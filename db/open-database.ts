import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { runMigrations } from '@/db/migrations';
import { seedCategories } from '@/db/seed';

const DB_NAME = 'trackr.db';
const LEGACY_DB_NAME = 'moneymanager.db';

function copyLegacyDatabaseIfNeeded(): void {
  if (Platform.OS === 'web') return;
  try {
    const sqliteDir = new Directory(Paths.document, 'SQLite');
    const newFile = new File(sqliteDir, DB_NAME);
    const oldFile = new File(sqliteDir, LEGACY_DB_NAME);
    if (newFile.exists) return;
    if (oldFile.exists) {
      oldFile.copy(newFile);
    }
  } catch {
    // Fresh install or unexpected FS layout; openDatabaseAsync will create trackr.db.
  }
}

export async function openAndPrepareDatabase(): Promise<SQLiteDatabase> {
  copyLegacyDatabaseIfNeeded();
  const db = await openDatabaseAsync(DB_NAME);
  await runMigrations(db);
  await seedCategories(db);
  return db;
}
