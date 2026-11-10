/* Умный список покупок: списки, свайпы, вишлист, история и аналитика. */
import { store, SHOP_CATEGORIES, SHOP_TEMPLATES } from '../store.js';
import {
  esc, formatMoney, formatDateShort, formatDate, formatMonth, todayKey,
  sum, percent, clamp, monthKey, CURRENCIES
} from '../utils.js';
import { icon } from './icons.js';
import {
  pageHead, backHead, emptyState, progress, openSheet, toast, celebrate,
  playSound, rewardToast, confirmSheet, sectionHead, ring
} from './components.js';

const EMOJIS = ['🛒', '🥦', '👕', '💻', '🏠', '🎁', '✈️', '🎒', '🎉', '🐶', '💄', '🔧'];
const COLORS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA', '#5856D6', '#FFCC00'];

function money(v) { return formatMoney(v, store.state.settings.currency); }

export function renderShopping({ query } = {}) {
  const lists = store.state.shopping.lists;
  const due = store.getDueWishlist();
  const allWish = store.getAllWishlist();
  const history = store.state.shopping.history;
  const totalPlanned = lists.reduce((acc, l) => acc + sum(l.items, i => i.price * i.qty), 0);
  const totalItems = lists.reduce((acc, l) => acc + l.items.length, 0);
  const totalBudget = lists.reduce((acc, l) => acc + Number(l.budget || 0), 0);

  const html = `<div class="page">
    ${pageHead({
      eyebrow: 'Реальная жизнь',
      title: 'Покупки',
      subtitle: 'Списки, которые берегут твой бюджет',
      actions: `<button class="icon-btn icon-btn--accent" type="button" data-new-list aria-label="Новый список">${icon('plus', 21)}</button>`
    })}

    ${allWish.length ? `<button class="wishlist-alert" type="button" data-wishlist style="width:100%;text-align:left;margin-bottom:14px">
      <div class="icon-badge" style="background:var(--orange)">${icon('clock', 20)}</div>
      <div class="grow">
        <div class="small strong">${due.length ? `Пора проверить ${due.length} ${plural(due.length, 'желание', 'желания', 'желаний')}` : `В вишлисте ${allWish.length} ${plural(allWish.length, 'желание', 'желания', 'желаний')}`}</div>
        <div class="tiny tertiary">${due.length ? 'Прошло 24 часа. Всё ещё хочешь?' : 'Правило 24 часов работает — желания ждут своего часа.'}</div>
      </div>
      ${icon('chevron-right', 16)}
    </button>` : ''}

    <div class="shopping-summary">
      <div class="shopping-summary-row">
        <div>
          <h2>Активные списки</h2>
          <div class="total">${money(totalPlanned)}</div>
          <div class="sub">${lists.length} ${plural(lists.length, 'список', 'списка', 'списков')} · ${totalItems} ${plural(totalItems, 'позиция', 'позиции', 'позиций')}${totalBudget ? ` · лимит ${money(totalBudget)}` : ''}</div>
        </div>
        <div class="summary-count">🛍️<br>${lists.reduce((a, l) => a + l.items.filter(i => i.bought).length, 0)} куплено</div>
      </div>
    </div>

    <div class="course-tools" style="grid-template-columns:repeat(3,1fr)">
      <button class="tool-card" type="button" data-history>
        <span class="tool-icon">${icon('clock', 16)}</span>
        <span class="tool-name">История</span>
        <span class="tool-count">${history.length ? `${history.length} походов` : 'Пока пусто'}</span>
      </button>
      <button class="tool-card" type="button" data-wishlist>
        <span class="tool-icon">${icon('clock', 16)}</span>
        <span class="tool-name">Вишлист</span>
        <span class="tool-count">${allWish.length ? `${allWish.length} отложено` : '0 желаний'}</span>
      </button>
      <a class="tool-card" href="#/calculators/unit">
        <span class="tool-icon">${icon('calc', 16)}</span>
        <span class="tool-name">Что выгоднее?</span>
        <span class="tool-count">цена за единицу</span>
      </a>
    </div>

    ${lists.length ? `<div class="section">
      ${sectionHead('Мои списки', `${lists.length}`)}
      ${lists.map(list => listCard(list)).join('')}
    </div>` : emptyState({
      emoji: '🛒',
      title: 'Создай первый список',
      text: 'Собери покупки заранее, поставь лимит и не покупай лишнего под влиянием момента.',
      action: `<button class="btn" type="button" data-new-list>Новый список</button>`
    })}

    <div class="section" style="margin-top:22px">
      ${sectionHead('Шаблоны', 'Повторить прошлый', 'data-history')}
      <div class="templates-grid">
        ${SHOP_TEMPLATES.map(t => `<button class="template-card" type="button" data-template="${t.id}">
          <div class="template-emoji">${t.emoji}</div>
          <div class="template-name">${esc(t.name)}</div>
          <div class="template-sub">${t.items.length} позиций · до ${money(t.budget)}</div>
        </button>`).join('')}
      </div>
    </div>

    <div class="section">
      <div class="card card--tight row" style="gap:12px;padding:15px 16px">
        <div class="icon-badge icon-badge--soft" style="color:var(--orange)">${icon('lightbulb', 20)}</div>
        <div class="grow"><div class="small strong">Правило 24 часов</div><div class="tiny tertiary">Откладывай желания в вишлист. Через сутки приложение спросит: «Всё ещё хочешь?» Часто ответ — нет.</div></div>
      </div>
    </div>
  </div>`;

  return {
    html,
    mount(root, ctx = {}) {
      root.querySelectorAll('[data-new-list]').forEach(btn => btn.addEventListener('click', () => openListSheet()));
      root.querySelectorAll('[data-template]').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = SHOP_TEMPLATES.find(x => x.id === btn.dataset.template);
          if (!t) return;
          const list = store.createListFromTemplate(t);
          toast('Список создан по шаблону', { emoji: t.emoji });
          location.hash = `#/shopping/list/${list.id}`;
        });
      });
      root.querySelectorAll('[data-history]').forEach(btn => btn.addEventListener('click', () => { location.hash = '#/shopping/history'; }));
      root.querySelectorAll('[data-wishlist]').forEach(btn => btn.addEventListener('click', () => openWishlistSheet()));
      root.querySelectorAll('[data-list-id]').forEach(card => card.addEventListener('click', () => { location.hash = `#/shopping/list/${card.dataset.listId}`; }));

      const q = ctx.query || query;
      if (q?.get?.('new') === '1') {
        history.replaceState(null, '', '#/shopping');
        openListSheet();
      }
    }
  };
}

