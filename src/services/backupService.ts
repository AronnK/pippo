import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";

import { localDate } from "@/database/queries/study";
import { DATABASE_VERSION } from "@/database/schema";

type Table = { name: string; columns: string[]; since?: number };

// Deletion happens in reverse order, so children must come after their parents.
// `since` marks tables that only exist from a given schema version on; an older
// backup file neither has to contain them nor gets to overwrite what is there.
const TABLES: Table[] = [
  { name: "subjects", columns: ["id", "name", "created_at"] },
  { name: "decks", columns: ["id", "subject_id", "name", "created_at"] },
  { name: "cards", columns: ["id", "deck_id", "question", "answer", "created_at", "last_seen_at"] },
  {
    name: "mcqs",
    columns: ["id", "deck_id", "question", "options_json", "correct_answer_index", "explanation", "created_at", "last_seen_at"],
  },
  { name: "weak_cards", columns: ["card_id", "marked_at"] },
  { name: "weak_mcqs", columns: ["mcq_id", "marked_at"] },
  {
    name: "daily_stats",
    columns: ["date", "items_completed", "flashcards_completed", "mcqs_completed", "study_seconds"],
  },
  {
    name: "study_sessions",
    columns: ["id", "start_time", "end_time", "source", "subject_id", "deck_id"],
  },
  {
    name: "streak",
    since: 2,
    columns: [
      "id",
      "current_streak",
      "longest_streak",
      "last_completed_date",
      "freeze_count",
      "last_awarded_milestone",
      "last_celebrated_milestone",
      "pending_freeze_decision",
      "is_dead",
    ],
  },
  { name: "notification_settings", since: 2, columns: ["category", "is_enabled"] },
  {
    name: "laundry_reminder",
    since: 4,
    columns: ["id", "is_active", "started_at", "honor_quiet_hours"],
  },
  {
    name: "notification_config",
    since: 4,
    columns: ["id", "quiet_hours_enabled", "quiet_start_minute", "quiet_end_minute"],
  },
  { name: "import_history", columns: ["id", "imported_at", "subject", "deck", "card_count"] },
];

const present = (payload: BackupPayload) =>
  TABLES.filter((table) => Array.isArray(payload.tables[table.name]));

export type BackupPayload = {
  app: "pippo";
  schema: number;
  exported_at: string;
  tables: Record<string, Record<string, unknown>[]>;
};

export async function collectBackup(db: SQLiteDatabase): Promise<BackupPayload> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of TABLES)
    tables[table.name] = await db.getAllAsync<Record<string, unknown>>(
      `SELECT ${table.columns.join(", ")} FROM ${table.name}`,
    );
  return { app: "pippo", schema: DATABASE_VERSION, exported_at: new Date().toISOString(), tables };
}

export function backupSummary(payload: BackupPayload) {
  return {
    subjects: payload.tables.subjects.length,
    decks: payload.tables.decks.length,
    cards: payload.tables.cards.length,
    mcqs: payload.tables.mcqs.length,
    weakCards: payload.tables.weak_cards.length,
    studyDays: payload.tables.daily_stats.length,
    streak: Number(payload.tables.streak[0]?.current_streak ?? 0),
  };
}

export async function exportBackup(db: SQLiteDatabase) {
  const payload = await collectBackup(db);
  const file = new File(Paths.document, `pippo_backup_${localDate()}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(payload));
  if (!(await Sharing.isAvailableAsync())) {
    file.delete();
    throw new Error("This device has no share sheet, so the backup cannot be sent anywhere.");
  }
  await Sharing.shareAsync(file.contentUri, {
    mimeType: "application/json",
    dialogTitle: "Save your Pippo backup",
  });
  return file.name;
}

export function parseBackup(text: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file is not readable JSON. If it was edited by hand, the damage may be a missing comma or quote.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Expected one JSON object, the format Pippo writes when it exports.");
  const payload = parsed as Partial<BackupPayload>;
  if (payload.app !== "pippo") throw new Error("This backup was not made by Pippo.");
  if (typeof payload.schema !== "number") throw new Error("This backup has no version number, so it is probably corrupted.");
  if (payload.schema > DATABASE_VERSION)
    throw new Error(`This backup comes from a newer Pippo than the one installed here.`);
  if (!payload.tables || typeof payload.tables !== "object")
    throw new Error("This backup has no data tables in it.");
  for (const table of TABLES) {
    if ((table.since ?? 1) > payload.schema) continue;
    const rows = payload.tables[table.name];
    if (!Array.isArray(rows)) throw new Error(`This backup is missing its ${table.name} data.`);
    if (rows.some((row) => !row || typeof row !== "object" || Array.isArray(row)))
      throw new Error(`The ${table.name} data in this backup is malformed.`);
  }
  return payload as BackupPayload;
}

function bindValue(value: unknown): SQLiteBindValue {
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return null;
}

function insertRows(tx: SQLiteDatabase, table: Table, rows: Record<string, unknown>[]) {
  const placeholders = table.columns.map(() => "?").join(", ");
  // Table and column names come from TABLES above, never from the backup file,
  // so restoring a hand-edited file cannot inject SQL.
  const statement = `INSERT INTO ${table.name} (${table.columns.join(", ")}) VALUES (${placeholders})`;
  return rows.map((row) =>
    tx.runAsync(statement, ...table.columns.map((column) => bindValue(row[column]))),
  );
}

export async function restoreBackup(db: SQLiteDatabase, payload: BackupPayload) {
  const tables = present(payload);
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const table of [...tables].reverse()) await tx.runAsync(`DELETE FROM ${table.name}`);
    for (const table of tables)
      await Promise.all(insertRows(tx, table, payload.tables[table.name]));
    await tx.runAsync("INSERT OR IGNORE INTO streak (id) VALUES (1)");
    await tx.runAsync("INSERT OR IGNORE INTO laundry_reminder (id) VALUES (1)");
    await tx.runAsync("INSERT OR IGNORE INTO notification_config (id) VALUES (1)");
  });
  return tables.reduce((sum, table) => sum + payload.tables[table.name].length, 0);
}

export async function clearAllData(db: SQLiteDatabase) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const table of [...TABLES].reverse()) await tx.runAsync(`DELETE FROM ${table.name}`);
    await tx.runAsync("INSERT INTO streak (id) VALUES (1)");
    await tx.runAsync("INSERT INTO laundry_reminder (id) VALUES (1)");
    await tx.runAsync("INSERT INTO notification_config (id) VALUES (1)");
  });
}
