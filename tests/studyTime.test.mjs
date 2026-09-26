import { check, finish, migratedDb } from "./harness.mjs";

const { localDate } = await import("@/database/queries/study");
const study = await import("@/services/studyTimeService");

const { raw, db } = migratedDb();

const midnight = new Date();
midnight.setHours(0, 0, 0, 0);
const at = (minutes) => midnight.getTime() + minutes * 60_000;
const start = (minutes) => new Date(at(minutes)).toISOString();
const span = (list) =>
  list.reduce((total, item) => total + (item.end - item.start), 0);

console.log("interval union (spec 4.7: never double-count)");
check(
  "overlapping manual and automatic time merges into one",
  span(
    study.mergeIntervals([
      { start: at(0), end: at(30) },
      { start: at(20), end: at(45) },
    ]),
  ),
  45 * 60_000,
);
check(
  "a session nested inside another adds nothing",
  study.mergeIntervals([
    { start: at(0), end: at(60) },
    { start: at(10), end: at(20) },
  ]).length,
  1,
);
check(
  "separate sessions stay separate",
  span(
    study.mergeIntervals([
      { start: at(0), end: at(10) },
      { start: at(30), end: at(40) },
    ]),
  ),
  20 * 60_000,
);
check(
  "an idle pause leaves a gap the merge cannot bridge",
  span(
    study.mergeIntervals([
      { start: at(0), end: at(30) },
      { start: at(31), end: at(60) },
    ]),
  ),
  59 * 60_000,
);
check(
  "zero-length and backwards intervals are dropped",
  study.mergeIntervals([
    { start: at(5), end: at(5) },
    { start: at(10), end: at(3) },
  ]),
  [],
);

console.log("\nday boundaries");
const parts = study.splitIntervalByLocalDay({
  start: at(-60),
  end: at(120),
});
check("one session that crosses midnight becomes two days", parts.length, 2);
check(
  "each half is stamped with its own local date",
  parts.map((part) => part.date),
  [localDate(new Date(at(-60))), localDate(new Date(at(120)))],
);
check(
  "the halves add up to the whole and meet at midnight",
  [span(parts), parts[0].end === at(0)],
  [3 * 60 * 60_000, true],
);

console.log("\nsessions to daily stats");
const today = localDate();
raw
  .prepare(
    "INSERT INTO daily_stats (date,items_completed,flashcards_completed,mcqs_completed,study_seconds) VALUES (?,50,30,20,0)",
  )
  .run(today);
const insert = (from, to, source) =>
  raw
    .prepare("INSERT INTO study_sessions (start_time,end_time,source) VALUES (?,?,?)")
    .run(start(from), start(to), source);
insert(0, 40, "manual");
insert(30, 60, "deck_flashcards");
await study.rebuildStudySeconds(db);
const stats = () =>
  raw
    .prepare("SELECT study_seconds,items_completed FROM daily_stats WHERE date=?")
    .get(today);
check(
  "a manual timer and card time on the same day count once",
  stats().study_seconds,
  60 * 60,
);
check(
  "rebuilding study time leaves item counts alone",
  stats().items_completed,
  50,
);
insert(70, 90, "deck_mcqs");
await study.rebuildStudySeconds(db);
check("a later session is added on top", stats().study_seconds, 80 * 60);

await study.startSession(db, "manual");
await study.startSession(db, "manual");
check(
  "starting the same source twice leaves one open session",
  raw
    .prepare(
      "SELECT COUNT(*) c FROM study_sessions WHERE source='manual' AND end_time IS NULL",
    )
    .get().c,
  1,
);
check(
  "the open timer reports when it started",
  Boolean((await study.getManualTimer(db))?.start_time),
  true,
);
check(
  "an open session is not counted yet",
  raw.prepare("SELECT study_seconds s FROM daily_stats WHERE date=?").get(today).s,
  80 * 60,
);
await study.stopSession(db, "manual");
check("stopping the timer closes it", await study.getManualTimer(db), null);

const summary = await study.studyTimeSummary(db);
check("today's summary reads back the merged total", summary.today, stats().study_seconds);
raw
  .prepare(
    "INSERT INTO daily_stats (date,items_completed,flashcards_completed,mcqs_completed,study_seconds) VALUES (?,0,0,0,600)",
  )
  .run("2000-01-01");
await study.rebuildStudySeconds(db);
check(
  "rebuilding today leaves other days untouched",
  raw.prepare("SELECT study_seconds s FROM daily_stats WHERE date='2000-01-01'").get().s,
  600,
);
check(
  "the total covers every day",
  (await study.studyTimeSummary(db)).total,
  stats().study_seconds + 600,
);

console.log("\nstudying which subject");
const timed = migratedDb();
for (const [sql, params] of [
  [
    "INSERT INTO subjects (id,name,created_at) VALUES (1,'Pharmacology',?), (2,'Anatomy',?)",
    [start(0), start(0)],
  ],
  [
    "INSERT INTO decks (id,subject_id,name,created_at) VALUES (10,1,'Ch1',?), (20,2,'Skull',?)",
    [start(0), start(0)],
  ],
])
  timed.raw.prepare(sql).run(...params);
