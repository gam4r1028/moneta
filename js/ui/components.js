/* Переиспользуемые UI-компоненты: кольца, bottom sheet, тосты, конфетти. */
import { icon } from './icons.js';
import { esc, clamp, formatMoney } from '../utils.js';
import { store } from '../store.js';

let activeSheet = null;
let lastFocused = null;

export function ring({ value = 0, size = 72, stroke = 8, color = 'var(--blue)', track = 'var(--fill)', label = '', sub = '', className = 'ring', textFill = 'var(--label)', subFill = 'var(--label-tertiary)' }) {
  const v = clamp(Number(value) || 0, 0, 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - v / 100);
  const center = size / 2;
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label || `${Math.round(v)}%`)}">
    <circle class="ring-track" cx="${center}" cy="${center}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle class="ring-value" cx="${center}" cy="${center}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
      transform="rotate(-90 ${center} ${center})" style="transition: stroke-dashoffset .9s var(--ease-spring)"/>
    ${label !== false ? `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" style="font-size:${Math.round(size * .21)}px;font-weight:750;fill:${textFill}">${esc(label || `${Math.round(v)}%`)}</text>` : ''}
    ${sub ? `<text x="50%" y="${center + size * .16}" text-anchor="middle" style="font-size:${Math.round(size * .085)}px;font-weight:600;fill:${subFill}">${esc(sub)}</text>` : ''}
  </svg>`;
}

export function progress(value, color = 'var(--blue)', height = 6) {
  return `<div class="progress" style="height:${height}px"><span style="width:${clamp(value, 0, 100)}%;background:${color}"></span></div>`;
}

export function pageHead({ eyebrow = '', title = '', subtitle = '', actions = '', className = '' }) {
  return `<header class="page-head ${className}" data-page-head>
    <div class="page-head-row">
      <div class="grow">
        ${eyebrow ? `<div class="page-eyebrow">${esc(eyebrow)}</div>` : ''}
        <h1 class="large-title">${title}</h1>
        ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ''}
      </div>
      ${actions ? `<div class="head-actions">${actions}</div>` : ''}
    </div>
  </header>`;
}

export function backHead({ title = '', subtitle = '', back = '#/home', action = '' }) {
  return `<header class="page-head" data-page-head>
    <div class="back-head">
      <button class="back-btn" type="button" data-nav="${esc(back)}" aria-label="Назад">${icon('chevron-left', 21)}</button>
      <div class="grow">
        <h1 class="large-title">${title}</h1>
        ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ''}
      </div>
      ${action}
    </div>
  </header>`;
}

export function emptyState({ emoji = '✨', title = 'Пока пусто', text = '', action = '' }) {
  return `<div class="empty-state">
    <div class="empty-art" aria-hidden="true">${emoji}</div>
    <h3>${esc(title)}</h3>
    <p>${text}</p>
    ${action}
  </div>`;
}

export function sectionHead(title, link = '', linkAttrs = '') {
  return `<div class="section-head">
    <h2 class="section-title">${esc(title)}</h2>
    ${link ? `<button class="section-link" type="button" ${linkAttrs}>${esc(link)}</button>` : ''}
  </div>`;
}

export function openSheet({ title = '', subtitle = '', body = '', onMount = null, className = '', dismissible = true }) {
  closeSheet(true);
  lastFocused = document.activeElement;
  const root = document.getElementById('sheet-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.dataset.sheetClose = 'true';
  const sheet = document.createElement('section');
  sheet.className = `sheet ${className}`;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', title || 'Окно');
  sheet.innerHTML = `
    <div class="sheet-grabber" aria-hidden="true"></div>
    <div class="sheet-header">
      <div class="sheet-title">${esc(title)}</div>
      ${dismissible ? `<button class="sheet-close" type="button" data-sheet-close aria-label="Закрыть">${icon('close', 17)}</button>` : ''}
    </div>
    <div class="sheet-body">${subtitle ? `<p class="sheet-lead">${esc(subtitle)}</p>` : ''}${body}</div>`;
  root.append(backdrop, sheet);
  document.body.style.overflow = 'hidden';
  activeSheet = { backdrop, sheet, dismissible };

  const close = () => closeSheet();
  backdrop.addEventListener('click', close);
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-sheet-close]')) close();
  });

  // Жест «потянуть вниз», чтобы закрыть.
  let startY = 0, delta = 0, dragging = false;
  sheet.querySelector('.sheet-grabber').addEventListener('pointerdown', (e) => {
    if (!dismissible) return;
    dragging = true; startY = e.clientY; delta = 0;
    sheet.classList.add('dragging');
    e.target.setPointerCapture?.(e.pointerId);
  });
  sheet.querySelector('.sheet-grabber').addEventListener('pointermove', (e) => {
    if (!dragging) return;
    delta = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translate(-50%, ${delta}px)`;
  });
  sheet.querySelector('.sheet-grabber').addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
    if (delta > 76) close();
  });

  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    sheet.classList.add('open');
  });

  if (typeof onMount === 'function') onMount(sheet.querySelector('.sheet-body'), close, sheet);

  setTimeout(() => {
    const target = sheet.querySelector('input:not([type="hidden"]), select, textarea, button:not(.sheet-close)');
    if (target && !('ontouchstart' in window)) target.focus({ preventScroll: true });
  }, 380);

  return { sheet, body: sheet.querySelector('.sheet-body'), close };
}

