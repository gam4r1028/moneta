/* Бюджет: месяц, диаграммы, лимиты, цели, подписки, экспорт и импорт. */
import { store, BUDGET_CATEGORIES } from '../store.js';
import {
  esc, formatMoney, formatCompact, formatDate, formatDateShort, todayKey, monthKey,
  addMonths, formatMonth, MONTHS_NOM, sum, percent, getLevel, CURRENCIES
} from '../utils.js';
import { icon } from './icons.js';
import {
  pageHead, backHead, ring, progress, emptyState, openSheet, toast, celebrate,
  playSound, confirmSheet, sectionHead
} from './components.js';
import { openTransactionSheet, openGoalSheet } from './forms.js';

function money(v) { return formatMoney(v, store.state.settings.currency); }

function donut(byCategory, total, currency) {
  const size = 136, stroke = 16, r = (size - stroke - 4) / 2, c = 2 * Math.PI * r;
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  let offset = 0;
  const segments = entries.length ? entries.map(([cat, amount]) => {
    const share = total ? amount / total : 0;
    const dash = share * c;
    const color = BUDGET_CATEGORIES.expense[cat]?.color || '#8E8E93';
    const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"
      transform="rotate(-90 ${size / 2} ${size / 2})" stroke-linecap="butt"><title>${esc(cat)}: ${formatMoney(amount, currency)}</title></circle>`;
    offset += dash;
    return el;
  }).join('') : `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--fill)" stroke-width="${stroke}"/>`;
  return `<svg class="donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Расходы по категориям">
    ${segments}
    <text x="50%" y="46%" text-anchor="middle" class="donut-center-value">${esc(formatCompact(total, currency))}</text>
    <text x="50%" y="56%" text-anchor="middle" class="donut-center-label">расходы</text>
  </svg>`;
}

function dailyBars(days, currency) {
  const max = Math.max(1, ...days.map(d => d.amount));
  const width = 340, height = 92, padBottom = 13;
  const barW = Math.max(3, (width - 8) / days.length - 2.3);
  return `<div class="bar-chart">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Расходы по дням месяца">
      <line x1="0" y1="${height - padBottom}" x2="${width}" y2="${height - padBottom}" class="grid-line"/>
      ${days.map((d, i) => {
        const h = d.amount ? Math.max(3, (d.amount / max) * (height - padBottom - 8)) : 2;
        const x = 4 + i * ((width - 8) / days.length);
        return `<rect class="bar" x="${x.toFixed(1)}" y="${(height - padBottom - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="1.8" style="${d.amount ? '' : 'opacity:.18'}"><title>${d.day}: ${formatMoney(d.amount, currency)}</title></rect>`;
      }).join('')}
      ${days.map((d, i) => d.day % 5 === 0 || d.day === 1 ? `<text x="${(4 + i * ((width - 8) / days.length) + barW / 2).toFixed(1)}" y="${height - 2}" text-anchor="middle" class="bar-label">${d.day}</text>` : '').join('')}
    </svg>
    <div class="tiny tertiary" style="padding:3px 5px 0">Максимальный день: ${formatMoney(max === 1 && !days.some(d => d.amount) ? 0 : max, currency)}</div>
  </div>`;
}

export function renderBudget({ query } = {}) {
  const now = new Date();
  const requested = query?.get?.('m');
  const selectedMonth = /^\d{4}-\d{2}$/.test(requested || '') ? requested : monthKey(now);
  const [year, month] = selectedMonth.split('-').map(Number);
  const summary = store.getMonthSummary(selectedMonth);
  const days = store.getDailyExpenses(selectedMonth);
  const currency = store.state.settings.currency;
  const limits = store.state.budget.limits;
  const goals = store.state.budget.goals;
  const subs = store.state.budget.subscriptions;
  const monthName = formatMonth(month - 1, year);
  const canNext = selectedMonth < monthKey(now) || true;
  const catEntries = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);
  const maxLegend = catEntries.slice(0, 5);

  // 50/30/20 на основе фактических расходов месяца
  const needSpent = catEntries.filter(([c]) => BUDGET_CATEGORIES.expense[c]?.group === 'need').reduce((a, x) => a + x[1], 0);
  const wantSpent = catEntries.filter(([c]) => BUDGET_CATEGORIES.expense[c]?.group === 'want').reduce((a, x) => a + x[1], 0);
  const income = summary.income;
  const saving = Math.max(0, income - summary.expenses);
  const ruleBase = Math.max(income, summary.expenses, 1);
  const pNeed = percent(needSpent, ruleBase);
  const pWant = percent(wantSpent, ruleBase);
  const pSave = percent(saving, ruleBase);
  const norm = Math.max(1, pNeed + pWant + pSave);
  const widthNeed = (pNeed / norm) * 100, widthWant = (pWant / norm) * 100, widthSave = (pSave / norm) * 100;

  const monthlySubs = sum(subs, s => s.period === 'year' ? s.amount / 12 : s.amount);
  const annualSubs = sum(subs, s => s.period === 'year' ? s.amount : s.amount * 12);
  const subsShare = income ? Math.round(percent(monthlySubs, income)) : 0;

  const prevMonth = formatMonth(addMonths(new Date(year, month - 1, 1), -1).getMonth(), addMonths(new Date(year, month - 1, 1), -1).getFullYear());
  const nextMonth = addMonths(new Date(year, month - 1, 1), 1);
  const prevKey = monthKey(addMonths(new Date(year, month - 1, 1), -1));
  const nextKey = monthKey(nextMonth);

  const html = `<div class="page">
    ${pageHead({
      eyebrow: 'Деньги под контролем',
      title: 'Бюджет',
      subtitle: 'Доходы, расходы и цели — в одном месте',
      actions: `<button class="icon-btn icon-btn--accent" type="button" data-add-expense aria-label="Добавить операцию">${icon('plus', 21)}</button>`
    })}

    <div class="budget-hero card" style="margin-bottom:14px">
      <div class="budget-month">
        <div>
          <div class="budget-total-label">Остаток за месяц</div>
          <div class="budget-total ${summary.balance < 0 ? 'text-red' : ''}">${money(summary.balance)}</div>
        </div>
        <div class="month-nav">
          <a class="icon-btn" href="#/budget?m=${prevKey}" aria-label="Предыдущий месяц">${icon('chevron-left', 18)}</a>
          <span class="month-title" style="font-size:13px;text-align:center;min-width:105px">${monthName}</span>
          <a class="icon-btn" href="#/budget?m=${nextKey}" aria-label="Следующий месяц">${icon('chevron-right', 18)}</a>
        </div>
      </div>
      <div class="budget-subgrid">
        <div class="budget-sub"><div class="label">Доходы</div><div class="value text-green">+ ${money(summary.income)}</div></div>
        <div class="budget-sub"><div class="label">Расходы</div><div class="value">− ${money(summary.expenses)}</div></div>
      </div>
      <div class="btn-row" style="margin-top:13px">
        <button class="btn btn--soft" type="button" data-add-expense>${icon('plus', 16)} Расход</button>
        <button class="btn btn--soft" type="button" data-add-income>${icon('arrow-down-left', 16)} Доход</button>
      </div>
    </div>

    <div class="card card--padded" style="margin-bottom:14px">
      <div class="row row--between" style="margin-bottom:13px">
        <span class="section-title" style="font-size:15px">Структура расходов</span>
        <span class="tiny tertiary">${summary.expenses ? `${catEntries.length} ${plural(catEntries.length, 'категория', 'категории', 'категорий')}` : ''}</span>
      </div>
      ${summary.expenses ? `<div class="donut-wrap">
        ${donut(summary.byCategory, summary.expenses, currency)}
        <div class="legend">
          ${maxLegend.map(([cat, amount]) => `<div class="legend-row"><span class="legend-dot" style="background:${BUDGET_CATEGORIES.expense[cat]?.color || '#8E8E93'}"></span><span class="legend-name">${esc(cat)}</span><span class="legend-value">${Math.round(percent(amount, summary.expenses))}%</span></div>`).join('')}
        </div>
      </div>` : `<div class="row" style="gap:13px;padding:4px 0 2px">
        <div class="icon-badge icon-badge--soft" style="color:var(--blue)">${icon('pie', 20)}</div>
        <div class="grow"><div class="small strong">Пока нет расходов</div><div class="tiny tertiary">Добавь первый расход — здесь появится круговая диаграмма.</div></div>
      </div>`}
      ${dailyBars(days, currency)}
    </div>

    <div class="card rule-card" style="margin-bottom:14px">
      <div class="row row--between">
        <span class="section-title" style="font-size:15px">Правило 50/30/20</span>
        <span class="tiny tertiary">${income ? 'от доходов месяца' : 'добавь доход для точности'}</span>
      </div>
      <div class="rule-bar">
        <span style="width:${widthNeed}%;background:var(--green)">${widthNeed > 13 ? `50% · ${Math.round(pNeed)}%` : ''}</span>
        <span style="width:${widthWant}%;background:var(--orange)">${widthWant > 13 ? `30% · ${Math.round(pWant)}%` : ''}</span>
        <span style="width:${widthSave}%;background:var(--blue)">${widthSave > 13 ? `20% · ${Math.round(pSave)}%` : ''}</span>
      </div>
      <div class="rule-legend">
        <div><strong>${money(needSpent)}</strong>необходимое</div>
        <div style="text-align:center"><strong>${money(wantSpent)}</strong>желания</div>
        <div style="text-align:right"><strong>${money(saving)}</strong>в остатке</div>
      </div>
      <div class="tiny tertiary" style="margin-top:10px">${income ? (pSave < 20 ? 'Остаток меньше 20% — есть куда расти. Начни с 5–10% и двигайся постепенно.' : 'Ты оставляешь 20% или больше — отличный баланс. Направь остаток в цель или подушку.') : 'Правило считается от дохода. Добавь доходы за месяц, чтобы увидеть реальную картину.'}</div>
    </div>

    <div class="section">
      ${sectionHead('Лимиты по категориям', 'Настроить', 'data-limit')}
      <div class="card card--padded" style="padding:8px 17px" id="limits-section">
        ${Object.keys(limits).filter(k => Number(limits[k]) > 0).length ? Object.entries(limits).filter(([, v]) => Number(v) > 0).map(([cat, limit]) => {
          const spent = summary.byCategory[cat] || 0;
          const p = percent(spent, limit);
          const over = spent > limit;
          return `<button class="limit-row" type="button" data-limit-cat="${esc(cat)}" style="width:100%;text-align:left;border:0;background:none;color:var(--label)">
            <div class="limit-top"><span class="lim-name"><span class="dot" style="color:${BUDGET_CATEGORIES.expense[cat]?.color || 'var(--blue)'}"></span>${esc(cat)}</span><span class="lim-nums ${over ? 'text-red' : ''}">${money(spent)} / ${money(limit)}</span></div>
            ${progress(p, over ? 'var(--red)' : p > 80 ? 'var(--orange)' : BUDGET_CATEGORIES.expense[cat]?.color || 'var(--blue)', 5)}
            ${over ? `<div class="tiny text-red" style="margin-top:4px">Перебор ${money(spent - limit)}</div>` : ''}
          </button>`;
        }).join('') : `<div class="empty-mini" style="padding:12px 0 15px">
          <div class="row" style="gap:12px"><div class="icon-badge icon-badge--soft" style="color:var(--green)">${icon('target', 20)}</div>
          <div class="grow"><div class="small strong">Поставь первые лимиты</div><div class="tiny tertiary">Например, на продукты, кафе и развлечения.</div></div></div>
          <button class="btn btn--soft btn--wide" type="button" data-limit style="margin-top:11px">Добавить лимит</button>
        </div>`}
      </div>
    </div>

    <div class="section">
      ${sectionHead('Цели накопления', 'Новая цель', 'data-new-goal')}
      ${goals.length ? goals.map(goal => goalCard(goal, currency)).join('') : `<div class="empty-state" style="padding:25px 20px">
        <div class="empty-art" style="width:68px;height:68px;border-radius:22px;font-size:32px;margin-bottom:10px">🎯</div>
        <h3 style="font-size:16px">Копи с смыслом</h3>
        <p style="margin-bottom:13px">Создай цель — на поездку, технику или подушку безопасности.</p>
        <button class="btn btn--soft" type="button" data-new-goal>Создать цель</button>
      </div>`}
    </div>

    <div class="section">
      ${sectionHead('Подписки и регулярные платежи', 'Добавить', 'data-new-sub')}
      <div class="card card--padded" style="padding:9px 17px">
        ${subs.length ? `${subs.map(sub => `<div class="sub-row">
          <div class="sub-icon">${icon('credit-card', 18)}</div>
          <div class="grow"><div class="sub-name">${esc(sub.name)}</div><div class="sub-meta">${sub.period === 'year' ? 'раз в год' : 'каждый месяц'}${sub.nextDate ? ` · след. ${formatDate(sub.nextDate)}` : ''}</div></div>
          <div class="sub-price">${money(sub.amount)}<small>${sub.period === 'year' ? 'в год' : 'в месяц'}</small></div>
          <button class="icon-btn icon-btn--sm" type="button" data-del-sub="${sub.id}" aria-label="Удалить подписку">${icon('trash', 14)}</button>
        </div>`).join('')}
        <div class="row row--between" style="padding:12px 0 6px;border-top:1px solid var(--separator);margin-top:4px">
          <span class="small secondary">Всего в месяц</span><strong>${money(monthlySubs)}</strong>
        </div>
        <div class="row row--between" style="padding:2px 0 7px"><span class="small secondary">За год</span><strong>${money(annualSubs)}</strong></div>
        ${subsShare >= 10 ? `<div class="smart-tip" style="margin-bottom:7px">${icon('alert', 16, 'tip-bulb')}<span><strong>Подписки съедают ${subsShare}% дохода.</strong> Проверь, чем реально пользуешься.</span></div>` : ''}` : `<div class="row" style="gap:12px;padding:12px 0 15px"><div class="icon-badge icon-badge--soft" style="color:var(--purple)">${icon('credit-card', 20)}</div><div class="grow"><div class="small strong">Подписки незаметны</div><div class="tiny tertiary">Добавь их, чтобы увидеть, сколько они стоят в год.</div></div></div>`}
      </div>
    </div>

    <div class="section">
      ${sectionHead('Операции месяца', summary.txs.length ? `${summary.txs.length}` : '')}
      ${summary.txs.length ? `<div class="card card--padded" style="padding:5px 16px">${summary.txs.slice(0, 15).map(tx => transactionRow(tx, currency)).join('')}</div>` : `<div class="card card--padded" style="text-align:center;padding:24px 18px"><div style="font-size:30px;margin-bottom:5px">🧾</div><div class="small strong">Пока нет операций</div><div class="tiny tertiary" style="margin:3px 0 11px">Добавь доход или расход — бюджет оживёт.</div><button class="btn btn--soft btn--sm" type="button" data-add-expense>Добавить операцию</button></div>`}
    </div>

    <div class="section">
      <div class="settings-list">
        <button class="settings-row" type="button" data-export><span class="settings-icon" style="background:var(--green)">${icon('download', 16)}</span><span class="settings-label">Экспорт данных</span><span class="settings-value">JSON</span>${icon('chevron-right', 15, 'chev')}</button>
        <button class="settings-row" type="button" data-import><span class="settings-icon" style="background:var(--blue)">${icon('upload', 16)}</span><span class="settings-label">Импорт данных</span><span class="settings-value">${store.state.meta.lastBackupAt ? 'есть копия' : 'нет копии'}</span>${icon('chevron-right', 15, 'chev')}</button>
      </div>
      <input class="file-input" type="file" id="import-file" accept="application/json,.json">
      <div class="tiny tertiary" style="text-align:center;margin-top:9px">Резервная копия хранится только у тебя. Регулярно сохраняй её перед сменой телефона.</div>
    </div>
  </div>`;

  return {
    html,
    mount(root, ctx = {}) {
      root.querySelectorAll('[data-add-expense]').forEach(btn => btn.addEventListener('click', () => openTransactionSheet({ type: 'expense', onSaved: rerender })));
      root.querySelectorAll('[data-add-income]').forEach(btn => btn.addEventListener('click', () => openTransactionSheet({ type: 'income', onSaved: rerender })));
      root.querySelectorAll('[data-limit]').forEach(btn => btn.addEventListener('click', () => openLimitSheet()));
      root.querySelectorAll('[data-limit-cat]').forEach(btn => btn.addEventListener('click', () => openLimitSheet(btn.dataset.limitCat)));
      root.querySelectorAll('[data-new-goal]').forEach(btn => btn.addEventListener('click', () => openGoalSheet({ onSaved: rerender })));
      root.querySelectorAll('[data-goal-deposit]').forEach(btn => btn.addEventListener('click', () => {
        const goal = goals.find(g => g.id === btn.dataset.goalDeposit);
        if (goal) openDepositSheet(goal);
      }));
      root.querySelectorAll('[data-goal-menu]').forEach(btn => btn.addEventListener('click', () => {
        const goal = goals.find(g => g.id === btn.dataset.goalMenu);
        if (goal) openGoalActions(goal);
      }));
      root.querySelectorAll('[data-new-sub]').forEach(btn => btn.addEventListener('click', () => openSubscriptionSheet()));
      root.querySelectorAll('[data-del-sub]').forEach(btn => btn.addEventListener('click', async () => {
        const sub = subs.find(s => s.id === btn.dataset.delSub);
        if (!sub) return;
        const ok = await confirmSheet({ title: 'Удалить подписку?', text: `«${sub.name}» больше не будет учитываться.`, iconName: 'trash', confirmLabel: 'Удалить', danger: true });
        if (ok) { store.removeSubscription(sub.id); toast('Подписка удалена', { emoji: '🗑️' }); rerender(); }
      }));
      root.querySelectorAll('[data-tx-menu]').forEach(btn => btn.addEventListener('click', () => {
        const tx = summary.txs.find(t => t.id === btn.dataset.txMenu);
        if (tx) openTransactionActions(tx);
      }));

      root.querySelector('[data-export]')?.addEventListener('click', exportBackup);
      root.querySelector('[data-import]')?.addEventListener('click', () => root.querySelector('#import-file')?.click());
      root.querySelector('#import-file')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ok = await confirmSheet({
          title: 'Импортировать данные?',
          text: 'Текущие данные будут заменены содержимым файла. Сначала лучше сделать экспорт.',
          iconName: 'upload', confirmLabel: 'Импортировать', danger: true
        });
        if (!ok) { e.target.value = ''; return; }
        try {
          const text = await file.text();
          store.importData(text);
          toast('Данные импортированы', { emoji: '📥' });
          rerender();
        } catch (err) {
          toast('Не удалось прочитать файл', { emoji: '⚠️' });
        }
        e.target.value = '';
      });

      const q = ctx.query || query;
      if (q?.get?.('add') === 'expense') {
        history.replaceState(null, '', `#/budget${q.get('m') ? `?m=${q.get('m')}` : ''}`);
        openTransactionSheet({ type: 'expense', onSaved: rerender });
      }
      if (q?.get?.('add') === 'income') {
        history.replaceState(null, '', `#/budget${q.get('m') ? `?m=${q.get('m')}` : ''}`);
        openTransactionSheet({ type: 'income', onSaved: rerender });
      }
      if (q?.get?.('goal') === '1') {
        history.replaceState(null, '', '#/budget');
        openGoalSheet({ onSaved: rerender });
      }
      if (q?.get?.('limits') === '1') {
        history.replaceState(null, '', '#/budget');
        openLimitSheet();
      }
    }
  };
}

