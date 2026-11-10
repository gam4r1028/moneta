/* Каталог курса. Модули 1–3 подключены полностью; остальные появятся следующими этапами. */
import { module01 } from './module-01.js';
import { module02 } from './module-02.js';
import { module03 } from './module-03.js';

const fullModules = [module01, module02, module03];

const upcoming = [
  { id: 4, title: 'Умные покупки', subtitle: 'Меньше импульса', icon: 'cart', color: '#FF9500', color2: '#C86B00', description: 'Импульсивные покупки, правило 24 часов, цена за единицу, скидки, подписки и сезонные траты.', lessons: [], available: false },
  { id: 5, title: 'Накопления и проценты', subtitle: 'Время — твой союзник', icon: 'trending-up', color: '#30B0C7', color2: '#147A8C', description: 'Простой и сложный процент, вклады, инфляция, реальная доходность и накопления на цель.', lessons: [], available: false },
  { id: 6, title: 'Кредиты и долги', subtitle: 'Без кабалы', icon: 'credit-card', color: '#FF3B30', color2: '#B5241C', description: 'Кредит, рассрочка, кредитка, переплата, «0%» и как выбраться из долговой спирали.', lessons: [], available: false },
  { id: 7, title: 'Банки и карты', subtitle: 'Понятная банковская жизнь', icon: 'bank', color: '#5856D6', color2: '#3634A3', description: 'Виды карт, кешбэк, комиссии, безопасность, онлайн-банкинг и платежи с телефона.', lessons: [], available: false },
  { id: 8, title: 'Инвестиции для новичков', subtitle: 'Риск и доходность', icon: 'chart', color: '#00C7BE', color2: '#008F88', description: 'Акции, облигации, фонды, золото, диверсификация, горизонт и психология инвестора.', lessons: [], available: false },
  { id: 9, title: 'Мошенничество и безопасность', subtitle: 'Не попадись', icon: 'shield-check', color: '#FF2D55', color2: '#B8002E', description: 'Фишинг, «безопасный счёт», звонки из банка, схемы в мессенджерах и фейковые магазины.', lessons: [], available: false },
  { id: 10, title: 'Первая работа и налоги', subtitle: 'Взрослые деньги', icon: 'briefcase', color: '#FFCC00', color2: '#C79A00', description: 'Зарплата до и после налогов, подработка, фриланс, договор и финансовый план на пять лет.', lessons: [], available: false }
];

export const courseModules = [...fullModules, ...upcoming].map(m => ({
  ...m,
  available: m.available !== false,
  lessons: (m.lessons || []).map((lesson, index) => ({
    ...lesson,
    moduleId: m.id,
    moduleTitle: m.title,
    moduleColor: m.color,
    moduleIcon: m.icon,
    number: index + 1,
    available: m.available !== false
  }))
}));

export const availableModules = courseModules.filter(m => m.available);

export const allLessons = availableModules.flatMap(m => m.lessons);

export const totalLessons = allLessons.length;

export const totalMinutes = allLessons.reduce((acc, l) => acc + (Number(l.minutes) || 0), 0);

export function getModule(id) {
  return courseModules.find(m => m.id === Number(id)) || null;
}

export function getLesson(id) {
  return allLessons.find(l => l.id === id) || null;
}

export function getLessonWithModule(id) {
  const lesson = getLesson(id);
  if (!lesson) return null;
  return { lesson, module: getModule(lesson.moduleId) };
}

export function getModuleLessons(moduleId) {
  return getModule(moduleId)?.lessons || [];
}

export function nextModuleAfter(moduleId) {
  const index = courseModules.findIndex(m => m.id === Number(moduleId));
  if (index < 0) return null;
  return courseModules[index + 1] || null;
}

export function searchLessons(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  return allLessons
    .map(lesson => {
      const module = getModule(lesson.moduleId);
      const haystack = [
        lesson.title, lesson.goal, module?.title, module?.description,
        ...(lesson.cards || []).map(c => `${c.title} ${c.text}`),
        ...(lesson.remember || [])
      ].join(' ').toLowerCase();
      const score = words.reduce((acc, w) => acc + (haystack.includes(w) ? 1 : 0), 0);
      return { lesson, module, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

export function totalCourseXP() {
  return allLessons.length * 20 + courseModules.length * 100;
}
