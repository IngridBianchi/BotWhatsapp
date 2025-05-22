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
const BackupManager = require('./bot/backupManager');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');

// Vista principal
app.get('/', (req, res) => {
  res.render('index');
});

// Google Contacts
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
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

// Socket.IO
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  }
});

// Inicializaciones
const whatsappClients = {};
const logger = new MessageLogger();
const backupManager = new BackupManager();
backupManager.initialize();

// Crear sesión WhatsApp
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
    socket.emit('log', `✅ Sesión ${clientId} lista.`);
    if (whatsappClients[clientId]?.qrInterval) {
      clearInterval(whatsappClients[clientId].qrInterval);
      whatsappClients[clientId].qrInterval = null;
    }
  });

  client.on('authenticated', () => {
    if (whatsappClients[clientId]?.qrInterval) {
      clearInterval(whatsappClients[clientId].qrInterval);
      whatsappClients[clientId].qrInterval = null;
    }
  });

  client.on('disconnected', (reason) => {
    console.log(`📴 Sesión ${clientId} desconectada: ${reason}`);
    if (whatsappClients[clientId]?.qrInterval) {
      clearInterval(whatsappClients[clientId].qrInterval);
    }
    delete whatsappClients[clientId];
  });

  client.on('message', async (msg) => {
    if (msg.fromMe) {
      const number = msg.to.split('@')[0];
      try {
        await logger.logNumber(number);
        socket.emit('message-sent', { clientId });
        socket.emit('log', `📤 Mensaje enviado a ${number} desde ${clientId}`);
      } catch (error) {
        await logger.markAsFailed(number);
        socket.emit('log', `❌ Error registrando mensaje a ${number}: ${error.message}`);
      }
    }
  });

  await client.initialize();
}

// Socket.IO: eventos
io.on("connection", (socket) => {
  socket.on("start-bot", async ({ authCode, clientId }) => {
    try {
      const effectiveCode = authCode || process.env.GOOGLE_AUTH_CODE;

      if (!effectiveCode) {
        socket.emit("log", "❌ No se proporcionó ningún código de autenticación.");
        return;
      }

      await getGoogleContacts(effectiveCode); // Se puede eliminar si no usas los contactos aquí
      await createWhatsAppSession(socket, clientId);

      console.log("✅ Bot iniciado con código:", effectiveCode);
    } catch (e) {
      socket.emit("log", `❌ Error al iniciar sesión: ${e.message}`);
    }
  });

  socket.on("stop-bot", ({ clientId }) => {
    const session = whatsappClients[clientId];
    if (session) {
      session.client.destroy();
      if (session.qrInterval) clearInterval(session.qrInterval);
      delete whatsappClients[clientId];
      socket.emit("log", `🛑 Sesión ${clientId} detenida.`);
      socket.emit("qr-clear", { clientId });
    }
  });
});

// API REST
app.get('/successful-numbers', async (req, res) => {
  const sent = await logger.getLog();
  res.json(sent);
});

app.get('/failed-numbers', async (req, res) => {
  const failed = await logger.getFailedNumbers();
  res.json(failed);
});
