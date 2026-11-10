/* Экран курса, уроки, тесты, закладки, ошибки и словарь. */
import { store } from '../store.js';
import {
  courseModules, availableModules, allLessons, getModule, getLesson,
  searchLessons, nextModuleAfter
} from '../data/course.js';
import { glossary } from '../data/glossary.js';
import {
  esc, highlight, formatMoney, percent, formatDuration, getLevel, pctLabel
} from '../utils.js';
import { icon } from './icons.js';
import {
  pageHead, backHead, ring, progress, emptyState, openSheet, closeSheet,
  toast, celebrate, playSound, rewardToast, sectionHead
} from './components.js';

const LETTERS = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ'.split('');

function moduleStatus(module) {
  if (!module.available) return { label: 'Скоро', cls: 'locked', icon: 'clock', locked: true, upcoming: true };
  if (store.isModuleComplete(module.id)) return { label: 'Пройден', cls: 'done', icon: 'check-circle', locked: false };
  if (!store.isModuleUnlocked(module.id)) return { label: 'Закрыт', cls: 'locked', icon: 'lock', locked: true };
  const p = store.getModuleProgress(module);
  if (p.done > 0) return { label: 'В процессе', cls: '', icon: 'play', locked: false };
  return { label: 'Доступен', cls: '', icon: 'play', locked: false };
}

function moduleCard(module) {
  const status = moduleStatus(module);
  const p = store.getModuleProgress(module);
  return `<button type="button" class="module-card ${status.locked ? 'is-locked' : ''} ${store.isModuleComplete(module.id) ? 'is-done' : ''}"
      style="--accent:${module.color}" data-module-id="${module.id}" data-locked="${status.locked ? '1' : '0'}" data-upcoming="${status.upcoming ? '1' : '0'}">
    <div class="module-main">
      <div class="module-icon">${icon(status.locked && !status.upcoming ? 'lock' : module.icon, 24)}</div>
      <div class="module-copy">
        <div class="module-kicker">Модуль ${module.id}</div>
        <div class="module-title">${esc(module.title)}</div>
        <div class="module-desc">${esc(module.description)}</div>
      </div>
      <span class="module-status ${status.cls}">${icon(status.icon, 11)} ${status.label}</span>
    </div>
    <div class="module-progress">
      ${progress(p.percent, module.color)}
      <div class="module-foot">
        <span>${p.done} из ${p.total} уроков</span>
        <span>${p.percent ? Math.round(p.percent) + '%' : module.available ? 'Начни сегодня' : 'Следующий этап'}</span>
      </div>
    </div>
  </button>`;
}