function listCard(list) {
  const planned = sum(list.items, i => i.price * i.qty);
  const bought = list.items.filter(i => i.bought).length;
  const budgetPercent = list.budget ? percent(planned, list.budget) : 0;
  const over = list.budget && planned > list.budget;
  return `<button class="list-card" type="button" data-list-id="${list.id}">
    <div class="list-icon" style="--list-color:${list.color}">${list.emoji || '🛒'}</div>
    <div class="grow">
      <div class="row row--between" style="gap:8px">
        <div class="list-name">${esc(list.name)}</div>
        <div class="list-budget ${over ? 'text-red' : ''}">${money(planned)}<small>${list.budget ? `из ${money(list.budget)}` : 'без лимита'}</small></div>
      </div>
      <div class="list-meta"><span>${bought} из ${list.items.length} куплено</span>${list.budget ? `<span>·</span><span class="${over ? 'text-red' : ''}">${over ? 'лимит превышен' : `${Math.round(budgetPercent)}% лимита`}</span>` : ''}</div>
      ${list.budget ? `<div style="margin-top:7px">${progress(budgetPercent, over ? 'var(--red)' : list.color, 4)}</div>` : ''}
    </div>
    ${icon('chevron-right', 17, 'chev')}
  </button>`;
}

export function renderShoppingDetail({ params, query } = {}) {
  const list = store.getList(params.id);
  if (!list) return { html: `<div class="page">${backHead({ title: 'Список', back: '#/shopping' })}${emptyState({ emoji: '🧭', title: 'Список не найден', text: 'Возможно, он уже завершён или удалён.', action: '<button class="btn" data-nav="#/shopping" type="button">К покупкам</button>' })}</div>`, mount() {} };

  const filters = {
    need: query?.get('need') || 'all',
    category: query?.get('cat') || 'all',
    status: query?.get('status') || 'all',
    sort: query?.get('sort') || 'priority'
  };

  let items = [...list.items];
  if (filters.need !== 'all') items = items.filter(i => i.need === filters.need);
  if (filters.category !== 'all') items = items.filter(i => i.category === filters.category);
  if (filters.status === 'bought') items = items.filter(i => i.bought);
  if (filters.status === 'active') items = items.filter(i => !i.bought);
  items.sort((a, b) => {
    if (a.bought !== b.bought) return a.bought ? 1 : -1;
    if (filters.sort === 'priority') return (b.priority || 2) - (a.priority || 2);
    if (filters.sort === 'price') return (b.price * b.qty) - (a.price * a.qty);
    if (filters.sort === 'name') return a.name.localeCompare(b.name, 'ru');
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const planned = sum(list.items, i => i.price * i.qty);
  const actual = sum(list.items.filter(i => i.bought), i => i.actualPrice ?? i.price * i.qty);
  const remaining = list.budget ? list.budget - planned : null;
  const over = list.budget && planned > list.budget;
  const percentage = list.budget ? percent(planned, list.budget) : 0;
  const wantItems = list.items.filter(i => i.need === 'want');
  const wantPercent = list.items.length ? Math.round((wantItems.length / list.items.length) * 100) : 0;
  const monthIncome = store.getMonthSummary(monthKey()).income;
  const expensiveWish = list.items.find(i => !i.bought && i.need === 'want' && monthIncome > 0 && i.price * i.qty > monthIncome * 0.1);
  const wishlist = store.getAllWishlist().filter(w => w.listId === list.id);
  const boughtCount = list.items.filter(i => i.bought).length;

  let queryForLink = new URLSearchParams();
  const filterUrl = (patch) => {
    const p = new URLSearchParams({ ...filters, ...patch });
    [...p.entries()].forEach(([k, v]) => { if (v === 'all' || !v) p.delete(k); });
    const s = p.toString();
    return `#/shopping/list/${list.id}${s ? `?${s}` : ''}`;
  };

  const html = `<div class="page">
    ${backHead({
      title: esc(list.name),
      subtitle: `${list.items.length} ${plural(list.items.length, 'позиция', 'позиции', 'позиций')} · ${list.emoji}`,
      back: '#/shopping',
      action: `<button class="icon-btn icon-btn--glass" type="button" data-share aria-label="Поделиться списком">${icon('share', 18)}</button>`
    })}

    <div class="shop-head-stats">
      <div class="shop-stat">
        <div class="label">Плановая сумма</div>
        <div class="value">${money(planned)}</div>
      </div>
      <div class="shop-stat">
        <div class="label">Куплено фактически</div>
        <div class="value text-green">${money(actual)}</div>
      </div>
    </div>

    <div class="budget-progress ${over ? 'warn' : ''}">
      <div class="budget-progress-top">
        <span>${list.budget ? `Бюджет ${money(list.budget)}` : 'Лимит не задан'}</span>
        <span class="${over ? 'text-red' : ''}">${list.budget ? (over ? `перебор ${money(planned - list.budget)}` : `осталось ${money(remaining)}`) : 'совет: поставь лимит'}</span>
      </div>
      ${list.budget ? progress(percentage, over ? 'var(--red)' : (percentage > 80 ? 'var(--orange)' : 'var(--green)'), 7) : ''}
      <div class="row row--between" style="margin-top:7px">
        <span class="tiny tertiary">${boughtCount} из ${list.items.length} отмечено</span>
        <span class="tiny tertiary">${list.budget ? `${Math.round(percentage)}% лимита` : ''}</span>
      </div>
    </div>

    ${wantPercent >= 35 ? `<div class="smart-tip">${icon('lightbulb', 16, 'tip-bulb')}<span><strong>${wantPercent}% списка — это «Хочу».</strong> Проверь, что из этого действительно нужно сейчас.</span></div>` : ''}
    ${over ? `<div class="smart-tip" style="background:color-mix(in srgb,var(--red) 8%,transparent)">${icon('alert', 16, 'tip-bulb')}<span><strong>Ты превысишь бюджет на ${money(planned - list.budget)}.</strong> Убери что-нибудь из «Хочу» или снизь количество.</span></div>` : ''}
    ${expensiveWish ? `<div class="smart-tip">${icon('clock', 16, 'tip-bulb')}<span><strong>«${esc(expensiveWish.name)}» стоит больше 10% твоего дохода за месяц.</strong> Отложи на 24 часа и реши без импульса.</span></div>` : ''}

    <div class="quick-add">
      <div class="input-group">
        <input class="input" id="quick-item" type="text" placeholder="Добавить товар…" autocomplete="off" aria-label="Быстро добавить товар">
        <div class="autocomplete hidden" id="quick-suggest"></div>
      </div>
      <button class="btn" type="button" id="quick-add-btn" aria-label="Добавить товар">${icon('plus', 21)}</button>
    </div>

    <div class="shop-toolbar">
      <div class="chip-scroll">
        <a class="chip ${filters.status === 'all' && filters.need === 'all' ? 'active' : ''}" href="${filterUrl({ status: 'all', need: 'all' })}">Все</a>
        <a class="chip ${filters.need === 'need' ? 'chip--blue active' : ''}" href="${filterUrl({ need: 'need', status: 'all' })}">Нужно</a>
        <a class="chip ${filters.need === 'want' ? 'chip--blue active' : ''}" href="${filterUrl({ need: 'want', status: 'all' })}">Хочу</a>
        <a class="chip ${filters.status === 'bought' ? 'active' : ''}" href="${filterUrl({ status: 'bought' })}">Куплено</a>
      </div>
      <button class="icon-btn icon-btn--sm" type="button" data-filter aria-label="Фильтры и сортировка" style="${filters.category !== 'all' || filters.sort !== 'priority' ? 'background:var(--blue);color:#fff' : ''}">${icon('filter', 15)}</button>
    </div>

    ${items.length ? `<div class="shop-items" id="shop-items">
      ${items.map(item => shopItem(item, list)).join('')}
    </div>` : emptyState({
      emoji: list.items.length ? '🎛️' : '🧺',
      title: list.items.length ? 'Под фильтр ничего не подошло' : 'Список пока пуст',
      text: list.items.length ? 'Попробуй изменить фильтры или добавь новую позицию.' : 'Добавь первый товар — можно быстро, с ценой и категорией.',
      action: `<button class="btn" type="button" data-add-item>Добавить товар</button>`
    })}

    ${wishlist.length ? `<div class="section" style="margin-top:18px">
      ${sectionHead('Отложенные желания', `${wishlist.length}`)}
      ${wishlist.map(w => `<div class="card card--tight row" style="gap:10px;padding:12px 14px;margin-bottom:7px">
        <div class="icon-badge icon-badge--soft" style="color:var(--orange)">${icon('clock', 18)}</div>
        <div class="grow"><div class="small strong">${esc(w.name)}</div><div class="tiny tertiary">${new Date(w.remindAt) > Date.now() ? `Проверить ${formatDateShort(w.remindAt)}` : 'Можно проверить сейчас'}</div></div>
        <div class="small strong">${money(w.price)}</div>
      </div>`).join('')}
    </div>` : ''}

    <div class="shop-footer">
      <div class="btn-row">
        <button class="btn btn--secondary" type="button" data-add-item>${icon('plus', 17)} Товар</button>
        <button class="btn btn--green" type="button" data-finish ${boughtCount ? '' : 'disabled'}>Поход закончен ${icon('check', 17)}</button>
      </div>
      <button class="btn btn--ghost btn--wide" type="button" data-postpone-all style="margin-top:5px;font-size:12px">Отложить все «Хочу» на 24 часа</button>
    </div>
  </div>`;

  return {
    html,
    mount(root) {
      const quick = root.querySelector('#quick-item');
      const suggest = root.querySelector('#quick-suggest');
      const quickAdd = root.querySelector('#quick-add-btn');

      const recentList = Object.values(store.state.shopping.recent);
      const showSuggest = () => {
        const q = quick.value.trim().toLowerCase();
        if (!q) { suggest.classList.add('hidden'); return; }
        const matches = recentList.filter(r => r.name.toLowerCase().includes(q)).slice(0, 6);
        if (!matches.length) { suggest.classList.add('hidden'); return; }
        suggest.innerHTML = matches.map(r => `<button type="button" data-suggest="${esc(r.name)}"><span>${esc(r.name)}</span><span class="ac-price">${money(r.price)}</span></button>`).join('');
        suggest.classList.remove('hidden');
        suggest.querySelectorAll('[data-suggest]').forEach(btn => {
          btn.addEventListener('click', () => {
            quick.value = btn.dataset.suggest;
            const item = recentList.find(r => r.name === btn.dataset.suggest);
            if (item) quick.dataset.price = item.price;
            suggest.classList.add('hidden');
            quick.focus();
          });
        });
      };
      quick?.addEventListener('input', showSuggest);
      quick?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addQuick(); }
        if (e.key === 'Escape') suggest.classList.add('hidden');
      });
      const addQuick = () => {
        const name = quick.value.trim();
        if (!name) { openItemSheet(list.id); return; }
        const recent = store.state.shopping.recent[name.toLowerCase()];
        store.addShoppingItem(list.id, {
          name,
          qty: 1,
          unit: recent?.unit || 'шт',
          price: recent?.price || 0,
          category: recent?.category || 'Другое',
          need: 'need'
        });
        toast('Товар добавлен', { emoji: '🛒', xp: 2 });
        playSound('tap');
        rerender();
      };
      quickAdd?.addEventListener('click', () => {
        if (quick.value.trim()) addQuick();
        else openItemSheet(list.id);
      });
      root.querySelectorAll('[data-add-item]').forEach(b => b.addEventListener('click', () => openItemSheet(list.id)));
      root.querySelector('[data-filter]')?.addEventListener('click', () => openFilterSheet(list.id, filters));
      root.querySelector('[data-share]')?.addEventListener('click', () => shareList(list));
      root.querySelector('[data-finish]')?.addEventListener('click', () => finishList(list));
      root.querySelector('[data-postpone-all]')?.addEventListener('click', async () => {
        const wants = list.items.filter(i => i.need === 'want' && !i.bought);
        if (!wants.length) { toast('В списке нет активных желаний', { emoji: '✨' }); return; }
        const ok = await confirmSheet({
          title: `Отложить ${wants.length} ${plural(wants.length, 'желание', 'желания', 'желаний')}?`,
          text: 'Они уйдут в вишлист на 24 часа. Через сутки приложение напомнит и спросит, всё ли ещё хочется.',
          iconName: 'clock',
          confirmLabel: 'Отложить',
          cancelLabel: 'Оставить'
        });
        if (!ok) return;
        wants.forEach(i => store.postponeToWishlist(list.id, i.id));
        toast('Желания ждут 24 часа', { emoji: '⏳' });
        rerender();
      });

      root.querySelectorAll('.shop-item').forEach(row => {
        const item = list.items.find(i => i.id === row.dataset.itemId);
        if (!item) return;
        const check = row.querySelector('.shop-check');
        check?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.bought) {
            store.markItemBought(list.id, item.id, false);
            rerender();
          } else {
            openActualPriceSheet(list, item);
          }
        });
        row.querySelector('.shop-item-copy')?.addEventListener('click', () => openItemSheet(list.id, item));
        row.querySelector('[data-item-menu]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          openItemActions(list, item);
        });
        bindSwipe(row, {
          onLeft: async () => {
            const ok = await confirmSheet({
              title: 'Удалить товар?',
              text: `«${item.name}» исчезнет из списка.`,
              iconName: 'trash', confirmLabel: 'Удалить', danger: true
            });
            if (ok) { store.removeShoppingItem(list.id, item.id); toast('Товар удалён', { emoji: '🗑️' }); rerender(); }
            else rerender();
          },
          onRight: () => {
            if (item.bought) return;
            store.markItemBought(list.id, item.id, true);
            toast('Куплено', { emoji: '✅' });
            rerender();
          }
        });
      });
      root.querySelectorAll('.shop-item').forEach(row => {
        const item = list.items.find(i => i.id === row.dataset.itemId);
        if (item?.bought) {
          row.querySelector('.shop-item-copy')?.addEventListener('click', () => openItemSheet(list.id, item));
        }
      });
    }
  };
}

