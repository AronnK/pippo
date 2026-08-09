export const DATABASE_NAME = 'pippo.db';
export const DATABASE_VERSION = 3;

export const CREATE_SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS decks (
    id INTEGER PRIMARY KEY NOT NULL,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL COLLATE NOCASE,
    created_at TEXT NOT NULL,
    UNIQUE(subject_id, name)
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY NOT NULL,
    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mcqs (
    id INTEGER PRIMARY KEY NOT NULL,
    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options_json TEXT NOT NULL,
    correct_answer_index INTEGER NOT NULL CHECK(correct_answer_index BETWEEN 0 AND 3),
    explanation TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS weak_cards (
    card_id INTEGER PRIMARY KEY NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    marked_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS weak_mcqs (
    mcq_id INTEGER PRIMARY KEY NOT NULL REFERENCES mcqs(id) ON DELETE CASCADE,
    marked_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY NOT NULL,
    items_completed INTEGER NOT NULL DEFAULT 0 CHECK(items_completed >= 0),
    flashcards_completed INTEGER NOT NULL DEFAULT 0 CHECK(flashcards_completed >= 0),
    mcqs_completed INTEGER NOT NULL DEFAULT 0 CHECK(mcqs_completed >= 0),
    study_seconds INTEGER NOT NULL DEFAULT 0 CHECK(study_seconds >= 0),
    CHECK(items_completed = flashcards_completed + mcqs_completed)
  );

  CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    source TEXT NOT NULL,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    deck_id INTEGER REFERENCES decks(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS import_history (
    id INTEGER PRIMARY KEY NOT NULL,
    imported_at TEXT NOT NULL,
    subject TEXT NOT NULL,
    deck TEXT NOT NULL,
    card_count INTEGER NOT NULL CHECK(card_count >= 0)
  );

  CREATE INDEX IF NOT EXISTS idx_decks_subject_id ON decks(subject_id);
  CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
  CREATE INDEX IF NOT EXISTS idx_mcqs_deck_id ON mcqs(deck_id);
  CREATE INDEX IF NOT EXISTS idx_study_sessions_subject_id ON study_sessions(subject_id);
  CREATE INDEX IF NOT EXISTS idx_study_sessions_deck_id ON study_sessions(deck_id);
`;

export const PHASE_TWO_MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS streak (
    id INTEGER PRIMARY KEY NOT NULL CHECK(id = 1),
    current_streak INTEGER NOT NULL DEFAULT 0 CHECK(current_streak >= 0),
    longest_streak INTEGER NOT NULL DEFAULT 0 CHECK(longest_streak >= 0),
    last_completed_date TEXT,
    freeze_count INTEGER NOT NULL DEFAULT 0 CHECK(freeze_count >= 0),
    last_awarded_milestone INTEGER NOT NULL DEFAULT 0 CHECK(last_awarded_milestone >= 0),
    last_celebrated_milestone INTEGER NOT NULL DEFAULT 0 CHECK(last_celebrated_milestone >= 0),
    pending_freeze_decision INTEGER NOT NULL DEFAULT 0 CHECK(pending_freeze_decision IN (0, 1)),
    is_dead INTEGER NOT NULL DEFAULT 0 CHECK(is_dead IN (0, 1))
  );
  INSERT OR IGNORE INTO streak (id) VALUES (1);

  CREATE TABLE IF NOT EXISTS notification_settings (
    category TEXT PRIMARY KEY NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK(is_enabled IN (0, 1))
  );

  CREATE TABLE IF NOT EXISTS laundry_reminder (
    id INTEGER PRIMARY KEY NOT NULL CHECK(id = 1),
    is_active INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN (0, 1)),
    started_at TEXT
  );
  INSERT OR IGNORE INTO laundry_reminder (id) VALUES (1);
`;

export const PHASE_THREE_MIGRATION_SQL = `
  INSERT OR IGNORE INTO notification_settings (category, is_enabled) VALUES ('keep_calm', 1);
`;