export function renderCourse({ query } = {}) {
  const course = store.getCourseProgress();
  const level = getLevel(store.state.profile.xp);
  const bookmarks = store.state.course.bookmarks.length;
  const mistakes = store.state.course.wrong.length;
  const next = store.getNextLesson();
  const html = `<div class="page">
    ${pageHead({
      eyebrow: 'Обучение',
      title: 'Курс',
      subtitle: 'Финансовая грамотность на реальных примерах',
      actions: `<a class="icon-btn icon-btn--glass" href="#/profile" aria-label="Профиль">${icon('user', 19)}</a>`
    })}

    <div class="course-hero card">
      ${ring({ value: course.percent, size: 88, stroke: 9, color: 'var(--blue)', label: `${Math.round(course.percent)}%` })}
      <div class="course-hero-copy">
        <div class="course-hero-title">${course.completed ? 'Продолжай в том же ритме' : 'Начни свой путь'}</div>
        <div class="course-hero-sub">${course.completed ? `Следующий шаг: ${esc(next?.title || 'повторить урок')}` : '15 живых уроков уже доступны. Остальные модули — в следующих обновлениях.'}</div>
        <div class="course-stats">
          <span>${icon('check-circle', 13)} ${course.completed} / ${course.total}</span>
          <span>${icon('clock', 13)} ${formatDuration(course.minutesLeft)}</span>
          <span>${icon('trophy', 13)} ${course.modulesDone} / 10 модулей</span>
        </div>
      </div>
    </div>

    <div class="search-box">
      ${icon('search', 19, 'search-icon')}
      <input class="input" id="course-search" type="search" placeholder="Найти урок или тему" autocomplete="off" aria-label="Поиск по урокам">
    </div>

    <div class="course-tools">
      <a class="tool-card" href="#/course/bookmarks">
        <span class="tool-icon">${icon('bookmark', 16)}</span>
        <span class="tool-name">Закладки</span>
        <span class="tool-count">${bookmarks} ${plural(bookmarks, 'урок', 'урока', 'уроков')}</span>
      </a>
      <a class="tool-card" href="#/course/mistakes">
        <span class="tool-icon">${icon('rotate', 16)}</span>
        <span class="tool-name">Работа над ошибками</span>
        <span class="tool-count">${mistakes ? `${mistakes} ${plural(mistakes, 'вопрос', 'вопроса', 'вопросов')}` : 'Всё чисто'}</span>
      </a>
      <a class="tool-card" href="#/course/glossary">
        <span class="tool-icon">${icon('book', 16)}</span>
        <span class="tool-name">Словарик</span>
        <span class="tool-count">${glossary.length} терминов</span>
      </a>
    </div>

    <div id="course-search-results" class="search-results hidden"></div>

    <div id="module-list">
      ${sectionHead('Модули курса', `Доступно ${availableModules.length}`)}
      ${courseModules.map(moduleCard).join('')}
    </div>

    <div class="section" style="margin-top:22px">
      <div class="card card--tight row" style="gap:12px;padding:15px 16px">
        <div class="icon-badge icon-badge--soft" style="color:var(--orange)">${icon('sparkles', 19)}</div>
        <div class="grow"><div class="small strong">Новые модули уже в работе</div><div class="tiny tertiary">Умные покупки, кредиты, инвестиции и симулятор «Год жизни» появятся в следующих обновлениях приложения.</div></div>
      </div>
    </div>
  </div>`;

  return {
    html,
    mount(root, { query: q } = {}) {
      root.querySelectorAll('[data-module-id]').forEach(card => {
        card.addEventListener('click', () => {
          const id = Number(card.dataset.moduleId);
          if (card.dataset.upcoming === '1') {
            toast('Этот модуль появится в следующем обновлении', { emoji: '📦' });
            return;
          }
          if (card.dataset.locked === '1') {
            const prev = getModule(id - 1);
            toast(`Сначала пройди итоговый тест модуля «${prev?.title || 'предыдущего'}»`, { emoji: '🔒' });
            return;
          }
          location.hash = `#/course/module/${id}`;
        });
      });

      const input = root.querySelector('#course-search');
      const results = root.querySelector('#course-search-results');
      const modules = root.querySelector('#module-list');
      const renderSearch = () => {
        const query = input.value.trim();
        if (!query) {
          results.classList.add('hidden');
          results.innerHTML = '';
          modules.classList.remove('hidden');
          return;
        }
        modules.classList.add('hidden');
        results.classList.remove('hidden');
        const found = searchLessons(query);
        results.innerHTML = found.length
          ? `<div class="section-caption" style="margin:0 2px 9px">Найдено: ${found.length}</div>` +
            found.map(({ lesson, module }) => `<button class="lesson-row" data-search-lesson="${lesson.id}" style="width:100%">
              <span class="lesson-num current" style="--accent:${module.color};background:color-mix(in srgb,${module.color} 13%,transparent);color:${module.color}">${lesson.number}</span>
              <span class="grow"><span class="lesson-row-title">${highlight(lesson.title, query)}</span>
                <span class="lesson-row-meta">${esc(module.title)} · ${lesson.minutes} мин</span></span>
              ${icon('chevron-right', 16, 'chev')}
            </button>`).join('')
          : emptyState({ emoji: '🔍', title: 'Ничего не нашлось', text: `По запросу «${esc(query)}» уроков нет. Попробуй другое слово — например, «бюджет» или «процент».` });
        results.querySelectorAll('[data-search-lesson]').forEach(btn => {
          btn.addEventListener('click', () => { location.hash = `#/course/lesson/${btn.dataset.searchLesson}`; });
        });
      };
      input?.addEventListener('input', renderSearch);
      if (q?.get?.('resume') === '1' && next) {
        location.hash = `#/course/lesson/${next.id}`;
      }
    }
  };
}

export function renderModule({ params } = {}) {
  const module = getModule(params.id);
  if (!module) return notFound('Модуль не найден');
  if (!module.available) {
    return lockedPage('Модуль скоро появится', 'Мы уже работаем над этим материалом. А пока закрепи базу в доступных модулях.');
  }
  if (!store.isModuleUnlocked(module.id)) {
    const prev = getModule(module.id - 1);
    return lockedPage('Модуль пока закрыт', `Сначала сдай итоговый тест модуля «${prev?.title || 'предыдущего'}» на 70% или выше.`);
  }
  const p = store.getModuleProgress(module);
  const test = store.state.course.tests[module.id];
  const allDone = p.done >= p.total;

  const rows = module.lessons.map((lesson, i) => {
    const done = store.isLessonComplete(lesson.id);
    const current = !done && module.lessons.findIndex(l => !store.isLessonComplete(l.id)) === i;
    return `<button class="lesson-row" type="button" data-nav="#/course/lesson/${lesson.id}">
      <span class="lesson-num ${done ? 'done' : current ? 'current' : ''}" style="--accent:${module.color}">${done ? icon('check', 14) : i + 1}</span>
      <span class="grow">
        <span class="lesson-row-title">${esc(lesson.title)}</span>
        <span class="lesson-row-meta">${lesson.minutes} мин чтения ${current ? '· <span style="color:var(--blue);font-weight:650">Продолжить</span>' : ''}</span>
      </span>
      ${icon('chevron-right', 16, 'chev')}
    </button>`;
  }).join('');

  const html = `<div class="page" style="--accent:${module.color}">
    ${backHead({
      title: esc(module.title),
      subtitle: `Модуль ${module.id} · ${p.done} из ${p.total} уроков`,
      back: '#/course',
      action: `<span class="chip" style="background:color-mix(in srgb,${module.color} 12%,transparent);color:${module.color};font-weight:700">${Math.round(p.percent)}%</span>`
    })}
    <div class="lesson-hero">
      <div class="lesson-kicker">Модуль ${module.id}</div>
      <div class="lesson-title">${esc(module.subtitle || module.title)}</div>
      <div class="lesson-meta">
        <span>${icon('book', 13)} ${module.lessons.length} уроков</span>
        <span>${icon('clock', 13)} ${formatDuration(module.lessons.reduce((a, l) => a + l.minutes, 0))}</span>
        ${test?.passed ? `<span>${icon('trophy', 13)} Тест сдан на ${test.percent}%</span>` : ''}
      </div>
    </div>
    <div class="card card--padded" style="margin-bottom:15px">
      <div class="row row--between" style="margin-bottom:9px">
        <span class="small strong">Прогресс модуля</span>
        <span class="tiny tertiary">${p.done}/${p.total}</span>
      </div>
      ${progress(p.percent, module.color, 8)}
      <div class="tiny tertiary" style="margin-top:8px">${esc(module.description)}</div>
    </div>
    <div class="card card--padded" style="padding:5px 16px">
      ${rows}
    </div>
    <div class="test-card" style="--accent:${module.color}">
      <div class="icon-badge">${icon(allDone ? 'trophy' : 'lock', 21)}</div>
      <div class="test-card-copy">
        <div class="test-card-title">${test?.passed ? 'Итоговый тест пройден' : 'Итоговый тест модуля'}</div>
        <div class="test-card-sub">${test?.passed ? `Результат: ${test.score}/${test.total} · ${test.percent}%` : allDone ? '10 вопросов · проходной балл 70% · +100 XP' : `Сначала пройди все ${p.total} уроков`}</div>
      </div>
      ${allDone ? `<button class="btn btn--sm" type="button" data-nav="#/course/test/${module.id}">${test?.passed ? 'Пройти снова' : 'Начать'}</button>` : `<span class="chip">${icon('lock', 12)}</span>`}
    </div>
    ${test?.passed ? `<div class="remember-card" style="margin-top:14px">
      <div class="remember-label">Бейдж модуля получен</div>
      <div class="row"><div class="ach-medal" style="width:48px;height:48px;margin:0;background:color-mix(in srgb,${module.color} 15%,transparent);filter:none;opacity:1">${module.badge?.emoji || '🏅'}</div>
      <div><div class="small strong">${esc(module.badge?.name || 'Модуль пройден')}</div><div class="tiny secondary">${esc(module.badge?.description || '')}</div></div></div>
    </div>` : ''}
  </div>`;
  return { html, mount(root) {} };
}