function shopItem(item, list) {
  const total = item.price * item.qty;
  const category = SHOP_CATEGORIES[item.category] || SHOP_CATEGORIES['Другое'];
  const priorityLabel = item.priority === 3 ? 'высокий' : item.priority === 1 ? 'низкий' : 'средний';
  return `<div class="shop-item ${item.bought ? 'bought' : ''}" data-item-id="${item.id}">
    <div class="swipe-hint left">${icon('trash', 16)} Удалить</div>
    <div class="swipe-hint right">${icon('check', 16)} Куплено</div>
    <div class="swipe-inner">
      <button class="shop-check ${item.bought ? 'done' : ''}" type="button" aria-label="${item.bought ? 'Вернуть в список' : 'Отметить купленным'}">${icon('check', 15)}</button>
      <div class="shop-item-copy" role="button" tabindex="0" aria-label="Редактировать ${esc(item.name)}">
        <div class="shop-item-name">${esc(item.name)}</div>
        <div class="shop-item-meta">
          <span>${category.emoji} ${esc(item.category)}</span>
          <span class="tag ${item.need === 'want' ? 'tag--want' : 'tag--need'}">${item.need === 'want' ? 'Хочу' : 'Нужно'}</span>
          ${item.priority === 3 ? '<span class="tag" style="background:color-mix(in srgb,var(--red) 10%,transparent);color:var(--red)">важно</span>' : ''}
          ${item.note ? `<span title="${esc(item.note)}">📝</span>` : ''}
        </div>
      </div>
      <div class="shop-item-price">
        <div class="price">${money(item.bought ? (item.actualPrice ?? total) : total)}</div>
        <div class="qty">${formatQty(item.qty)} ${esc(item.unit)}${item.price ? ` × ${money(item.price)}` : ''}</div>
      </div>
      <button class="shop-item-menu" type="button" data-item-menu aria-label="Действия с товаром">${icon('more', 18)}</button>
    </div>
  </div>`;
}

