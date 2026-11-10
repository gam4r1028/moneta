/* Финансовые расчёты без DOM.
   Функции возвращают уже округлённые для показа значения и серии для графиков. */

const MAX_MONTHS = 1200;

function n(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function positive(value, fallback = 0) {
  return Math.max(0, n(value, fallback));
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function ratePerMonth(annualPercent) {
  return Math.max(0, n(annualPercent)) / 100 / 12;
}

/* ---------- Сложный процент ---------- */

export function compounding({ principal = 0, monthly = 0, rate = 0, years = 5 } = {}) {
  const start = positive(principal);
  const contribution = positive(monthly);
  const monthlyRate = ratePerMonth(rate);
  const months = Math.max(0, Math.min(MAX_MONTHS, Math.round(positive(years) * 12)));

  let balance = start;
  let contributed = start;
  const points = [{ label: '0', value: start, contributed: start, interest: 0 }];
  const yearly = [];
  let lastYearInterest = 0;

  for (let month = 1; month <= months; month++) {
    const interest = balance * monthlyRate;
    balance += interest + contribution;
    contributed += contribution;

    if (month % 12 === 0 || month === months) {
      const year = month / 12;
      const point = {
        label: Number.isInteger(year) ? String(year) : year.toFixed(1),
        value: money(balance),
        contributed: money(contributed),
        interest: money(balance - contributed)
      };
      points.push(point);
      yearly.push({
        year: point.label,
        contributed: point.contributed,
        interest: point.interest,
        total: point.value
      });
      lastYearInterest = point.interest;
    }
  }

  const final = money(balance);
  return {
    months,
    final,
    contributed: money(contributed),
    interest: money(balance - contributed),
    lastYearInterest,
    points,
    yearly,
    monthlyRate: monthlyRate * 100
  };
}

/* ---------- Кредит ---------- */

export function loan({ amount = 10000, rate = 12, months = 24 } = {}) {
  const principal = Math.max(1, positive(amount));
  const monthlyRate = ratePerMonth(rate);
  const term = Math.max(1, Math.min(MAX_MONTHS, Math.round(positive(months))));

  const payment = monthlyRate > 0
    ? principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -term))
    : principal / term;

  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  const rows = [];
  const points = [{ label: '0', value: money(balance) }];

  for (let month = 1; month <= term; month++) {
    const interest = balance * monthlyRate;
    let principalPart = payment - interest;
    if (month === term) principalPart = balance;
    const pay = principalPart + interest;
    balance = Math.max(0, balance - principalPart);
    totalInterest += interest;
    totalPaid += pay;
    rows.push({
      month,
      payment: money(pay),
      interest: money(interest),
      principal: money(principalPart),
      balance: money(balance)
    });
    if (month % 12 === 0 || month === term) {
      points.push({ label: String(Number((month / 12).toFixed(1))), value: money(balance) });
    }
  }

  return {
    amount: principal,
    months: term,
    payment: money(payment),
    totalPaid: money(totalPaid),
    overpay: money(totalPaid - principal),
    totalInterest: money(totalInterest),
    effectiveOverpay: principal ? (totalPaid - principal) / principal * 100 : 0,
    rows,
    points
  };
}

/* ---------- Инфляция ---------- */

export function inflation({ amount = 1000, rate = 6, years = 10 } = {}) {
  const sum = positive(amount);
  const annual = Math.max(0, n(rate)) / 100;
  const term = positive(years);
  const factor = Math.pow(1 + annual, term);
  const futureCost = money(sum * factor);
  const purchasingPower = money(sum / factor);
  const loss = money(sum - purchasingPower);
  const lossPercent = sum ? (1 - 1 / factor) * 100 : 0;

  const steps = Math.min(10, Math.max(1, Math.ceil(term)));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = term * (i / steps);
    const f = Math.pow(1 + annual, t);
    points.push({
      label: Number(t.toFixed(1)).toString(),
      value: money(sum / f),
      cost: money(sum * f)
    });
  }
  if (points[points.length - 1].label !== String(term)) {
    points.push({ label: String(term), value: purchasingPower, cost: futureCost });
  }

  return {
    amount: sum,
    rate: annual * 100,
    years: term,
    factor,
    futureCost,
    purchasingPower,
    loss,
    lossPercent,
    points
  };
}

/* ---------- Цель ---------- */