function goalCard(goal, currency) {
  const p = percent(goal.saved, goal.target);
  const monthsLeft = goal.deadline ? Math.max(1, Math.ceil((new Date(goal.deadline) - new Date()) / (86400000 * 30.4))) : null;
  const monthlyNeed = monthsLeft ? Math.max(0, (goal.target - goal.saved) / monthsLeft) : null;
  const left = Math.max(0, goal.target - goal.saved);
  return `<div class="goal-card" style="--goal-color:${goal.color || 'var(--blue)'};${goal.completed ? 'opacity:.82' : ''}">
    <div class="goal-top">
      <div class="goal-icon">${goal.completed ? '🏆' : (goal.emoji || '🎯')}</div>
      <div class="grow"><div class="goal-name">${esc(goal.name)} ${goal.completed ? '· достигнута' : ''}</div>
        <div class="goal-meta">${goal.deadline ? `до ${formatDate(goal.deadline)}` : 'без срока'}${monthlyNeed && !goal.completed ? ` · ~${money(monthlyNeed)}/мес` : ''}</div>
      </div>
      <button class="icon-btn icon-btn--sm" type="button" data-goal-menu="${goal.id}" aria-label="Действия с целью">${icon('more', 16)}</button>
    </div>
    <div class="goal-amounts"><span><strong>${money(goal.saved)}</strong> из ${money(goal.target)}</span><span>${left ? `осталось ${money(left)}` : 'готово'}</span></div>
    <div style="margin-top:7px">${progress(p, goal.completed ? 'var(--green)' : (goal.color || 'var(--blue)'), 7)}</div>
    ${!goal.completed ? `<div class="goal-actions"><button class="btn btn--sm btn--soft" type="button" data-goal-deposit="${goal.id}">${icon('plus', 15)} Пополнить</button><span class="tiny tertiary" style="align-self:center">${Math.round(p)}%</span></div>` : ''}
  </div>`;
}

