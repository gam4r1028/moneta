/* Выдача достижений: проверяем условия после изменений в хранилище. */
import { store } from './store.js';
import { achievements } from './data/achievements.js';
import { allLessons } from './data/course.js';

let timer = null;
let running = false;

export function evaluateAchievements() {
  if (running) return [];
  running = true;
  const ctx = { totalLessons: allLessons.length };
  const newly = [];
  for (const def of achievements) {
    if (store.state.achievements[def.id]) continue;
    let unlocked = false;
    try { unlocked = !!def.check(store.state, ctx); } catch { unlocked = false; }
    if (unlocked) {
      store.state.achievements[def.id] = new Date().toISOString();
      newly.push(def);
    }
  }
  if (newly.length) {
    store.save();
    store.emit({ type: 'achievement', achievements: newly });
  }
  running = false;
  return newly;
}

export function scheduleAchievementCheck(delay = 260) {
  clearTimeout(timer);
  timer = setTimeout(() => evaluateAchievements(), delay);
}

export function getAchievement(def) {
  return achievements.find(a => a.id === def);
}

export function achievementStatus(state = store.state) {
  const ctx = { totalLessons: allLessons.length };
  return achievements.map(def => {
    let unlocked = !!state.achievements[def.id];
    if (!unlocked) {
      try { unlocked = !!def.check(state, ctx); } catch { unlocked = false; }
    }
    return { ...def, unlocked, date: state.achievements[def.id] || null };
  });
}