function bindSwipe(row, { onLeft, onRight }) {
  const inner = row.querySelector('.swipe-inner');
  let startX = 0, startY = 0, dx = 0, active = false, horizontal = false;
  inner.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    startX = e.clientX; startY = e.clientY; dx = 0; active = true; horizontal = false;
  });
  inner.addEventListener('pointermove', (e) => {
    if (!active) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;
    if (!horizontal) {
      if (Math.abs(mx) > Math.abs(my) + 5 && Math.abs(mx) > 8) {
        horizontal = true;
        row.classList.add('is-dragging');
        inner.setPointerCapture?.(e.pointerId);
      } else if (Math.abs(my) > 10) {
        active = false;
        return;
      }
    }
    if (!horizontal) return;
    e.preventDefault();
    dx = clamp(mx, -110, 110);
    inner.style.transform = `translateX(${dx}px)`;
  });
  const end = () => {
    if (!active) return;
    active = false;
    row.classList.remove('is-dragging');
    inner.style.transform = '';
    if (dx < -62) onLeft();
    else if (dx > 62) onRight();
    dx = 0;
    horizontal = false;
  };
  inner.addEventListener('pointerup', end);
  inner.addEventListener('pointercancel', end);
  inner.addEventListener('pointerleave', (e) => { if (active && e.buttons === 0) end(); });
}