function theoryCard(card, index, accent) {
  const kind = card.kind || 'text';
  return `<div class="theory-card" style="--accent:${accent}">
    <div class="row row--between" style="margin-bottom:6px">
      <h3>${esc(card.title)}</h3>
      <span class="tiny tertiary mono" style="font-size:9px">${String(index + 1).padStart(2, '0')}</span>
    </div>
    <p>${card.text}</p>
    ${card.stats ? `<div class="stat-inline">${card.stats.map(s => `<div class="stat-box"><div class="stat-num">${esc(s.value)}</div><div class="stat-label">${esc(s.label)}</div></div>`).join('')}</div>` : ''}
    ${kind === 'list' && card.items ? `<ul class="theory-list">${card.items.map(item => `<li>${item}</li>`).join('')}</ul>` : ''}
    ${card.callout ? `<div class="theory-callout">${card.callout}</div>` : ''}
  </div>`;
}

function quizOptionLabel(type, i) {
  return type === 'tf' ? (i === 0 ? 'Верно' : 'Неверно') : String.fromCharCode(1040 + i);
}

function renderQuiz(q, index, accent) {
  const typeLabel = q.type === 'single' ? 'Выбор ответа' : q.type === 'tf' ? 'Верно / неверно' : 'Число';
  if (q.type === 'number') {
    return `<div class="quiz-q" data-qid="${q.id}" style="--accent:${accent}">
      <div class="quiz-q-top"><span class="quiz-q-num">Вопрос ${index + 1}</span><span class="quiz-q-type">${typeLabel}</span></div>
      <div class="quiz-question">${esc(q.q)}</div>
      <div class="quiz-input-row">
        <div class="input-group"><input class="input" type="number" inputmode="decimal" step="any" placeholder="Твой ответ" aria-label="Введи число"><span class="input-suffix">${esc(q.suffix || '')}</span></div>
        <button class="btn btn--sm" type="button" data-answer-number>Ответить</button>
      </div>
      <div class="quiz-explain hidden"></div>
    </div>`;
  }
  const options = q.type === 'tf' ? ['Верно', 'Неверно'] : q.options;
  return `<div class="quiz-q" data-qid="${q.id}" style="--accent:${accent}">
    <div class="quiz-q-top"><span class="quiz-q-num">Вопрос ${index + 1}</span><span class="quiz-q-type">${typeLabel}</span></div>
    <div class="quiz-question">${esc(q.q)}</div>
    <div class="quiz-options">
      ${options.map((opt, i) => `<button class="quiz-opt" type="button" data-opt="${i}">
        <span class="opt-marker">${typeLabel === 'Выбор ответа' ? quizOptionLabel('single', i) : (q.type === 'tf' ? (i === 0 ? '✓' : '✕') : i + 1)}</span>
        <span>${esc(opt)}</span>
      </button>`).join('')}
    </div>
    <div class="quiz-explain hidden"></div>
  </div>`;
}

