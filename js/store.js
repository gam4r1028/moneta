/* Хранилище и бизнес-логика «Копейки».
   Всё живёт в localStorage, версия схемы позволяет делать миграции. */
import { uid, todayKey, monthKey, addDays, parseDateKey, clamp, getLevel, sum } from './utils.js';
import { courseModules, allLessons } from './data/course.js';

const STORAGE_KEY = 'kopeyka:state:v1';
const SCHEMA_VERSION = 1;

const EXPENSE_CATEGORIES = {
  'Продукты': { color: '#34C759', icon: 'cart', group: 'need' },
  'Жильё': { color: '#007AFF', icon: 'home', group: 'need' },
  'Транспорт': { color: '#30B0C7', icon: 'arrow-right', group: 'need' },
  'Кафе и доставка': { color: '#FF9500', icon: 'receipt', group: 'want' },
  'Покупки': { color: '#AF52DE', icon: 'cart', group: 'want' },
  'Здоровье': { color: '#FF3B30', icon: 'shield', group: 'need' },
  'Развлечения': { color: '#FF2D55', icon: 'sparkles', group: 'want' },
  'Образование': { color: '#5856D6', icon: 'book', group: 'need' },
  'Подписки': { color: '#00C7BE', icon: 'credit-card', group: 'want' },
  'Другое': { color: '#8E8E93', icon: 'more', group: 'want' }
};
const INCOME_CATEGORIES = {
  'Зарплата': { color: '#34C759', icon: 'briefcase' },
  'Стипендия': { color: '#5AC8FA', icon: 'book' },
  'Подработка': { color: '#30B0C7', icon: 'wallet' },
  'Подарок': { color: '#FF9500', icon: 'gift' },
  'Другое': { color: '#8E8E93', icon: 'more' }
};
export const BUDGET_CATEGORIES = { expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES };

export const SHOP_CATEGORIES = {
  'Продукты': { emoji: '🥦', color: '#34C759' },
  'Одежда': { emoji: '👕', color: '#AF52DE' },
  'Техника': { emoji: '💻', color: '#007AFF' },
  'Дом': { emoji: '🏠', color: '#FF9500' },
  'Гигиена': { emoji: '🧴', color: '#5AC8FA' },
  'Развлечения': { emoji: '🎬', color: '#FF2D55' },
  'Подарки': { emoji: '🎁', color: '#FFCC00' },
  'Другое': { emoji: '📦', color: '#8E8E93' }
};

export const SHOP_TEMPLATES = [
  { id: 'groceries', emoji: '🛒', name: 'Продукты на неделю', budget: 120, color: '#34C759', items: ['Молоко', 'Хлеб', 'Яйца', 'Курица', 'Овощи', 'Фрукты', 'Крупа', 'Сыр'] },
  { id: 'school', emoji: '🎒', name: 'Школа и учёба', budget: 80, color: '#5856D6', items: ['Тетради', 'Ручки', 'Стикеры', 'Папка'] },
  { id: 'trip', emoji: '✈️', name: 'Поездка', budget: 250, color: '#5AC8FA', items: ['Билеты', 'Проживание', 'Аптечка', 'Зарядка', 'Вода в дорогу'] },
  { id: 'birthday', emoji: '🎁', name: 'Подарок маме', budget: 90, color: '#FF2D55', items: ['Цветы', 'Открытка', 'Подарок'] }
];

function createDefaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    settings: {
      theme: 'auto',
      currency: 'BYN',
      sound: true,
      haptics: true,
      reminder: false,
      reminderTime: '19:00',
      unlockAll: false
    },
    profile: {
      name: '',
      avatar: '🦊',
      xp: 0,
      streak: 0,
      bestStreak: 0,
      lastActiveDate: null,
      totalSeconds: 0,
      installDismissed: false
    },
    course: {
      completedLessons: [],
      completedModules: [],
      bookmarks: [],
      wrong: [],
      scores: {},
      tests: {},
      lastLesson: null,
      lastModule: null,
      startedAt: null,
      completedAt: null,
      glossaryViews: 0
    },
    activity: {},
    stats: {
      correct: 0,
      wrong: 0,
      lessons: 0,
      testsPassed: 0,
      perfectQuizzes: 0,
      transactions: 0,
      listsCompleted: 0,
      goalsCompleted: 0
    },
    budget: {
      transactions: [],
      limits: {},
      goals: [],
      subscriptions: [],
      incomeTarget: 0
    },
    shopping: {
      lists: [],
      wishlist: [],
      history: [],
      recent: {},
      templatesUsed: []
    },
    achievements: {},
    meta: {
      lastTipDate: null,
      installPromptSeen: false,
      lastBackupAt: null,
      onboardingDone: false
    }
  };
}

