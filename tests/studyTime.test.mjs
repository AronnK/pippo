import { check, finish, migratedDb } from "./harness.mjs";

const { localDate } = await import("@/database/queries/study");
const study = await import("@/services/studyTimeService");

const { raw, db } = migratedDb();

const midnight = new Date();
midnight.setHours(0, 0, 0, 0);
const at = (minutes) => midnight.getTime() + minutes * 60_000;
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
const insert = (start, end, source) =>
  raw
    .prepare("INSERT INTO study_sessions (start_time,end_time,source) VALUES (?,?,?)")
    .run(new Date(at(start)).toISOString(), new Date(at(end)).toISOString(), source);
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

finish();