export function renderLesson({ params } = {}) {
  const lesson = getLesson(params.id);
  if (!lesson) return notFound('Урок не найден');
  const module = getModule(lesson.moduleId);
  if (module && !store.isModuleUnlocked(module.id)) {
    return lockedPage('Урок закрыт', `Сначала пройди модуль «${getModule(module.id - 1)?.title || 'предыдущий'}».`);
  }
  const done = store.isLessonComplete(lesson.id);
  const bookmarked = store.isBookmarked(lesson.id);
  const accent = module?.color || '#007AFF';
  const moduleLessons = module?.lessons || [];
  const index = moduleLessons.findIndex(l => l.id === lesson.id);
  const nextInModule = moduleLessons[index + 1] || null;
  const total = lesson.quiz.length;

  const html = `<div class="page lesson-page" style="--accent:${accent}">
    ${backHead({
      title: `Урок ${lesson.number || index + 1}`,
      subtitle: module ? esc(module.title) : '',
      back: `#/course/module/${lesson.moduleId}`,
      action: `<button class="icon-btn ${bookmarked ? 'icon-btn--accent' : 'icon-btn--glass'}" type="button" data-bookmark aria-label="${bookmarked ? 'Удалить из закладок' : 'Добавить в закладки'}" aria-pressed="${bookmarked}">${icon('bookmark', 19)}</button>`
    })}

    <div class="lesson-hero">
      <div class="lesson-kicker">${done ? 'Урок пройден' : 'Теория и практика'}</div>
      <div class="lesson-title">${esc(lesson.title)}</div>
      <div class="lesson-meta">
        <span>${icon('clock', 13)} ${lesson.minutes} мин</span>
        <span>${icon('book', 13)} ${lesson.cards.length} карточек</span>
        <span>${icon('target', 13)} ${lesson.quiz.length} вопроса</span>
        ${done ? `<span style="background:rgba(255,255,255,.28)">${icon('check', 12)} Пройден</span>` : ''}
      </div>
    </div>

    <div class="lesson-goal">
      <div class="goal-label">Цель урока</div>
      <p>${esc(lesson.goal)}</p>
    </div>

    <div class="theory-block">
      <div class="theory-index"><span>Теория</span><span class="line"></span><span>${lesson.cards.length} карточек</span></div>
      ${lesson.cards.map((card, i) => theoryCard(card, i, accent)).join('')}
    </div>

    <div class="section">
      <div class="example-card">
        <div class="example-label">${icon('sparkles', 13)} Пример из жизни</div>
        <h3>${esc(lesson.example.title)}</h3>
        <p>${esc(lesson.example.text)}</p>
      </div>
    </div>

    <div class="section">
      <div class="remember-card">
        <div class="remember-label">${icon('check-circle', 13)} Запомни главное</div>
        <ul class="remember-list">
          ${lesson.remember.map(item => `<li><span class="check-dot">${icon('check', 12)}</span><span>${esc(item)}</span></li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="quiz-block" id="lesson-quiz">
      <div class="quiz-heading">Проверь себя</div>
      <div class="quiz-sub">${total} ${plural(total, 'вопрос', 'вопроса', 'вопросов')} · объяснение после каждого ответа</div>
      ${lesson.quiz.map((q, i) => renderQuiz(q, i, accent)).join('')}
      <div class="quiz-result ${done ? 'show' : ''}" id="lesson-quiz-result">
        <div class="quiz-score" id="quiz-score">0 / ${total}</div>
        <div class="small">${done ? 'Ты уже проходил этот урок. Можно повторить и освежить знания.' : 'Ответь на все вопросы, чтобы завершить урок.'}</div>
        <button class="btn btn--wide" type="button" id="finish-lesson" ${done ? '' : 'disabled'}>${done ? 'Вернуться к модулю' : 'Завершить урок · +20 XP'}</button>
      </div>
    </div>

    <div class="practice-card">
      <div class="practice-label">${icon('target', 13)} Практика</div>
      <h3>${esc(lesson.practice.title)}</h3>
      <p>${esc(lesson.practice.text)}</p>
      <button class="btn btn--dark" type="button" data-practice="${esc(lesson.practice.route)}">${esc(lesson.practice.label)} ${icon('arrow-right', 16)}</button>
    </div>

    <div class="section" style="margin-top:18px">
      <div class="card card--tight row" style="gap:12px">
        <div class="icon-badge icon-badge--soft" style="color:${accent}">${icon('lightbulb', 19)}</div>
        <div class="grow tiny secondary">Совет: не спеши. Один урок в день с практикой полезнее пяти уроков за вечер без применения.</div>
      </div>
    </div>
  </div>`;

  return {
    html,
    mount(root) {
      const answered = new Map();
      let finished = done;
      const resultBox = root.querySelector('#lesson-quiz-result');
      const scoreEl = root.querySelector('#quiz-score');
      const finishBtn = root.querySelector('#finish-lesson');

      const updateResult = () => {
        let correct = 0;
        answered.forEach(v => { if (v.correct) correct++; });
        scoreEl.textContent = `${correct} / ${total}`;
        if (answered.size === total) {
          resultBox.classList.add('show');
          finishBtn.disabled = false;
          if (!done) finishBtn.textContent = `Завершить урок · +20 XP`;
        }
      };

      const record = (question, isCorrect, qEl) => {
        answered.set(question.id, { correct: isCorrect });
        store.recordQuizAnswer({
          lessonId: lesson.id,
          moduleId: lesson.moduleId,
          question,
          selected: null,
          correct: isCorrect
        });
        updateResult();
      };

      root.querySelectorAll('.quiz-q').forEach((qEl, qIndex) => {
        const question = lesson.quiz[qIndex];
        const explain = qEl.querySelector('.quiz-explain');
        const markOptions = (chosen) => {
          const isCorrect = question.type === 'tf'
            ? String(chosen) === String(question.correct)
            : Number(chosen) === Number(question.correct);
          qEl.querySelectorAll('.quiz-opt').forEach((btn, i) => {
            btn.disabled = true;
            const optionCorrect = question.type === 'tf' ? (i === 0) === !!question.correct : i === Number(question.correct);
            if (optionCorrect) btn.classList.add('correct');
            if (i === chosen && !isCorrect) btn.classList.add('wrong');
            if (i === chosen) btn.setAttribute('aria-pressed', 'true');
          });
          explain.innerHTML = `<strong>${isCorrect ? 'Верно!' : 'Не совсем.'}</strong> ${esc(question.explanation)}`;
          explain.classList.remove('hidden');
          record(question, isCorrect, qEl);
          playSound(isCorrect ? 'success' : 'error');
        };

        if (question.type === 'number') {
          const input = qEl.querySelector('input');
          qEl.querySelector('[data-answer-number]').addEventListener('click', () => {
            if (qEl.dataset.answered) return;
            const value = Number(String(input.value).replace(',', '.'));
            if (!Number.isFinite(value) || input.value === '') { toast('Введи число', { emoji: '🔢' }); return; }
            qEl.dataset.answered = '1';
            const isCorrect = Math.abs(value - Number(question.correct)) <= Number(question.tolerance || 0.001);
            input.disabled = true;
            qEl.querySelector('[data-answer-number]').disabled = true;
            explain.innerHTML = `<strong>${isCorrect ? 'Верно!' : `Правильный ответ: ${question.correct} ${question.suffix || ''}.`}</strong> ${esc(question.explanation)}`;
            explain.classList.remove('hidden');
            record(question, isCorrect, qEl);
            playSound(isCorrect ? 'success' : 'error');
          });
          input?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); qEl.querySelector('[data-answer-number]')?.click(); }
          });
        } else {
          qEl.querySelectorAll('.quiz-opt').forEach(btn => {
            btn.addEventListener('click', () => {
              if (qEl.dataset.answered) return;
              qEl.dataset.answered = '1';
              markOptions(Number(btn.dataset.opt));
            });
          });
        }
      });

      finishBtn.addEventListener('click', () => {
        if (!done && answered.size < total) return;
        if (done) { location.hash = `#/course/module/${lesson.moduleId}`; return; }
        let correct = 0;
        answered.forEach(v => { if (v.correct) correct++; });
        const res = store.completeLesson(lesson, { correct, total });
        if (res.newly) {
          celebrate(1);
          playSound('success');
          toast('Урок завершён', { emoji: '🎉', xp: 20 });
        }
        const allModuleDone = module.lessons.every(l => store.isLessonComplete(l.id));
        const nextLesson = nextInModule || nextModuleAfter(lesson.moduleId)?.lessons?.[0] || null;
        openSheet({
          title: res.newly ? 'Урок пройден!' : 'Хорошая работа',
          body: `<div style="text-align:center;padding:5px 0 4px">
            <div style="font-size:58px;line-height:1.1;margin-bottom:8px">${correct === total ? '🏆' : '🎉'}</div>
            <div class="confirm-title">${correct} из ${total} правильных</div>
            <p class="confirm-text">${res.newly ? 'Ты получил 20 XP. Продолжай в том же ритме.' : 'Урок уже был пройден ранее. Повторение помогает закрепить материал.'}</p>
            <div class="confirm-summary row row--between">
              <span class="small"><strong>${esc(lesson.title)}</strong></span>
              <span class="text-green small strong">${res.newly ? '+20 XP' : '✓'}</span>
            </div>
            ${answered.size < total ? '<p class="tiny tertiary">Ты завершил урок, не ответив на все вопросы. Ошибки можно разобрать в разделе «Работа над ошибками».</p>' : ''}
            <div class="form-actions">
              <button class="btn btn--secondary" type="button" data-nav="#/course/module/${lesson.moduleId}">К модулю</button>
              ${allModuleDone && module ? `<button class="btn" type="button" data-nav="#/course/test/${module.id}">Итоговый тест</button>` : nextLesson ? `<button class="btn" type="button" data-nav="#/course/lesson/${nextLesson.id}">Следующий урок</button>` : ''}
            </div>
          </div>`
        });
      });

      root.querySelector('[data-bookmark]')?.addEventListener('click', (e) => {
        const added = store.toggleBookmark(lesson.id);
        e.currentTarget.classList.toggle('icon-btn--accent', added);
        e.currentTarget.classList.toggle('icon-btn--glass', !added);
        e.currentTarget.setAttribute('aria-pressed', String(added));
        toast(added ? 'Добавлено в закладки' : 'Убрано из закладок', { emoji: '🔖' });
      });

      root.querySelector('[data-practice]')?.addEventListener('click', (e) => {
        location.hash = e.currentTarget.dataset.practice;
      });
    }
  };
}

