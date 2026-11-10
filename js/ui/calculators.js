/* Экраны калькуляторов: сетка, формы и живые результаты. */
import { store } from '../store.js';
import {
  esc, formatMoney, formatCompact, formatNumber, formatDate, addMonths, CURRENCIES, clamp
} from '../utils.js';
import { icon } from './icons.js';
import { pageHead, backHead, emptyState, toast, playSound } from './components.js';
import { compounding, loan, inflation, goal, salary, unitPrice, cushion } from '../calc.js';

const CALCULATORS = [
  {
    id: 'compound',
    title: 'Сложный процент',
    sub: 'Как растут накопления',
    icon: 'trending-up',
    color: '#34C759',
    description: 'Узнай, сколько накопится, если регулярно откладывать и получать процент на остаток.'
  },
  {
    id: 'loan',
    title: 'Кредит',
    sub: 'Платёж и переплата',
    icon: 'credit-card',
    color: '#FF3B30',
    description: 'Рассчитай ежемесячный платёж, итоговую переплату и график погашения долга.'
  },
  {
    id: 'inflation',
    title: 'Инфляция',
    sub: 'Что будет с деньгами',
    icon: 'trending-down',
    color: '#FF9500',
    description: 'Пойми, сколько будет стоить та же корзина товаров через несколько лет и что останется от суммы.'
  },
  {
    id: 'goal',
    title: 'Цель',
    sub: 'Сколько и как долго',
    icon: 'target',
    color: '#007AFF',
    description: 'Посчитай, когда получится накопить на цель и сколько нужно откладывать каждый месяц.'
  },
  {
    id: 'salary',
    title: 'Зарплата',
    sub: 'До и после налогов',
    icon: 'briefcase',
    color: '#5856D6',
    description: 'Переведи зарплату «до налогов» в сумму на руки и обратно — с учётом ставки налога.'
  },
  {
    id: 'unit',
    title: 'Цена за единицу',
    sub: 'Что выгоднее',
    icon: 'cart',
    color: '#AF52DE',
    description: 'Сравни две упаковки по цене за килограмм, литр или штуку и не дай скидке себя запутать.'
  },
  {
    id: 'cushion',
    title: 'Подушка безопасности',
    sub: 'Запас на спокойствие',
    icon: 'shield',
    color: '#30B0C7',
    description: 'Посчитай размер финансового резерва и срок, за который его реально собрать.'
  }
];

const memo = {};
let chartSeq = 0;

function currency() {
  return store.state.settings.currency;
}

function money(value) {
  return formatMoney(value, currency());
}

function money2(value) {
  return formatMoney(value, currency(), { digits: 2 });
}

function symbol() {
  return CURRENCIES[currency()]?.symbol || currency();
}

function stateFor(id, defaults) {
  if (!memo[id]) memo[id] = { ...defaults };
  return memo[id];
}

function field({ label, name, value, suffix = '', min = 0, max = '', step = 'any', hint = '' }) {
  return `<div class="field">
    <label class="field-label" for="${esc(name)}">${esc(label)}</label>
    <div class="input-group">
      <input class="input" id="${esc(name)}" data-field="${esc(name)}" name="${esc(name)}" type="number"
        inputmode="decimal" min="${esc(min)}" ${max !== '' ? `max="${esc(max)}"` : ''} step="${esc(step)}"
        value="${esc(value)}" autocomplete="off">
      ${suffix ? `<span class="input-suffix">${esc(suffix)}</span>` : ''}
    </div>
    ${hint ? `<span class="tiny tertiary">${esc(hint)}</span>` : ''}
  </div>`;
}

function miniGrid(items) {
  return `<div class="calc-mini-grid">
    ${items.map(([label, value]) => `<div class="calc-mini"><div class="l">${esc(label)}</div><div class="v">${value}</div></div>`).join('')}
  </div>`;
}

function resultCard({ label, value, sub = '', minis = [] }) {
  return `<div class="calc-result">
    <div class="calc-result-label">${esc(label)}</div>
    <div class="calc-result-value">${value}</div>
    ${sub ? `<div class="calc-result-sub">${sub}</div>` : ''}
    ${minis.length ? miniGrid(minis) : ''}
  </div>`;
}

