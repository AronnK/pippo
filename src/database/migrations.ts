import type { SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS } from '@/database/schema';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  for (const migration of MIGRATIONS)
    if (currentVersion < migration.version) {
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    }
}
