require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getGoogleContacts } = require('./googleContacts');
const { MessageLogger } = require('./messageLog');
const BackupManager = require('./backupManager');
const backupManager = new BackupManager();

// Inicializar backups
backupManager.initialize();

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true }
});

// 1. Manejar QR Code
client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log('Escanea el código QR desde WhatsApp > Dispositivos vinculados');
});

// 2. Cuando esté listo
client.on('ready', async () => {
  console.log('¡Cliente listo!');
  
  try {
    const contacts = await getGoogleContacts();
    const logger = new MessageLogger();
    
    for (const contact of contacts) {
      if (await logger.isAlreadySent(contact.number)) {
        console.log(`Saltando: ${contact.name} (${contact.number})`);
        continue;
      }
      
      await sendMessage(contact);
      await logger.logNumber(contact.number);
      await delay(30000); // Espera 30 segundos
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
});

// 3. Función de envío
async function sendMessage(contact) {
  try {
    const number = contact.number + '@c.us';
    const message = `Hola ${contact.name}, este es mi primer bot 🤖`;
    
    await client.sendMessage(number, message);
    console.log(`✅ Enviado a ${contact.name}`);
    
  } catch (error) {
    console.error(`❌ Error con ${contact.number}:`, error.message);
  }
}

// Helper
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

client.initialize();