function lineChart(series, { height = 132 } = {}) {
  const width = 330;
  const pad = { left: 7, right: 7, top: 12, bottom: 22 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const all = series.flatMap(s => s.points.map(p => Number(p.value) || 0));
  const max = Math.max(1, ...all);
  const first = series[0];
  const count = Math.max(1, first.points.length);
  const x = (i) => count <= 1 ? pad.left + innerW / 2 : pad.left + (i / (count - 1)) * innerW;
  const y = (v) => pad.top + innerH - (Math.max(0, Number(v) || 0) / max) * innerH;
  const id = `calc-grad-${++chartSeq}`;

  const grid = [0, 0.5, 1].map(part => {
    const yy = pad.top + innerH * (1 - part);
    return `<line x1="${pad.left}" y1="${yy.toFixed(1)}" x2="${width - pad.right}" y2="${yy.toFixed(1)}" class="grid-line"/>`;
  }).join('');

  const areas = series.map((s, sIndex) => {
    const pts = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    if (sIndex > 0) return '';
    return `<path d="${pts} L${x(count - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z" fill="url(#${id})"/>`;
  }).join('');

  const lines = series.map(s => {
    const pts = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const dots = s.points.map((p, i) => {
      if (s.points.length > 16 && i % Math.ceil(s.points.length / 10) !== 0 && i !== s.points.length - 1) return '';
      return `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="2.6" fill="${s.color}" stroke="var(--surface-solid)" stroke-width="1.4"><title>${esc(s.name)} · ${esc(p.label)}: ${esc(formatCompact(p.value, currency()))}</title></circle>`;
    }).join('');
    return `<path d="${pts}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
  }).join('');

  const labelIndexes = [...new Set([0, Math.floor((count - 1) / 2), count - 1])].filter(i => i >= 0);
  const labels = labelIndexes.map((i, order) => {
    const anchor = order === 0 ? 'start' : order === labelIndexes.length - 1 ? 'end' : 'middle';
    return `<text x="${x(i).toFixed(1)}" y="${height - 5}" text-anchor="${anchor}" class="bar-label">${esc(first.points[i]?.label || '')}</text>`;
  }).join('');

  const legend = series.length > 1
    ? `<div class="row" style="gap:12px;padding:0 5px 7px;flex-wrap:wrap">${series.map(s => `<span class="tiny secondary row" style="gap:5px"><span class="legend-dot" style="background:${s.color}"></span>${esc(s.name)}</span>`).join('')}</div>`
    : '';

  return `${legend}<div class="bar-chart">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="График расчёта">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${first.color}" stop-opacity=".2"/>
        <stop offset="100%" stop-color="${first.color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      ${areas}
      ${lines}
      ${labels}
      <text x="${width - pad.right}" y="${pad.top - 2}" text-anchor="end" class="bar-label">${esc(formatCompact(max, currency()))}</text>
    </svg>
  </div>`;
}

function chartCard(title, series, note = '') {
  return `<div class="chart-card" style="margin-top:13px">
    <div class="chart-title">${esc(title)}</div>
    ${lineChart(series)}
    ${note ? `<div class="tiny tertiary" style="padding:6px 5px 2px">${esc(note)}</div>` : ''}
  </div>`;
}

function schedule({ title, summary, head, rows, open = false }) {
  if (!rows.length) return '';
  return `<details class="schedule" ${open ? 'open' : ''}>
    <summary><span>${esc(title)}</span><span class="tiny tertiary">${esc(summary)}</span></summary>
    <div class="schedule-scroll">
      <table class="schedule-table">
        <thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
  </details>`;
}

function shell(def, fieldsHtml, extras = {}) {
  const hero = `<div class="calc-hero">
    <div class="row" style="gap:10px">
      <div class="calc-icon" style="background:rgba(255,255,255,.17);color:#fff">${icon(def.icon, 21)}</div>
      <span class="calc-hero-kicker">Быстрый расчёт</span>
    </div>
    <h2>${esc(def.title)}</h2>
    <p>${esc(def.description)}</p>
  </div>`;

  return `<div class="page calc-page" style="--calc-color:${def.color}">
    ${backHead({ title: def.title, subtitle: def.sub, back: '#/calculators' })}
    ${hero}
    <form class="calc-form card" id="calc-form" novalidate>
      ${fieldsHtml}
      <div class="form-actions" style="margin-top:16px">
        <button class="btn btn--wide" type="submit">${icon('calc', 17)} Рассчитать</button>
      </div>
    </form>
    <div id="calc-output" aria-live="polite"></div>
    ${extras.explanation ? `<div class="card card--padded" style="margin-top:13px;background:color-mix(in srgb,${def.color} 6%,var(--surface-solid))">
      <div class="row" style="gap:10px;align-items:flex-start">
        <div class="icon-badge icon-badge--soft" style="color:${def.color}">${icon('lightbulb', 19)}</div>
        <div class="grow"><div class="small strong" style="margin-bottom:3px">${esc(extras.explanation.title)}</div>
        <div class="tiny secondary" style="line-height:1.5">${extras.explanation.text}</div></div>
      </div>
    </div>` : ''}
  </div>`;
}

function bindForm(root, state, render) {
  const form = root.querySelector('#calc-form');
  const output = root.querySelector('#calc-output');
  if (!form || !output) return null;

  const sync = () => {
    form.querySelectorAll('[data-field]').forEach(el => {
      state[el.dataset.field] = el.type === 'number' ? Number(el.value) : el.value;
    });
  };
  const run = () => {
    sync();
    output.innerHTML = render(state);
  };

  form.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('input', run);
    el.addEventListener('change', run);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    run();
    playSound('tap');
  });
  run();
  return { run, sync, form, output };
}

/* ---------- Сложный процент ---------- */

function compoundPage(def) {
  const state = stateFor('compound', { principal: 1000, monthly: 100, rate: 6, years: 10 });
  const fields = `<div class="form-grid">
    ${field({ label: 'Сначала есть', name: 'principal', value: state.principal, suffix: symbol() })}
    ${field({ label: 'Каждый месяц', name: 'monthly', value: state.monthly, suffix: symbol() })}
    ${field({ label: 'Ставка в год', name: 'rate', value: state.rate, suffix: '%' })}
    ${field({ label: 'Срок', name: 'years', value: state.years, suffix: 'лет', max: 100 })}
  </div>`;

  const render = (value) => {
    const result = compounding(value);
    const rows = result.yearly.map(row => `<tr><td>${esc(row.year)}</td><td>${money(row.contributed)}</td><td>${money(row.interest)}</td><td><strong>${money(row.total)}</strong></td></tr>`);
    return `${resultCard({
      label: 'Итоговая сумма',
      value: money(result.final),
      sub: `Из них ${money(result.contributed)} — твои взносы и ${money(result.interest)} — доход от процентов.`,
      minis: [
        ['Доходность', `${Math.round(result.interest)} ${symbol()}`],
        ['Срок', `${result.months} мес`],
        ['Взносов всего', money(result.contributed)]
      ]
    })}
    ${chartCard('Как растёт сумма', [
      { name: 'Всего', color: def.color, points: result.points.map(p => ({ label: p.label, value: p.value })) },
      { name: 'Твои взносы', color: '#8E8E93', points: result.points.map(p => ({ label: p.label, value: p.contributed })) }
    ], 'Зелёная линия — весь капитал, серая — сколько ты вложил сам. Разница и есть сложный процент.')}
    ${schedule({
      title: 'Расчёт по годам',
      summary: `${result.yearly.length} ${plural(result.yearly.length, 'год', 'года', 'лет')}`,
      head: ['Год', 'Взносы', 'Проценты', 'Итог'],
      rows
    })}`;
  };

  return {
    html: shell(def, fields, {
      explanation: {
        title: 'Почему это работает',
        text: 'Процент начисляется не только на первоначальную сумму, но и на уже начисленные проценты. Поэтому чем дольше срок, тем заметнее разница. Регулярные взносы ускоряют рост.'
      }
    }),
    mount(root) { bindForm(root, state, render); }
  };
}

/* ---------- Кредит ---------- */

function loanPage(def) {
  const state = stateFor('loan', { amount: 10000, rate: 12, months: 24 });
  const fields = `<div class="form-grid">
    ${field({ label: 'Сумма кредита', name: 'amount', value: state.amount, suffix: symbol() })}
    ${field({ label: 'Ставка в год', name: 'rate', value: state.rate, suffix: '%' })}
    ${field({ label: 'Срок', name: 'months', value: state.months, suffix: 'мес', max: 480, hint: 'Например, 24 месяца — это 2 года' })}
  </div>`;

  const render = (value) => {
    const result = loan(value);
    const rows = result.rows.map(row => `<tr>
      <td>${row.month}</td><td>${money(row.payment)}</td><td>${money(row.interest)}</td><td>${money(row.balance)}</td>
    </tr>`);
    return `${resultCard({
      label: 'Ежемесячный платёж',
      value: money(result.payment),
      sub: `Всего вернёшь ${money(result.totalPaid)}, из них переплата — ${money(result.overpay)}.`,
      minis: [
        ['Переплата', money(result.overpay)],
        ['Доля переплаты', `${formatNumber(result.effectiveOverpay, 1)}%`],
        ['Платежей', `${result.months}`]
      ]
    })}
    ${chartCard('Остаток долга', [
      { name: 'Остаток', color: def.color, points: result.points.map(p => ({ label: p.label, value: p.value })) }
    ], 'В начале срока большая часть платежа уходит на проценты, поэтому долг уменьшается медленнее, чем кажется.')}
    ${schedule({
      title: 'График платежей',
      summary: `${result.rows.length} ${plural(result.rows.length, 'платёж', 'платежа', 'платежей')}`,
      head: ['Месяц', 'Платёж', 'Проценты', 'Остаток'],
      rows
    })}`;
  };

  return {
    html: shell(def, fields, {
      explanation: {
        title: 'На что смотреть',
        text: 'Низкий платёж не всегда выгоден: удлинение срока снижает ежемесячную нагрузку, но увеличивает переплату. Сравнивай не только платёж, но и полную стоимость кредита.'
      }
    }),
    mount(root) { bindForm(root, state, render); }
  };
}

/* ---------- Инфляция ---------- */

function inflationPage(def) {
  const state = stateFor('inflation', { amount: 1000, rate: 6, years: 10 });
  const fields = `<div class="form-grid">
    ${field({ label: 'Сумма сейчас', name: 'amount', value: state.amount, suffix: symbol() })}
    ${field({ label: 'Инфляция в год', name: 'rate', value: state.rate, suffix: '%' })}
    ${field({ label: 'Через сколько лет', name: 'years', value: state.years, suffix: 'лет', max: 100 })}
  </div>`;

  const render = (value) => {
    const result = inflation(value);
    return `${resultCard({
      label: `Покупательная способность через ${formatNumber(result.years, 1)} г.`,
      value: money(result.purchasingPower),
      sub: `Та же сумма будет покупать меньше. Чтобы купить то же, что сейчас на ${money(result.amount)}, понадобится ${money(result.futureCost)}.`,
      minis: [
        ['Потеря покупательной силы', `${formatNumber(result.lossPercent, 1)}%`],
        ['Будущая цена корзины', money(result.futureCost)],
        ['Рост цен', `×${formatNumber(result.factor, 2)}`]
      ]
    })}
    ${chartCard('Что произойдёт с деньгами', [
      { name: 'Покупательная способность суммы', color: def.color, points: result.points.map(p => ({ label: p.label, value: p.value })) },
      { name: 'Цена той же корзины', color: '#FF3B30', points: result.points.map(p => ({ label: p.label, value: p.cost })) }
    ], 'Одна и та же сумма со временем покупает меньше. Инфляция — причина держать деньги не только в наличных.')}`;
  };

  return {
    html: shell(def, fields, {
      explanation: {
        title: 'Инфляция — это не абстракция',
        text: 'Если деньги лежат без процентов, их реальная стоимость постепенно снижается. Защита — регулярные накопления, вклады и инвестиции с доходностью выше инфляции, но с учётом риска.'
      }
    }),
    mount(root) { bindForm(root, state, render); }
  };
}

/* ---------- Цель ---------- */

function goalPage(def) {
  const state = stateFor('goal', { target: 5000, saved: 0, monthly: 200, rate: 3, monthsLimit: 24 });
  const fields = `<div class="form-grid">
    ${field({ label: 'Цель', name: 'target', value: state.target, suffix: symbol() })}
    ${field({ label: 'Уже накоплено', name: 'saved', value: state.saved, suffix: symbol() })}
    ${field({ label: 'Откладываю в месяц', name: 'monthly', value: state.monthly, suffix: symbol() })}
    ${field({ label: 'Доходность в год', name: 'rate', value: state.rate, suffix: '%', hint: 'Например, вклад или накопительный счёт' })}
    ${field({ label: 'Хочу успеть за', name: 'monthsLimit', value: state.monthsLimit, suffix: 'мес', hint: 'Необязательно. 0 — без срока', max: 600 })}
  </div>`;

  const render = (value) => {
    const result = goal(value);
    const targetDate = result.reached && result.months > 0 ? addMonths(new Date(), result.months) : null;
    const mainValue = result.reached
      ? (result.months === 0 ? 'Уже готово' : `${formatNumber(result.months)} мес`)
      : 'Пока не выходит';
    const sub = result.reached
      ? `${result.months === 0 ? 'Цель уже достигнута — можно выбрать новую.' : `Ориентировочно к ${formatDate(targetDate, { day: 'numeric', month: 'long', year: 'numeric' })}.`} Твои взносы составят ${money(result.contributed)}, доход — ${money(result.interest)}.`
      : 'При таком взносе и доходности цель не достигается за разумный срок. Увеличь ежемесячную сумму или срок.';

    const limitText = result.monthsLimit > 0
      ? `${result.requiredMonthly === null ? '—' : money(result.requiredMonthly)}${symbol()}`
      : 'без срока';

    return `${resultCard({
      label: 'До цели осталось',
      value: mainValue,
      sub,
      minis: [
        ['Нужно в месяц', limitText],
        ['Будет накоплено', money(result.final)],
        ['Доход от процентов', money(result.interest)]
      ]
    })}
    ${result.monthsLimit > 0 ? `<div class="smart-tip" style="margin-top:12px">${icon('info', 16, 'tip-bulb')}<span>Чтобы успеть за ${result.monthsLimit} мес, нужно откладывать <strong>${money(result.requiredMonthly || 0)}</strong> в месяц. ${result.enough ? 'Твой текущий взнос подходит.' : 'Сейчас взноса недостаточно.'}</span></div>` : ''}
    ${result.reached ? chartCard('Накопления по месяцам', [
      { name: 'Накоплено', color: def.color, points: result.points.map(p => ({ label: p.label, value: p.value })) }
    ], 'График показывает, как растёт сумма с учётом процентов на остаток.') : ''}`;
  };

  return {
    html: shell(def, fields, {
      explanation: {
        title: 'Цель лучше без героизма',
        text: 'Реалистичный взнос важнее максимального. Если сумма кажется неподъёмной, разбей цель на этапы: сначала подушка, потом крупная покупка. Главное — регулярность.'
      }
    }),
    mount(root) { bindForm(root, state, render); }
  };
}

/* ---------- Зарплата ---------- */

function salaryPage(def) {
  const state = stateFor('salary', { mode: 'gross', amount: 2000, rate: 14 });
  const fields = `<div class="segmented" id="salary-mode" style="margin-bottom:15px" role="tablist" aria-label="Что известно">
    <button type="button" data-mode="gross" class="${state.mode === 'gross' ? 'active' : ''}">До налогов</button>
    <button type="button" data-mode="net" class="${state.mode === 'net' ? 'active' : ''}">На руки</button>
  </div>
  <div class="chip-scroll" style="margin-bottom:13px">
    <button class="chip" type="button" data-preset="14">Беларусь · 14%</button>
    <button class="chip" type="button" data-preset="13">Россия · 13%</button>
    <button class="chip" type="button" data-preset="0">Без налога</button>
  </div>
  <div class="form-grid">
    ${field({ label: 'Сумма', name: 'amount', value: state.amount, suffix: symbol() })}
    ${field({ label: 'Ставка налога', name: 'rate', value: state.rate, suffix: '%', max: 90 })}
  </div>`;

  const render = (value) => {
    const result = salary(value);
    const isGross = result.mode === 'gross';
    const netShare = result.gross ? (result.net / result.gross) * 100 : 0;
    return `${resultCard({
      label: isGross ? 'На руки' : 'Нужна зарплата до налогов',
      value: money(isGross ? result.net : result.gross),
      sub: `Налоги и взносы — ${money(result.tax)} в месяц (${formatNumber(result.rate, 1)}%).`,
      minis: [
        ['За год на руки', money(result.annualNet)],
        ['Налоги за год', money(result.annualTax)],
        ['В среднем в день', money(result.dayNet)]
      ]
    })}
    <div class="card card--padded" style="margin-top:13px">
      <div class="row row--between" style="margin-bottom:8px">
        <span class="small strong">Структура зарплаты</span>
        <span class="tiny tertiary">${money(result.gross)} до налогов</span>
      </div>
      <div class="rule-bar" style="height:24px">
        <span style="width:${netShare}%;background:var(--green)">${netShare > 18 ? 'на руки' : ''}</span>
        <span style="width:${100 - netShare}%;background:var(--orange)">${100 - netShare > 12 ? `налог ${formatNumber(result.rate, 0)}%` : ''}</span>
      </div>
      <div class="rule-legend">
        <div><strong>${money(result.net)}</strong>на руки</div>
        <div style="text-align:right"><strong>${money(result.tax)}</strong>налог</div>
      </div>
    </div>`;
  };

  return {
    html: shell(def, fields, {
      explanation: {
        title: 'Это упрощённый расчёт',
        text: 'Ставка объединяет основные налоги и взносы работника. В реальности могут действовать вычеты, разные ставки и дополнительные удержания — уточняй в своей бухгалтерии или налоговой.'
      }
    }),
    mount(root) {
      const stateRef = state;
      const form = root.querySelector('#calc-form');
      const modeWrap = form.querySelector('#salary-mode');
      const rateInput = form.querySelector('[data-field="rate"]');
      const run = bindForm(root, stateRef, render);
      if (!run) return;

      const syncMode = () => {
        modeWrap.querySelectorAll('[data-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === stateRef.mode));
      };
      modeWrap.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
        stateRef.mode = btn.dataset.mode;
        syncMode();
        run.run();
      }));
      form.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', () => {
        stateRef.rate = Number(btn.dataset.preset);
        rateInput.value = stateRef.rate;
        run.run();
        toast('Ставка подставлена', { emoji: '🧮' });
      }));
    }
  };
}

/* ---------- Цена за единицу ---------- */

function unitPage(def) {
  const state = stateFor('unit', { priceA: 3.5, qtyA: 1000, priceB: 5.99, qtyB: 2000, unit: 'г' });
  const unitOptions = ['г', 'кг', 'мл', 'л', 'шт'].map(u => `<option value="${u}" ${state.unit === u ? 'selected' : ''}>${u}</option>`).join('');
  const fields = `<div class="form-grid">
    ${field({ label: 'Цена упаковки A', name: 'priceA', value: state.priceA, suffix: symbol() })}
    ${field({ label: 'Вес или объём A', name: 'qtyA', value: state.qtyA, suffix: '' })}
    ${field({ label: 'Цена упаковки B', name: 'priceB', value: state.priceB, suffix: symbol() })}
    ${field({ label: 'Вес или объём B', name: 'qtyB', value: state.qtyB, suffix: '' })}
    <div class="field span-2">
      <label class="field-label" for="unit-type">Единица измерения</label>
      <select class="select" id="unit-type" data-field="unit" name="unit">${unitOptions}</select>
      <span class="tiny tertiary">Обе упаковки измеряем в одной единице. Например, 1000 г или 2 л.</span>
    </div>
  </div>`;

  const render = (value) => {
    const result = unitPrice(value);
    const priceA = money2(result.perA);
    const priceB = money2(result.perB);
    return `${resultCard({
      label: result.winner === 'tie' ? 'Цена одинаковая' : `Выгоднее упаковка ${result.winner.toUpperCase()}`,
      value: money2(result.winner === 'b' ? result.perB : result.perA),
      sub: `Цена за 1 ${esc(result.displayUnit)}. Разница — ${formatNumber(result.difference, 1)}%.`,
      minis: [
        ['Экономия на единице', `${money2(result.savingPer)} / ${result.displayUnit}`],
        ['Упаковка A', `${priceA} / ${result.displayUnit}`],
        ['Упаковка B', `${priceB} / ${result.displayUnit}`]
      ]
    })}
    <div class="compare-grid" style="margin-top:13px">
      <div class="compare-box ${result.winner === 'a' ? 'winner' : ''}">
        <div class="cb-label">Упаковка A</div>
        <div class="cb-value">${priceA}</div>
        <div class="cb-sub">${symbol()} за 1 ${esc(result.displayUnit)}</div>
        ${result.winner === 'a' ? '<div class="winner-badge">Выгоднее</div>' : ''}
      </div>
      <div class="compare-box ${result.winner === 'b' ? 'winner' : ''}">
        <div class="cb-label">Упаковка B</div>
        <div class="cb-value">${priceB}</div>
        <div class="cb-sub">${symbol()} за 1 ${esc(result.displayUnit)}</div>
        ${result.winner === 'b' ? '<div class="winner-badge">Выгоднее</div>' : ''}
      </div>
    </div>
    <div class="smart-tip" style="margin-top:12px">${icon('lightbulb', 16, 'tip-bulb')}<span>${result.winner === 'tie' ? 'Обе упаковки стоят одинаково за единицу — выбирай по удобству и качеству.' : `Большая упаковка не всегда выгодна. Здесь выгоднее ${result.winner === 'a' ? 'A' : 'B'} — но проверь, успеешь ли использовать продукт до того, как он испортится.`}</span></div>`;
  };

  return {
    html: shell(def, fields, {
      explanation: {
        title: 'Смотри на ценник, а не на скидку',
        text: '«−40%» на маленькой упаковке может быть дороже большой без скидки. Сравнение цены за единицу — самый честный способ понять, что выгоднее.'
      }
    }),
    mount(root) { bindForm(root, state, render); }
  };
}

/* ---------- Подушка безопасности ---------- */

function cushionPage(def) {
  const state = stateFor('cushion', { expenses: 1200, months: 6, saved: 0, monthly: 300 });
  const fields = `<div class="form-grid">
    ${field({ label: 'Расходы в месяц', name: 'expenses', value: state.expenses, suffix: symbol() })}
    ${field({ label: 'Запас на', name: 'months', value: state.months, suffix: 'мес', min: 1, max: 36, hint: 'Обычно 3–6 месяцев' })}
    ${field({ label: 'Уже отложено', name: 'saved', value: state.saved, suffix: symbol() })}
    ${field({ label: 'Откладываю в месяц', name: 'monthly', value: state.monthly, suffix: symbol() })}
  </div>`;

  const render = (value) => {
    const result = cushion(value);
    const date = result.monthsToSave !== null && result.monthsToSave > 0 ? addMonths(new Date(), result.monthsToSave) : null;
    return `${resultCard({
      label: `Резерв на ${result.targetMonths} ${plural(result.targetMonths, 'месяц', 'месяца', 'месяцев')}`,
      value: money(result.target),
      sub: result.alreadyDone
        ? 'Подушка уже собрана — отличная работа. Теперь её можно постепенно пополнять под рост расходов.'
        : `Не хватает ${money(result.gap)}. Без учёта процентов это ${result.monthsToSave === null ? 'пока недостижимо при нулевом взносе' : `${result.monthsToSave} мес — ориентировочно к ${formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}`}.`,
      minis: [
        ['Собрано', `${formatNumber(result.percent, 0)}%`],
        ['Осталось', money(result.gap)],
        ['Нужно в месяц', result.monthsToSave === null ? '—' : money(Math.ceil(result.gap / Math.max(1, result.monthsToSave)))]
      ]
    })}
    <div class="card card--padded" style="margin-top:13px">
      <div class="row row--between" style="margin-bottom:8px">
        <span class="small strong">Прогресс резерва</span>
        <span class="tiny tertiary">${money(result.saved)} / ${money(result.target)}</span>
      </div>
      <div class="progress" style="height:9px"><span style="width:${clamp(result.percent, 0, 100)}%;background:${def.color}"></span></div>
    </div>
    ${result.points.length > 1 ? chartCard('Как растёт подушка', [
      { name: 'Накоплено', color: def.color, points: result.points.map(p => ({ label: p.label, value: p.value })) }
    ], 'График без процентов: только регулярные взносы. С доходностью процесс пойдёт быстрее.') : ''}`;
  };

  return {
    html: shell(def, fields, {
      explanation: {
        title: 'Зачем нужна подушка',
        text: 'Это деньги на случай потери работы, болезни или срочного ремонта. Держи их отдельно от ежедневного бюджета и пополняй, когда расходы растут. Начинать можно с одного месяца расходов.'
      }
    }),
    mount(root) { bindForm(root, state, render); }
  };
}

const BUILDERS = {
  compound: compoundPage,
  loan: loanPage,
  inflation: inflationPage,
  goal: goalPage,
  salary: salaryPage,
  unit: unitPage,
  cushion: cushionPage
};

function plural(n, one, few, many) {
  const abs = Math.abs(Number(n)) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export function renderCalculators() {
  const html = `<div class="page">
    ${pageHead({
      eyebrow: 'Быстрые расчёты',
      title: 'Калькуляторы',
      subtitle: 'Посчитай деньги без формул и таблиц'
    })}
    <div class="card card--padded" style="margin-bottom:16px;background:linear-gradient(135deg,color-mix(in srgb,var(--blue) 9%,var(--surface-solid)),var(--surface-solid) 70%)">
      <div class="row" style="gap:12px">
        <div class="icon-badge" style="background:var(--gradient-brand);color:#fff">${icon('calc', 21)}</div>
        <div class="grow"><div class="small strong">Семь полезных сценариев</div><div class="tiny secondary" style="margin-top:2px">Всё считается прямо на устройстве. Никаких отправок данных.</div></div>
      </div>
    </div>
    <div class="calc-grid">
      ${CALCULATORS.map(def => `<button class="calc-card" type="button" data-nav="#/calculators/${def.id}" style="--calc-color:${def.color}">
        <span class="calc-icon">${icon(def.icon, 19)}</span>
        <span><span class="calc-name">${esc(def.title)}</span><span class="calc-sub" style="display:block">${esc(def.sub)}</span></span>
      </button>`).join('')}
    </div>
    <div class="card card--padded" style="margin-top:16px">
      <div class="row" style="gap:10px;align-items:flex-start">
        <div class="icon-badge icon-badge--soft" style="color:var(--orange)">${icon('info', 19)}</div>
        <div class="grow"><div class="small strong">Расчёты приблизительные</div><div class="tiny secondary" style="margin-top:2px;line-height:1.5">Калькуляторы помогают понять порядок цифр. Для кредита или вклада всегда сверяйся с условиями банка: комиссии и правила могут менять результат.</div></div>
      </div>
    </div>
  </div>`;
  return { html, mount() {} };
}

export function renderCalculator({ params = {} } = {}) {
  const def = CALCULATORS.find(item => item.id === params.id);
  if (!def || !BUILDERS[def.id]) {
    return {
      html: `<div class="page">
        ${backHead({ title: 'Калькулятор', back: '#/calculators' })}
        ${emptyState({
          emoji: '🧮',
          title: 'Такого калькулятора нет',
          text: 'Возможно, ссылка устарела. Вернись к списку — там семь полезных расчётов.',
          action: `<button class="btn" type="button" data-nav="#/calculators">К калькуляторам</button>`
        })}
      </div>`,
      mount() {}
    };
  }
  return BUILDERS[def.id](def);
}

export const calculatorList = CALCULATORS;
