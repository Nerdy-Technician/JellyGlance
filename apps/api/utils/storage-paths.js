const path = require("path");

const defaultBackupDir = path.join(__dirname, "..", "backup-data");
const defaultConfigDir = path.join(__dirname, "..", "config-data");

function resolveStoragePath(envValue, fallbackPath) {
  if (!envValue) {
    return fallbackPath;
  }

  return path.isAbsolute(envValue) ? envValue : path.resolve(process.cwd(), envValue);
}

function getBackupDir() {
  return resolveStoragePath(process.env.BACKUP_DIR, defaultBackupDir);
}

function getConfigDir() {
  return resolveStoragePath(process.env.CONFIG_DIR, defaultConfigDir);
}

module.exports = {
  getBackupDir,
  getConfigDir,
};
