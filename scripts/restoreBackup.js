const MessageLogger = require('./messageLog');
const logger = new MessageLogger();


const timestamp = process.argv[2];

if (!timestamp) {
  console.log('Especifica timestamp del backup (ej: 2023-10-05T12-34-56-123Z)');
  process.exit(1);
}

logger.restoreBackup(timestamp);