require('dotenv').config();
const express = require('express');
const socketIO = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { getGoogleContacts } = require('./bot/googleContacts');
const { MessageLogger } = require('./bot/messageLog');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configurar motor de vistas
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Ruta principal
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta para obtener números fallidos
app.get('/failed-numbers', (req, res) => {
    const logger = new MessageLogger();
    logger.getFailedNumbers().then(failedNumbers => {
        res.json(failedNumbers);
    });
});

// Ruta para obtener números exitosos
app.get('/successful-numbers', (req, res) => {
    const logger = new MessageLogger();
    logger.getLog().then(successfulNumbers => {
        res.json(successfulNumbers);
    });
});

const server = app.listen(port, () => {
    console.log(`Servidor en http://localhost:${port}`);
});

// Configuración de Socket.io con CORS
const io = socketIO(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

let whatsappClient = null;
const logger = new MessageLogger();

io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado');

    // Manejar inicio del bot
    socket.on('start-bot', async (data) => {
        try {
            const { authCode } = data;
            console.log('data:', data);
            const contacts = await getGoogleContacts(authCode);
            socket.emit('contacts-loaded', contacts.length);
            socket.emit('log', 'Bot listo - Contactos cargados');

            whatsappClient = new Client({
                authStrategy: new LocalAuth(),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox'
                    ]
                }
            });

            // Generar QR como imagen base64
            whatsappClient.on('qr', async qr => {
                try {
                  const qrImage = await QRCode.toDataURL(qr);
                  console.log('Enviando QR al cliente...');
                  socket.emit('qr', qrImage); // Enviar imagen del QR
                  console.log('QR enviado al cliente.');
                  socket.emit('log', 'QR generado - Escanea con WhatsApp');
                } catch (error) {
                  console.error('Error generando QR:', error);
                  socket.emit('log', `Error generando QR: ${error.message}`);
                }
              });

            // Cuando está listo
            whatsappClient.on('ready', async () => {
                socket.emit('log', 'Bot listo');
            });

            // Manejar mensajes enviados
            whatsappClient.on('message', async msg => {
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

            // Inicializar cliente
            await whatsappClient.initialize();

        } catch (error) {
            socket.emit('log', `ERROR INICIAL: ${error.message}`);
        }
    });

    // Manejar detención del bot
    socket.on('stop-bot', () => {
        if (whatsappClient) {
            whatsappClient.destroy();
            socket.emit('log', 'Bot detenido manualmente');
            socket.emit('qr-clear');
        }
    });

    // Limpiar al desconectar
    socket.on('disconnect', () => {
        if (whatsappClient) {
            whatsappClient.destroy();
        }
    });
});