function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function mergeDefaults(defaults, saved) {
  if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : defaults;
  if (isObject(defaults)) {
    const out = {};
    for (const key of Object.keys(defaults)) {
      out[key] = key in (saved || {}) ? mergeDefaults(defaults[key], saved[key]) : defaults[key];
    }
    if (isObject(saved)) {
      for (const key of Object.keys(saved)) if (!(key in out)) out[key] = saved[key];
    }
    return out;
  }
  return saved === undefined ? defaults : saved;
}

class Store {
  constructor() {
    this.listeners = new Set();
    this.state = this.load();
    this.storageAvailable = true;
  }

  get defaultState() { return createDefaultState(); }

  load() {
    const defaults = createDefaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      if (!isObject(parsed)) return defaults;
      let merged = mergeDefaults(defaults, parsed);
      if ((parsed.schemaVersion || 0) < SCHEMA_VERSION) merged = this.migrate(merged, parsed.schemaVersion || 0);
      merged.schemaVersion = SCHEMA_VERSION;
      return this.normalize(merged);
    } catch (error) {
      console.warn('Копейка: не удалось прочитать данные, создаём новые.', error);
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) localStorage.setItem(`${STORAGE_KEY}:broken:${Date.now()}`, raw);
      } catch { /* ignore */ }
      return defaults;
    }
  }

  migrate(state, fromVersion) {
    // Место для будущих миграций. Сейчас схема первая.
    if (fromVersion < 1) {
      state.schemaVersion = 1;
    }
    return state;
  }

  normalize(state) {
    const s = state;
    s.course.completedLessons = Array.isArray(s.course.completedLessons) ? [...new Set(s.course.completedLessons)] : [];
    s.course.completedModules = Array.isArray(s.course.completedModules) ? [...new Set(s.course.completedModules.map(Number))] : [];
    s.course.bookmarks = Array.isArray(s.course.bookmarks) ? [...new Set(s.course.bookmarks)] : [];
    s.course.wrong = Array.isArray(s.course.wrong) ? s.course.wrong.filter(x => x && x.id) : [];
    s.budget.transactions = Array.isArray(s.budget.transactions) ? s.budget.transactions.filter(x => x && Number(x.amount) >= 0) : [];
    s.budget.goals = Array.isArray(s.budget.goals) ? s.budget.goals : [];
    s.budget.subscriptions = Array.isArray(s.budget.subscriptions) ? s.budget.subscriptions : [];
    s.shopping.lists = Array.isArray(s.shopping.lists) ? s.shopping.lists : [];
    s.shopping.wishlist = Array.isArray(s.shopping.wishlist) ? s.shopping.wishlist : [];
    s.shopping.history = Array.isArray(s.shopping.history) ? s.shopping.history : [];
    s.activity = isObject(s.activity) ? s.activity : {};
    s.achievements = isObject(s.achievements) ? s.achievements : {};
    s.profile.xp = Math.max(0, Number(s.profile.xp) || 0);
    s.profile.totalSeconds = Math.max(0, Number(s.profile.totalSeconds) || 0);
    return s;
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.storageAvailable = true;
    } catch (error) {
      this.storageAvailable = false;
      console.warn('Копейка: не удалось сохранить данные.', error);
      this.emit({ type: 'storage-error', error });
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event = { type: 'change' }) {
    for (const fn of this.listeners) {
      try { fn(this.state, event); } catch (error) { console.error(error); }
    }
  }

  update(mutator, event = { type: 'change' }, save = true) {
    const result = mutator(this.state);
    if (save) this.save();
    this.emit(event);
    return result;
  }

  // ---------- Профиль и XP ----------

  touchDay() {
    const today = todayKey();
    const p = this.state.profile;
    if (p.lastActiveDate === today) {
      if (!this.state.activity[today]) this.state.activity[today] = { actions: 0, xp: 0, minutes: 0 };
      return { streak: p.streak, isNewDay: false };
    }
    const yesterday = todayKey(addDays(new Date(), -1));
    let streak = 1;
    if (p.lastActiveDate === yesterday) streak = (p.streak || 0) + 1;
    p.streak = streak;
    p.bestStreak = Math.max(p.bestStreak || 0, streak);
    p.lastActiveDate = today;
    if (!this.state.activity[today]) this.state.activity[today] = { actions: 0, xp: 0, minutes: 0 };
    this.state.activity[today].actions = (this.state.activity[today].actions || 0) + 1;
    this.save();
    return { streak, isNewDay: true };
  }

  recordAction({ actions = 1, xp = 0, minutes = 0 } = {}) {
    const today = todayKey();
    const a = this.state.activity[today] || (this.state.activity[today] = { actions: 0, xp: 0, minutes: 0 });
    a.actions = (a.actions || 0) + actions;
    a.xp = (a.xp || 0) + xp;
    a.minutes = (a.minutes || 0) + minutes;
  }

  addXP(amount, { silent = false } = {}) {
    const xp = Math.max(0, Math.round(Number(amount) || 0));
    if (!xp) return { xp: 0, levelUp: false };
    const before = getLevel(this.state.profile.xp);
    this.state.profile.xp += xp;
    this.recordAction({ xp });
    const after = getLevel(this.state.profile.xp);
    const levelUp = after.index > before.index;
    if (!silent) this.save();
    return { xp, levelUp, level: after, before };
  }

  addTime(seconds) {
    const s = Math.max(0, Math.round(seconds));
    if (!s) return;
    this.state.profile.totalSeconds += s;
    const today = todayKey();
    const a = this.state.activity[today] || (this.state.activity[today] = { actions: 0, xp: 0, minutes: 0 });
    a.minutes = (a.minutes || 0) + s / 60;
    this.save();
  }

  setProfile(patch) {
    Object.assign(this.state.profile, patch);
    this.save();
    this.emit();
  }

  setName(name) {
    this.state.profile.name = String(name || '').trim().slice(0, 40);
    this.save(); this.emit();
  }

  setAvatar(avatar) {
    this.state.profile.avatar = String(avatar || '🦊').slice(0, 8);
    this.save(); this.emit();
  }

  // ---------- Настройки ----------

  setSetting(key, value) {
    if (!(key in this.state.settings)) return;
    this.state.settings[key] = value;
    this.save();
    this.emit({ type: 'settings', key, value });
  }

  resetAll() {
    const state = createDefaultState();
    this.state = state;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    this.save();
    this.emit({ type: 'reset' });
  }

  exportData() {
    this.state.meta.lastBackupAt = new Date().toISOString();
    this.save();
    return JSON.stringify(this.state, null, 2);
  }

  importData(raw) {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!isObject(parsed) || !isObject(parsed.profile) || !isObject(parsed.course)) {
      throw new Error('Файл не похож на резервную копию «Копейки».');
    }
    const merged = this.normalize(mergeDefaults(createDefaultState(), parsed));
    merged.schemaVersion = SCHEMA_VERSION;
    this.state = merged;
    this.save();
    this.emit({ type: 'import' });
    return true;
  }

  // ---------- Курс ----------

  isLessonComplete(id) { return this.state.course.completedLessons.includes(id); }
  isModuleComplete(id) { return this.state.course.completedModules.includes(Number(id)); }
  isBookmarked(id) { return this.state.course.bookmarks.includes(id); }

  toggleBookmark(lessonId) {
    const list = this.state.course.bookmarks;
    const i = list.indexOf(lessonId);
    if (i >= 0) list.splice(i, 1); else list.push(lessonId);
    this.save();
    this.emit();
    return i < 0;
  }

  completeLesson(lesson, score = { correct: 0, total: 0 }) {
    if (!lesson) return { newly: false, xp: 0 };
    const newly = !this.isLessonComplete(lesson.id);
    if (newly) {
      this.state.course.completedLessons.push(lesson.id);
      this.state.course.lastLesson = lesson.id;
      this.state.course.lastModule = lesson.moduleId;
      this.state.course.startedAt ||= new Date().toISOString();
      this.state.stats.lessons = this.state.course.completedLessons.length;
      if (score.total > 0 && score.correct === score.total) this.state.stats.perfectQuizzes++;
      this.state.course.scores[lesson.id] = score;
      const xp = 20;
      this.addXP(xp, { silent: true });
      this.recordAction({ xp: 0 });
      this.save();
      this.emit({ type: 'lesson-complete', lesson });
      return { newly, xp };
    }
    this.save();
    return { newly: false, xp: 0 };
  }

  recordQuizAnswer({ lessonId, moduleId, question, selected, correct }) {
    if (correct) {
      this.state.stats.correct++;
      // Если вопрос из «работы над ошибками» — убираем его.
      this.state.course.wrong = this.state.course.wrong.filter(w => w.id !== question.id);
    } else {
      this.state.stats.wrong++;
      const exists = this.state.course.wrong.find(w => w.id === question.id);
      if (!exists) {
        this.state.course.wrong.unshift({
          id: question.id,
          lessonId,
          moduleId,
          question: question.q,
          options: question.options || null,
          type: question.type,
          correct: question.correct,
          suffix: question.suffix || '',
          explanation: question.explanation,
          addedAt: new Date().toISOString(),
          attempts: 1
        });
      } else {
        exists.attempts = (exists.attempts || 1) + 1;
        exists.addedAt = new Date().toISOString();
      }
    }
    this.recordAction({ actions: 1 });
    this.save();
    this.emit({ type: 'answer', correct });
  }

  completeModule(moduleId, score, total) {
    const id = Number(moduleId);
    const passed = total > 0 && score / total >= 0.7;
    this.state.course.tests[id] = {
      score, total, passed,
      date: new Date().toISOString(),
      percent: Math.round((score / total) * 100)
    };
    let newly = false;
    if (passed && !this.isModuleComplete(id)) {
      this.state.course.completedModules.push(id);
      this.state.stats.testsPassed++;
      this.addXP(100, { silent: true });
      newly = true;
    }
    this.save();
    this.emit({ type: 'module-test', moduleId: id, passed, newly });
    return { passed, newly, percent: Math.round((score / total) * 100) };
  }

  getCourseProgress() {
    const completed = this.state.course.completedLessons.length;
    const total = allLessons.length;
    return {
      completed,
      total,
      percent: total ? (completed / total) * 100 : 0,
      modulesDone: this.state.course.completedModules.length,
      minutesLeft: allLessons.filter(l => !this.isLessonComplete(l.id)).reduce((a, l) => a + l.minutes, 0)
    };
  }

  getNextLesson() {
    const incomplete = allLessons.find(l => !this.isLessonComplete(l.id));
    return incomplete || allLessons[allLessons.length - 1] || null;
  }

  getModuleProgress(module) {
    if (!module || !module.lessons?.length) return { done: 0, total: 0, percent: 0 };
    const done = module.lessons.filter(l => this.isLessonComplete(l.id)).length;
    return { done, total: module.lessons.length, percent: (done / module.lessons.length) * 100 };
  }

  isModuleUnlocked(moduleId, modules = courseModules) {
    if (this.state.settings.unlockAll) return true;
    const id = Number(moduleId);
    if (id <= 1) return true;
    const index = modules.findIndex(m => m.id === id);
    if (index <= 0) return true;
    const prev = modules[index - 1];
    return this.isModuleComplete(prev.id) || (prev.available === false);
  }

  // ---------- Покупки ----------

  createList({ name, emoji = '🛒', color = '#007AFF', budget = 0 }) {
    const list = {
      id: uid('list'),
      name: String(name || 'Новый список').trim().slice(0, 60),
      emoji: String(emoji || '🛒').slice(0, 4),
      color,
      budget: Math.max(0, Number(budget) || 0),
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.state.shopping.lists.unshift(list);
    this.recordAction({ actions: 1, xp: 5 });
    this.addXP(5, { silent: true });
    this.save();
    this.emit({ type: 'list-created', list });
    return list;
  }

  createListFromTemplate(template) {
    const list = this.createList({ name: template.name, emoji: template.emoji, color: template.color, budget: template.budget });
    template.items.forEach((name, i) => {
      list.items.push({
        id: uid('item'), name, qty: 1, unit: 'шт', price: 0, category: template.id === 'groceries' ? 'Продукты' : 'Другое',
        need: 'need', priority: 2, note: '', bought: false, actualPrice: null, createdAt: new Date().toISOString()
      });
    });
    list.items = list.items;
    this.save();
    this.emit({ type: 'list-created', list });
    return list;
  }

  getList(listId) { return this.state.shopping.lists.find(l => l.id === listId) || null; }

  addShoppingItem(listId, data) {
    const list = this.getList(listId);
    if (!list) return null;
    const item = {
      id: uid('item'),
      name: String(data.name || '').trim().slice(0, 100),
      qty: Math.max(0.01, Number(data.qty) || 1),
      unit: data.unit || 'шт',
      price: Math.max(0, Number(data.price) || 0),
      category: data.category || 'Другое',
      need: data.need === 'want' ? 'want' : 'need',
      priority: clamp(Number(data.priority) || 2, 1, 3),
      note: String(data.note || '').slice(0, 200),
      bought: false,
      actualPrice: null,
      createdAt: new Date().toISOString()
    };
    if (!item.name) return null;
    list.items.push(item);
    list.updatedAt = new Date().toISOString();
    if (item.price > 0) {
      this.state.shopping.recent[item.name.toLowerCase()] = {
        name: item.name, price: item.price, unit: item.unit, category: item.category, updatedAt: new Date().toISOString()
      };
    }
    this.recordAction({ actions: 1, xp: 2 });
    this.addXP(2, { silent: true });
    this.save();
    this.emit({ type: 'item-added', list, item });
    return item;
  }

  updateShoppingItem(listId, itemId, patch) {
    const list = this.getList(listId);
    const item = list?.items.find(i => i.id === itemId);
    if (!item) return null;
    Object.assign(item, patch);
    list.updatedAt = new Date().toISOString();
    if (Number(patch.price) > 0) {
      this.state.shopping.recent[item.name.toLowerCase()] = {
        name: item.name, price: Number(patch.price), unit: item.unit, category: item.category, updatedAt: new Date().toISOString()
      };
    }
    this.save();
    this.emit();
    return item;
  }

  removeShoppingItem(listId, itemId) {
    const list = this.getList(listId);
    if (!list) return;
    list.items = list.items.filter(i => i.id !== itemId);
    list.updatedAt = new Date().toISOString();
    this.save();
    this.emit();
  }

  markItemBought(listId, itemId, bought, actualPrice = null) {
    const list = this.getList(listId);
    const item = list?.items.find(i => i.id === itemId);
    if (!item) return;
    item.bought = !!bought;
    if (bought) {
      item.actualPrice = actualPrice === null || actualPrice === undefined || actualPrice === ''
        ? item.price * item.qty
        : Math.max(0, Number(actualPrice) || 0);
      this.recordAction({ actions: 1, xp: 1 });
    } else {
      item.actualPrice = null;
    }
    this.save();
    this.emit();
  }

  postponeToWishlist(listId, itemId) {
    const list = this.getList(listId);
    const item = list?.items.find(i => i.id === itemId);
    if (!list || !item) return null;
    const wish = {
      id: uid('wish'),
      itemId: item.id,
      listId,
      name: item.name,
      price: item.price * item.qty,
      category: item.category,
      addedAt: new Date().toISOString(),
      remindAt: addDays(new Date(), 1).toISOString(),
      asked: false
    };
    this.state.shopping.wishlist.push(wish);
    list.items = list.items.filter(i => i.id !== itemId);
    list.updatedAt = new Date().toISOString();
    this.save();
    this.emit({ type: 'wish-added', wish });
    return wish;
  }

  removeWishlistItem(id) {
    this.state.shopping.wishlist = this.state.shopping.wishlist.filter(w => w.id !== id);
    this.save(); this.emit();
  }

  getDueWishlist() {
    const now = Date.now();
    return this.state.shopping.wishlist.filter(w => new Date(w.remindAt).getTime() <= now && !w.asked);
  }

  getAllWishlist() {
    return [...this.state.shopping.wishlist].sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt));
  }

  completeList(listId, { addToBudget = true } = {}) {
    const list = this.getList(listId);
    if (!list) return null;
    const boughtItems = list.items.filter(i => i.bought);
    const actualTotal = sum(boughtItems, i => i.actualPrice ?? (i.price * i.qty));
    const plannedTotal = sum(list.items, i => i.price * i.qty);
    const byCategory = {};
    for (const item of boughtItems) {
      const amount = Number(item.actualPrice) || 0;
      if (!byCategory[item.category]) byCategory[item.category] = 0;
      byCategory[item.category] += amount;
    }
    const history = {
      id: uid('history'),
      listName: list.name,
      emoji: list.emoji,
      date: new Date().toISOString(),
      total: actualTotal,
      planned: plannedTotal,
      budget: list.budget,
      itemCount: list.items.length,
      boughtCount: boughtItems.length,
      byCategory,
      items: list.items.map(i => ({ ...i }))
    };
    this.state.shopping.history.unshift(history);
    if (addToBudget && actualTotal > 0) {
      for (const [category, amount] of Object.entries(byCategory)) {
        const budgetCategory = category === 'Продукты' ? 'Продукты'
          : category === 'Одежда' ? 'Покупки'
            : category === 'Техника' ? 'Покупки'
              : category === 'Дом' ? 'Дом'
                : category === 'Гигиена' ? 'Продукты'
                  : category === 'Развлечения' ? 'Развлечения'
                    : category === 'Подарки' ? 'Покупки' : 'Другое';
        this.state.budget.transactions.unshift({
          id: uid('tx'), type: 'expense', amount, category: budgetCategory,
          date: todayKey(), note: `Список «${list.name}»`, source: 'shopping',
          createdAt: new Date().toISOString()
        });
      }
      this.state.stats.transactions += Object.keys(byCategory).length;
    }
    this.state.shopping.lists = this.state.shopping.lists.filter(l => l.id !== listId);
    this.state.stats.listsCompleted++;
    this.recordAction({ actions: 1, xp: 15 });
    this.addXP(15, { silent: true });
    this.save();
    this.emit({ type: 'list-completed', history, list });
    return history;
  }

  repeatList(historyId) {
    const h = this.state.shopping.history.find(x => x.id === historyId);
    if (!h) return null;
    const list = this.createList({ name: `${h.listName} · повтор`, emoji: h.emoji, color: '#007AFF', budget: h.budget });
    list.items = h.items.map(i => ({
      ...i, id: uid('item'), bought: false, actualPrice: null, createdAt: new Date().toISOString()
    }));
    this.save(); this.emit();
    return list;
  }

  importShoppingItems(listId, names) {
    const list = this.getList(listId);
    if (!list) return 0;
    let added = 0;
    names.forEach(name => {
      const recent = this.state.shopping.recent[name.toLowerCase()];
      list.items.push({
        id: uid('item'), name, qty: 1, unit: recent?.unit || 'шт',
        price: recent?.price || 0, category: recent?.category || 'Другое',
        need: 'need', priority: 2, note: '', bought: false, actualPrice: null, createdAt: new Date().toISOString()
      });
      added++;
    });
    list.updatedAt = new Date().toISOString();
    this.save(); this.emit();
    return added;
  }

  // ---------- Бюджет ----------

  addTransaction({ type = 'expense', amount, category = 'Другое', date = todayKey(), note = '', source = 'manual' }) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return null;
    const tx = {
      id: uid('tx'),
      type: type === 'income' ? 'income' : 'expense',
      amount: Math.round(value * 100) / 100,
      category: category || (type === 'income' ? 'Другое' : 'Другое'),
      date: date || todayKey(),
      note: String(note || '').slice(0, 160),
      source,
      createdAt: new Date().toISOString()
    };
    this.state.budget.transactions.unshift(tx);
    this.state.stats.transactions++;
    this.recordAction({ actions: 1, xp: 5 });
    this.addXP(5, { silent: true });
    this.save();
    this.emit({ type: 'transaction', transaction: tx });
    return tx;
  }

  deleteTransaction(id) {
    this.state.budget.transactions = this.state.budget.transactions.filter(t => t.id !== id);
    this.save(); this.emit();
  }

  setLimit(category, amount) {
    const value = Math.max(0, Number(amount) || 0);
    if (!value) delete this.state.budget.limits[category];
    else this.state.budget.limits[category] = value;
    this.save(); this.emit();
  }

  addGoal({ name, target, saved = 0, deadline = '', emoji = '🎯', color = '#007AFF' }) {
    const goal = {
      id: uid('goal'),
      name: String(name || 'Моя цель').trim().slice(0, 80),
      target: Math.max(1, Number(target) || 100),
      saved: Math.max(0, Number(saved) || 0),
      deadline: deadline || '',
      emoji: emoji || '🎯',
      color: color || '#007AFF',
      createdAt: new Date().toISOString(),
      completed: false,
      completedAt: null
    };
    this.state.budget.goals.push(goal);
    this.save(); this.emit({ type: 'goal-created', goal });
    return goal;
  }

  depositGoal(goalId, amount) {
    const goal = this.state.budget.goals.find(g => g.id === goalId);
    if (!goal) return null;
    const value = Number(amount) || 0;
    const wasCompleted = goal.completed;
    goal.saved = Math.max(0, Math.min(goal.target, goal.saved + value));
    if (goal.saved >= goal.target && !goal.completed) {
      goal.completed = true;
      goal.completedAt = new Date().toISOString();
      this.state.stats.goalsCompleted++;
      this.addXP(30, { silent: true });
    }
    this.recordAction({ actions: 1 });
    this.save();
    this.emit({ type: 'goal-deposit', goal, completed: goal.completed && !wasCompleted });
    return goal;
  }

  updateGoal(goalId, patch) {
    const goal = this.state.budget.goals.find(g => g.id === goalId);
    if (!goal) return;
    Object.assign(goal, patch);
    this.save(); this.emit();
  }

  removeGoal(goalId) {
    this.state.budget.goals = this.state.budget.goals.filter(g => g.id !== goalId);
    this.save(); this.emit();
  }

  addSubscription({ name, amount, period = 'month', nextDate = '' }) {
    const sub = {
      id: uid('sub'), name: String(name || 'Подписка').slice(0, 60),
      amount: Math.max(0, Number(amount) || 0), period: period === 'year' ? 'year' : 'month',
      nextDate: nextDate || '', createdAt: new Date().toISOString()
    };
    this.state.budget.subscriptions.push(sub);
    this.save(); this.emit({ type: 'subscription' });
    return sub;
  }

  removeSubscription(id) {
    this.state.budget.subscriptions = this.state.budget.subscriptions.filter(s => s.id !== id);
    this.save(); this.emit();
  }

  getTransactionsForMonth(month) {
    return this.state.budget.transactions.filter(t => (t.date || '').startsWith(month));
  }

  getMonthSummary(month = monthKey()) {
    const txs = this.getTransactionsForMonth(month);
    const income = sum(txs.filter(t => t.type === 'income'), t => t.amount);
    const expenses = sum(txs.filter(t => t.type === 'expense'), t => t.amount);
    const byCategory = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount);
    });
    return { income, expenses, balance: income - expenses, txs, byCategory };
  }

  getDailyExpenses(month) {
    const [y, m] = month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const result = Array.from({ length: days }, (_, i) => ({ day: i + 1, amount: 0 }));
    this.getTransactionsForMonth(month).filter(t => t.type === 'expense').forEach(t => {
      const day = Number((t.date || '').split('-')[2]) - 1;
      if (result[day]) result[day].amount += Number(t.amount);
    });
    return result;
  }
}

export const store = new Store();
