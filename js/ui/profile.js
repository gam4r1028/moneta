/* Профиль, достижения и настройки. */
import { store } from '../store.js';
import { achievements } from '../data/achievements.js';
import { achievementStatus } from '../achievements.js';
import { glossary } from '../data/glossary.js';
import { tips } from '../data/tips.js';
import { allLessons } from '../data/course.js';
import {
  esc, formatDate, formatDuration, formatNumber, getLevel, MONTHS,
  todayKey, addDays, plural
} from '../utils.js';
import { icon } from './icons.js';
import {
  pageHead, backHead, progress, openSheet, toast, confirmSheet, celebrate,
  playSound, sectionHead
} from './components.js';

const AVATARS = ['🦊', '🐱', '🐼', '🐨', '🦁', '🐯', '🐸', '🐵', '🦄', '🐙', '🐳', '🦉', '🐝', '🌻', '🚀', '💎'];

function currency() {
  return store.state.settings.currency;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function canPromptInstall() {
  return Boolean(window.kopeykaInstallPrompt);
}

function shortDuration(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (value < 60) return `${value} мин`;
  const hours = value / 60;
  return `${formatNumber(hours, hours < 10 ? 1 : 0)} ч`;
}

/* ---------- Профиль ---------- */

function weekBars() {
  const days = [];
  const maxXp = { value: 1 };
  for (let i = 6; i >= 0; i--) {
    const date = addDays(new Date(), -i);
    const key = todayKey(date);
    const xp = Number(store.state.activity[key]?.xp || 0);
    days.push({ date, xp });
    if (xp > maxXp.value) maxXp.value = xp;
  }

  const width = 330;
  const height = 94;
  const pad = { left: 4, right: 4, top: 8, bottom: 20 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const barW = Math.max(12, (innerW / 7) - 7);
  const total = days.reduce((acc, day) => acc + day.xp, 0);

  const bars = days.map((day, index) => {
    const x = pad.left + index * (innerW / 7) + ((innerW / 7) - barW) / 2;
    const h = day.xp > 0 ? Math.max(3, (day.xp / maxXp.value) * innerH) : 2;
    const y = pad.top + innerH - h;
    const label = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(day.date).replace('.', '');
    return `<rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2.4" style="${day.xp ? '' : 'opacity:.18'}"><title>${esc(formatDate(day.date))}: ${day.xp} XP</title></rect>
      <text x="${(x + barW / 2).toFixed(1)}" y="${height - 5}" text-anchor="middle" class="bar-label">${esc(label)}</text>`;
  }).join('');

  return `<div class="bar-chart">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="XP за последние семь дней">
      <line x1="0" y1="${pad.top + innerH}" x2="${width}" y2="${pad.top + innerH}" class="grid-line"/>
      ${bars}
      <text x="${pad.left}" y="${pad.top - 1}" class="bar-label">${total} XP за неделю</text>
    </svg>
  </div>`;
}

function heatmap() {
  const today = new Date();
  let start = addDays(today, -83);
  start = addDays(start, -((start.getDay() + 6) % 7));

  const cells = [];
  let cursor = new Date(start);
  let guard = 0;
  while (cursor <= today && guard < 120) {
    const key = todayKey(cursor);
    const activity = store.state.activity[key] || {};
    const actions = Number(activity.actions) || 0;
    const xp = Number(activity.xp) || 0;
    const score = actions * 2 + xp;
    const level = score >= 80 ? 4 : score >= 40 ? 3 : score >= 15 ? 2 : score > 0 ? 1 : 0;
    cells.push(`<span class="heat-cell" data-level="${level}" title="${esc(formatDate(cursor))}: ${actions} ${plural(actions, 'действие', 'действия', 'действий')}, ${xp} XP"></span>`);
    cursor = addDays(cursor, 1);
    guard++;
  }

  const labels = [start, addDays(start, 30), addDays(start, 60), today]
    .map(date => `<span>${esc(new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(date).replace('.', ''))}</span>`)
    .join('');

  return `<div class="card heatmap-card">
    <div class="row row--between" style="margin-bottom:11px">
      <div><div class="small strong">Активность</div><div class="tiny tertiary">Последние 12 недель</div></div>
      <div class="tiny tertiary">${openStreakLabel()}</div>
    </div>
    <div class="heat-months">${labels}</div>
    <div class="heatmap" role="img" aria-label="Карта активности за последние 12 недель">${cells.join('')}</div>
    <div class="heat-legend"><span>меньше</span>
      ${[0, 1, 2, 3, 4].map(level => `<span class="heat-cell" data-level="${level}" style="width:9px;height:9px"></span>`).join('')}
      <span>больше</span>
    </div>
  </div>`;
}

function openStreakLabel() {
  const streak = store.state.profile.streak || 0;
  return `${icon('flame', 12)} ${streak} ${plural(streak, 'день', 'дня', 'дней')}`;
}

function achievementStrip() {
  const statuses = achievementStatus();
  const unlocked = statuses.filter(item => item.unlocked)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const locked = statuses.filter(item => !item.unlocked);
  const list = [...unlocked.slice(0, 6), ...locked.slice(0, Math.max(0, 8 - Math.min(6, unlocked.length)))];
  if (!list.length) return '';
  return `<div class="achievements-strip">
    ${list.map(item => `<a class="ach-mini ${item.unlocked ? 'unlocked' : ''}" href="#/profile/achievements" style="--ach-color:${item.color}" title="${esc(item.title)}">
      <span class="ach-medal">${item.emoji}</span>
      <span class="ach-name">${esc(item.title)}</span>
    </a>`).join('')}
  </div>`;
}

export function renderProfile() {
  const state = store.state;
  const profile = state.profile;
  const level = getLevel(profile.xp);
  const name = profile.name || 'Друзья';
  const course = store.getCourseProgress();
  const minutes = Math.round(profile.totalSeconds / 60);
  const unlockedAchievements = Object.keys(state.achievements).length;
  const goalsDone = state.budget.goals.filter(goalItem => goalItem.completed).length;
  const since = state.createdAt ? new Date(state.createdAt) : new Date();
  const sinceLabel = `${MONTHS[since.getMonth()]} ${since.getFullYear()}`;

  const html = `<div class="page">
    ${pageHead({
      title: 'Профиль',
      subtitle: 'Твой прогресс и настройки',
      actions: `<button class="icon-btn icon-btn--glass" type="button" data-nav="#/profile/settings" aria-label="Настройки">${icon('settings', 19)}</button>`
    })}

    <div class="card profile-hero" style="margin-bottom:14px">
      <button class="avatar-btn" type="button" data-edit-profile aria-label="Изменить имя и аватар">${esc(profile.avatar || '🦊')}</button>
      <div class="profile-name">${esc(name)}</div>
      <button class="profile-level" type="button" data-edit-profile>${icon('sparkles', 13)} ${esc(level.icon)} ${esc(level.name)} · ${formatNumber(profile.xp)} XP</button>
      <div class="xp-bar-wrap">
        <div class="xp-top">
          <span>Уровень ${level.index + 1}</span>
          <span>${level.next ? `${formatNumber(level.toNext)} XP до «${esc(level.next.name)}»` : 'Максимальный уровень'}</span>
        </div>
        <div class="xp-bar"><span style="width:${level.progress}%"></span></div>
      </div>
      <div class="tiny tertiary" style="margin-top:10px">С «Копейкой» с ${esc(sinceLabel)}</div>
    </div>

    <div class="section">
      <div class="stats-grid">
        <div class="stat-tile"><span class="st-icon">${icon('book', 17)}</span><div class="st-value">${course.completed}<span class="tiny tertiary"> / ${course.total}</span></div><div class="st-label">уроков пройдено</div></div>
        <div class="stat-tile"><span class="st-icon">${icon('flame', 17)}</span><div class="st-value">${profile.streak}</div><div class="st-label">${plural(profile.streak, 'день подряд', 'дня подряд', 'дней подряд')} · рекорд ${profile.bestStreak}</div></div>
        <div class="stat-tile"><span class="st-icon">${icon('clock', 17)}</span><div class="st-value">${esc(shortDuration(minutes))}</div><div class="st-label">в приложении</div></div>
        <div class="stat-tile"><span class="st-icon">${icon('trophy', 17)}</span><div class="st-value">${unlockedAchievements}<span class="tiny tertiary"> / ${achievements.length}</span></div><div class="st-label">достижений открыто</div></div>
      </div>
    </div>

    <div class="section">${heatmap()}</div>

    <div class="section">
      ${sectionHead('Динамика за неделю', 'Курс', 'data-nav="#/course"')}
      <div class="card card--padded">
        <div class="row row--between" style="margin-bottom:2px">
          <div><div class="small strong">XP за 7 дней</div><div class="tiny tertiary">${course.minutesLeft ? `${formatDuration(course.minutesLeft)} материала ещё впереди` : 'Все доступные уроки пройдены'}</div></div>
          <span class="chip chip--blue">${goalDoneText(goalsDone)}</span>
        </div>
        ${weekBars()}
      </div>
    </div>

    <div class="section">
      ${sectionHead('Достижения', 'Все', 'data-nav="#/profile/achievements"')}
      <div class="card card--padded" style="padding:15px 12px">
        ${achievementStrip()}
      </div>
    </div>

    ${!isStandalone() ? `<div class="section">
      <div class="install-banner">
        <div class="icon-badge" style="background:var(--gradient-brand);color:#fff">${icon('download', 20)}</div>
        <div class="grow">
          <div class="small strong">Копейка на главном экране</div>
          <div class="tiny secondary" style="margin-top:2px">Открывается как приложение, работает офлайн и без браузерных панелей.</div>
        </div>
        <button class="btn btn--sm" type="button" data-install>${canPromptInstall() ? 'Установить' : 'Как?'}</button>
      </div>
    </div>` : ''}

    <div class="section">
      <div class="settings-list">
        <button class="settings-row" type="button" data-nav="#/profile/achievements">
          <span class="settings-icon" style="background:var(--orange)">${icon('trophy', 16)}</span>
          <span class="settings-label">Достижения</span>
          <span class="settings-value">${unlockedAchievements} из ${achievements.length}</span>
          ${icon('chevron-right', 15, 'chev')}
        </button>
        <button class="settings-row" type="button" data-nav="#/course/glossary">
          <span class="settings-icon" style="background:var(--purple)">${icon('book', 16)}</span>
          <span class="settings-label">Словарик</span>
          <span class="settings-value">${glossary.length} терминов</span>
          ${icon('chevron-right', 15, 'chev')}
        </button>
        <button class="settings-row" type="button" data-install>
          <span class="settings-icon" style="background:var(--green)">${icon('download', 16)}</span>
          <span class="settings-label">${isStandalone() ? 'Приложение установлено' : 'Установить приложение'}</span>
          <span class="settings-value">${isStandalone() ? '✓' : 'PWA'}</span>
          ${icon('chevron-right', 15, 'chev')}
        </button>
        <button class="settings-row" type="button" data-nav="#/profile/settings">
          <span class="settings-icon" style="background:var(--blue)">${icon('settings', 16)}</span>
          <span class="settings-label">Настройки</span>
          <span class="settings-value">${esc(currency())}</span>
          ${icon('chevron-right', 15, 'chev')}
        </button>
      </div>
    </div>

    <div class="section">
      <div class="disclaimer">
        <strong style="color:var(--label-secondary)">Копейка — образовательный проект.</strong><br>
        Материалы и калькуляторы помогают разобраться в личных финансах, но не являются индивидуальной финансовой рекомендацией. Перед кредитом, вкладом или инвестицией проверяй условия и риски.
      </div>
      <div class="tiny tertiary center" style="margin-top:11px">Версия 1.0 · этап 1 · данные хранятся только на устройстве</div>
    </div>
  </div>`;

  return {
    html,
    mount(root) {
      root.querySelectorAll('[data-edit-profile]').forEach(btn => btn.addEventListener('click', openProfileSheet));
      root.querySelectorAll('[data-install]').forEach(btn => btn.addEventListener('click', openInstallSheet));
    }
  };
}

function goalDoneText(goalsDone) {
  if (!goalsDone) return 'Цели →';
  return `${goalsDone} ${plural(goalsDone, 'цель', 'цели', 'целей')} закрыто`;
}

function openProfileSheet() {
  const state = store.state.profile;
  let selectedAvatar = state.avatar || '🦊';

  const { body, close } = openSheet({
    title: 'Профиль',
    subtitle: 'Имя и аватар видны только тебе — всё хранится на этом устройстве.',
    body: `<form id="profile-form" novalidate>
      <div class="field" style="margin-bottom:15px">
        <label class="field-label" for="profile-name">Как тебя зовут?</label>
        <input class="input" id="profile-name" name="name" type="text" maxlength="40" value="${esc(state.name || '')}" placeholder="Например, Аня" autocomplete="off">
      </div>
      <div class="field" style="margin-bottom:6px">
        <span class="field-label">Аватар</span>
        <div class="avatar-grid" id="avatar-grid">
          ${AVATARS.map(avatar => `<button class="avatar-choice ${avatar === selectedAvatar ? 'selected' : ''}" type="button" data-avatar="${esc(avatar)}" aria-label="Выбрать ${esc(avatar)}" aria-pressed="${avatar === selectedAvatar}">${avatar}</button>`).join('')}
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn--secondary" type="button" data-sheet-close>Отмена</button>
        <button class="btn" type="submit">Сохранить</button>
      </div>
    </form>`,
    onMount(bodyEl, closeFn) {
      const form = bodyEl.querySelector('#profile-form');
      const nameInput = bodyEl.querySelector('#profile-name');
      bodyEl.querySelectorAll('[data-avatar]').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedAvatar = btn.dataset.avatar;
          bodyEl.querySelectorAll('[data-avatar]').forEach(other => {
            const active = other === btn;
            other.classList.toggle('selected', active);
            other.setAttribute('aria-pressed', String(active));
          });
        });
      });
      form.addEventListener('submit', event => {
        event.preventDefault();
        store.setName(nameInput.value);
        store.setAvatar(selectedAvatar);
        playSound('success');
        toast('Профиль обновлён', { emoji: '✨' });
        closeFn();
        window.dispatchEvent(new CustomEvent('kopeyka:rerender'));
      });
      setTimeout(() => nameInput.focus({ preventScroll: true }), 420);
    }
  });

  return { body, close };
}