export function goal({ target = 5000, saved = 0, monthly = 200, rate = 3, monthsLimit = 0 } = {}) {
  const aim = Math.max(1, positive(target));
  const start = positive(saved);
  const contribution = positive(monthly);
  const monthlyRate = ratePerMonth(rate);
  const limit = Math.max(0, Math.round(positive(monthsLimit)));

  let balance = start;
  let months = 0;
  let contributed = start;
  const points = [{ label: '0', value: money(balance) }];
  let reached = balance >= aim;

  if (!reached) {
    if (contribution <= 0 && monthlyRate <= 0) {
      reached = false;
    } else if (balance <= 0 && contribution <= 0) {
      reached = false;
    } else {
      while (balance < aim && months < MAX_MONTHS) {
        balance = balance * (1 + monthlyRate) + contribution;
        contributed += contribution;
        months++;
        if (months % 12 === 0) points.push({ label: String(months / 12), value: money(Math.min(balance, aim)) });
      }
      reached = balance >= aim;
      if (reached) points.push({ label: months < 12 ? `${months} мес` : String(Number((months / 12).toFixed(1))), value: money(Math.min(balance, aim)) });
    }
  }

  let requiredMonthly = null;
  if (limit > 0) {
    if (monthlyRate > 0) {
      const growth = Math.pow(1 + monthlyRate, limit);
      requiredMonthly = Math.max(0, (aim - start * growth) * monthlyRate / (growth - 1));
    } else {
      requiredMonthly = Math.max(0, (aim - start) / limit);
    }
    requiredMonthly = money(requiredMonthly);
  }

  return {
    target: aim,
    saved: start,
    monthly: contribution,
    reached,
    months: reached ? months : null,
    final: money(Math.min(balance, aim)),
    contributed: money(contributed),
    interest: money(Math.min(balance, aim) - contributed),
    points,
    monthsLimit: limit,
    requiredMonthly,
    enough: requiredMonthly === null ? null : contribution >= requiredMonthly
  };
}

/* ---------- Зарплата ---------- */

export function salary({ mode = 'gross', amount = 2000, rate = 14 } = {}) {
  const taxRate = Math.max(0, Math.min(90, n(rate))) / 100;
  const value = Math.max(0, n(amount));

  let gross;
  let net;
  let tax;
  if (mode === 'net') {
    net = value;
    gross = taxRate < 1 ? value / (1 - taxRate) : value;
    tax = gross - net;
  } else {
    gross = value;
    tax = gross * taxRate;
    net = gross - tax;
  }

  return {
    mode: mode === 'net' ? 'net' : 'gross',
    rate: taxRate * 100,
    gross: money(gross),
    net: money(net),
    tax: money(tax),
    annualGross: money(gross * 12),
    annualNet: money(net * 12),
    annualTax: money(tax * 12),
    dayNet: money(net / 30.4)
  };
}

/* ---------- Цена за единицу ---------- */

const UNITS = {
  'г': { base: 'g', multiply: 1, display: 'кг', perDisplay: 1000 },
  'кг': { base: 'g', multiply: 1000, display: 'кг', perDisplay: 1000 },
  'мл': { base: 'ml', multiply: 1, display: 'л', perDisplay: 1000 },
  'л': { base: 'ml', multiply: 1000, display: 'л', perDisplay: 1000 },
  'шт': { base: 'pcs', multiply: 1, display: 'шт', perDisplay: 1 }
};

export function unitPrice({ priceA = 100, qtyA = 1000, priceB = 180, qtyB = 2000, unit = 'г' } = {}) {
  const meta = UNITS[unit] || UNITS['г'];
  const a = Math.max(0.0001, positive(qtyA) * meta.multiply);
  const b = Math.max(0.0001, positive(qtyB) * meta.multiply);
  const pa = positive(priceA) / a * meta.perDisplay;
  const pb = positive(priceB) / b * meta.perDisplay;

  let winner = 'tie';
  if (Math.abs(pa - pb) > 0.0001) winner = pa < pb ? 'a' : 'b';
  const expensive = Math.max(pa, pb);
  const cheap = Math.min(pa, pb);
  const difference = expensive ? (expensive - cheap) / expensive * 100 : 0;

  return {
    unit,
    displayUnit: meta.display,
    perA: money(pa),
    perB: money(pb),
    winner,
    difference,
    savingPer: money(Math.abs(pa - pb))
  };
}

/* ---------- Подушка безопасности ---------- */

export function cushion({ expenses = 1200, months = 6, saved = 0, monthly = 300 } = {}) {
  const monthlyExpenses = positive(expenses);
  const targetMonths = Math.max(1, Math.min(36, Math.round(positive(months) || 1)));
  const target = money(monthlyExpenses * targetMonths);
  const start = Math.min(positive(saved), target);
  const gap = money(Math.max(0, target - start));
  const contribution = positive(monthly);

  let monthsToSave = 0;
  if (gap > 0) monthsToSave = contribution > 0 ? Math.ceil(gap / contribution) : null;

  const points = [{ label: '0', value: start }];
  let balance = start;
  if (monthsToSave !== null) {
    const step = Math.max(1, Math.ceil(monthsToSave / 12));
    for (let m = step; m <= monthsToSave; m += step) {
      points.push({ label: String(m), value: money(Math.min(target, start + contribution * m)) });
    }
    if (points[points.length - 1].label !== String(monthsToSave)) {
      points.push({ label: String(monthsToSave), value: target });
    }
  }

  return {
    target,
    targetMonths,
    saved: start,
    gap,
    monthsToSave,
    monthly: contribution,
    percent: target ? Math.min(100, start / target * 100) : 0,
    points,
    alreadyDone: gap <= 0
  };
}
