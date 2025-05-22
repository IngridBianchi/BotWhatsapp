const fs = require('fs').promises;
const path = require('path');

class BackupManager {
  constructor() {
    this.backupDir = path.join(__dirname, 'backups');
    this.maxBackups = 10; // Mantener últimos 10 backups
  }

  async initialize() {
    await this.createBackupDir();
    setInterval(() => this.createBackup(), 60 * 60 * 1000); // Cada 1 hora
    setInterval(() => this.cleanOldBackups(), 24 * 60 * 60 * 1000); // Limpieza diaria
  }

  async createBackupDir() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.error('Error creando directorio de backups:', error);
    }
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
    try {
      // Copiar archivos críticos
      await this.copyFile('sent.json', `sent-${timestamp}.json`);
      await this.copyFile('contacts.json', `contacts-${timestamp}.json`);
      await this.copyFile('failed.json', `failed-${timestamp}.json`); // 👈 Nuevo
  
      console.log(`✅ Backup creado: ${timestamp}`);
    } catch (error) {
      console.error('❌ Error en backup:', error);
    }
  }
  

  async copyFile(source, targetName) {
    const sourcePath = path.join(__dirname, source);
    const targetPath = path.join(this.backupDir, targetName);
    
    try {
      const data = await fs.readFile(sourcePath, 'utf8');
      await fs.writeFile(targetPath, data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('⚠️ Archivo no encontrado para backup:', source);
      } else {
        throw error;
      }
    }
  }

  async cleanOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      if (files.length <= this.maxBackups) return;

      // Ordenar por fecha (más viejo primero)
      const sortedFiles = files.sort((a, b) => 
        a.split('-').slice(1).join('-').localeCompare(b.split('-').slice(1).join('-'))
      );

      // Eliminar excedentes
      const toDelete = sortedFiles.slice(0, files.length - this.maxBackups);
      for (const file of toDelete) {
        await fs.unlink(path.join(this.backupDir, file));
        console.log(`🗑️ Backup eliminado: ${file}`);
      }
    } catch (error) {
      console.error('Error limpiando backups:', error);
    }
  }
}

module.exports = BackupManager;