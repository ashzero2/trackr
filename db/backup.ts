import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const DB_NAME = 'trackr.db';

/**
 * Get the path to the SQLite database file.
 */
function getDbFile(): File {
  const sqliteDir = new Directory(Paths.document, 'SQLite');
  return new File(sqliteDir, DB_NAME);
}

/**
 * Export the SQLite database file by sharing it.
 * Copies the DB to the cache directory first (so we don't share the live file),
 * then uses the system share sheet.
 *
 * Returns the path to the shared copy, or null if sharing is not available.
 */
export async function exportDatabase(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) return null;

  const dbFile = getDbFile();
  if (!dbFile.exists) {
    throw new Error('Database file not found');
  }

  // Copy to cache so we share a snapshot, not the live DB
  const cacheDir = new Directory(Paths.cache);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const exportName = `trackr-backup-${timestamp}.db`;
  const exportFile = new File(cacheDir, exportName);

  // Remove old export if it exists
  if (exportFile.exists) {
    exportFile.delete();
  }

  dbFile.copy(exportFile);

  await Sharing.shareAsync(exportFile.uri, {
    mimeType: 'application/x-sqlite3',
    dialogTitle: 'Export Trackr Backup',
    UTI: 'public.database',
  });

  return exportFile.uri;
}

/**
 * Import a database file from the given URI.
 * Overwrites the current database.
 *
 * IMPORTANT: The app should be restarted after import to pick up the new data.
 * The caller is responsible for closing the current DB connection first.
 *
 * @param sourceUri - URI of the .db file to import (from document picker)
 */
export async function importDatabase(sourceUri: string): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Database import is not supported on web');
  }

  const sourceFile = new File(sourceUri);
  if (!sourceFile.exists) {
    throw new Error('Selected file does not exist');
  }

  const dbFile = getDbFile();

  // Create a backup of the current DB before overwriting
  const sqliteDir = new Directory(Paths.document, 'SQLite');
  const backupFile = new File(sqliteDir, `${DB_NAME}.bak`);
  if (backupFile.exists) {
    backupFile.delete();
  }
  if (dbFile.exists) {
    dbFile.copy(backupFile);
  }

  try {
    // Overwrite the current DB with the imported file
    if (dbFile.exists) {
      dbFile.delete();
    }
    sourceFile.copy(dbFile);

    // Also remove WAL/SHM files if they exist (stale from old DB)
    const walFile = new File(sqliteDir, `${DB_NAME}-wal`);
    const shmFile = new File(sqliteDir, `${DB_NAME}-shm`);
    if (walFile.exists) walFile.delete();
    if (shmFile.exists) shmFile.delete();
  } catch (e) {
    // Restore from backup on failure
    if (backupFile.exists) {
      if (dbFile.exists) dbFile.delete();
      backupFile.copy(dbFile);
    }
    throw e;
  } finally {
    // Clean up backup
    if (backupFile.exists) {
      backupFile.delete();
    }
  }
}