export const DEFAULT_SLOTS: Record<string, string[]> = {
  threads: ['08:15', '12:10', '17:40'],
  linkedin: ['10:05'],
  substack: ['07:45', '13:30', '20:15'],
};

const TIME_ZONE = 'America/Chicago';

function partsInZone(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find(p => p.type === type)?.value || 0);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute'), second: value('second') };
}

function zonedLocalToUtc(year: number, month: number, day: number, hour: number, minute: number) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const p = partsInZone(new Date(guess));
    const shownAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    guess += desiredAsUtc - shownAsUtc;
  }
  return new Date(guess);
}

export function slotForToday(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  const now = new Date();
  const chicagoNow = partsInZone(now);
  let target = zonedLocalToUtc(chicagoNow.year, chicagoNow.month, chicagoNow.day, hour, minute);
  if (target <= now) {
    const noon = zonedLocalToUtc(chicagoNow.year, chicagoNow.month, chicagoNow.day, 12, 0);
    noon.setUTCDate(noon.getUTCDate() + 1);
    const tomorrow = partsInZone(noon);
    target = zonedLocalToUtc(tomorrow.year, tomorrow.month, tomorrow.day, hour, minute);
  }
  return target.toISOString();
}
