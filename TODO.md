# ZS v0.2 — TODO

## Срез 14 — Мобильная адаптация SPA

Источник: макет дизайнера в `ui2/`. Задание: `docs/04-mobile-adaptation.md`.
Дизайнер добавил responsive поведение через CSS-классы и media queries.
Desktop layout (lg) не изменён — все изменения additive.

### Что сделал дизайнер (ui2/ vs ui/)

**`ui2/app/tokens.css`:**
- Новый блок `[data-density="mobile"]` + `@media (max-width: 640px)` — touch-friendly density:
  `--row-h: 44px`, `--pad: 16px`, `--gap: 12px`, `--fs-base: 15px`, `--fs-sm: 13px`, `--fs-xs: 12px`,
  `--fs-h1: 21px`, `--fs-code: 13px`, `--cell-py: 12px`

**`ui2/app/layout.jsx`:**
- Hamburger icon: size 20 → 22
- Breadcrumb: добавлен `className="zs-breadcrumb"`, скрывается на mobile
- Page title: новый `div.zs-page-title` (display:none по умолчанию, показывается на sm) — текст из последнего crumb
- Header spacer: `className="zs-header-spacer"`
- Tweaks button: новая кнопка settings в header (icon gear, 32x32)
- Role switch: `className="zs-role-switch"` — скрывается на phone

**`ui2/app/table.jsx`:**
- Новый prop `cardRole` на колонках: `"title"` | `"badge"` | `"hide"`
- Автодетект: первая колонка = title, колонка "status" = badge
- Mobile sort control: `div.zs-dt-sort` (display:none, flex на sm) — Select dropdown + direction toggle button
- Desktop table: обёрнут в `div.zs-dt-table`
- Mobile cards: новый `div.zs-dt-cards` (display:none, flex на sm) — карточки с title+badge+meta grid (2 колонки)
- Pagination: `span.zs-page-nums` (desktop), `span.zs-page-compact` "N / M" (mobile)
- onSort API расширен: `onSort(key, "keep"|"flip")` для mobile dropdown

**`ui2/app/page-trace.jsx`:**
- Wrapper: `className="zs-tdetail"` + `data-mtab={mobileTab}`
- Mobile tabs: добавлен третий tab "Coverage" (было: Code / Events)
- Coverage panel: `className="zs-cov-panel"` — скрывается CSS'ом когда не выбран coverage tab

**`ui2/ZS Frontend.html` (responsive CSS):**
- `@media (max-width: 1024px)`: sidebar → drawer (.zs-sidebar-desktop hidden, .zs-hamburger shown), split → full-width, help tree → accordion (.zs-help-acc), trace detail height auto
- `@media (max-width: 768px)`: role switch hidden, content-max 100%
- `@media (max-width: 640px)`: breadcrumb → page title, table → cards, sort dropdown, compact pagination, tweaks → bottom sheet (full-width, border-radius top only, max-height 80vh)
- Coverage tab switching: `.zs-tdetail[data-mtab="coverage"] .zs-split { display:none }`, etc.

### 14.1. CSS tokens — mobile density

- [ ] **14.1.1** `packages/web/src/index.css` — добавить `[data-density="mobile"]` блок из `ui2/app/tokens.css` (строки 50-76): все 10 переменных.
- [ ] **14.1.2** `packages/web/src/index.css` — добавить `@media (max-width: 640px)` блок: auto-apply mobile density на sm, override comfortable/compact.

### 14.2. Responsive media queries

- [ ] **14.2.1** `packages/web/src/index.css` — добавить все responsive media queries из `ui2/ZS Frontend.html`:
  - `@media (max-width: 1024px)`: `.zs-sidebar-desktop { display:none }`, `.zs-hamburger { display:inline-flex }`, split → full-width, help tree → accordion, trace detail height auto, tall pages scroll
  - `@media (max-width: 768px)`: `.zs-role-switch { display:none }`, content-max 100%
  - `@media (max-width: 640px)`: breadcrumb/page-title/header-spacer switching, table→cards, sort/pagination mobile variants, tweaks bottom sheet, coverage tab switching
- [ ] **14.2.2** Проверить что все CSS-классы (zs-sidebar-desktop, zs-hamburger, zs-breadcrumb, zs-page-title, zs-header-spacer, zs-role-switch, zs-dt-table, zs-dt-cards, zs-dt-sort, zs-page-nums, zs-page-compact, zs-tdetail, zs-cov-panel, zs-split, zs-split-code, zs-split-events, zs-help-tree, zs-help-acc, zs-main, zs-main-inner, twk-panel) существуют в компонентах. Добавить отсутствующие.

### 14.3. Layout — sidebar + header

- [ ] **14.3.1** `packages/web/src/layout/sidebar.tsx` — добавить `className="zs-sidebar-desktop"` на корневой div sidebar'а.
- [ ] **14.3.2** `packages/web/src/layout/header.tsx` (или `app.tsx` где header рендерится):
  - Hamburger button: добавить `className="zs-hamburger"` (уже есть кнопка, проверить hidden по умолчанию).
  - Breadcrumb: добавить `className="zs-breadcrumb"`.
  - Page title: добавить новый `div.zs-page-title` (display:none, текст = последний сегмент пути). Показывается на sm через CSS.
  - Header spacer: заменить `<div className="flex-1" />` на `<div className="zs-header-spacer flex-1" />`.
  - Tweaks button: добавить кнопку settings (gear icon, 32x32) рядом с user avatar.
