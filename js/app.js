/* Запуск приложения, маршрутизация, тема, PWA, достижения и время в приложении. */
import { store } from './store.js';
import { icon } from './ui/icons.js';
import { renderHome } from './ui/home.js';
import {
  renderCourse, renderModule, renderLesson, renderModuleTest,
  renderBookmarks, renderMistakes, renderGlossary
} from './ui/course.js';
import { renderShopping, renderShoppingDetail, renderShoppingHistory } from './ui/shopping.js';
import { renderBudget } from './ui/budget.js';
import { renderCalculators, renderCalculator, calculatorList } from './ui/calculators.js';
import { renderProfile, renderAchievements, renderSettings } from './ui/profile.js';
import { backHead, emptyState, toast, celebrate, playSound, closeSheet } from './ui/components.js';
import { scheduleAchievementCheck } from './achievements.js';
import { addDays } from './utils.js';

const view = document.getElementById('view');
const scrollPositions = new Map();
let currentKey = null;
let rendering = false;
let reminderTimer = null;
let activeSince = document.visibilityState === 'visible' ? Date.now() : null;
let scrollFrame = 0;
let pendingUpdate = false;

/* ---------- Маршруты ---------- */

function currentHash() {
  const hash = location.hash;
  return !hash || hash === '#' || hash === '#/' ? '#/home' : hash;
}

function parseHash() {
  const raw = currentHash();
  const withoutHash = raw.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = withoutHash.split('?');
  const segments = pathPart.split('/').filter(Boolean).map(segment => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  });
  return { segments, query: new URLSearchParams(queryPart), key: raw };
}

function notFound(title = 'Страница не найдена') {
  return {
    html: `<div class="page">
      ${backHead({ title: 'Не найдено', back: '#/home' })}
      ${emptyState({
        emoji: '🧭',
        title,
        text: 'Похоже, ссылка устарела или такой страницы пока нет. Вернись на главную — там всё на месте.',
        action: `<button class="btn" type="button" data-nav="#/home">На главную</button>`
      })}
    </div>`,
    mount() {}
  };
}

function resolveRoute({ segments, query }) {
  const [root, second, third] = segments;

  if (!root || root === 'home') {
    return { render: renderHome, tab: 'home', title: 'Главная' };
  }

  if (root === 'course') {
    if (!second) return { render: renderCourse, tab: 'course', title: 'Курс' };
    if (second === 'module' && third) return { render: renderModule, tab: 'course', title: 'Модуль' };
    if (second === 'lesson' && third) return { render: renderLesson, tab: 'course', title: 'Урок' };
    if (second === 'test' && third) return { render: renderModuleTest, tab: 'course', title: 'Итоговый тест' };
    if (second === 'bookmarks') return { render: renderBookmarks, tab: 'course', title: 'Закладки' };
    if (second === 'mistakes') return { render: renderMistakes, tab: 'course', title: 'Работа над ошибками' };
    if (second === 'glossary') return { render: renderGlossary, tab: 'course', title: 'Словарик' };
    return { render: () => notFound('Страница курса не найдена'), tab: 'course', title: 'Курс' };
  }

  if (root === 'shopping') {
    if (second === 'list' && third) return { render: renderShoppingDetail, tab: 'shopping', title: 'Список покупок' };
    if (second === 'history') return { render: renderShoppingHistory, tab: 'shopping', title: 'История покупок' };
    return { render: renderShopping, tab: 'shopping', title: 'Покупки' };
  }

  if (root === 'budget') {
    return { render: renderBudget, tab: 'budget', title: 'Бюджет' };
  }

  if (root === 'calculators') {
    if (second) {
      const def = calculatorList.find(item => item.id === second);
      return { render: renderCalculator, tab: null, title: def ? def.title : 'Калькулятор' };
    }
    return { render: renderCalculators, tab: null, title: 'Калькуляторы' };
  }

  if (root === 'profile') {
    if (second === 'achievements') return { render: renderAchievements, tab: 'profile', title: 'Достижения' };
    if (second === 'settings') return { render: renderSettings, tab: 'profile', title: 'Настройки' };
    return { render: renderProfile, tab: 'profile', title: 'Профиль' };
  }

  return { render: () => notFound(), tab: null, title: 'Не найдено', query };
}

