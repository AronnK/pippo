import { DatabaseSync } from "node:sqlite";

const {
  CREATE_SCHEMA_SQL,
  DATABASE_VERSION,
  PHASE_TWO_MIGRATION_SQL,
  PHASE_THREE_MIGRATION_SQL,
} = await import("@/database/schema");
const backup = await import("@/services/backupService");
const shared = (await import("expo-sharing")).shared;

const raw = new DatabaseSync(":memory:");
raw.exec("PRAGMA foreign_keys = ON;");
raw.exec(CREATE_SCHEMA_SQL);
raw.exec(PHASE_TWO_MIGRATION_SQL);
raw.exec(PHASE_THREE_MIGRATION_SQL);

// expo-sqlite's shape, over node:sqlite, so the service runs unchanged.
const asSqlite = (d) => ({
  getAllAsync: (sql, ...params) => Promise.resolve(d.prepare(sql).all(...params)),
  getFirstAsync: (sql, ...params) =>
    Promise.resolve(d.prepare(sql).get(...params) ?? null),
  runAsync: (sql, ...params) => Promise.resolve(d.prepare(sql).run(...params)),
  execAsync: (sql) => Promise.resolve(d.exec(sql)),
});
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

const NOW = "2026-09-26T10:00:00.000Z";
const SEED = [
  ["INSERT INTO subjects (id,name,created_at) VALUES (1,'Pharmacology',?)", [NOW]],
  ["INSERT INTO decks (id,subject_id,name,created_at) VALUES (10,1,'Ch1',?)", [NOW]],
  ["INSERT INTO cards (id,deck_id,question,answer,created_at) VALUES (100,10,'Q1','A1',?)", [NOW]],
  ["INSERT INTO cards (id,deck_id,question,answer,created_at) VALUES (101,10,'Q2','A2',?)", [NOW]],
  [
    "INSERT INTO mcqs (id,deck_id,question,options_json,correct_answer_index,explanation,created_at) VALUES (200,10,'MQ?',?,2,'because',?)",
    ['["a","b","c","d"]', NOW],
  ],
  ["INSERT INTO weak_cards (card_id,marked_at) VALUES (101,?)", [NOW]],
  [
    "INSERT INTO daily_stats (date,items_completed,flashcards_completed,mcqs_completed,study_seconds) VALUES ('2026-09-25',50,30,20,3600)",
    [],
  ],
  [
    "INSERT INTO study_sessions (id,start_time,end_time,source,subject_id,deck_id) VALUES (1,?,?, 'deck_flashcards',1,10)",
    [NOW, NOW],
  ],
  [
    "UPDATE streak SET current_streak=9, longest_streak=14, last_completed_date='2026-09-25', freeze_count=1, last_awarded_milestone=7 WHERE id=1",
    [],
  ],
  [
    "INSERT INTO import_history (id,imported_at,subject,deck,card_count) VALUES (1,?,'Pharmacology','Ch1',2)",
    [NOW],
  ],
];
for (const [sql, params] of SEED) raw.prepare(sql).run(...params);

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`,
  );
};
const state = () => ({
  cards: raw.prepare("SELECT COUNT(*) c FROM cards").get().c,
  weak: raw.prepare("SELECT COUNT(*) c FROM weak_cards").get().c,
  streak: raw.prepare("SELECT current_streak s FROM streak WHERE id=1").get().s,
  stats:
    raw.prepare("SELECT items_completed i FROM daily_stats WHERE date='2026-09-25'")
      .get()?.i ?? null,
  sessions: raw.prepare("SELECT COUNT(*) c FROM study_sessions").get().c,
});

console.log("export");
const fileName = await backup.exportBackup(db);
check(
  "filename matches spec",
  /^pippo_backup_\d{4}-\d{2}-\d{2}\.json$/.test(fileName),
  true,
);
check(
  "share sheet opened with a content URI",
  shared.length === 1 &&
    shared[0].uri.startsWith("content://") &&
    shared[0].options.mimeType === "application/json",
  true,
);

console.log("\nround trip");
const exported = await backup.collectBackup(db);
const asText = JSON.stringify(exported);
raw.prepare("DELETE FROM cards").run();
raw.prepare("DELETE FROM weak_cards").run();
raw.prepare("DELETE FROM daily_stats").run();
raw.prepare("UPDATE streak SET current_streak=0").run();
raw.prepare(
  "INSERT INTO cards (id,deck_id,question,answer,created_at) VALUES (999,10,'stray','stray',?)",
).run(NOW);
check("data really was destroyed before restore", state(), {
  cards: 1,
  weak: 0,
  streak: 0,
  stats: null,
  sessions: 1,
});

const parsed = backup.parseBackup(asText);
const restoredRows = await backup.restoreBackup(db, parsed);
const expectedRows = Object.values(parsed.tables).reduce(
  (total, rows) => total + rows.length,
  0,
);
check("restore reported the rows it wrote", restoredRows, expectedRows);
check(
  "restore brought everything back",
  state(),
  { cards: 2, weak: 1, streak: 9, stats: 50, sessions: 1 },
);
check(
  "restore removed rows that only existed after export",
  raw.prepare("SELECT COUNT(*) c FROM cards WHERE id=999").get().c,
  0,
);
check(
  "foreign keys still resolve after restore",
  raw.prepare("SELECT COUNT(*) c FROM cards WHERE deck_id=10").get().c,
  2,
);
check("summary reads the payload", backup.backupSummary(parsed), {
  subjects: 1,
  decks: 1,
  cards: 2,
  mcqs: 1,
  weakCards: 1,
  studyDays: 1,
  streak: 9,
});

console.log("\nrejected input leaves the database alone");
const before = state();
const rejections = [
  ["garbage text", () => backup.parseBackup("not json at all")],
  ["json array", () => backup.parseBackup("[]")],
  [
    "not a pippo backup",
    () => backup.parseBackup(JSON.stringify({ app: "other", schema: 3, tables: {} })),
  ],
  [
    "newer schema than installed",
    () =>
      backup.parseBackup(JSON.stringify({ ...exported, schema: DATABASE_VERSION + 5 })),
  ],
  [
    "missing a table",
    () =>
      backup.parseBackup(
        JSON.stringify({ ...exported, tables: { ...exported.tables, cards: undefined } }),
      ),
  ],
  [
    "malformed row",
    () =>
      backup.parseBackup(
        JSON.stringify({ ...exported, tables: { ...exported.tables, cards: ["hello"] } }),
      ),
  ],
];
for (const [label, reject] of rejections) {
  let message = null;
  try {
    reject();
  } catch (error) {
    message = error.message;
  }
  check(`rejects ${label}`, !!message && !message.includes("undefined"), true);
}
check("nothing was written", state(), before);

console.log("\nhostile file");
const hostile = JSON.parse(asText);
hostile.tables.cards = [
  { id: 100, deck_id: 10, question: "x',?'); DROP TABLE subjects;--", answer: "a", created_at: NOW },
];
hostile.tables["subjects); DROP TABLE cards;--"] = [{ id: 1 }];
// Only one card survives, but weak_cards still points at card 101, so the
// foreign key must abort the whole transaction.
let hostileError = null;
try {
  await backup.restoreBackup(db, backup.parseBackup(JSON.stringify(hostile)));
} catch (error) {
  hostileError = error.message;
}
check("hand-edited backup was refused", /FOREIGN KEY|constraint/i.test(hostileError ?? ""), true);
check(
  "injected table name never reached SQL",
  raw.prepare("SELECT COUNT(*) c FROM subjects").get().c,
  1,
);
check("cards rolled back", raw.prepare("SELECT COUNT(*) c FROM cards").get().c, 2);
check("streak rolled back", raw.prepare("SELECT current_streak s FROM streak WHERE id=1").get().s, 9);

console.log("\nreset");
await backup.clearAllData(db);
check(
  "study data is gone",
  [
    raw.prepare("SELECT COUNT(*) c FROM cards").get().c,
    raw.prepare("SELECT COUNT(*) c FROM subjects").get().c,
  ],
  [0, 0],
);
check(
  "streak singleton row stays usable",
  raw.prepare("SELECT current_streak s FROM streak WHERE id=1").get().s,
  0,
);

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