function openInstallSheet() {
  if (isStandalone()) {
    toast('Копейка уже установлена', { emoji: '📲' });
    return;
  }

  const prompt = window.kopeykaInstallPrompt;
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);

  const steps = ios
    ? [
      'Открой «Копейку» в Safari.',
      'Нажми кнопку «Поделиться» в нижней панели.',
      'Выбери «На экран „Домой“» и подтверди «Добавить».'
    ]
    : android
      ? [
        'Открой меню браузера (три точки в правом верхнем углу).',
        'Выбери «Установить приложение» или «Добавить на главный экран».',
        'Подтверди установку — иконка появится на главном экране.'
      ]
      : [
        'Открой «Копейку» в Chrome, Edge или Safari.',
        'Найди в адресной строке значок установки или меню браузера.',
        'Выбери «Установить приложение» / «Добавить на главный экран».'
      ];

  openSheet({
    title: 'Установить Копейку',
    subtitle: 'Приложение откроется в отдельном окне, будет работать офлайн и запомнит весь прогресс.',
    body: `<div class="stack" style="gap:13px">
      ${steps.map((step, index) => `<div class="row" style="gap:11px;align-items:flex-start">
        <span class="lesson-num current" style="flex:none">${index + 1}</span>
        <span class="small secondary" style="padding-top:3px;line-height:1.45">${esc(step)}</span>
      </div>`).join('')}
      ${prompt ? `<button class="btn btn--wide" type="button" data-install-now style="margin-top:6px">${icon('download', 17)} Установить сейчас</button>` : ''}
      <div class="disclaimer">На iPhone установка работает в Safari. В некоторых встроенных браузерах (например, внутри Telegram) пункта установки может не быть — открой ссылку в Safari или Chrome.</div>
    </div>`,
    onMount(bodyEl, closeFn) {
      bodyEl.querySelector('[data-install-now]')?.addEventListener('click', async () => {
        if (!window.kopeykaInstallPrompt) { closeFn(); return; }
        closeFn();
        try {
          window.kopeykaInstallPrompt.prompt();
          const choice = await window.kopeykaInstallPrompt.userChoice;
          window.kopeykaInstallPrompt = null;
          if (choice?.outcome === 'accepted') {
            toast('Копейка установлена', { emoji: '🎉' });
            celebrate(0.8);
          } else {
            toast('Можно установить позже', { emoji: '📲' });
          }
        } catch {
          toast('Не получилось открыть установку', { emoji: '⚠️' });
        }
      });
    }
  });
}