function openListSheet() {
  const { body } = openSheet({
    title: 'Новый список',
    subtitle: 'Название, лимит и цвет помогут не потеряться среди покупок.',
    body: `<form id="list-form">
      <div class="field" style="margin-bottom:12px">
        <label class="field-label" for="list-name">Название</label>
        <input class="input" id="list-name" name="name" type="text" maxlength="60" placeholder="Например, продукты на неделю" required autocomplete="off">
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label" for="list-budget">Лимит</label>
          <div class="input-group"><input class="input" id="list-budget" name="budget" type="number" min="0" step="1" inputmode="decimal" placeholder="0"><span class="input-suffix">${CURRENCIES[store.state.settings.currency]?.symbol || 'BYN'}</span></div>
        </div>
        <div class="field">
          <label class="field-label" for="list-emoji">Иконка</label>
          <select class="select" id="list-emoji" name="emoji">${EMOJIS.map(e => `<option>${e}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field" style="margin-top:12px">
        <span class="field-label">Цвет</span>
        <div class="chip-scroll" id="color-row">
          ${COLORS.map((c, i) => `<button class="color-chip ${i === 0 ? 'active' : ''}" type="button" data-color="${c}" aria-label="Цвет ${i + 1}" style="width:31px;height:31px;border-radius:50%;border:2px solid ${i === 0 ? 'var(--label)' : 'transparent'};background:${c};padding:0;flex:none"></button>`).join('')}
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn--secondary" type="button" data-sheet-close>Отмена</button>
        <button class="btn" type="submit">Создать</button>
      </div>
    </form>`,
    onMount(bodyEl, close) {
      let color = COLORS[0];
      bodyEl.querySelectorAll('[data-color]').forEach(btn => {
        btn.addEventListener('click', () => {
          color = btn.dataset.color;
          bodyEl.querySelectorAll('[data-color]').forEach(b => b.style.border = `2px solid ${b === btn ? 'var(--label)' : 'transparent'}`);
        });
      });
      bodyEl.querySelector('#list-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const list = store.createList({ name: fd.get('name'), emoji: fd.get('emoji'), budget: fd.get('budget'), color });
        close();
        playSound('success');
        toast('Список создан', { emoji: list.emoji, xp: 5 });
        location.hash = `#/shopping/list/${list.id}`;
      });
      setTimeout(() => bodyEl.querySelector('#list-name')?.focus({ preventScroll: true }), 420);
    }
  });
}

function openActualPriceSheet(list, item) {
  const planned = item.price * item.qty;
  const { body } = openSheet({
    title: 'Сколько потратил?',
    subtitle: `«${item.name}». Можно оставить плановую сумму или ввести фактическую.`,
    body: `<form id="actual-form">
      <div class="field" style="margin-bottom:12px">
        <label class="field-label" for="actual-price">Фактическая сумма за всю позицию</label>
        <div class="input-group"><input class="input" id="actual-price" name="actual" type="number" inputmode="decimal" step="0.01" min="0" value="${planned}"><span class="input-suffix">${CURRENCIES[store.state.settings.currency]?.symbol || 'BYN'}</span></div>
      </div>
      <div class="card card--tight" style="box-shadow:none;background:var(--fill);padding:11px 12px;margin-bottom:10px">
        <div class="tiny secondary">План: ${formatQty(item.qty)} ${esc(item.unit)} × ${money(item.price)} = <strong>${money(planned)}</strong></div>
      </div>
      <div class="form-actions">
        <button class="btn btn--secondary" type="button" data-sheet-close>Отмена</button>
        <button class="btn btn--green" type="submit">Куплено</button>
      </div>
    </form>`,
    onMount(bodyEl, close) {
      bodyEl.querySelector('#actual-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const value = Number(new FormData(e.currentTarget).get('actual'));
        store.markItemBought(list.id, item.id, true, value);
        close();
        toast('Отмечено как купленное', { emoji: '✅' });
        rerender();
      });
      setTimeout(() => bodyEl.querySelector('#actual-price')?.select(), 420);
    }
  });
}

