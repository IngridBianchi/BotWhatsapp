require('dotenv').config();
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');
const socketIO = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { getGoogleContacts } = require('./bot/googleContacts');
const { MessageLogger } = require('./bot/messageLog');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
 // Ajusta bien esta ruta

app.set('view engine', 'ejs');

// Ruta principal
app.get('/', (req, res) => {
  res.render('index');
});

// Endpoint para recibir el code y devolver los contactos
app.post('/auth/google/callback', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'No se proporcionó el código de autenticación.' });

  try {
    const contacts = await getGoogleContacts(code);
    res.json({ success: true, contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error obteniendo contactos.', error: err.message });
  }
});

/* // Después de definir todas las rutas y middleware, justo antes de arrancar el servidor
console.log('--- RUTAS REGISTRADAS EN EXPRESS ---');
if (app._router && app._router.stack) {
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      console.log(`${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router' && middleware.handle.stack) {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          console.log(`${Object.keys(handler.route.methods).join(', ').toUpperCase()} ${handler.route.path}`);
        }
      });
    }
  });
} else {
  console.log('No se encontraron rutas registradas en Express.');
}
console.log('--- FIN DE LAS RUTAS ---'); */

// Servidor HTTP con Socket.io
const server = app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  }
});

let whatsappClient = null;
const logger = new MessageLogger();

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado');

  socket.on('start-bot', async (data = {}) => {
    try {
      const { authCode } = data;
      const contacts = await getGoogleContacts(authCode);
      socket.emit('contacts-loaded', contacts.length);
      socket.emit('log', 'Bot listo - Contactos cargados');

      whatsappClient = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      whatsappClient.on('qr', async (qr) => {
        try {
          const qrImage = await QRCode.toDataURL(qr);
          socket.emit('qr', qrImage);
          socket.emit('log', 'QR generado - Escanea con WhatsApp');
        } catch (error) {
          socket.emit('log', `Error generando QR: ${error.message}`);
        }
      });

      whatsappClient.on('ready', () => {
        socket.emit('log', 'Bot listo');
      });

      whatsappClient.on('message', async (msg) => {
        if (msg.fromMe) {
          try {
            const number = msg.to.split('@')[0];
            await logger.logNumber(number);
            socket.emit('message-sent');
            socket.emit('log', `Mensaje enviado a: ${number}`);
          } catch (error) {
            socket.emit('log', `Error registrando mensaje: ${error.message}`);
          }
        }
      });

      await whatsappClient.initialize();

    } catch (error) {
      socket.emit('log', `ERROR INICIAL: ${error.message}`);
    }
  });

  socket.on('stop-bot', () => {
    if (whatsappClient) {
      whatsappClient.destroy();
      socket.emit('log', 'Bot detenido manualmente');
      socket.emit('qr-clear');
    }
  });

  socket.on('disconnect', () => {
    if (whatsappClient) whatsappClient.destroy();
  });
});

//(Opcional) Ruta para SPA que maneje cualquier otra ruta (pero ojo con interferir con otras APIs)
/* app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
}); */
// Solo devolver index.html si no se trata de assets como .js, .css, .png, etc.
app.get(/^\/(?!css|js|images|socket\.io).*$/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
  });
  