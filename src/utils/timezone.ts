export function getCurrentMexicoTimestamp(): string {
  return new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' });
}

export function getMexicoDate(): Date {
  const now = new Date();
  const mexicoTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  return mexicoTime;
}

export function getCurrentMexicoDate(): Date {
  return getMexicoDate();
}

export function getCurrentMexicoDateString(): string {
  const date = getMexicoDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMexicoDateStringWithOffset(offsetDays: number): string {
  const date = getMexicoDate();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