- [ ] **14.3.3** `packages/web/src/app.tsx` — sidebar overlay для mobile:
  - State `sidebarOpen` (false по умолчанию).
  - Hamburger onClick → `setSidebarOpen(true)`.
  - Sidebar: на mobile рендерить как fixed overlay + backdrop.
  - Клик по backdrop или навигация → `setSidebarOpen(false)`.
  - CSS: sidebar overlay = position fixed, z-index 50, backdrop = semi-transparent.
- [ ] **14.3.4** `packages/web/src/app.tsx` — добавить `className="zs-main"` на `<main>` и `className="zs-main-inner"` на внутренний контейнер, чтобы media queries из 14.2.1 работали.

### 14.4. DataTable — card layout

- [ ] **14.4.1** `packages/web/src/ui/data-table.tsx` — добавить `cardRole` prop в `Column<T>` interface: `cardRole?: "title" | "badge" | "hide"`.
- [ ] **14.4.2** `packages/web/src/ui/data-table.tsx` — auto-detect titleCol/badgeCol:
  ```
  const titleCol = columns.find(c => c.cardRole === "title") || columns[0];
  const badgeCol = columns.find(c => c.cardRole === "badge") || columns.find(c => c.key === "status");
  const metaCols = columns.filter(c => c !== titleCol && c !== badgeCol && c.cardRole !== "hide");
  ```
- [ ] **14.4.3** `packages/web/src/ui/data-table.tsx` — desktop table: обернуть существующую `<table>` в `<div className="zs-dt-table">`.
- [ ] **14.4.4** `packages/web/src/ui/data-table.tsx` — mobile cards: добавить `<div className="zs-dt-cards">` (display:none по умолчанию) с карточками по паттерну из `ui2/app/table.jsx`:
  - Карточка: border + border-radius + bg-1, padding 14px
  - Верх: title (flex:1, fontWeight:600) + badge (flexShrink:0)
  - Низ: grid 2 колонки, каждая meta: label (xs, text-3, uppercase) + value (sm)
- [ ] **14.4.5** `packages/web/src/ui/data-table.tsx` — mobile sort control: `<div className="zs-dt-sort">` (display:none по умолчанию):
  - Select dropdown с sortable колонками
  - Toggle direction button (chevronDown, rotate на asc)
  - onSort API: если второй аргумент "keep" — только сменить ключ; "flip" — перевернуть направление
- [ ] **14.4.6** `packages/web/src/ui/data-table.tsx` — pagination: обернуть номера страниц в `<span className="zs-page-nums">`, добавить `<span className="zs-page-compact">` с "N / M" (display:none по умолчанию).
- [ ] **14.4.7** Все страницы с DataTable (Dashboard, Traces, Scripts table, Agents, Script Detail runs) — добавить `cardRole` к колонкам где нужно. Минимум: `key="status"` → `cardRole: "badge"`. Первая колонка auto-detected как title.

### 14.5. Trace Detail — tabs + coverage

- [ ] **14.5.1** `packages/web/src/pages/trace-detail.tsx` — wrapper: добавить `className="zs-tdetail"` и `data-mtab={mobileTab}` (или аналог через state) на корневой div trace detail.
- [ ] **14.5.2** `packages/web/src/pages/trace-detail.tsx` — mobile tabs: добавить третий tab "Coverage" к Segmented control (было Code/Events). На desktop Coverage Summary всегда видна под split — на mobile показывается только когда tab = "coverage".
- [ ] **14.5.3** `packages/web/src/pages/trace-detail.tsx` — coverage panel: добавить `className="zs-cov-panel"` на div Coverage Summary. CSS из 14.2.1 скроет его когда tab != "coverage" на mobile.
- [ ] **14.5.4** Split panels: добавить `className="zs-split"` на контейнер split, `className="zs-split-code"` и `className="zs-split-events"` на панели. CSS из 14.2.1 переключит на full-width + показ/скрытие по tab.

### 14.6. Help — accordion на mobile

- [ ] **14.6.1** `packages/web/src/pages/help.tsx` — sidebar категорий: добавить `className="zs-help-tree"`.
- [ ] **14.6.2** `packages/web/src/pages/help.tsx` — добавить accordion-версию категорий (`className="zs-help-acc"`, display:none по умолчанию). На mobile (через CSS) tree скрыт, accordion показан. Accordion: collapsible секции по категориям, tap раскрывает список статей.

### 14.7. Tweaks Panel — bottom sheet

- [ ] **14.7.1** `packages/web/src/ui/tweaks-panel.tsx` — добавить `className="twk-panel"` на корневой div панели. CSS из 14.2.1 превратит его в bottom sheet на sm (full-width, border-radius top, max-height 80vh).

### 14.8. Тестирование и финализация

- [ ] **14.8.1** Визуальная проверка в Chrome DevTools: 375px (iPhone SE), 390px (iPhone 14), 768px (iPad), 1024px (iPad landscape). Все страницы.
- [ ] **14.8.2** Проверить что desktop layout (>1024px) не изменился — regression check.
- [ ] **14.8.3** Typecheck clean.
- [ ] **14.8.4** Тестировать touch: sidebar swipe (если реализован), card tap → navigate, sort dropdown.
- [ ] **14.8.5** Обновить CLAUDE.md — добавить responsive breakpoints в описание frontend.