function setActiveTab(tab) {
  document.querySelectorAll('.tabbar .tab').forEach(link => {
    const active = Boolean(tab) && link.dataset.tab === tab;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function updateDocumentTitle(title) {
  document.title = title ? `${title} — Копейка` : 'Копейка — финансовая грамотность';
}

function updateHeaderState() {
  const head = view.querySelector('[data-page-head]');
  if (head) head.classList.toggle('is-compact', window.scrollY > 22);
}

function errorScreen(error) {
  console.error('Копейка: ошибка экрана', error);
  return {
    html: `<div class="page">
      ${backHead({ title: 'Что-то пошло не так', back: '#/home' })}
      ${emptyState({
        emoji: '🛠️',
        title: 'Не удалось открыть экран',
        text: 'Попробуй вернуться на главную. Если ошибка повторяется, обнови страницу — данные не пострадают.',
        action: `<button class="btn" type="button" data-nav="#/home">На главную</button>`
      })}
    </div>`,
    mount() {}
  };
}

function renderRoute({ force = false, preserveScroll = false } = {}) {
  const parsed = parseHash();
  const same = parsed.key === currentKey;
  if (same && !force) return;
  if (rendering) return;
  rendering = true;

  if (!same && currentKey) scrollPositions.set(currentKey, window.scrollY);
  const restoreY = same ? window.scrollY : (scrollPositions.get(parsed.key) ?? 0);
  const route = resolveRoute(parsed);
  const params = {
    id: parsed.segments[parsed.segments.length - 1] || '',
    segments: parsed.segments
  };

  view.setAttribute('aria-busy', 'true');
  try {
    const screen = route.render({
      query: parsed.query,
      params
    });
    view.innerHTML = screen.html;
    screen.mount?.(view, {
      query: parsed.query,
      params,
      route
    });

    setActiveTab(route.tab);
    updateDocumentTitle(route.title);

    // Некоторые экраны (например, бюджет) чистят query через replaceState.
    currentKey = currentHash();
    if (same) {
      if (!preserveScroll) window.scrollTo(0, 0);
    } else {
      requestAnimationFrame(() => window.scrollTo(0, restoreY));
    }

    view.classList.remove('is-entering');
    void view.offsetWidth;
    view.classList.add('is-entering');
    setTimeout(() => view.classList.remove('is-entering'), 420);

    requestAnimationFrame(updateHeaderState);
    scheduleAchievementCheck(450);
  } catch (error) {
    view.innerHTML = errorScreen(error).html;
    setActiveTab(null);
    updateDocumentTitle('Ошибка');
  } finally {
    view.setAttribute('aria-busy', 'false');
    rendering = false;
  }
}

/* ---------- Навигация ---------- */

function navigateTo(target) {
  if (!target) return;
  closeSheet(true);
  if (currentHash() === target) {
    renderRoute({ force: true });
  } else {
    location.hash = target;
  }
}

document.addEventListener('click', event => {
  const nav = event.target.closest('[data-nav]');
  if (!nav) return;
  event.preventDefault();
  navigateTo(nav.dataset.nav);
});

window.addEventListener('hashchange', () => {
  closeSheet(true);
  renderRoute();
});

window.addEventListener('kopeyka:rerender', () => {
  renderRoute({ force: true, preserveScroll: true });
});

window.addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    updateHeaderState();
  });
}, { passive: true });

/* ---------- Тема и настройки ---------- */

function applyTheme() {
  const theme = store.state.settings.theme || 'auto';
  document.documentElement.dataset.theme = theme;
}

function scheduleReminder() {
  clearTimeout(reminderTimer);
  reminderTimer = null;
  const settings = store.state.settings;
  if (!settings.reminder) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const [hours, minutes] = String(settings.reminderTime || '19:00').split(':').map(Number);
  const now = new Date();
  let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours || 19, minutes || 0, 0, 0);
  if (target <= now) target = addDays(target, 1);
  const delay = target.getTime() - now.getTime();
  if (delay <= 0 || delay > 2147483647) return;

  reminderTimer = setTimeout(() => {
    try {
      new Notification('Копейка — время для финансов', {
        body: 'Пять минут на урок или бюджет — и день закрыт.',
        icon: './icons/icon-192.png',
        badge: './icons/favicon-64.png'
      });
    } catch { /* уведомление не критично */ }
    scheduleReminder();
  }, delay);
}