export function renderModuleTest({ params } = {}) {
  const module = getModule(params.id);
  if (!module || !module.available) return notFound('Тест не найден');
  if (!store.isModuleUnlocked(module.id)) return lockedPage('Тест закрыт', 'Сначала открой модуль.');
  const progressData = store.getModuleProgress(module);
  if (progressData.done < progressData.total) return lockedPage('Тест пока недоступен', `Пройди все уроки модуля: осталось ${progressData.total - progressData.done}.`);
  const test = module.finalTest;
  const previous = store.state.course.tests[module.id];

  const questions = test.map((q, i) => {
    const options = q.type === 'tf' ? ['Верно', 'Неверно'] : q.options;
    return `<div class="quiz-q" data-test-q="${q.id}">
      <div class="quiz-q-top"><span class="quiz-q-num">Вопрос ${i + 1} из ${test.length}</span><span class="quiz-q-type">${q.type === 'tf' ? 'Верно / неверно' : 'Выбор ответа'}</span></div>
      <div class="quiz-question">${esc(q.q)}</div>
      <div class="quiz-options">
        ${options.map((opt, oi) => `<label class="quiz-opt" style="cursor:pointer">
          <input type="radio" name="q-${i}" value="${oi}" style="accent-color:${module.color};width:17px;height:17px;flex:none">
          <span>${esc(opt)}</span>
        </label>`).join('')}
      </div>
    </div>`;
  }).join('');

  const html = `<div class="page" style="--accent:${module.color}">
    ${backHead({ title: 'Итоговый тест', subtitle: `${module.title} · проходной балл 70%`, back: `#/course/module/${module.id}` })}
    <div class="lesson-hero">
      <div class="lesson-kicker">Модуль ${module.id}</div>
      <div class="lesson-title">${esc(module.title)}</div>
      <div class="lesson-meta">
        <span>${icon('check-circle', 13)} 10 вопросов</span>
        <span>${icon('target', 13)} нужно 7 правильных</span>
        <span>${icon('trophy', 13)} +100 XP и бейдж</span>
      </div>
    </div>
    ${previous ? `<div class="card card--tight" style="margin-bottom:14px;padding:13px 15px">
      <div class="row row--between"><span class="small"><strong>Прошлый результат:</strong> ${previous.score}/${previous.total}</span><span class="chip ${previous.passed ? 'active' : ''}" style="${previous.passed ? 'background:var(--green);color:#fff' : ''}">${previous.percent}%</span></div>
    </div>` : ''}
    <p class="small secondary" style="margin:0 3px 12px">Отвечай спокойно. После отправки ты увидишь результат и сможешь пройти тест снова.</p>
    <form id="module-test-form">${questions}
      <button class="btn btn--lg btn--wide" type="submit" style="margin-top:6px">Проверить результат</button>
    </form>
    <div id="test-result"></div>
  </div>`;

  return {
    html,
    mount(root) {
      const form = root.querySelector('#module-test-form');
      let submitted = false;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (submitted) return;
        const fd = new FormData(form);
        const answers = test.map((q, i) => fd.get(`q-${i}`));
        if (answers.some(v => v === null || v === '')) {
          toast('Ответь на все 10 вопросов', { emoji: '📝' });
          return;
        }
        submitted = true;
        let correct = 0;
        test.forEach((q, i) => {
          const selected = Number(answers[i]);
          const isCorrect = q.type === 'tf'
            ? (selected === 0) === !!q.correct
            : selected === Number(q.correct);
          if (isCorrect) correct++;
          store.recordQuizAnswer({
            lessonId: `module-${module.id}-test`,
            moduleId: module.id,
            question: q,
            selected,
            correct: isCorrect
          });
        });
        const result = store.completeModule(module.id, correct, test.length);
        if (result.passed) { celebrate(1.6); playSound('success'); }
        else playSound('error');

        root.querySelectorAll('#module-test-form input').forEach(input => input.disabled = true);
        form.querySelector('button[type="submit"]').disabled = true;

        openSheet({
          title: result.passed ? 'Тест сдан!' : 'Почти получилось',
          body: `<div style="text-align:center;padding:4px 0">
            <div style="font-size:64px;line-height:1.1">${result.passed ? (module.badge?.emoji || '🏆') : '📘'}</div>
            <div class="quiz-score" style="color:${result.passed ? 'var(--green)' : 'var(--red)'}">${correct} / ${test.length}</div>
            <p class="confirm-text">${result.passed ? `Это ${result.percent}%. Проходной балл пройден — модуль и бейдж «${module.badge?.name || 'Модуль'}» твои.` : `Это ${result.percent}%. Для прохождения нужно 70%. Перечитай уроки и попробуй снова — ошибки уже добавлены в работу над ошибками.`}</p>
            <div class="confirm-summary">
              <div class="row row--between"><span class="small">Правильных ответов</span><strong>${correct} из ${test.length}</strong></div>
              <div class="row row--between" style="margin-top:6px"><span class="small">Награда</span><strong class="text-green">${result.newly ? '+100 XP' : result.passed ? 'Бейдж уже получен' : 'пока нет'}</strong></div>
            </div>
            <div class="form-actions">
              <button class="btn btn--secondary" type="button" data-nav="#/course/module/${module.id}">К модулю</button>
              ${!result.passed ? `<button class="btn" type="button" data-retry>Пройти снова</button>` : `<button class="btn" type="button" data-nav="#/course">К курсу</button>`}
            </div>
          </div>`,
          onMount(body, close) {
            body.querySelector('[data-retry]')?.addEventListener('click', () => {
              close();
              location.hash = `#/course/test/${module.id}`;
              // принудительный перезапуск, если хэш тот же
              setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 30);
            });
          }
        });
      });
    }
  };
}

