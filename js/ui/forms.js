/* Быстрые формы, которые открываются в bottom sheet из разных экранов. */
import { store, BUDGET_CATEGORIES } from '../store.js';
import { CURRENCIES, todayKey, esc } from '../utils.js';
import { openSheet, toast, sheetFormActions, playSound } from './components.js';

export function openTransactionSheet({ type = 'expense', onSaved = null } = {}) {
  let currentType = type === 'income' ? 'income' : 'expense';
  const symbol = CURRENCIES[store.state.settings.currency]?.symbol || 'BYN';

  const categories = (t) => Object.keys(BUDGET_CATEGORIES[t] || {});

  function categoryOptions(t) {
    return categories(t).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }

  const { body, close } = openSheet({
    title: 'Новая операция',
    subtitle: 'Запиши операцию сразу — так бюджет останется честным.',
    body: `<form id="tx-form" novalidate>
      <div class="segmented" style="margin-bottom:16px" role="tablist" aria-label="Тип операции">
        <button type="button" data-type="expense" class="${currentType === 'expense' ? 'active' : ''}">Расход</button>
        <button type="button" data-type="income" class="${currentType === 'income' ? 'active' : ''}">Доход</button>
      </div>
      <div class="field" style="margin-bottom:12px">
        <label class="field-label" for="tx-amount">Сумма</label>
        <div class="input-group">
          <input class="input" id="tx-amount" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0" required autocomplete="off">
          <span class="input-suffix">${esc(symbol)}</span>
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label" for="tx-category">Категория</label>
          <select class="select" id="tx-category" name="category">${categoryOptions(currentType)}</select>
        </div>
        <div class="field">
          <label class="field-label" for="tx-date">Дата</label>
          <input class="input" id="tx-date" name="date" type="date" value="${todayKey()}" max="2100-12-31">
        </div>
        <div class="field span-2">
          <label class="field-label" for="tx-note">Заметка <span class="tertiary">— необязательно</span></label>
          <input class="input" id="tx-note" name="note" type="text" maxlength="160" placeholder="Например, продукты на неделю" autocomplete="off">
        </div>
      </div>
      ${sheetFormActions('Сохранить')}
    </form>`,
    onMount(formBody, closeFn) {
      const form = formBody.querySelector('#tx-form');
      const catSelect = formBody.querySelector('#tx-category');
      const amountInput = formBody.querySelector('#tx-amount');
      formBody.querySelectorAll('[data-type]').forEach(btn => {
        btn.addEventListener('click', () => {
          currentType = btn.dataset.type;
          formBody.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('active', b === btn));
          catSelect.innerHTML = categoryOptions(currentType);
        });
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = Number(amountInput.value);
        if (!Number.isFinite(amount) || amount <= 0) {
          amountInput.focus();
          amountInput.setAttribute('aria-invalid', 'true');
          toast('Введи сумму больше нуля', { emoji: '⚠️' });
          return;
        }
        const data = new FormData(form);
        const tx = store.addTransaction({
          type: currentType,
          amount,
          category: data.get('category'),
          date: data.get('date') || todayKey(),
          note: data.get('note')
        });
        if (tx) {
          playSound('success');
          toast(currentType === 'income' ? 'Доход записан' : 'Расход записан', { emoji: currentType === 'income' ? '📈' : '🧾', xp: 5 });
          closeFn();
          onSaved?.(tx);
        }
      });
      setTimeout(() => amountInput.focus({ preventScroll: true }), 420);
    }
  });
  return { body, close };
}

export function openGoalSheet({ onSaved = null, preset = {} } = {}) {
  const symbol = CURRENCIES[store.state.settings.currency]?.symbol || 'BYN';
  const { body } = openSheet({
    title: 'Новая цель',
    subtitle: 'Конкретная сумма и срок превращают мечту в план.',
    body: `<form id="goal-form" novalidate>
      <div class="field" style="margin-bottom:12px">
        <label class="field-label" for="goal-name">Название</label>
        <input class="input" id="goal-name" name="name" type="text" maxlength="80" placeholder="Например, подушка безопасности" value="${esc(preset.name || '')}" required>
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label" for="goal-target">Нужная сумма</label>
          <div class="input-group"><input class="input" id="goal-target" name="target" type="number" min="1" step="1" inputmode="decimal" placeholder="1000" required><span class="input-suffix">${esc(symbol)}</span></div>
        </div>
        <div class="field">
          <label class="field-label" for="goal-saved">Уже есть</label>
          <div class="input-group"><input class="input" id="goal-saved" name="saved" type="number" min="0" step="1" inputmode="decimal" placeholder="0"><span class="input-suffix">${esc(symbol)}</span></div>
        </div>
        <div class="field">
          <label class="field-label" for="goal-deadline">Срок</label>
          <input class="input" id="goal-deadline" name="deadline" type="date" min="${todayKey()}">
        </div>
        <div class="field">
          <label class="field-label" for="goal-emoji">Иконка</label>
          <select class="select" id="goal-emoji" name="emoji">
            <option>🎯</option><option>🛡️</option><option>💻</option><option>🏠</option><option>✈️</option><option>🚲</option><option>🎸</option><option>📱</option><option>🎓</option><option>🎁</option>
          </select>
        </div>
      </div>
      ${sheetFormActions('Создать цель')}
    </form>`,
    onMount(bodyEl, close) {
      const form = bodyEl.querySelector('#goal-form');
      form.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(form);
        const name = String(fd.get('name') || '').trim();
        const target = Number(fd.get('target'));
        if (!name || !target || target <= 0) { toast('Заполни название и сумму', { emoji: '⚠️' }); return; }
        const goal = store.addGoal({
          name, target,
          saved: Number(fd.get('saved')) || 0,
          deadline: fd.get('deadline') || '',
          emoji: fd.get('emoji') || '🎯'
        });
        playSound('success');
        toast('Цель создана', { emoji: '🎯', xp: 0 });
        close();
        onSaved?.(goal);
      });
      setTimeout(() => bodyEl.querySelector('#goal-name')?.focus({ preventScroll: true }), 420);
    }
  });
  return { body };
}