function transactionRow(tx, currency) {
  const cat = BUDGET_CATEGORIES[tx.type]?.[tx.category];
  return `<div class="transaction-row">
    <div class="transaction-icon" style="color:${cat?.color || 'var(--label-secondary)'}">${icon(cat?.icon || (tx.type === 'income' ? 'arrow-down-left' : 'arrow-up-right'), 17)}</div>
    <div class="grow"><div class="transaction-name">${esc(tx.note || tx.category)}</div><div class="transaction-meta">${esc(tx.category)} · ${formatDateShort(tx.date)}</div></div>
    <div class="transaction-amount ${tx.type === 'income' ? 'text-green' : ''}">${tx.type === 'income' ? '+' : '−'}${money(tx.amount)}</div>
    <button class="icon-btn icon-btn--sm" style="background:transparent;width:27px;height:27px" type="button" data-tx-menu="${tx.id}" aria-label="Действия с операцией">${icon('more', 15)}</button>
  </div>`;
}

function openLimitSheet(preset = '') {
  const limits = store.state.budget.limits;
  const categories = Object.keys(BUDGET_CATEGORIES.expense);
  const { body } = openSheet({
    title: 'Лимит на категорию',
    subtitle: 'Лимит — это ориентир, а не запрет. Он помогает заметить перерасход раньше.',
    body: `<form id="limit-form">
      <div class="field" style="margin-bottom:12px">
        <label class="field-label" for="limit-cat">Категория</label>
        <select class="select" id="limit-cat" name="category">${categories.map(c => `<option ${c === preset ? 'selected' : ''}>${c}</option>`).join('')}</select>
      </div>
      <div class="field" style="margin-bottom:12px">
        <label class="field-label" for="limit-amount">Лимит на месяц</label>
        <div class="input-group"><input class="input" id="limit-amount" name="amount" type="number" min="1" step="1" inputmode="decimal" value="${limits[preset] || ''}" placeholder="Например, 250"><span class="input-suffix">${CURRENCIES[store.state.settings.currency]?.symbol || 'BYN'}</span></div>
      </div>
      <div class="form-actions">
        ${preset && limits[preset] ? `<button class="btn btn--secondary" type="button" data-remove-limit>Убрать</button>` : `<button class="btn btn--secondary" type="button" data-sheet-close>Отмена</button>`}
        <button class="btn" type="submit">Сохранить</button>
      </div>
    </form>`,
    onMount(bodyEl, close) {
      const select = bodyEl.querySelector('#limit-cat');
      select.addEventListener('change', () => {
        bodyEl.querySelector('#limit-amount').value = limits[select.value] || '';
        const removeBtn = bodyEl.querySelector('[data-remove-limit]');
        if (removeBtn) removeBtn.classList.toggle('hidden', !limits[select.value]);
      });
      bodyEl.querySelector('#limit-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const amount = Number(fd.get('amount'));
        if (!amount || amount <= 0) { toast('Введи сумму лимита', { emoji: '⚠️' }); return; }
        store.setLimit(fd.get('category'), amount);
        close(); toast('Лимит сохранён', { emoji: '🎯' }); playSound('success'); rerender();
      });
      bodyEl.querySelector('[data-remove-limit]')?.addEventListener('click', () => {
        store.setLimit(select.value, 0);
        close(); toast('Лимит убран', { emoji: '✅' }); rerender();
      });
    }
  });
}