function openItemSheet(listId, item = null) {
  const isEdit = !!item;
  const { body } = openSheet({
    title: isEdit ? 'Редактировать товар' : 'Новый товар',
    subtitle: isEdit ? 'Измени количество, цену или метку.' : 'Чем точнее данные, тем умнее подсказки.',
    body: `<form id="item-form">
      <div class="field" style="margin-bottom:12px">
        <label class="field-label" for="item-name">Название</label>
        <input class="input" id="item-name" name="name" type="text" maxlength="100" required autocomplete="off" value="${esc(item?.name || '')}" placeholder="Например, молоко">
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label" for="item-qty">Количество</label>
          <input class="input" id="item-qty" name="qty" type="number" min="0.01" step="0.01" inputmode="decimal" value="${item?.qty ?? 1}">
        </div>
        <div class="field">
          <label class="field-label" for="item-unit">Единица</label>
          <select class="select" id="item-unit" name="unit">${['шт', 'кг', 'л', 'уп', 'пач', 'м'].map(u => `<option ${item?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label class="field-label" for="item-price">Цена за единицу</label>
          <div class="input-group"><input class="input" id="item-price" name="price" type="number" min="0" step="0.01" inputmode="decimal" value="${item?.price ?? ''}" placeholder="0"><span class="input-suffix">${CURRENCIES[store.state.settings.currency]?.symbol || 'BYN'}</span></div>
        </div>
        <div class="field">
          <label class="field-label" for="item-category">Категория</label>
          <select class="select" id="item-category" name="category">${Object.keys(SHOP_CATEGORIES).map(c => `<option ${item?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field" style="margin-top:12px">
        <span class="field-label">Это…</span>
        <div class="segmented" id="need-seg">
          <button type="button" data-need="need" class="${item?.need !== 'want' ? 'active' : ''}">Нужно</button>
          <button type="button" data-need="want" class="${item?.need === 'want' ? 'active' : ''}">Хочу</button>
        </div>
      </div>
      <div class="field" style="margin-top:12px">
        <label class="field-label" for="item-priority">Приоритет</label>
        <select class="select" id="item-priority" name="priority">
          <option value="1" ${item?.priority === 1 ? 'selected' : ''}>Низкий</option>
          <option value="2" ${item?.priority === 2 || !item ? 'selected' : ''}>Средний</option>
          <option value="3" ${item?.priority === 3 ? 'selected' : ''}>Высокий</option>
        </select>
      </div>
      <div class="field" style="margin-top:12px">
        <label class="field-label" for="item-note">Заметка</label>
        <input class="input" id="item-note" name="note" type="text" maxlength="200" value="${esc(item?.note || '')}" placeholder="Необязательно">
      </div>
      <div class="form-actions">
        ${isEdit ? `<button class="btn btn--secondary" type="button" data-delete>Удалить</button>` : `<button class="btn btn--secondary" type="button" data-sheet-close>Отмена</button>`}
        <button class="btn" type="submit">${isEdit ? 'Сохранить' : 'Добавить'}</button>
      </div>
    </form>`,
    onMount(bodyEl, close) {
      let need = item?.need || 'need';
      bodyEl.querySelectorAll('[data-need]').forEach(btn => btn.addEventListener('click', () => {
        need = btn.dataset.need;
        bodyEl.querySelectorAll('[data-need]').forEach(b => b.classList.toggle('active', b === btn));
      }));
      bodyEl.querySelector('#item-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const data = {
          name: fd.get('name'), qty: fd.get('qty'), unit: fd.get('unit'), price: fd.get('price'),
          category: fd.get('category'), need, priority: fd.get('priority'), note: fd.get('note')
        };
        if (!String(data.name).trim()) { toast('Введи название товара', { emoji: '⚠️' }); return; }
        if (isEdit) store.updateShoppingItem(listId, item.id, { ...data, qty: Number(data.qty) || 1, price: Number(data.price) || 0, priority: Number(data.priority) || 2 });
        else store.addShoppingItem(listId, data);
        close();
        toast(isEdit ? 'Изменения сохранены' : 'Товар добавлен', { emoji: isEdit ? '✏️' : '🛒', xp: isEdit ? 0 : 2 });
        rerender();
      });
      bodyEl.querySelector('[data-delete]')?.addEventListener('click', async () => {
        const ok = await confirmSheet({ title: 'Удалить товар?', text: 'Действие нельзя отменить.', iconName: 'trash', confirmLabel: 'Удалить', danger: true });
        if (!ok) return;
        store.removeShoppingItem(listId, item.id);
        close();
        toast('Товар удалён', { emoji: '🗑️' });
        rerender();
      });
      setTimeout(() => bodyEl.querySelector('#item-name')?.focus({ preventScroll: true }), 420);
    }
  });
}

function openItemActions(list, item) {
  const { body, close } = openSheet({
    title: item.name,
    subtitle: `${formatQty(item.qty)} ${item.unit} · ${money(item.price * item.qty)}`,
    body: `<div class="stack" style="padding-bottom:5px">
      <button class="settings-row" type="button" data-edit>${icon('edit', 19)}<span class="settings-label">Редактировать</span>${icon('chevron-right', 16)}</button>
      ${item.need === 'want' && !item.bought ? `<button class="settings-row" type="button" data-postpone>${icon('clock', 19)}<span class="settings-label">Отложить на 24 часа</span>${icon('chevron-right', 16)}</button>` : ''}
      <button class="settings-row" type="button" data-toggle>${icon(item.bought ? 'rotate' : 'check', 19)}<span class="settings-label">${item.bought ? 'Вернуть в список' : 'Отметить купленным'}</span>${icon('chevron-right', 16)}</button>
      <button class="settings-row" type="button" data-del style="color:var(--red)">${icon('trash', 19)}<span class="settings-label" style="color:var(--red)">Удалить</span>${icon('chevron-right', 16)}</button>
    </div>`,
    onMount(bodyEl, closeFn) {
      bodyEl.querySelector('[data-edit]').addEventListener('click', () => { closeFn(); openItemSheet(list.id, item); });
      bodyEl.querySelector('[data-postpone]')?.addEventListener('click', () => {
        store.postponeToWishlist(list.id, item.id);
        closeFn(); toast('Отложено на 24 часа', { emoji: '⏳' }); rerender();
      });
      bodyEl.querySelector('[data-toggle]').addEventListener('click', () => {
        if (item.bought) { store.markItemBought(list.id, item.id, false); closeFn(); rerender(); }
        else { closeFn(); openActualPriceSheet(list, item); }
      });
      bodyEl.querySelector('[data-del]').addEventListener('click', async () => {
        closeFn();
        const ok = await confirmSheet({ title: 'Удалить товар?', text: `«${item.name}» исчезнет из списка.`, iconName: 'trash', confirmLabel: 'Удалить', danger: true });
        if (ok) { store.removeShoppingItem(list.id, item.id); toast('Товар удалён', { emoji: '🗑️' }); rerender(); }
      });
    }
  });
}

function openFilterSheet(listId, filters) {
  const categories = ['all', ...Object.keys(SHOP_CATEGORIES)];
  const { body } = openSheet({
    title: 'Фильтры и сортировка',
    body: `<form id="filter-form">
      <div class="field" style="margin-bottom:12px">
        <label class="field-label" for="filter-status">Статус</label>
        <select class="select" id="filter-status" name="status">
          <option value="all" ${filters.status === 'all' ? 'selected' : ''}>Все</option>
          <option value="active" ${filters.status === 'active' ? 'selected' : ''}>Только не купленные</option>
          <option value="bought" ${filters.status === 'bought' ? 'selected' : ''}>Только купленные</option>
        </select>
      </div>
      <div class="field" style="margin-bottom:12px">
        <label class="field-label" for="filter-need">Метка</label>
        <select class="select" id="filter-need" name="need">
          <option value="all" ${filters.need === 'all' ? 'selected' : ''}>Все</option>
          <option value="need" ${filters.need === 'need' ? 'selected' : ''}>Нужно</option>
          <option value="want" ${filters.need === 'want' ? 'selected' : ''}>Хочу</option>
        </select>
      </div>
      <div class="field" style="margin-bottom:12px">
        <label class="field-label" for="filter-cat">Категория</label>
        <select class="select" id="filter-cat" name="cat">${categories.map(c => `<option value="${c}" ${filters.category === c ? 'selected' : ''}>${c === 'all' ? 'Все категории' : c}</option>`).join('')}</select>
      </div>
      <div class="field" style="margin-bottom:12px">
        <label class="field-label" for="filter-sort">Сортировка</label>
        <select class="select" id="filter-sort" name="sort">
          <option value="priority" ${filters.sort === 'priority' ? 'selected' : ''}>Сначала важные</option>
          <option value="price" ${filters.sort === 'price' ? 'selected' : ''}>Сначала дорогие</option>
          <option value="name" ${filters.sort === 'name' ? 'selected' : ''}>По названию</option>
          <option value="new" ${filters.sort === 'new' ? 'selected' : ''}>Сначала новые</option>
        </select>
      </div>
      <div class="form-actions">
        <button class="btn btn--secondary" type="button" data-reset>Сбросить</button>
        <button class="btn" type="submit">Применить</button>
      </div>
    </form>`,
    onMount(bodyEl, close) {
      bodyEl.querySelector('#filter-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const p = new URLSearchParams();
        for (const [k, v] of fd.entries()) if (v !== 'all' && !(k === 'sort' && v === 'priority')) p.set(k, v);
        close();
        location.hash = `#/shopping/list/${listId}${p.toString() ? `?${p}` : ''}`;
      });
      bodyEl.querySelector('[data-reset]').addEventListener('click', () => {
        close();
        location.hash = `#/shopping/list/${listId}`;
      });
    }
  });
}

