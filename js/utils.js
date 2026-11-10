/* Общие функции: форматирование, даты, безопасный HTML. */

export const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];
export const MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
export const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export const CURRENCIES = {
  BYN: { label: 'Белорусский рубль', symbol: 'Br', flag: '🇧🇾' },
  RUB: { label: 'Российский рубль', symbol: '₽', flag: '🇷🇺' },
  USD: { label: 'Доллар США', symbol: '$', flag: '🇺🇸' },
  EUR: { label: 'Евро', symbol: '€', flag: '🇪🇺' }
};

export const LEVELS = [
  { min: 0, name: 'Новичок', icon: '🌱' },
  { min: 150, name: 'Копейка', icon: '🪙' },
  { min: 400, name: 'Рубль', icon: '💵' },
  { min: 900, name: 'Капитал', icon: '💎' },
  { min: 1800, name: 'Финансовый гуру', icon: '🧠' }
];

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function attr(value) {
  return esc(value);
}

export function uid(prefix = 'id') {
  const random = (globalThis.crypto?.getRandomValues
    ? Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('')
    : Math.random().toString(16).slice(2, 14));
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function clamp(n, min, max) { return Math.min(max, Math.max(min, Number(n) || 0)); }

export function sum(list, getter = (v) => v) {
  return list.reduce((acc, item) => acc + (Number(getter(item)) || 0), 0);
}

export function round(n, digits = 2) {
  const p = 10 ** digits;
  return Math.round((Number(n) + Number.EPSILON) * p) / p;
}

export function percent(part, total) {
  if (!total) return 0;
  return clamp((Number(part) / Number(total)) * 100, 0, 100);
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dateKey(date = new Date()) { return todayKey(date); }

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}

export function parseDateKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function formatMoney(value, currency = 'BYN', options = {}) {
  const amount = Number(value) || 0;
  const digits = options.digits ?? (Math.abs(amount % 1) > 0.004 ? 2 : 0);
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      ...options
    }).format(amount).replace(/\u00A0/g, ' ');
  } catch {
    return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(amount)} ${currency}`;
  }
}

export function formatNumber(value, digits = 0) {
  try {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(Number(value) || 0).replace(/\u00A0/g, ' ');
  } catch {
    return String(Math.round(Number(value) || 0));
  }
}

export function formatCompact(value, currency = 'BYN') {
  const n = Number(value) || 0;
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${formatNumber(abs / 1_000_000, 1)} млн ${CURRENCIES[currency]?.symbol || currency}`;
  if (abs >= 10_000) return `${sign}${formatNumber(abs / 1000, 1)} тыс. ${CURRENCIES[currency]?.symbol || currency}`;
  return formatMoney(n, currency);
}

export function formatDate(date, opts = {}) {
  const d = date instanceof Date ? date : parseDateKey(date);
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', ...opts
  }).format(d);
}

export function formatDateShort(date) {
  const d = date instanceof Date ? date : parseDateKey(date);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(d);
}

export function formatFullDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatMonth(month, year) {
  return `${MONTHS_NOM[month]} ${year}`;
}

export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} ч ${rest} мин` : `${h} ч`;
}

export function formatSeconds(seconds) {
  return formatDuration(Math.round((Number(seconds) || 0) / 60));
}

export function plural(n, one, few, many) {
  const num = Math.abs(Number(n)) % 100;
  const last = num % 10;
  if (num > 10 && num < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export function timeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function getLevel(xp) {
  let current = LEVELS[0];
  let index = 0;
  LEVELS.forEach((lvl, i) => { if (xp >= lvl.min) { current = lvl; index = i; } });
  const next = LEVELS[index + 1] || null;
  const base = current.min;
  const range = next ? next.min - base : 1;
  const progress = next ? clamp(((xp - base) / range) * 100, 0, 100) : 100;
  return { ...current, index, next, base, progress, toNext: next ? Math.max(0, next.min - xp) : 0 };
}

export function dayIndex(date = new Date()) {
  return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86400000);
}

export function truncate(str, length = 80) {
  const s = String(str || '');
  return s.length > length ? `${s.slice(0, length - 1)}…` : s;
}

export function debounce(fn, delay = 180) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlight(text, query) {
  const q = String(query || '').trim();
  if (!q) return esc(text);
  const re = new RegExp(`(${escapeRegExp(q)})`, 'ig');
  return esc(text).replace(re, '<mark class="search-hit-mark">$1</mark>');
}

export function safeId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

export function pctLabel(value) {
  const n = Number(value) || 0;
  return `${n > 0 && n < 1 ? n.toFixed(1) : Math.round(n)}%`;
}