function openDepositSheet(goal) {
  const monthly = goal.deadline ? Math.max(1, Math.ceil((goal.target - goal.saved) / Math.max(1, Math.ceil((new Date(goal.deadline) - new Date()) / (86400000 * 30.4))))) : 100;
  const { body } = openSheet({
    title: 'Пополнить цель',
    subtitle: `${goal.name}. Осталось ${money(Math.max(0, goal.target - goal.saved))}.`,
    body: `<form id="deposit-form">
      <div class="field" style="margin-bottom:12px">
        <label class="field-label" for="deposit-amount">Сумма пополнения</label>
        <div class="input-group"><input class="input" id="deposit-amount" name="amount" type="number" min="1" step="1" inputmode="decimal" value="${Math.min(monthly, Math.max(1, goal.target - goal.saved))}" placeholder="100"><span class="input-suffix">${CURRENCIES[store.state.settings.currency]?.symbol || 'BYN'}</span></div>
      </div>
      <div class="chip-scroll" style="margin-bottom:7px">
        ${[25, 50, 100, Math.round(monthly)].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0,4).map(v => `<button class="chip" type="button" data-quick="${v}">${money(v)}</button>`).join('')}
      </div>
      <div class="form-actions"><button class="btn btn--secondary" type="button" data-sheet-close>Отмена</button><button class="btn btn--green" type="submit">Пополнить</button></div>
    </form>`,
    onMount(bodyEl, close) {
      bodyEl.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => { bodyEl.querySelector('#deposit-amount').value = b.dataset.quick; }));
      bodyEl.querySelector('#deposit-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = Number(new FormData(e.currentTarget).get('amount'));
        if (!amount || amount <= 0) return;
        const updated = store.depositGoal(goal.id, amount);
        close();
        playSound('success');
        if (updated.completed) { celebrate(1.2); toast('Цель достигнута!', { emoji: '🏆', xp: 30 }); }
        else toast('Цель пополнена', { emoji: '🎯' });
        rerender();
      });
    }
  });
}