/* ---------- PWA ---------- */

function showUpdateBanner(worker) {
  if (document.querySelector('.update-banner')) return;
  const banner = document.createElement('button');
  banner.type = 'button';
  banner.className = 'update-banner';
  banner.innerHTML = `<span class="update-banner-icon">${icon('rotate', 18)}</span><span class="grow">Доступно обновление</span><span class="update-banner-action">Перезапустить</span>`;
  banner.addEventListener('click', () => {
    pendingUpdate = true;
    banner.textContent = 'Обновляем…';
    worker.postMessage({ type: 'SKIP_WAITING' });
  });
  document.body.append(banner);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    registration.update().catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (pendingUpdate) location.reload();
    });

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          pendingUpdate = true;
          showUpdateBanner(worker);
        }
      });
    });
  } catch (error) {
    console.warn('Копейка: service worker не зарегистрирован.', error);
  }
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  window.kopeykaInstallPrompt = event;
  if (currentKey && currentKey.startsWith('#/profile')) {
    setTimeout(() => renderRoute({ force: true, preserveScroll: true }), 80);
  }
});

window.addEventListener('appinstalled', () => {
  window.kopeykaInstallPrompt = null;
  toast('Копейка установлена на устройство', { emoji: '🎉' });
  celebrate(0.9);
});

/* ---------- Время в приложении ---------- */

function flushTime() {
  if (activeSince === null) return;
  const now = Date.now();
  const seconds = Math.round((now - activeSince) / 1000);
  activeSince = now;
  if (seconds >= 5) store.addTime(seconds);
}

setInterval(flushTime, 60000);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    flushTime();
    activeSince = null;
  } else {
    activeSince = Date.now();
    store.touchDay();
    scheduleReminder();
    scheduleAchievementCheck(300);
  }
});

window.addEventListener('pagehide', flushTime);

/* ---------- Подписки на изменения ---------- */

store.subscribe((_state, event = {}) => {
  if (event.type === 'achievement') {
    const list = event.achievements || [];
    if (list.length) {
      celebrate(0.55);
      playSound('success');
      list.forEach((item, index) => {
        setTimeout(() => {
          toast(`Достижение: ${item.title}`, { emoji: item.emoji, duration: 4300 });
        }, index * 750);
      });
    }
    return;
  }

  if (event.type === 'storage-error') {
    toast('Не удалось сохранить данные. Проверь свободное место в браузере.', { emoji: '⚠️', duration: 4500 });
    return;
  }

  if (event.type === 'settings') {
    applyTheme();
    if (event.key === 'currency') {
      setTimeout(() => renderRoute({ force: true, preserveScroll: true }), 0);
    }
    if (event.key === 'reminder' || event.key === 'reminderTime') scheduleReminder();
    return;
  }

  if (event.type === 'reset' || event.type === 'import') {
    applyTheme();
    return;
  }

  scheduleAchievementCheck();
});

window.addEventListener('online', () => toast('Соединение восстановлено', { emoji: '🌐' }));
window.addEventListener('offline', () => toast('Нет сети. Копейка продолжает работать офлайн', { emoji: '📴', duration: 3800 }));

/* ---------- Запуск ---------- */

function boot() {
  applyTheme();
  if (!location.hash) history.replaceState(null, '', '#/home');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  document.querySelectorAll('.tab-icon[data-icon]').forEach(el => {
    el.innerHTML = icon(el.dataset.icon, 22);
  });

  const streak = store.touchDay();
  renderRoute({ force: true });
  scheduleReminder();
  registerServiceWorker();
  scheduleAchievementCheck(1000);

  if (streak?.isNewDay && streak.streak >= 2) {
    setTimeout(() => toast(`Серия: ${streak.streak} дней подряд`, { emoji: '🔥', duration: 3200 }), 900);
  }
}

boot();
