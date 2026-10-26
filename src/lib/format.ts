const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

/** 24065 -> "24,065", 7.5 -> "7.5": up to one decimal place (retailer order points can be halves). */
export const formatNumber = (n: number) => {
  const rounded = Math.round(n * 10) / 10;
  const [whole, fraction] = Math.abs(rounded).toFixed(Number.isInteger(rounded) ? 0 : 1).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${rounded < 0 ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
};

/** 4102 -> "PKR 4,102" */
export function formatPKR(amount: number) {
  return `PKR ${formatNumber(amount)}`;
}

/** 24065 -> "24,065 pts" */
export function formatPoints(points: number) {
  return `${formatNumber(points)} pts`;
}

/** Formats a ledger value in the user's unit. */
export function formatValue(value: number, unit: 'points' | 'cash') {
  return unit === 'points' ? formatPoints(value) : formatPKR(value);
}

/** "Wednesday, 07-Oct-2026" */
export function formatDay(iso: string) {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]}, ${pad(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

/** "07-Oct-2026, 3:20 PM" */
export function formatDateTime(iso: string) {
  const d = new Date(iso);
  const hours = d.getHours() % 12 || 12;
  const ampm = d.getHours() < 12 ? 'AM' : 'PM';
  return `${pad(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()}, ${hours}:${pad(d.getMinutes())} ${ampm}`;
}

/** Local calendar day, used to group entries by date. */
export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 2048 -> "2 KB" */
export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