/* ---------- Достижения ---------- */

function achievementGrid(statuses) {
  if (!statuses.length) {
    return `<div class="empty-state" style="padding:28px 20px"><div class="empty-art" style="width:68px;height:68px;border-radius:22px;font-size:32px;margin-bottom:10px">🔒</div><h3 style="font-size:16px">Здесь пока пусто</h3><p style="margin-bottom:0">Продолжай учиться и пользоваться приложением — достижения откроются сами.</p></div>`;
  }
  return `<div class="achievement-grid">
    ${statuses.map(item => `<div class="ach-card ${item.unlocked ? '' : 'locked'}" style="--ach-color:${item.color}">
      <div class="ach-medal">${item.emoji}</div>
      <div class="ach-title">${esc(item.title)}</div>
      <div class="ach-desc">${esc(item.description)}</div>
      <div class="ach-date">${item.unlocked ? `Открыто ${esc(formatDate(new Date(item.date), { day: 'numeric', month: 'short', year: 'numeric' }))}` : 'Ещё не открыто'}</div>
    </div>`).join('')}
  </div>`;
}

export function renderAchievements() {
  const statuses = achievementStatus();
  const unlocked = statuses.filter(item => item.unlocked);
  const locked = statuses.filter(item => !item.unlocked);
  const percentValue = statuses.length ? (unlocked.length / statuses.length) * 100 : 0;

  const html = `<div class="page">
    ${backHead({ title: 'Достижения', subtitle: `${unlocked.length} из ${statuses.length} открыто`, back: '#/profile' })}
    <div class="card card--padded" style="margin-bottom:14px">
      <div class="row row--between" style="margin-bottom:9px">
        <div><div class="small strong">Коллекция</div><div class="tiny tertiary">${percentValue >= 100 ? 'Абсолютно всё собрано!' : 'Открывай новые вместе с прогрессом'}</div></div>
        <span class="chip chip--blue">${Math.round(percentValue)}%</span>
      </div>
      ${progress(percentValue, 'var(--orange)', 8)}
    </div>
    <div class="chip-scroll" style="margin-bottom:14px">
      <button class="chip active" type="button" data-ach-filter="all">Все · ${statuses.length}</button>
      <button class="chip" type="button" data-ach-filter="unlocked">Открыто · ${unlocked.length}</button>
      <button class="chip" type="button" data-ach-filter="locked">Закрыто · ${locked.length}</button>
    </div>
    <div id="achievement-grid">${achievementGrid(statuses)}</div>
    <div class="section" style="margin-top:16px">
      <div class="disclaimer">Достижения открываются автоматически. Некоторые связаны с курсом, другие — с бюджетом, целями и симулятором, который появится в следующих этапах.</div>
    </div>
  </div>`;

  return {
    html,
    mount(root) {
      const grid = root.querySelector('#achievement-grid');
      const chips = root.querySelectorAll('[data-ach-filter]');
      const apply = (filter) => {
        const list = filter === 'unlocked' ? unlocked : filter === 'locked' ? locked : statuses;
        grid.innerHTML = achievementGrid(list);
      };
      chips.forEach(chip => chip.addEventListener('click', () => {
        chips.forEach(other => other.classList.toggle('active', other === chip));
        apply(chip.dataset.achFilter);
      }));
    }
  };
}

