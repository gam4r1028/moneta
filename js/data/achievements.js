/* 30 достижений. Проверка условий получает состояние приложения и контекст. */
export const achievements = [
  {
    id: 'first_lesson', title: 'Первый шаг', emoji: '🌟', color: '#FFCC00',
    description: 'Заверши свой первый урок.',
    check: s => s.course.completedLessons.length >= 1
  },
  {
    id: 'five_lessons', title: 'В ритме', emoji: '📚', color: '#007AFF',
    description: 'Пройди пять уроков.',
    check: s => s.course.completedLessons.length >= 5
  },
  {
    id: 'ten_lessons', title: 'Десятка', emoji: '🔟', color: '#5856D6',
    description: 'Пройди десять уроков.',
    check: s => s.course.completedLessons.length >= 10
  },
  {
    id: 'first_module', title: 'Модуль пройден', emoji: '🏅', color: '#FF9500',
    description: 'Сдай итоговый тест первого модуля.',
    check: s => s.course.completedModules.length >= 1
  },
  {
    id: 'three_modules', title: 'Три высоты', emoji: '⛰️', color: '#34C759',
    description: 'Заверши три модуля курса.',
    check: s => s.course.completedModules.length >= 3
  },
  {
    id: 'course_half', title: 'Половина пути', emoji: '🌗', color: '#AF52DE',
    description: 'Пройди половину доступных уроков.',
    check: (s, ctx) => ctx.totalLessons > 0 && s.course.completedLessons.length >= Math.ceil(ctx.totalLessons / 2)
  },
  {
    id: 'course_done', title: 'Финансовый марафон', emoji: '🏆', color: '#FFD60A',
    description: 'Пройди все уроки курса.',
    check: (s, ctx) => ctx.totalLessons > 0 && s.course.completedLessons.length >= ctx.totalLessons
  },
  {
    id: 'streak_3', title: 'Три дня подряд', emoji: '🔥', color: '#FF9500',
    description: 'Заходи в приложение три дня подряд.',
    check: s => s.profile.streak >= 3 || s.profile.bestStreak >= 3
  },
  {
    id: 'streak_7', title: 'Неделя подряд', emoji: '🔥', color: '#FF3B30',
    description: 'Собери серию из семи дней.',
    check: s => s.profile.streak >= 7 || s.profile.bestStreak >= 7
  },
  {
    id: 'streak_30', title: 'Месяц дисциплины', emoji: '🌋', color: '#FF2D55',
    description: 'Собери серию из тридцати дней.',
    check: s => s.profile.streak >= 30 || s.profile.bestStreak >= 30
  },
  {
    id: 'first_transaction', title: 'Учёт начат', emoji: '🧾', color: '#34C759',
    description: 'Добавь первый доход или расход.',
    check: s => s.stats.transactions >= 1
  },
  {
    id: 'transactions_25', title: 'Финансовый детектив', emoji: '🔎', color: '#30B0C7',
    description: 'Запиши 25 операций в бюджет.',
    check: s => s.stats.transactions >= 25
  },
  {
    id: 'first_list', title: 'Первая покупка', emoji: '🛒', color: '#34C759',
    description: 'Заверши первый список покупок.',
    check: s => s.stats.listsCompleted >= 1
  },
  {
    id: 'lists_5', title: 'Охотник за скидками', emoji: '🎯', color: '#FF9500',
    description: 'Заверши пять списков покупок.',
    check: s => s.stats.listsCompleted >= 5
  },
  {
    id: 'first_goal', title: 'Первая цель', emoji: '🎯', color: '#007AFF',
    description: 'Создай свою первую финансовую цель.',
    check: s => s.budget.goals.length >= 1
  },
  {
    id: 'goal_done', title: 'Цель достигнута', emoji: '🎉', color: '#34C759',
    description: 'Закрой накопление на цель.',
    check: s => s.stats.goalsCompleted >= 1
  },
  {
    id: 'goals_three', title: 'Коллекционер целей', emoji: '🧩', color: '#AF52DE',
    description: 'Достигни трёх финансовых целей.',
    check: s => s.stats.goalsCompleted >= 3
  },
  {
    id: 'xp_100', title: 'Сотня XP', emoji: '✨', color: '#5AC8FA',
    description: 'Набери 100 XP.',
    check: s => s.profile.xp >= 100
  },
  {
    id: 'xp_500', title: 'Пятьсот XP', emoji: '💫', color: '#5856D6',
    description: 'Набери 500 XP.',
    check: s => s.profile.xp >= 500
  },
  {
    id: 'level_ruble', title: 'Уровень «Рубль»', emoji: '💵', color: '#34C759',
    description: 'Достигни уровня «Рубль» — 400 XP.',
    check: s => s.profile.xp >= 400
  },
  {
    id: 'perfect_quiz', title: 'Без единой ошибки', emoji: '💯', color: '#FFCC00',
    description: 'Пройди мини-тест урока без ошибок.',
    check: s => s.stats.perfectQuizzes >= 1
  },
  {
    id: 'bookmarks_5', title: 'Коллекционер знаний', emoji: '🔖', color: '#AF52DE',
    description: 'Сохрани пять уроков в закладки.',
    check: s => s.course.bookmarks.length >= 5
  },
  {
    id: 'glossary', title: 'Словарный запас', emoji: '📖', color: '#00C7BE',
    description: 'Загляни в словарик терминов.',
    check: s => s.course.glossaryViews >= 1
  },
  {
    id: 'module_test', title: 'Экзаменатор', emoji: '🧪', color: '#FF9500',
    description: 'Сдай итоговый тест модуля.',
    check: s => s.stats.testsPassed >= 1
  },
  {
    id: 'safety_pad', title: 'Подушка собрана', emoji: '🛡️', color: '#5AC8FA',
    description: 'Достигни цели, связанной с подушкой безопасности.',
    check: s => s.budget.goals.some(g => g.completed && /подушк|резерв/i.test(g.name))
  },
  {
    id: 'limits_3', title: 'Архитектор бюджета', emoji: '🧱', color: '#34C759',
    description: 'Установи лимиты минимум на три категории.',
    check: s => Object.keys(s.budget.limits || {}).filter(k => Number(s.budget.limits[k]) > 0).length >= 3
  },
  {
    id: 'subscription_check', title: 'Охотник за подписками', emoji: '✂️', color: '#FF2D55',
    description: 'Добавь подписки в бюджет и проверь их годовую стоимость.',
    check: s => (s.budget.subscriptions || []).length >= 1
  },
  {
    id: 'simulator_first', title: 'Год жизни', emoji: '🎮', color: '#5856D6',
    description: 'Заверши первый год в симуляторе.',
    check: s => (s.simulator?.runs || 0) >= 1
  },
  {
    id: 'simulator_a', title: 'Финансовый стратег', emoji: '🥇', color: '#FFD60A',
    description: 'Получи оценку A в симуляторе «Год жизни».',
    check: s => s.simulator?.bestGrade === 'A'
  },
  {
    id: 'no_scam', title: 'Не повёлся на мошенников', emoji: '🛡️', color: '#FF3B30',
    description: 'Распознай мошенническую схему в симуляторе или курсе.',
    check: s => (s.stats.scamsAvoided || 0) >= 1
  }
];

export function achievementContext(state) {
  return {
    totalLessons: state.__totalLessons || 0,
    money: state.settings.currency
  };
}
