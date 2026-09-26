import { check, finish, migratedDb } from "./harness.mjs";

const quality = await import("@/database/queries/quality");

const { raw, db } = migratedDb();

const NOW = new Date();
const ago = (days) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const SEED = [
  ["INSERT INTO subjects (id,name,created_at) VALUES (1,'Pharm',?), (2,'Anat',?)", [ago(9), ago(9)]],
  ["INSERT INTO decks (id,subject_id,name,created_at) VALUES (10,1,'Ch1',?), (20,2,'Ch9',?)", [ago(9), ago(9)]],
  ["INSERT INTO cards (id,deck_id,question,answer,created_at,last_seen_at) VALUES (100,10,'just seen','a',?,?), (101,10,'weak Q','a',?,?), (102,10,'unseen Q','a',?,NULL)", [ago(9), ago(0), ago(9), ago(1), ago(9)]],
  ["INSERT INTO cards (id,deck_id,question,answer,created_at,last_seen_at) VALUES (200,20,'recent A','a',?,?), (201,20,'A unseen','a',?,NULL)", [ago(9), ago(2), ago(9)]],
  ["INSERT INTO mcqs (id,deck_id,question,options_json,correct_answer_index,explanation,created_at,last_seen_at) VALUES (300,10,'stale M',?,0,'e',?,?), (301,20,'weak M',?,0,'e',?,?)", ['["a","b","c","d"]', ago(9), ago(40), '["a","b","c","d"]', ago(9), ago(30)]],
  ["INSERT INTO weak_cards (card_id,marked_at) VALUES (101,?)", [ago(1)]],
  ["INSERT INTO weak_mcqs (mcq_id,marked_at) VALUES (301,?)", [ago(1)]],
];
for (const [sql, params] of SEED) raw.prepare(sql).run(...params);

console.log("random quiz scope");
const everything = await quality.selectRandomItems(db, {}, 100);
check("all subjects means every item", everything.length, 7);
check(
  "a random quiz mixes flashcards and MCQs",
  [...new Set(everything.map((item) => item.kind))].sort(),
  ["flashcard", "mcq"],
);
check(
  "one subject",
  (await quality.selectRandomItems(db, { subjectId: 2 }, 100)).map((i) => i.id).sort(),
  [200, 201, 301],
);
check(
  "one deck",
  (await quality.selectRandomItems(db, { deckId: 10 }, 100)).map((i) => i.id).sort(),
  [100, 101, 102, 300],
);
check("count is honoured", (await quality.selectRandomItems(db, {}, 2)).length, 2);
check(
  "an empty scope selects nothing",
  (await quality.selectRandomItems(db, { subjectId: 3 }, 10)).length,
  0,
);

console.log("\nsurprise me weighting");
const session = await quality.selectSurpriseItems(db, 7);
const subjects = session.map((item) => item.subject_id);
check(
  "no subject comes up twice in a row",
  subjects.every((id, index) => index === 0 || id !== subjects[index - 1]),
  true,
);
check("a request bigger than the library returns what exists", (await quality.selectSurpriseItems(db, 20)).length, 7);
const pharm = session.filter((item) => item.subject_id === 1).map((item) => item.id);
check("weak items lead their subject", pharm[0], 101);
check("the item seen seconds ago comes last", pharm[pharm.length - 1], 100);
const anat = session.filter((item) => item.subject_id === 2).map((item) => item.id);
check("weak MCQ leads the second subject", anat[0], 301);
check(
  "a short session takes one from each subject",
  (await quality.selectSurpriseItems(db, 2)).map((i) => i.subject_id).sort(),
  [1, 2],
);
check(
  "weak review can be scoped to one subject",
  (await quality.getWeakItems(db, { subjectId: 1 })).map((i) => i.id),
  [101],
);

console.log("\nanswering records the review");
await quality.markFlashcard(db, 100, false);
check(
  "a missed card becomes weak",
  raw.prepare("SELECT COUNT(*) c FROM weak_cards WHERE card_id=100").get().c,
  1,
);
check(
  "and is stamped as seen",
  raw.prepare("SELECT last_seen_at IS NOT NULL s FROM cards WHERE id=100").get().s,
  1,
);
await quality.markFlashcard(db, 100, true);
check(
  "knowing it clears the weak flag but keeps the stamp",
  [
    raw.prepare("SELECT COUNT(*) c FROM weak_cards WHERE card_id=100").get().c,
    raw.prepare("SELECT last_seen_at IS NOT NULL s FROM cards WHERE id=100").get().s,
  ],
  [0, 1],
);
await quality.markMcq(db, 300, false);
check(
  "MCQs are tracked the same way",
  [
    raw.prepare("SELECT COUNT(*) c FROM weak_mcqs WHERE mcq_id=300").get().c,
    raw.prepare("SELECT last_seen_at IS NOT NULL s FROM mcqs WHERE id=300").get().s,
  ],
  [1, 1],
);

finish();