export function renderBookmarks() {
  const lessons = allLessons.filter(l => store.state.course.bookmarks.includes(l.id));
  const html = `<div class="page">
    ${backHead({ title: 'Закладки', subtitle: `${lessons.length} ${plural(lessons.length, 'сохранённый урок', 'сохранённых урока', 'сохранённых уроков')}`, back: '#/course' })}
    ${lessons.length ? `<div class="card card--padded" style="padding:5px 16px">${lessons.map(lesson => {
      const module = getModule(lesson.moduleId);
      return `<button class="lesson-row" type="button" data-nav="#/course/lesson/${lesson.id}">
        <span class="lesson-num current" style="--accent:${module.color};color:${module.color};background:color-mix(in srgb,${module.color} 13%,transparent)">${icon('bookmark', 14)}</span>
        <span class="grow"><span class="lesson-row-title">${esc(lesson.title)}</span><span class="lesson-row-meta">${esc(module.title)} · ${lesson.minutes} мин</span></span>
        ${store.isLessonComplete(lesson.id) ? `<span class="tag tag--need">пройден</span>` : ''}
        ${icon('chevron-right', 16, 'chev')}
      </button>`;
    }).join('')}</div>` : emptyState({
      emoji: '🔖',
      title: 'Закладок пока нет',
      text: 'Сохраняй уроки, к которым хочешь вернуться. Нажми на иконку закладки в правом верхнем углу урока.',
      action: `<button class="btn" type="button" data-nav="#/course">Перейти к курсу</button>`
    })}
  </div>`;
  return { html, mount() {} };
}

