// Shared scaffolding for the off-device tests: a real SQLite database built by
// running the app's own migrations, expo-sqlite's calling shape on top of it so
// services run unchanged, and a check() that reports every failure rather than
// stopping at the first one.
import { DatabaseSync } from "node:sqlite";

const { MIGRATIONS } = await import("@/database/schema");

const asSqlite = (database) => ({
  getAllAsync: (sql, ...params) =>
    Promise.resolve(database.prepare(sql).all(...params)),
  getFirstAsync: (sql, ...params) =>
    Promise.resolve(database.prepare(sql).get(...params) ?? null),
  runAsync: (sql, ...params) =>
    Promise.resolve(database.prepare(sql).run(...params)),
  execAsync: (sql) => Promise.resolve(database.exec(sql)),
});

export function migratedDb() {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON;");
  for (const migration of MIGRATIONS) raw.exec(migration.sql);
  const db = asSqlite(raw);
  db.withExclusiveTransactionAsync = async (callback) => {
    raw.exec("BEGIN IMMEDIATE");
    try {
      await callback(asSqlite(raw));
      raw.exec("COMMIT");
    } catch (error) {
      raw.exec("ROLLBACK");
      throw error;
    }
  };
  return { raw, db };
}

let failures = 0;

export const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`,
  );
};

export const finish = () => {
  console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
};