function finishList(list) {
  const bought = list.items.filter(i => i.bought);
  if (!bought.length) { toast('Сначала отметь купленные товары', { emoji: '🛍️' }); return; }
  const total = sum(bought, i => i.actualPrice ?? i.price * i.qty);
  const byCategory = {};
  bought.forEach(i => { const amount = i.actualPrice ?? i.price * i.qty; byCategory[i.category] = (byCategory[i.category] || 0) + amount; });
  const notBought = list.items.length - bought.length;
  openSheet({
    title: 'Поход закончен?',
    subtitle: 'Проверь сумму. Расход можно сразу добавить в бюджет — с разбивкой по категориям.',
    body: `<div class="confirm-icon" style="background:color-mix(in srgb,var(--green) 11%,transparent);color:var(--green)">${icon('check-circle', 28)}</div>
      <div class="confirm-title">${money(total)}</div>
      <p class="confirm-text">${bought.length} ${plural(bought.length, 'позиция', 'позиции', 'позиций')} куплено${notBought ? `, ${notBought} останется неотмеченными` : ''}. ${list.budget ? `Лимит списка: ${money(list.budget)}.` : ''}</p>
      <div class="confirm-summary">
        ${Object.entries(byCategory).map(([cat, val]) => `<div class="row row--between" style="padding:3px 0"><span class="small">${esc(cat)}</span><span class="small strong">${money(val)}</span></div>`).join('')}
      </div>
      <label class="checkbox" style="margin-bottom:16px"><input type="checkbox" id="add-budget" checked> Добавить сумму в бюджет как расходы</label>
      <div class="form-actions">
        <button class="btn btn--secondary" type="button" data-sheet-close>Ещё нет</button>
        <button class="btn btn--green" type="button" data-confirm-finish>Завершить</button>
      </div>`,
    onMount(bodyEl, close) {
      bodyEl.querySelector('[data-confirm-finish]').addEventListener('click', () => {
        const add = bodyEl.querySelector('#add-budget').checked;
        const history = store.completeList(list.id, { addToBudget: add });
        close();
        celebrate(1.2);
        playSound('success');
        toast('Список сохранён в историю', { emoji: '🎉', xp: 15 });
        location.hash = '#/shopping';
      });
    }
  });
}

