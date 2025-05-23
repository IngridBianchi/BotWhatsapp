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

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('index');
});

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

const server = app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  }
});

const whatsappClients = {};
const logger = new MessageLogger();

async function createWhatsAppSession(socket, clientId) {
  if (whatsappClients[clientId]) {
    socket.emit('log', `La sesión ${clientId} ya existe.`);
    return;
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  whatsappClients[clientId] = { client, qrInterval: null };

  client.on('qr', async (qr) => {
    try {
      const qrImage = await QRCode.toDataURL(qr);
      socket.emit('qr', { clientId, image: qrImage });

      if (whatsappClients[clientId].qrInterval) {
        clearInterval(whatsappClients[clientId].qrInterval);
      }

      whatsappClients[clientId].qrInterval = setInterval(async () => {
        try {
          const newQrImage = await QRCode.toDataURL(qr);
          socket.emit('qr', { clientId, image: newQrImage });
        } catch (e) {
          socket.emit('log', `Error regenerando QR: ${e.message}`);
        }
      }, 30000);

    } catch (e) {
      socket.emit('log', `Error generando QR: ${e.message}`);
    }
  });

  client.on('ready', () => {
    socket.emit('log', `Sesión ${clientId} lista.`);
    if (whatsappClients[clientId]?.qrInterval) {
      clearInterval(whatsappClients[clientId].qrInterval);
      whatsappClients[clientId].qrInterval = null;
    }
  });

  client.on('message', async (msg) => {
    if (msg.fromMe) {
      try {
        const number = msg.to.split('@')[0];
        await logger.logNumber(number);
        socket.emit('message-sent', { clientId });
        socket.emit('log', `Mensaje enviado a ${number} desde ${clientId}`);
      } catch (error) {
        socket.emit('log', `Error registrando mensaje: ${error.message}`);
      }
    }
  });

  await client.initialize();
}

io.on('connection', (socket) => {
  socket.on('start-bot', async ({ authCode, clientId }) => {
    try {
      const contacts = await getGoogleContacts(authCode);
      socket.emit('contacts-loaded', { clientId, count: contacts.length });
      await createWhatsAppSession(socket, clientId);
    } catch (e) {
      socket.emit('log', `Error al iniciar sesión: ${e.message}`);
    }
  });

  socket.on('stop-bot', ({ clientId }) => {
    const session = whatsappClients[clientId];
    if (session) {
      session.client.destroy();
      if (session.qrInterval) clearInterval(session.qrInterval);
      delete whatsappClients[clientId];
      socket.emit('log', `Sesión ${clientId} detenida.`);
      socket.emit('qr-clear', { clientId });
    }
  });
});

app.get('/failed-numbers', (req, res) => {
  res.json([]);
});

app.get('/successful-numbers', (req, res) => {
  res.json([]);
});
