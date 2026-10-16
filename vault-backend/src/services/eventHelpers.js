const ALLOWED_EVENT_TYPES = ['expiry', 'renewal', 'due_date', 'birthday', 'amount', 'other'];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function isValidDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function getNextBirthdayDate(dateStr, todayStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-');
  if (parts.length < 3) return null;
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(m) || isNaN(d)) return null;

  const [todayY] = todayStr.split('-').map(Number);

  function getDateForYear(y) {
    let day = d;
    if (m === 2 && d === 29 && !isLeapYear(y)) {
      day = 28;
    }
    const mm = String(m).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }

  const thisYearDate = getDateForYear(todayY);
  if (thisYearDate >= todayStr) {
    return thisYearDate;
  }
  return getDateForYear(todayY + 1);
}

module.exports = {
  ALLOWED_EVENT_TYPES,
  isLeapYear,
  isValidDate,
  getNextBirthdayDate,
};