function openGoalActions(goal) {
  const { body } = openSheet({
    title: goal.name,
    subtitle: `${money(goal.saved)} из ${money(goal.target)}`,
    body: `<div class="stack">
      ${!goal.completed ? `<button class="settings-row" type="button" data-deposit>${icon('plus', 19)}<span class="settings-label">Пополнить цель</span>${icon('chevron-right', 16)}</button>` : ''}
      <button class="settings-row" type="button" data-remove style="color:var(--red)">${icon('trash', 19)}<span class="settings-label" style="color:var(--red)">Удалить цель</span>${icon('chevron-right', 16)}</button>
    </div>`,
    onMount(bodyEl, close) {
      bodyEl.querySelector('[data-deposit]')?.addEventListener('click', () => { close(); openDepositSheet(goal); });
      bodyEl.querySelector('[data-remove]').addEventListener('click', async () => {
        close();
        const ok = await confirmSheet({ title: 'Удалить цель?', text: 'История накоплений по этой цели исчезнет. Деньги остаются у тебя.', iconName: 'trash', confirmLabel: 'Удалить', danger: true });
        if (ok) { store.removeGoal(goal.id); toast('Цель удалена', { emoji: '🗑️' }); rerender(); }
      });
    }
  });
}

function openSubscriptionSheet() {
  const { body } = openSheet({
    title: 'Новая подписка',
    subtitle: 'Добавь даже мелочь — за год сумма может удивить.',
    body: `<form id="sub-form">
      <div class="field" style="margin-bottom:12px"><label class="field-label" for="sub-name">Название</label><input class="input" id="sub-name" name="name" type="text" maxlength="60" placeholder="Музыка, облако, фитнес" required></div>
      <div class="form-grid">
        <div class="field"><label class="field-label" for="sub-amount">Сумма</label><div class="input-group"><input class="input" id="sub-amount" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="9"><span class="input-suffix">${CURRENCIES[store.state.settings.currency]?.symbol || 'BYN'}</span></div></div>
        <div class="field"><label class="field-label" for="sub-period">Период</label><select class="select" id="sub-period" name="period"><option value="month">В месяц</option><option value="year">В год</option></select></div>
      </div>
      <div class="field" style="margin-top:12px"><label class="field-label" for="sub-date">Следующее списание</label><input class="input" id="sub-date" name="nextDate" type="date"></div>
      <div class="form-actions"><button class="btn btn--secondary" type="button" data-sheet-close>Отмена</button><button class="btn" type="submit">Добавить</button></div>
    </form>`,
    onMount(bodyEl, close) {
      bodyEl.querySelector('#sub-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (!String(fd.get('name')).trim() || !Number(fd.get('amount'))) { toast('Заполни название и сумму', { emoji: '⚠️' }); return; }
        store.addSubscription({ name: fd.get('name'), amount: fd.get('amount'), period: fd.get('period'), nextDate: fd.get('nextDate') });
        close(); toast('Подписка добавлена', { emoji: '💳' }); rerender();
      });
    }
  });
}