export function renderMistakes() {
  const wrong = store.state.course.wrong;
  const html = `<div class="page">
    ${backHead({ title: 'Работа над ошибками', subtitle: wrong.length ? `${wrong.length} ${plural(wrong.length, 'вопрос', 'вопроса', 'вопросов')} ждут повторения` : 'Всё чисто', back: '#/course' })}
    ${wrong.length ? `<p class="small secondary" style="margin:0 3px 14px">Ошибка — это просто место, где можно стать лучше. Пройди вопрос заново: правильный ответ исчезнет из списка.</p>
      ${wrong.map(w => {
        const module = getModule(w.moduleId);
        return `<div class="wrong-card">
          <div class="row row--between"><span class="wrong-source">${esc(module?.title || 'Курс')}</span><span class="tiny tertiary">${w.attempts > 1 ? `попыток: ${w.attempts}` : '1 попытка'}</span></div>
          <div class="wrong-q">${esc(w.question)}</div>
          <div class="row row--between" style="gap:10px">
            <span class="tiny secondary">Повтори вопрос, чтобы убрать его отсюда.</span>
            <button class="btn btn--sm btn--soft" type="button" data-review="${w.id}">Повторить</button>
          </div>
        </div>`;
      }).join('')}` : emptyState({
        emoji: '🌈',
        title: 'Ошибок нет',
        text: 'Ты ответил правильно на все вопросы, которые встречались. Новые ошибки будут появляться здесь автоматически — их можно будет перепройти.',
        action: `<button class="btn" type="button" data-nav="#/course">К курсу</button>`
      })}
  </div>`;
  return {
    html,
    mount(root) {
      root.querySelectorAll('[data-review]').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = store.state.course.wrong.find(w => w.id === btn.dataset.review);
          if (item) openMistakeReview(item);
        });
      });
    }
  };
}

function openMistakeReview(wrong) {
  const isNumber = wrong.type === 'number';
  const options = wrong.type === 'tf' ? ['Верно', 'Неверно'] : (wrong.options || []);
  let done = false;
  const { body, close } = openSheet({
    title: 'Повторение',
    subtitle: 'Выбери правильный ответ. Если ответишь верно, вопрос уйдёт из списка.',
    body: `<div class="quiz-q" style="box-shadow:none;padding:4px 0 0">
      <div class="quiz-question">${esc(wrong.question)}</div>
      ${isNumber ? `<div class="quiz-input-row"><div class="input-group"><input class="input" type="number" step="any" placeholder="Твой ответ"><span class="input-suffix">${esc(wrong.suffix || '')}</span></div><button class="btn btn--sm" type="button" data-check-number>Проверить</button></div>` :
        `<div class="quiz-options">${options.map((opt, i) => `<button class="quiz-opt" type="button" data-opt="${i}"><span class="opt-marker">${String.fromCharCode(1040 + i)}</span><span>${esc(opt)}</span></button>`).join('')}</div>`}
      <div class="quiz-explain hidden"></div>
      <div class="form-actions"><button class="btn btn--secondary" type="button" data-sheet-close>Закрыть</button></div>
    </div>`,
    onMount(bodyEl, closeFn) {
      const explain = bodyEl.querySelector('.quiz-explain');
      const finish = (isCorrect) => {
        if (done) return;
        done = true;
        const question = { id: wrong.id, type: wrong.type, q: wrong.question, options: wrong.options, correct: wrong.correct, explanation: wrong.explanation, suffix: wrong.suffix };
        store.recordQuizAnswer({ lessonId: wrong.lessonId, moduleId: wrong.moduleId, question, selected: null, correct: isCorrect });
        if (isCorrect) {
          store.addXP(5);
          store.save();
          toast('Вопрос закрыт', { emoji: '✅', xp: 5 });
          playSound('success');
          setTimeout(() => {
            closeFn();
            window.dispatchEvent(new CustomEvent('kopeyka:rerender'));
          }, 700);
        } else {
          explain.innerHTML = `<strong>Пока нет.</strong> ${esc(wrong.explanation)}`;
          explain.classList.remove('hidden');
          playSound('error');
          setTimeout(() => { done = false; }, 500);
        }
      };
      if (isNumber) {
        bodyEl.querySelector('[data-check-number]').addEventListener('click', () => {
          if (done) return;
          const val = Number(bodyEl.querySelector('input').value.replace(',', '.'));
          finish(Math.abs(val - Number(wrong.correct)) <= 0.01);
        });
      } else {
        bodyEl.querySelectorAll('[data-opt]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (done) return;
            const index = Number(btn.dataset.opt);
            const isCorrect = wrong.type === 'tf' ? (index === 0) === !!wrong.correct : index === Number(wrong.correct);
            btn.classList.add(isCorrect ? 'correct' : 'wrong');
            finish(isCorrect);
          });
        });
      }
    }
  });
}

