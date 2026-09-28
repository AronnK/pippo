import { check, finish, migratedDb } from "./harness.mjs";

const { deleteSubject } = await import("@/database/queries/study");

const { raw, db } = migratedDb();
const now = new Date().toISOString();

// Two subjects so the test can prove the delete stays inside its own lane.
raw
  .prepare("INSERT INTO subjects (id, name, created_at) VALUES (?,?,?)")
  .run(1, "Anatomy", now, );
raw.prepare("INSERT INTO subjects (id, name, created_at) VALUES (?,?,?)").run(2, "Physiology", now);
raw.prepare("INSERT INTO decks (id, subject_id, name, created_at) VALUES (?,?,?,?)").run(10, 1, "Upper limb", now);
raw.prepare("INSERT INTO decks (id, subject_id, name, created_at) VALUES (?,?,?,?)").run(20, 2, "Cardiac", now);
raw.prepare("INSERT INTO cards (id, deck_id, question, answer, created_at) VALUES (?,?,?,?,?)").run(100, 10, "Q1", "A1", now);
raw.prepare("INSERT INTO cards (id, deck_id, question, answer, created_at) VALUES (?,?,?,?,?)").run(101, 10, "Q2", "A2", now);
raw.prepare("INSERT INTO cards (id, deck_id, question, answer, created_at) VALUES (?,?,?,?,?)").run(200, 20, "Q3", "A3", now);
raw
  .prepare("INSERT INTO mcqs (id, deck_id, question, options_json, correct_answer_index, explanation, created_at) VALUES (?,?,?,?,?,?,?)")
  .run(300, 10, "M1", '["a","b","c","d"]', 0, "because", now);
raw.prepare("INSERT INTO weak_cards (card_id, marked_at) VALUES (?,?)").run(100, now);
raw.prepare("INSERT INTO weak_mcqs (mcq_id, marked_at) VALUES (?,?)").run(300, now);
// Time she actually spent, so the session row must survive even when the
// subject label it carried does not.
raw
  .prepare("INSERT INTO study_sessions (id, start_time, end_time, source, subject_id, deck_id) VALUES (?,?,?,?,?,?)")
  .run(1, "2026-09-01T09:00:00.000Z", "2026-09-01T10:00:00.000Z", "deck_flashcards", 1, 10);
raw
  .prepare("INSERT INTO study_sessions (id, start_time, end_time, source, subject_id, deck_id) VALUES (?,?,?,?,?,?)")
  .run(2, "2026-09-02T09:00:00.000Z", "2026-09-02T10:00:00.000Z", "deck_flashcards", 2, 20);
raw.prepare("INSERT INTO daily_stats (date, items_completed, flashcards_completed, mcqs_completed, study_seconds) VALUES (?,1,1,0,3600)").run("2026-09-01");

const count = (sql) => raw.prepare(sql).get();

console.log("before the delete");
check("both subjects exist", count("SELECT COUNT(*) c FROM subjects").c, 2);
check("Anatomy has its weak card", count("SELECT COUNT(*) c FROM weak_cards").c, 1);

await deleteSubject(db, 1);

console.log("\ndeleting a subject takes its whole tree");
check("the subject is gone", count("SELECT COUNT(*) c FROM subjects WHERE id=1").c, 0);
check("only Physiology is left", raw.prepare("SELECT name FROM subjects").all().map((r) => r.name), ["Physiology"]);
check("its decks went with it", count("SELECT COUNT(*) c FROM decks WHERE subject_id=1").c, 0);
check("its cards went with it", count("SELECT COUNT(*) c FROM cards WHERE deck_id=10").c, 0);
check("its MCQs went with it", count("SELECT COUNT(*) c FROM mcqs WHERE deck_id=10").c, 0);
check("its weak marks went with it", count("SELECT COUNT(*) c FROM weak_cards").c, 0);
check("its weak MCQ marks went with it", count("SELECT COUNT(*) c FROM weak_mcqs").c, 0);

console.log("\nwhat belongs to other subjects stays");
check("Physiology keeps its deck", count("SELECT COUNT(*) c FROM decks WHERE id=20").c, 1);
check("Physiology keeps its card", count("SELECT COUNT(*) c FROM cards WHERE id=200").c, 1);
check("the other subject's session is untouched", raw.prepare("SELECT subject_id, deck_id FROM study_sessions WHERE id=2").get(), { subject_id: 2, deck_id: 20 });

console.log("\nstudied time outlives the label");
const session = raw.prepare("SELECT subject_id, deck_id FROM study_sessions WHERE id=1").get();
check("the deleted subject's session still exists", Boolean(session), true);
check("it lost its subject label", session.subject_id, null);
check("it lost its deck label", session.deck_id, null);
check("the daily total is still there", count("SELECT study_seconds s FROM daily_stats WHERE date='2026-09-01'").s, 3600);

console.log("\ndeleting something already gone is not an error");
await deleteSubject(db, 999);
check("the remaining subject survived a no-op delete", count("SELECT COUNT(*) c FROM subjects WHERE id=2").c, 1);

finish();