function openTransactionActions(tx) {
  const { body } = openSheet({
    title: tx.note || tx.category,
    subtitle: `${tx.type === 'income' ? '+' : '−'}${money(tx.amount)} · ${formatDate(tx.date)}`,
    body: `<button class="settings-row" type="button" data-remove style="color:var(--red)">${icon('trash', 19)}<span class="settings-label" style="color:var(--red)">Удалить операцию</span>${icon('chevron-right', 16)}</button>`,
    onMount(bodyEl, close) {
      bodyEl.querySelector('[data-remove]').addEventListener('click', async () => {
        close();
        const ok = await confirmSheet({ title: 'Удалить операцию?', text: 'Бюджет пересчитается без этой записи.', iconName: 'trash', confirmLabel: 'Удалить', danger: true });
        if (ok) { store.deleteTransaction(tx.id); toast('Операция удалена', { emoji: '🗑️' }); rerender(); }
      });
    }
  });
}

function exportBackup() {
  const data = store.exportData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kopeyka-backup-${todayKey()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('Резервная копия сохранена', { emoji: '💾' });
}

function rerender() {
  window.dispatchEvent(new CustomEvent('kopeyka:rerender'));
}

function plural(n, one, few, many) {
  const num = Math.abs(Number(n)) % 100;
  const last = num % 10;
  if (num > 10 && num < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