/* ---------- Настройки ---------- */

export function renderSettings() {
  const state = store.state;
  const settings = state.settings;
  const version = '1.0 · этап 1';
  const installed = isStandalone();

  const html = `<div class="page">
    ${backHead({ title: 'Настройки', subtitle: 'Всё можно изменить в любой момент', back: '#/profile' })}

    <div class="section">
      ${sectionHead('Внешний вид')}
      <div class="card card--padded stack">
        <div>
          <div class="small strong" style="margin-bottom:7px">Тема</div>
          <div class="segmented" role="tablist" aria-label="Тема оформления">
            ${[['auto', 'Авто'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([value, label]) => `<button type="button" data-theme-set="${value}" class="${settings.theme === value ? 'active' : ''}">${label}</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="currency-select">Валюта</label>
          <select class="select" id="currency-select" data-currency>
            ${Object.entries({ BYN: 'Белорусский рубль', RUB: 'Российский рубль', USD: 'Доллар США', EUR: 'Евро' }).map(([code, label]) => `<option value="${code}" ${settings.currency === code ? 'selected' : ''}>${code} — ${label}</option>`).join('')}
          </select>
        </div>
        <div class="divider" style="margin:0"></div>
        <button class="switch-row" type="button" data-switch="sound" role="switch" aria-checked="${settings.sound}">
          <span class="switch-copy"><span class="switch-title">Звуки</span><span class="switch-sub">Короткий отклик при правильном ответе и действиях</span></span>
          <span class="switch" aria-hidden="true"></span>
        </button>
        <button class="switch-row" type="button" data-switch="haptics" role="switch" aria-checked="${settings.haptics}">
          <span class="switch-copy"><span class="switch-title">Вибрация</span><span class="switch-sub">Тактильный отклик на поддерживаемых устройствах</span></span>
          <span class="switch" aria-hidden="true"></span>
        </button>
      </div>
    </div>

    <div class="section">
      ${sectionHead('Обучение')}
      <div class="card card--padded stack">
        <button class="switch-row" type="button" data-switch="unlockAll" role="switch" aria-checked="${settings.unlockAll}">
          <span class="switch-copy"><span class="switch-title">Свободный доступ к модулям</span><span class="switch-sub">Открыть все доступные модули без прохождения тестов. Полезно для повторения.</span></span>
          <span class="switch" aria-hidden="true"></span>
        </button>
        <div class="divider" style="margin:0"></div>
        <div class="row row--between" style="gap:10px">
          <div><div class="small strong">Прогресс курса</div><div class="tiny tertiary">${state.course.completedLessons.length} из ${allLessons.length} уроков · ${state.course.completedModules.length} модулей сдано</div></div>
          <button class="btn btn--soft btn--sm" type="button" data-nav="#/course">К курсу</button>
        </div>
      </div>
    </div>

    <div class="section">
      ${sectionHead('Напоминание')}
      <div class="card card--padded stack">
        <button class="switch-row" type="button" data-switch="reminder" role="switch" aria-checked="${settings.reminder}">
          <span class="switch-copy"><span class="switch-title">Напоминать заниматься</span><span class="switch-sub">Пока приложение открыто в браузере. Для установленного приложения работает как системное уведомление.</span></span>
          <span class="switch" aria-hidden="true"></span>
        </button>
        <div class="field">
          <label class="field-label" for="reminder-time">Время напоминания</label>
          <input class="input" id="reminder-time" type="time" value="${esc(settings.reminderTime || '19:00')}" data-reminder-time>
        </div>
        <div class="tiny tertiary">Уведомления зависят от разрешения браузера. Если разрешение не выдано, Копейка не сможет напомнить.</div>
      </div>
    </div>

    <div class="section">
      ${sectionHead('Данные')}
      <div class="settings-list">
        <button class="settings-row" type="button" data-export>
          <span class="settings-icon" style="background:var(--green)">${icon('download', 16)}</span>
          <span class="settings-label">Экспорт данных</span>
          <span class="settings-value">JSON</span>
          ${icon('chevron-right', 15, 'chev')}
        </button>
        <button class="settings-row" type="button" data-import>
          <span class="settings-icon" style="background:var(--blue)">${icon('upload', 16)}</span>
          <span class="settings-label">Импорт данных</span>
          <span class="settings-value">${state.meta.lastBackupAt ? 'копия есть' : 'нет копии'}</span>
          ${icon('chevron-right', 15, 'chev')}
        </button>
        <button class="settings-row" type="button" data-install>
          <span class="settings-icon" style="background:var(--purple)">${icon('download', 16)}</span>
          <span class="settings-label">${installed ? 'Приложение установлено' : 'Установить приложение'}</span>
          <span class="settings-value">${installed ? '✓' : 'PWA'}</span>
          ${icon('chevron-right', 15, 'chev')}
        </button>
      </div>
      <input class="file-input" type="file" id="settings-import-file" accept="application/json,.json">
      <div class="tiny tertiary" style="margin:9px 3px 0;line-height:1.45">Резервная копия — единственный способ перенести прогресс на другое устройство. Сохраняй её перед сменой телефона или очисткой браузера.</div>
    </div>

    <div class="section">
      ${sectionHead('О приложении')}
      <div class="card card--padded stack">
        <div class="row" style="gap:12px">
          <div class="icon-badge" style="background:var(--gradient-warm);color:#fff;font-size:24px">К</div>
          <div class="grow"><div class="small strong">Копейка</div><div class="tiny tertiary">Финансовая грамотность на каждый день · ${version}</div></div>
        </div>
        <div class="divider" style="margin:0"></div>
        <div class="row row--between"><span class="small secondary">Уроков в курсе</span><strong>${allLessons.length}</strong></div>
        <div class="row row--between"><span class="small secondary">Терминов в словарике</span><strong>${glossary.length}</strong></div>
        <div class="row row--between"><span class="small secondary">Советов</span><strong>${tips.length}</strong></div>
        <div class="row row--between"><span class="small secondary">Достижений</span><strong>${achievements.length}</strong></div>
        <div class="disclaimer" style="margin-top:2px">Приложение не собирает персональные данные и не отправляет их на сервер. Всё хранится в localStorage браузера. Очистка данных сайта удалит прогресс — сделай резервную копию заранее.</div>
        <button class="btn btn--red btn--wide" type="button" data-reset>Сбросить все данные</button>
      </div>
    </div>
  </div>`;

  return {
    html,
    mount(root) {
      root.querySelectorAll('[data-theme-set]').forEach(btn => btn.addEventListener('click', () => {
        const theme = btn.dataset.themeSet;
        store.setSetting('theme', theme);
        document.documentElement.dataset.theme = theme;
        root.querySelectorAll('[data-theme-set]').forEach(other => other.classList.toggle('active', other === btn));
        toast(theme === 'auto' ? 'Тема следует за системой' : 'Тема изменена', { emoji: theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🎨' });
      }));

      root.querySelector('[data-currency]')?.addEventListener('change', (event) => {
        store.setSetting('currency', event.target.value);
        toast(`Валюта: ${event.target.value}`, { emoji: '💱' });
      });

      root.querySelectorAll('[data-switch]').forEach(btn => btn.addEventListener('click', async () => {
        const key = btn.dataset.switch;
        const next = btn.getAttribute('aria-checked') !== 'true';
        if (key === 'reminder' && next) {
          if (!('Notification' in window)) {
            toast('Браузер не поддерживает уведомления', { emoji: '🔕' });
            return;
          }
          let permission = Notification.permission;
          if (permission === 'default') {
            try { permission = await Notification.requestPermission(); } catch { permission = 'denied'; }
          }
          if (permission !== 'granted') {
            toast('Разреши уведомления в настройках браузера', { emoji: '🔕' });
            return;
          }
        }
        store.setSetting(key, next);
        btn.setAttribute('aria-checked', String(next));
        playSound('tap');
      }));

      root.querySelector('[data-reminder-time]')?.addEventListener('change', (event) => {
        store.setSetting('reminderTime', event.target.value || '19:00');
        toast('Время напоминания сохранено', { emoji: '⏰' });
      });

      root.querySelector('[data-export]')?.addEventListener('click', downloadBackup);
      root.querySelector('[data-import]')?.addEventListener('click', () => root.querySelector('#settings-import-file')?.click());
      root.querySelector('#settings-import-file')?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const ok = await confirmSheet({
          title: 'Импортировать данные?',
          text: 'Текущие данные будут заменены содержимым файла. Сначала лучше сделать экспорт.',
          iconName: 'upload',
          confirmLabel: 'Импортировать',
          danger: true
        });
        if (!ok) { event.target.value = ''; return; }
        try {
          const text = await file.text();
          store.importData(text);
          toast('Данные импортированы', { emoji: '📥' });
          window.dispatchEvent(new CustomEvent('kopeyka:rerender'));
        } catch {
          toast('Не удалось прочитать файл', { emoji: '⚠️' });
        }
        event.target.value = '';
      });

      root.querySelectorAll('[data-install]').forEach(btn => btn.addEventListener('click', openInstallSheet));
      root.querySelector('[data-reset]')?.addEventListener('click', resetEverything);
    }
  };
}

function downloadBackup() {
  try {
    const raw = store.exportData();
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kopeyka-backup-${todayKey()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Резервная копия сохранена', { emoji: '💾' });
  } catch {
    toast('Не удалось создать копию', { emoji: '⚠️' });
  }
}

async function resetEverything() {
  const ok = await confirmSheet({
    title: 'Сбросить все данные?',
    text: 'Удалятся прогресс курса, бюджет, списки покупок, цели и достижения. Это действие нельзя отменить.',
    iconName: 'trash',
    confirmLabel: 'Сбросить всё',
    danger: true
  });
  if (!ok) return;
  store.resetAll();
  document.documentElement.dataset.theme = 'auto';
  toast('Данные сброшены. Начинаем с чистого листа', { emoji: '🧹' });
  location.hash = '#/home';
  window.dispatchEvent(new CustomEvent('kopeyka:rerender'));
}
