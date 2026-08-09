import type { SQLiteDatabase } from 'expo-sqlite';

import { CREATE_SCHEMA_SQL, DATABASE_VERSION, PHASE_THREE_MIGRATION_SQL, PHASE_TWO_MIGRATION_SQL } from '@/database/schema';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(CREATE_SCHEMA_SQL);
    await db.execAsync('PRAGMA user_version = 1');
  }
  if (currentVersion < 2) {
    await db.execAsync(PHASE_TWO_MIGRATION_SQL);
    await db.execAsync('PRAGMA user_version = 2');
  }
  if (currentVersion < 3) {
    await db.execAsync(PHASE_THREE_MIGRATION_SQL);
    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  }
}