function shareList(list) {
  const currency = store.state.settings.currency;
  const lines = [`🛒 ${list.name}`, ''];
  list.items.forEach(i => {
    lines.push(`${i.bought ? '✓' : '•'} ${i.name} — ${formatQty(i.qty)} ${i.unit}${i.price ? ` × ${formatMoney(i.price, currency)}` : ''}${i.need === 'want' ? ' (хочу)' : ''}`);
  });
  const total = list.items.reduce((acc, i) => acc + i.price * i.qty, 0);
  lines.push('', `План: ${formatMoney(total, currency)}`, list.budget ? `Лимит: ${formatMoney(list.budget, currency)}` : '', '— из приложения «Копейка»');
  const text = lines.filter(Boolean).join('\n');
  if (navigator.share) {
    navigator.share({ title: list.name, text }).catch(() => {});
  } else {
    copyText(text).then(() => toast('Список скопирован', { emoji: '📋' })).catch(() => toast('Не удалось скопировать', { emoji: '⚠️' }));
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.append(ta); ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy failed');
}

export function openWishlistSheet() {
  const all = store.getAllWishlist();
  const due = store.getDueWishlist();
  const { body } = openSheet({
    title: 'Вишлист · правило 24 часов',
    subtitle: 'Желания, которые ты решил не покупать сразу. Через сутки можно выбрать: всё ещё хочу или отпустить.',
    body: all.length ? `<div class="stack">${all.map(w => {
      const isDue = new Date(w.remindAt) <= new Date();
      return `<div class="card card--tight" style="padding:13px 14px">
        <div class="row row--between" style="align-items:flex-start;gap:10px">
          <div class="grow"><div class="small strong">${esc(w.name)}</div><div class="tiny tertiary">${esc(w.category)} · ${money(w.price)}</div></div>
          <span class="tag ${isDue ? 'tag--want' : 'tag--wish'}">${isDue ? 'можно решить' : `до ${formatDateShort(w.remindAt)}`}</span>
        </div>
        ${isDue ? `<div class="btn-row" style="margin-top:10px">
          <button class="btn btn--sm btn--secondary" type="button" data-letgo="${w.id}">Уже не хочу</button>
          <button class="btn btn--sm" type="button" data-still="${w.id}">Всё ещё хочу</button>
        </div>` : `<div class="tiny tertiary" style="margin-top:8px">Мы напомним, когда пройдут 24 часа.</div>`}
      </div>`;
    }).join('')}</div>` : emptyState({ emoji: '⏳', title: 'Вишлист пуст', text: 'Отложи желание из списка покупок — и через 24 часа приложение спросит, нужно ли оно тебе.' }),
    onMount(bodyEl, close) {
      bodyEl.querySelectorAll('[data-letgo]').forEach(btn => {
        btn.addEventListener('click', () => {
          const wish = store.state.shopping.wishlist.find(w => w.id === btn.dataset.letgo);
          store.removeWishlistItem(wish.id);
          store.state.stats.wishlistResisted = (store.state.stats.wishlistResisted || 0) + 1;
          store.addXP(5);
          store.save();
          toast('Отпущено. Эти деньги остаются с тобой', { emoji: '🧘', xp: 5 });
          close(); rerender();
        });
      });
      bodyEl.querySelectorAll('[data-still]').forEach(btn => {
        btn.addEventListener('click', () => {
          const wish = store.state.shopping.wishlist.find(w => w.id === btn.dataset.still);
          if (!wish) return;
          let list = store.state.shopping.lists.find(l => l.id === wish.listId) || store.state.shopping.lists[0];
          if (!list) list = store.createList({ name: 'Желания', emoji: '💫', color: '#AF52DE' });
          store.addShoppingItem(list.id, { name: wish.name, price: wish.price, category: wish.category, need: 'want' });
          store.removeWishlistItem(wish.id);
          close();
          toast('Добавлено в список', { emoji: '🛍️' });
          rerender();
        });
      });
    }
  });
}

export function renderShoppingHistory() {
  const history = store.state.shopping.history;
  const allItems = history.flatMap(h => h.items || []);
  const byCategory = {};
  history.forEach(h => {
    Object.entries(h.byCategory || {}).forEach(([c, v]) => { byCategory[c] = (byCategory[c] || 0) + Number(v); });
  });
  const catEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...catEntries.map(x => x[1]));
  const needsTotal = allItems.filter(i => i.bought && i.need !== 'want').reduce((a, i) => a + (i.actualPrice || i.price * i.qty), 0);
  const wantsTotal = allItems.filter(i => i.bought && i.need === 'want').reduce((a, i) => a + (i.actualPrice || i.price * i.qty), 0);
  const allTotal = needsTotal + wantsTotal;
  const freq = {};
  allItems.forEach(i => { if (i.bought) freq[i.name] = (freq[i.name] || 0) + 1; });
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const weekly = {};
  history.forEach(h => {
    const d = new Date(h.date);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    weekly[key] = (weekly[key] || 0) + h.total;
  });
  const weeks = Object.entries(weekly).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  const maxWeek = Math.max(1, ...weeks.map(w => w[1]));

  const html = `<div class="page">
    ${backHead({ title: 'История покупок', subtitle: `${history.length} ${plural(history.length, 'поход', 'похода', 'походов')} в архиве`, back: '#/shopping' })}
    ${history.length ? `
      <div class="card card--padded" style="margin-bottom:14px">
        <div class="section-title" style="font-size:15px;margin-bottom:12px">Траты по категориям</div>
        ${catEntries.map(([c, v]) => `<div class="row" style="gap:10px;margin-bottom:9px">
          <span class="tiny" style="width:104px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--label-secondary)">${esc(c)}</span>
          <div style="flex:1;height:7px;background:var(--fill);border-radius:9px;overflow:hidden"><span style="display:block;height:100%;width:${(v / maxCat) * 100}%;background:${SHOP_CATEGORIES[c]?.color || 'var(--blue)'};border-radius:9px"></span></div>
          <span class="tiny strong" style="min-width:58px;text-align:right">${money(v)}</span>
        </div>`).join('')}
      </div>
      <div class="card card--padded" style="margin-bottom:14px">
        <div class="row row--between" style="margin-bottom:7px"><span class="section-title" style="font-size:15px">Нужно / Хочу</span><span class="tiny tertiary">${Math.round(percent(wantsTotal, allTotal || 1))}% желаний</span></div>
        <div class="summary-bar" style="height:12px;border-radius:6px">
          <span style="width:${percent(needsTotal, allTotal || 1)}%;background:var(--green);border-radius:6px"></span>
          <span style="width:${percent(wantsTotal, allTotal || 1)}%;background:var(--purple);border-radius:6px"></span>
        </div>
        <div class="row row--between" style="margin-top:8px"><span class="tiny"><span class="dot" style="color:var(--green);display:inline-block"></span> Нужно · ${money(needsTotal)}</span><span class="tiny"><span class="dot" style="color:var(--purple);display:inline-block"></span> Хочу · ${money(wantsTotal)}</span></div>
      </div>
      <div class="card card--padded" style="margin-bottom:14px">
        <div class="section-title" style="font-size:15px;margin-bottom:12px">Динамика по неделям</div>
        <div style="display:flex;align-items:flex-end;gap:8px;height:116px;padding-top:6px">
          ${weeks.length ? weeks.map(([week, amount]) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:5px">
            <span class="tiny tertiary" style="font-size:8px">${Math.round(amount)}</span>
            <div style="width:100%;max-width:24px;height:${Math.max(6, (amount / maxWeek) * 80)}px;background:var(--blue);border-radius:6px 6px 3px 3px"></div>
            <span class="tiny tertiary" style="font-size:8px">${formatDateShort(week).replace(' ', '\n')}</span>
          </div>`).join('') : '<div class="tiny tertiary">Пока нет данных</div>'}
        </div>
      </div>
      <div class="card card--padded" style="margin-bottom:14px">
        <div class="section-title" style="font-size:15px;margin-bottom:10px">Самые частые покупки</div>
        ${top.length ? top.map(([name, count]) => `<div class="row row--between" style="padding:6px 0;border-bottom:1px solid var(--separator)"><span class="small">${esc(name)}</span><span class="chip">${count} ${plural(count, 'раз', 'раза', 'раз')}</span></div>`).join('') : '<div class="tiny tertiary">Пока нет покупок.</div>'}
      </div>
      <div class="section-head"><h2 class="section-title">Походы</h2></div>
      ${history.map(h => `<div class="card card--tight" style="padding:14px 15px;margin-bottom:8px">
        <div class="row row--between" style="gap:10px">
          <div class="row" style="gap:10px"><div class="list-icon" style="--list-color:var(--blue);width:38px;height:38px;border-radius:12px;font-size:18px">${h.emoji || '🛒'}</div>
            <div><div class="small strong">${esc(h.listName)}</div><div class="history-date">${formatDate(h.date)} · ${h.boughtCount} из ${h.itemCount}</div></div>
          </div>
          <div style="text-align:right"><div class="small strong">${money(h.total)}</div><button class="section-link tiny" type="button" data-repeat="${h.id}" style="font-size:10px">Повторить</button></div>
        </div>
      </div>`).join('')}
    ` : emptyState({ emoji: '📊', title: 'История пока пуста', text: 'Заверши первый список покупок — здесь появятся траты по категориям, доля «Хочу» и динамика по неделям.', action: `<button class="btn" type="button" data-nav="#/shopping">Создать список</button>` })}
  </div>`;

  return {
    html,
    mount(root) {
      root.querySelectorAll('[data-repeat]').forEach(btn => {
        btn.addEventListener('click', () => {
          const list = store.repeatList(btn.dataset.repeat);
          if (list) { toast('Список повторён', { emoji: '🔁' }); location.hash = `#/shopping/list/${list.id}`; }
        });
      });
    }
  };
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

function formatQty(qty) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(qty) || 0);
}