export function closeSheet(immediate = false) {
  if (!activeSheet) return;
  const { backdrop, sheet } = activeSheet;
  activeSheet = null;
  document.body.style.overflow = '';
  if (immediate) {
    backdrop.remove(); sheet.remove();
  } else {
    backdrop.classList.remove('open');
    sheet.classList.remove('open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 380);
  }
  if (lastFocused && document.contains(lastFocused)) {
    setTimeout(() => lastFocused.focus?.({ preventScroll: true }), 40);
  }
}

export function toast(message, { emoji = '', xp = 0, duration = 2800 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `${emoji ? `<span class="toast-emoji">${emoji}</span>` : ''}<span>${esc(message)}</span>${xp ? `<span class="toast-xp">+${xp} XP</span>` : ''}`;
  root.append(el);
  haptic();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 280);
  }, duration);
}

export function rewardToast(message, xp = 0, emoji = '✨') {
  toast(message, { emoji, xp });
}

export function haptic(pattern = 10) {
  if (!store.state.settings.haptics) return;
  try { navigator.vibrate?.(pattern); } catch { /* не критично */ }
}

let audioCtx = null;
export function playSound(type = 'tap') {
  if (!store.state.settings.sound) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const now = audioCtx.currentTime;
    o.type = 'sine';
    const freq = type === 'success' ? 660 : type === 'error' ? 220 : 440;
    o.frequency.setValueAtTime(freq, now);
    if (type === 'success') o.frequency.exponentialRampToValueAtTime(990, now + 0.12);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(type === 'success' ? 0.055 : 0.025, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (type === 'success' ? 0.24 : 0.08));
    o.connect(g); g.connect(audioCtx.destination);
    o.start(now); o.stop(now + 0.26);
  } catch { /* звук не обязателен */ }
}

export function celebrate(power = 1) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.getElementById('confetti');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.scale(dpr, dpr);
  const colors = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF3B30', '#5AC8FA', '#FFD60A'];
  const count = Math.round(75 * power);
  const originX = w / 2;
  const originY = h * 0.36;
  const parts = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 8;
    return {
      x: originX + (Math.random() - 0.5) * 70,
      y: originY + (Math.random() - 0.5) * 30,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      life: 110 + Math.random() * 55,
      shape: Math.random() > .5 ? 'rect' : 'circle'
    };
  });
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, w, h);
    let alive = false;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive = true;
      p.vy += 0.16;
      p.vx *= 0.992;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * .66);
      else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    frame++;
    if (alive && frame < 220) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, w, h);
  }
  draw();
}

export function confirmSheet({
  title = 'Подтверди действие',
  text = '',
  iconName = 'info',
  confirmLabel = 'Продолжить',
  cancelLabel = 'Отмена',
  danger = false,
  summary = ''
}) {
  return new Promise((resolve) => {
    const { close } = openSheet({
      title: '',
      body: `<div style="padding-top:8px">
        <div class="confirm-icon" style="${danger ? 'background:color-mix(in srgb,var(--red) 11%,transparent);color:var(--red)' : ''}">${icon(iconName, 28)}</div>
        <h2 class="confirm-title">${esc(title)}</h2>
        <p class="confirm-text">${text}</p>
        ${summary ? `<div class="confirm-summary">${summary}</div>` : ''}
        <div class="form-actions">
          <button type="button" class="btn btn--secondary" data-cancel>${esc(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? 'btn--red' : ''}" data-confirm>${esc(confirmLabel)}</button>
        </div>
      </div>`,
      onMount(body, closeFn) {
        body.querySelector('[data-cancel]').addEventListener('click', () => { closeFn(); resolve(false); });
        body.querySelector('[data-confirm]').addEventListener('click', () => { closeFn(); resolve(true); });
      }
    });
    const body = document.querySelector('.sheet-body:last-child');
    if (body) {
      body.querySelector('[data-cancel]')?.addEventListener('click', () => resolve(false));
      body.querySelector('[data-confirm]')?.addEventListener('click', () => resolve(true));
    }
    void close;
  });
}

export function moneyPill(value, currency = store.state.settings.currency) {
  return `<span class="amount">${esc(formatMoney(value, currency))}</span>`;
}

export function sheetFormActions(confirmLabel = 'Сохранить', extra = '') {
  return `<div class="form-actions">
    ${extra || `<button type="button" class="btn btn--secondary" data-sheet-close>Отмена</button>`}
    <button type="submit" class="btn">${esc(confirmLabel)}</button>
  </div>`;
}
