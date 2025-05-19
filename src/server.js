require('dotenv').config();
const express = require('express');
const socketIO = require('socket.io');
const { Client } = require('whatsapp-web.js');
const { getGoogleContacts } = require('./bot/googleContacts');
const { MessageLogger } = require('./bot/messageLog');

const app = express();
const port = process.env.PORT || 3000;

// Configurar motor de vistas
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Ruta principal
app.get('/', (req, res) => {
    res.render('index');
});

const server = app.listen(port, () => {
    console.log(`Servidor en http://localhost:${port}`);
});

// Configurar Socket.io
const io = socketIO(server);
let whatsappClient = null;
const logger = new MessageLogger();

io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado');

    socket.on('start-bot', async () => {
        try {
            whatsappClient = new Client({
                authStrategy: new LocalAuth(),
                puppeteer: {
                    headless: true,
                    args: ['--no-sandbox']
                }
            });

            whatsappClient.on('qr', qr => {
                socket.emit('qr', qr);
            });

            whatsappClient.on('ready', async () => {
                const contacts = await getGoogleContacts();
                socket.emit('contacts-loaded', contacts.length);
                socket.emit('log', 'Bot listo para enviar mensajes');
            });

            whatsappClient.on('message', async msg => {
                if (msg.fromMe) {
                    await logger.logNumber(msg.to.split('@')[0]);
                    socket.emit('message-sent');
                    socket.emit('log', `Mensaje enviado a: ${msg.to}`);
                }
            });

            await whatsappClient.initialize();

        } catch (error) {
            socket.emit('log', `ERROR: ${error.message}`);
        }
    });

    socket.on('stop-bot', () => {
        if (whatsappClient) {
            whatsappClient.destroy();
            socket.emit('log', 'Bot detenido');
        }
    });
});