timed.raw
  .prepare(
    "INSERT INTO daily_stats (date,items_completed,flashcards_completed,mcqs_completed,study_seconds) VALUES (?,?,?,0,0)",
  )
  // study_seconds stays 0 here on purpose: the breakdown recomputes from sessions.
  .run(today, 50, 50);
const closed = (from, to, source, subjectId, deckId) =>
  timed.raw
    .prepare(
      "INSERT INTO study_sessions (start_time,end_time,source,subject_id,deck_id) VALUES (?,?,?,?,?)",
    )
    .run(start(from), start(to), source, subjectId, deckId);
closed(0, 60, "manual", null, null);
closed(30, 100, "deck_flashcards", 1, 10);
// subject_id set on one row, only deck_id on the other: both must resolve.
closed(90, 120, "surprise", null, 20);
const breakdown = await study.dayBreakdown(timed.db, today);
check(
  "the day totals the union of every session in it",
  breakdown.seconds,
  120 * 60,
);
check(
  "the day reports its item counts",
  [breakdown.items, breakdown.flashcards, breakdown.mcqs],
  [50, 50, 0],
);
check(
  "the day splits its time by subject",
  breakdown.subjects,
  [
    { name: "Pharmacology", seconds: 70 * 60 },
    { name: "Anatomy", seconds: 30 * 60 },
  ],
);
check(
  "timer time is not blamed on any subject",
  breakdown.subjects.reduce((sum, row) => sum + row.seconds, 0) <
    breakdown.seconds,
  true,
);
check(
  "a day with no sessions is empty rather than missing",
  await study.dayBreakdown(timed.db, "2000-01-01"),
  { seconds: 0, items: 0, flashcards: 0, mcqs: 0, subjects: [] },
);
check(
  "all-time subject time matches the per-day split",
  await study.subjectStudyTime(timed.db),
  [
    { name: "Pharmacology", seconds: 70 * 60 },
    { name: "Anatomy", seconds: 30 * 60 },
  ],
);

await study.startSession(timed.db, "surprise", 2, 20);
check(
  "the same subject and deck keeps one session open",
  timed.raw
    .prepare(
      "SELECT COUNT(*) c FROM study_sessions WHERE source='surprise' AND end_time IS NULL",
    )
    .get().c,
  1,
);
await study.startSession(timed.db, "surprise", 1, 10);
check(
  "switching decks closes the old interval and starts a new one",
  timed.raw
    .prepare(
      `SELECT subject_id, end_time IS NOT NULL done FROM study_sessions
       WHERE source='surprise' ORDER BY id DESC LIMIT 2`,
    )
    .all(),
  [
    { subject_id: 1, done: 0 },
    { subject_id: 2, done: 1 },
  ],
);
await study.stopSession(timed.db, "surprise");
check(
  "stopping the source closes every one of its sessions",
  timed.raw
    .prepare(
      "SELECT COUNT(*) c FROM study_sessions WHERE source='surprise' AND end_time IS NULL",
    )
    .get().c,
  0,
);

console.log("\ngrowth insights");
const history = migratedDb();
const lastWeekDay = study.shiftDate(study.weekStart(today), -1);
const farAway = study.shiftDate(today, -40);
for (const [date, seconds, items] of [
  [today, 7200, 50],
  [study.shiftDate(today, -1), 0, 0],
  [lastWeekDay, 3600, 50],
  [farAway, 9000, 50],
])
  history.raw
    .prepare(
      "INSERT INTO daily_stats (date,items_completed,flashcards_completed,mcqs_completed,study_seconds) VALUES (?,?,?,0,?)",
    )
    .run(date, items, items, seconds);
const growth = await study.growthInsights(history.db);
check("the longest day wins", growth.longestDay, {
  date: farAway,
  seconds: 9000,
});
check("the best week is that day's week", growth.bestWeek, {
  start: study.weekStart(farAway),
  seconds: 9000,
});
check("this week counts today", growth.thisWeek, 7200);
check("last week counts its own days", growth.lastWeek, 3600);
check("the comparison is a percentage", growth.change, 100);
check(
  "consistency ignores empty and too-old days",
  [growth.studiedDays, growth.windowDays],
  [2, 30],
);
const week = await study.dailySeries(history.db, study.shiftDate(today, -6), today);
check("a week always has seven days", week.length, 7);
check(
  "the series is oldest first and ends today",
  [week[0].date === study.shiftDate(today, -6), week.at(-1).date === today],
  [true, true],
);
check(
  "days without stats appear as zeros",
  week.find((day) => day.date === study.shiftDate(today, -1)),
  { date: study.shiftDate(today, -1), seconds: 0, items: 0 },
);
check("today's seconds carry into the series", week.at(-1).seconds, 7200);
check("up is a positive percentage", study.percentChange(120, 100), 20);
check("down is negative", study.percentChange(50, 100), -50);
check("a week with no previous baseline has no percentage", study.percentChange(50, 0), null);

finish();
