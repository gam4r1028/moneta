/* Главный экран: короткий срез всего важного за день. */
import { store } from '../store.js';
import { allLessons, getLesson, getModule, getLessonWithModule } from '../data/course.js';
import { tipOfTheDay } from '../data/tips.js';
import { formatFullDate, formatMoney, formatMonth, timeGreeting, todayKey, monthKey, sum, percent, getLevel, CURRENCIES } from '../utils.js';
import { icon } from './icons.js';
import { ring, pageHead, progress, sectionHead } from './components.js';
import { openTransactionSheet } from './forms.js';

function weekXP() {
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    total += Number(store.state.activity[key]?.xp || 0);
  }
  return total;
}

export function renderHome() {
  const state = store.state;
  const currency = state.settings.currency;
  const name = state.profile.name ? state.profile.name.split(' ')[0] : '';
  const course = store.getCourseProgress();
  const next = store.getNextLesson();
  const nextModule = next ? getModule(next.moduleId) : null;
  const month = monthKey();
  const summary = store.getMonthSummary(month);
  const level = getLevel(state.profile.xp);
  const tip = tipOfTheDay();
  const week = weekXP();
  const goalsTotal = state.budget.goals.length;
  const goalsDone = state.budget.goals.filter(g => g.completed).length;
  const goalsPercent = goalsTotal ? (goalsDone / goalsTotal) * 100 : 0;
  const recent = state.budget.transactions.slice(0, 3);
  const isComplete = next && store.isLessonComplete(next.id) && course.completed >= course.total;
  const ringValue = course.percent;
  const sym = CURRENCIES[currency]?.symbol || currency;
  const dateLine = formatFullDate();
  const monthLabel = formatMonth(Number(month.split('-')[1]) - 1, Number(month.split('-')[0]));

  const html = `<div class="page">
    ${pageHead({
      title: `${escGreeting(timeGreeting())}${name ? `, ${escapeName(name)}` : ''} <span class="wave">👋</span>`,
      subtitle: dateLine,
      actions: `<span class="streak-pill ${state.profile.streak >= 3 ? 'is-hot' : ''}" title="Серия дней">${icon('flame', 16)} ${state.profile.streak} ${pluralDays(state.profile.streak)}</span>`
    })}

    <a class="continue-card" href="#/course/lesson/${next ? next.id : ''}" aria-label="Продолжить обучение">
      <div class="continue-top">
        <div class="grow">
          <div class="continue-kicker">${course.completed ? 'Продолжить обучение' : 'Начать обучение'}${nextModule ? ` · Модуль ${nextModule.id}` : ''}</div>
          <div class="continue-title">${next ? escapeName(next.title) : 'Ты прошёл весь доступный курс'}</div>
          <div class="continue-meta">
            <span>${icon('clock', 13)} ${next ? `${next.minutes} мин` : 'Отдых заслужен'}</span>
            <span>·</span>
            <span>${course.completed} из ${course.total} уроков</span>
          </div>
        </div>
        ${ring({ value: ringValue, size: 78, stroke: 8, color: '#ffffff', track: 'rgba(255,255,255,.22)', label: `${Math.round(ringValue)}%`, className: 'ring-hero', textFill: '#ffffff' })}
      </div>
      <div class="continue-bottom">
        <span class="continue-cta">${course.completed ? 'Продолжить' : 'Первый урок'} ${icon('arrow-right', 15)}</span>
        <span style="font-size:11px;opacity:.7;font-weight:600">Уровень: ${level.name}</span>
      </div>
    </a>

    <div class="section" style="margin-top:22px">
      <div class="summary-card card">
        <div class="summary-head">
          <div class="summary-title">${monthLabel}</div>
          <a href="#/budget" class="section-link" style="font-size:12px">Весь бюджет ${icon('chevron-right', 13)}</a>
        </div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label"><span class="dot" style="color:var(--green)"></span>Доходы</div>
            <div class="summary-amount text-green" title="${formatMoney(summary.income, currency)}">${formatMoney(summary.income, currency)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label"><span class="dot" style="color:var(--red)"></span>Расходы</div>
            <div class="summary-amount" title="${formatMoney(summary.expenses, currency)}">${formatMoney(summary.expenses, currency)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label"><span class="dot" style="color:var(--blue)"></span>Остаток</div>
            <div class="summary-amount ${summary.balance < 0 ? 'text-red' : ''}" title="${formatMoney(summary.balance, currency)}">${formatMoney(summary.balance, currency)}</div>
          </div>
        </div>
        <div class="summary-bar" aria-hidden="true">
          <span style="width:${Math.min(100, percent(summary.expenses, Math.max(summary.income, 1)))}%;background:linear-gradient(90deg,var(--orange),var(--red))"></span>
        </div>
        <div class="row row--between" style="margin-top:7px">
          <span class="tiny tertiary">${summary.txs.length ? `Расходы — ${Math.round(percent(summary.expenses, Math.max(summary.income, 1)))}% дохода месяца` : 'Пока нет операций'}</span>
          <button class="section-link tiny" style="font-size:11px" type="button" data-action="add-expense">+ Добавить</button>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="quick-grid">
        <button class="quick-action" type="button" data-action="add-expense">
          <span class="q-icon">${icon('plus', 22)}</span>
          <span class="quick-label">Добавить<br>расход</span>
        </button>
        <a class="quick-action" href="#/shopping?new=1">
          <span class="q-icon">${icon('cart', 22)}</span>
          <span class="quick-label">Новый список<br>покупок</span>
        </a>
        <a class="quick-action" href="#/calculators">
          <span class="q-icon">${icon('calc', 22)}</span>
          <span class="quick-label">Кальку-<br>ляторы</span>
        </a>
      </div>
    </div>

    <div class="section">
      <div class="tip-card card">
        <div class="tip-icon">${icon('lightbulb', 22)}</div>
        <div>
          <div class="tip-kicker">Совет дня · ${tip.tag}</div>
          <div class="tip-text">${escapeText(tip.text)}</div>
        </div>
      </div>
    </div>

    <div class="section">
      ${sectionHead('Твой прогресс', 'Подробнее', 'data-nav="#/profile"')}
      <div class="card mini-rings">
        <div class="mini-ring-item">
          <div class="mini-ring">${ring({ value: course.percent, size: 68, stroke: 7, color: 'var(--blue)', label: `${course.completed}/${course.total}`, textFill: 'var(--label)' })}</div>
          <div class="mini-label">Уроки<br>курса</div>
          <div class="mini-value">${Math.round(course.percent)}%</div>
        </div>
        <div class="mini-ring-item">
          <div class="mini-ring">${ring({ value: Math.min(100, week), size: 68, stroke: 7, color: 'var(--green)', label: `${week}`, sub: 'XP' })}</div>
          <div class="mini-label">XP<br>за неделю</div>
          <div class="mini-value">цель 100</div>
        </div>
        <div class="mini-ring-item">
          <div class="mini-ring">${ring({ value: goalsPercent, size: 68, stroke: 7, color: 'var(--orange)', label: `${goalsDone}/${goalsTotal || '—'}` })}</div>
          <div class="mini-label">Цели<br>выполнены</div>
          <div class="mini-value">${goalsTotal ? `${Math.round(goalsPercent)}%` : 'создай цель'}</div>
        </div>
      </div>
    </div>

    ${recent.length ? `<div class="section">
      ${sectionHead('Последние операции', 'Все', 'data-nav="#/budget"')}
      <div class="card card--tight">
        ${recent.map(tx => `<div class="recent-row">
          <div class="icon-badge icon-badge--sm icon-badge--soft" style="color:${tx.type === 'income' ? 'var(--green)' : 'var(--red)'}">${icon(tx.type === 'income' ? 'arrow-down-left' : 'arrow-up-right', 16)}</div>
          <div class="grow"><div class="small strong">${escapeName(tx.note || tx.category)}</div><div class="tiny tertiary">${escapeName(tx.category)}</div></div>
          <div class="recent-amount ${tx.type === 'income' ? 'text-green' : ''}">${tx.type === 'income' ? '+' : '−'}${formatMoney(tx.amount, currency)}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <div class="section">
      <div class="card card--tight row" style="gap:13px;padding:15px 17px">
        <div class="icon-badge icon-badge--soft" style="color:var(--purple)">${icon('sparkles', 20)}</div>
        <div class="grow">
          <div class="small strong">${next ? escapeName(getModule(next.moduleId)?.title || 'Курс') : 'Курс'}</div>
          <div class="tiny tertiary">${course.minutesLeft ? `Осталось примерно ${formatMinutes(course.minutesLeft)} чтения и практики` : 'Все доступные уроки пройдены — отличная работа!'}</div>
        </div>
        <a class="chip chip--blue" href="#/course" style="color:var(--blue);background:color-mix(in srgb,var(--blue) 10%,transparent)">Курс</a>
      </div>
    </div>
  </div>`;

  return {
    html,
    mount(root) {
      const refresh = () => window.dispatchEvent(new CustomEvent('kopeyka:rerender'));
      root.querySelector('[data-action="add-expense"]')?.addEventListener('click', () => {
        openTransactionSheet({ type: 'expense', onSaved: refresh });
      });
      // Если на главной появился запрос ?add=expense — открываем форму.
      const query = new URLSearchParams(location.hash.split('?')[1] || '');
      if (query.get('add') === 'expense') openTransactionSheet({ type: 'expense', onSaved: refresh });
    }
  };
}

function escGreeting(s) { return escapeText(s); }
function escapeText(s) {
  return String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
function escapeName(s) { return escapeText(s); }
function pluralDays(n) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
}
function formatMinutes(min) {
  if (min < 60) return `${min} мин`;
  return `${Math.floor(min / 60)} ч ${min % 60} мин`;
}
