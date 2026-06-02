# Review F — Frontend SPA

## 21. Hash Router — ограничения

**Критичен: потеря состояния при refresh.**

- Deep linking: query params не используются для tab/filter state. F5 на `/scripts/:id` сбрасывает tab на "cognitive"
- Back button: работает через hashchange, но drawer-эффекты мешают
- Session persistence: только locale, token, tweaks в localStorage. UI state (tabs, filters, scroll) теряется

**Вывод:** минималистичен, но не масштабируется для восстановления сложного состояния.

---

## 22. Monaco Editor — размер и lazy loading

**1.2-1.5 MB JS chunk при первом заходе на Script Detail.**

- `loader.config({ monaco: monacoAll })` — весь Monaco в Vite deps pre-bundling
- Нет `build.rollupOptions.output.manualChunks` для отделения Monaco
- `preloadMonaco()` после auth — partial lazy loading, но chunk всё равно большой
- Ambient types (.d.ts) загружаются async, не блокируют render

**Рекомендация:** React.lazy для ZsMonacoEditor, explicit chunk splitting.

---

## 23. i18n — масштабируемость

**Хрупок: 2 языка работают, 3-й выявит боли.**

- Нет плюрализации (кодируется в компонентах, не в i18n)
- Flat ключи (`nav.dashboard`) вместо nested — нет автодополнения IDE
- `ru as unknown as Messages` — type cast обходит проверку полноты перевода
- 180 ключей × 3 языка = 540 переводов, ручная синхронизация

**Рекомендация:** структурирование, pluralize(), экстракция в CMS при >3 языках.

---

## 24. ErrorBoundary key={route.path} — потеря state

**Баг UX: потеря tab state при навигации между скриптами.**

- ErrorBoundary с `key={route.path}` пересоздаётся при каждой смене маршрута
- useState в ScriptDetailPage (tab, cog, srv, validation, diff) обнуляется
- Пользователь на вкладке "Runs" → переход на другой скрипт → сброс на "Cognitive"

**Решение:** убрать key из ErrorBoundary или переместить state persistence в URL params.

---

## 25. DiffEditor — фиксированная высота

**Неадаптивен: 400px hardcoded.**

| Экран | Проблема |
|-------|----------|
| 15" laptop | 400px = 50% viewport, скролл неудобен |
| 27" desktop | 400px = 28%, пустое место |
| Mobile | 400px = 62%, фактически не работает |

Также ZsMonacoEditor: height=500. Суммарно 900px минимум.

**Решение:** flex-based layout с `height: 100%` в grid-контейнере.

---

## Итог

| Вопрос | Приоритет |
|--------|-----------|
| 24. ErrorBoundary key | HIGH — баг UX |
| 21. Router state loss | HIGH — persistence |
| 22. Monaco chunk | MEDIUM — performance |
| 25. DiffEditor height | MEDIUM — adaptivity |
| 23. i18n | MEDIUM — tech debt |