export function renderGlossary() {
  store.state.course.glossaryViews = (store.state.course.glossaryViews || 0) + 1;
  store.save();
  store.emit({ type: 'glossary' });

  const grouped = {};
  glossary.forEach(item => {
    if (!grouped[item.letter]) grouped[item.letter] = [];
    grouped[item.letter].push(item);
  });
  const letters = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ru'));

  const html = `<div class="page">
    ${backHead({ title: 'Словарик', subtitle: `${glossary.length} терминов простым языком`, back: '#/course' })}
    <div class="search-box">
      ${icon('search', 19, 'search-icon')}
      <input class="input" id="glossary-search" type="search" placeholder="Найти термин" autocomplete="off" aria-label="Поиск по словарю">
    </div>
    <div class="alpha-row" id="alpha-row">
      ${letters.map(l => `<button class="alpha-btn" type="button" data-letter="${l}">${l}</button>`).join('')}
    </div>
    <div id="glossary-list">
      ${letters.map(letter => `<div class="glossary-group" data-group="${letter}">
        <div class="glossary-letter">${letter}</div>
        ${grouped[letter].map(item => `<div class="glossary-item" data-search="${esc((item.term + ' ' + item.def).toLowerCase())}">
          <div class="glossary-term">${esc(item.term)}</div>
          <div class="glossary-def">${esc(item.def)}</div>
        </div>`).join('')}
      </div>`).join('')}
    </div>
    <div id="glossary-empty" class="hidden">${emptyState({ emoji: '🔍', title: 'Термин не найден', text: 'Попробуй другое слово или выбери другую букву.' })}</div>
  </div>`;

  return {
    html,
    mount(root) {
      const search = root.querySelector('#glossary-search');
      const alpha = root.querySelector('#alpha-row');
      let activeLetter = '';
      const apply = () => {
        const q = search.value.trim().toLowerCase();
        let visible = 0;
        root.querySelectorAll('.glossary-item').forEach(item => {
          const matchText = !q || (item.dataset.search || '').includes(q);
          const group = item.closest('.glossary-group');
          const matchLetter = !activeLetter || group.dataset.group === activeLetter;
          const show = matchText && matchLetter;
          item.classList.toggle('hidden', !show);
          if (show) visible++;
        });
        root.querySelectorAll('.glossary-group').forEach(group => {
          const any = [...group.querySelectorAll('.glossary-item')].some(i => !i.classList.contains('hidden'));
          group.classList.toggle('hidden', !any);
        });
        root.querySelector('#glossary-empty').classList.toggle('hidden', visible > 0);
      };
      search.addEventListener('input', () => { activeLetter = ''; alpha.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active')); apply(); });
      alpha.querySelectorAll('[data-letter]').forEach(btn => {
        btn.addEventListener('click', () => {
          activeLetter = activeLetter === btn.dataset.letter ? '' : btn.dataset.letter;
          alpha.querySelectorAll('.alpha-btn').forEach(b => b.classList.toggle('active', b === btn && !!activeLetter));
          search.value = '';
          apply();
        });
      });
    }
  };
}

function lockedPage(title, text) {
  return {
    html: `<div class="page">
      ${backHead({ title: 'Курс', back: '#/course' })}
      ${emptyState({ emoji: '🔒', title, text: esc(text), action: `<button class="btn" type="button" data-nav="#/course">Вернуться к курсу</button>` })}
    </div>`,
    mount() {}
  };
}

function notFound(text) {
  return {
    html: `<div class="page">
      ${backHead({ title: 'Не найдено', back: '#/course' })}
      ${emptyState({ emoji: '🧭', title: text, text: 'Похоже, ссылка устарела или страница была перемещена.', action: `<button class="btn" type="button" data-nav="#/course">К курсу</button>` })}
    </div>`,
    mount() {}
  };
}

function plural(n, one, few, many) {
  const num = Math.abs(Number(n)) % 100;
  const last = num % 10;
  if (num > 10 && num < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
