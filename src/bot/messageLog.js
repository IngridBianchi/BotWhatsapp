const fs = require('fs').promises;
const path = require('path');

class MessageLogger {
  constructor() {
    this.logFile = 'sent.json';
    this.backupDir = path.join(__dirname, 'backups');
  }

  async isAlreadySent(number) {
    try {
      const sentNumbers = await this.getLog();
      return sentNumbers.includes(this.cleanNumber(number));
    } catch (error) {
      console.error('Error verificando número:', error);
      return false;
    }
  }

  async logNumber(number) {
    try {
      const cleanNum = this.cleanNumber(number);
      const existing = await this.getLog();
      
      if (!existing.includes(cleanNum)) {
        existing.push(cleanNum);
        await this.saveLog(existing);
        console.log(`📝 Número registrado: ${cleanNum}`);
      }
    } catch (error) {
      console.error('Error registrando número:', error);
      throw error;
    }
  }

  async getLog() {
    try {
      const data = await fs.readFile(this.logFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('⚠️ Archivo de log no encontrado, creando nuevo...');
        await this.saveLog([]);
        return [];
      }
      throw error;
    }
  }

  async saveLog(data) {
    await fs.writeFile(
      this.logFile, 
      JSON.stringify([...new Set(data)]), 
      'utf8'
    );
  }

  async restoreBackup(timestamp) {
    try {
      const backupFile = path.join(
        this.backupDir, 
        `sent-${timestamp}.json`
      );
      
      const backupData = await fs.readFile(backupFile, 'utf8');
      await this.saveLog(JSON.parse(backupData));
      console.log(`♻️ Backup restaurado desde: ${backupFile}`);
      return true;
    } catch (error) {
      console.error('Error restaurando backup:', error);
      return false;
    }
  }

  cleanNumber(number) {
    return number.toString().replace(/[^\d\s\-()+]/g, '');
  }

  // Nuevo método para recuperar números fallidos
  async getFailedNumbers() {
    try {
      const failedFile = path.join(__dirname, 'failed.json');
      const data = await fs.readFile(failedFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }
}

module.exports = { MessageLogger };