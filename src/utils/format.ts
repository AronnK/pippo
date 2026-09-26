export function formatMinute(minute: number) {
  const hour24 = Math.floor(minute / 60) % 24;
  const suffix = hour24 < 12 ? "AM" : "PM";
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour}:${String(minute % 60).padStart(2, "0")} ${suffix}`;
}
