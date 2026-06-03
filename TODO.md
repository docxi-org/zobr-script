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

- [x] **14.1.1** `packages/web/src/index.css` — добавить `[data-density="mobile"]` блок из `ui2/app/tokens.css` (строки 50-76): все 10 переменных.
- [x] **14.1.2** `packages/web/src/index.css` — добавить `@media (max-width: 640px)` блок: auto-apply mobile density на sm, override comfortable/compact.

### 14.2. Responsive media queries

- [x] **14.2.1** `packages/web/src/index.css` — добавить все responsive media queries из `ui2/ZS Frontend.html`:
  - `@media (max-width: 1024px)`: `.zs-sidebar-desktop { display:none }`, `.zs-hamburger { display:inline-flex }`, split → full-width, help tree → accordion, trace detail height auto, tall pages scroll
  - `@media (max-width: 768px)`: `.zs-role-switch { display:none }`, content-max 100%
  - `@media (max-width: 640px)`: breadcrumb/page-title/header-spacer switching, table→cards, sort/pagination mobile variants, tweaks bottom sheet, coverage tab switching
- [x] **14.2.2** Проверить что все CSS-классы (zs-sidebar-desktop, zs-hamburger, zs-breadcrumb, zs-page-title, zs-header-spacer, zs-role-switch, zs-dt-table, zs-dt-cards, zs-dt-sort, zs-page-nums, zs-page-compact, zs-tdetail, zs-cov-panel, zs-split, zs-split-code, zs-split-events, zs-help-tree, zs-help-acc, zs-main, zs-main-inner, twk-panel) существуют в компонентах. Добавить отсутствующие.

### 14.3. Layout — sidebar + header

- [x] **14.3.1** `packages/web/src/layout/sidebar.tsx` — `className="zs-sidebar-desktop"` уже есть на обёртке в app.tsx.
- [x] **14.3.2** `packages/web/src/layout/header.tsx`:
  - Hamburger button: `className="zs-hamburger"` уже есть, hidden по умолчанию ✓
  - Breadcrumb: добавлен `className="zs-breadcrumb"` ✓
  - Page title: добавлен `div.zs-page-title` (hidden, текст = последний crumb) ✓
  - Header spacer: `className="zs-header-spacer"` ✓
  - Tweaks button: уже есть (gear icon, 32x32) ✓
  - Hamburger icon 20 → 22 ✓
- [x] **14.3.3** `packages/web/src/app.tsx` — sidebar overlay для mobile уже реализован (drawer state + fixed overlay + backdrop + onNavigate close).
- [x] **14.3.4** `packages/web/src/app.tsx` — добавлены `className="zs-main"` и `className="zs-main-inner"`.

### 14.4. DataTable — card layout

- [x] **14.4.1** `packages/web/src/ui/data-table.tsx` — `cardRole` prop в Column<T>: `"title" | "badge" | "hide"`.
- [x] **14.4.2** Auto-detect titleCol/badgeCol/metaCols.
- [x] **14.4.3** Desktop table: обёрнут в `<div className="zs-dt-table">`.
- [x] **14.4.4** Mobile cards: `<div className="zs-dt-cards">` (hidden по умолчанию) — карточки с title+badge+meta grid.
- [x] **14.4.5** Mobile sort control: `<div className="zs-dt-sort">` с Select + direction toggle. handleSort с mode "keep"/"flip".
- [x] **14.4.6** Pagination: `<span className="zs-page-nums">` (desktop), `<span className="zs-page-compact">` (mobile). page/pageCount/onPage props.
- [x] **14.4.7** Dashboard: `cardRole: "hide"` на coverage, events. Остальные таблицы — auto-detect (first col = title, status = badge).

### 14.5. Trace Detail — tabs + coverage

- [x] **14.5.1** Wrapper: `className="zs-tdetail"` + `data-mtab={mobileTab}` на корневом div.
- [x] **14.5.2** Mobile tabs: segmented control Code/Events/Coverage (hidden, shown via CSS at ≤860px).
- [x] **14.5.3** Coverage panel: `className="zs-cov-panel"`.
- [x] **14.5.4** Split panels: `zs-split` + `data-mobile-tab`, `zs-split-code`, `zs-split-events`. Coverage bar area: `zs-hide-narrow`.

### 14.6. Help — accordion на mobile

- [x] **14.6.1** `zs-help-tree` уже был на nav.
- [x] **14.6.2** `HelpAccordion` компонент: `className="zs-help-acc"` (hidden по умолчанию). Collapsible секции по категориям.

### 14.7. Tweaks Panel — bottom sheet

- [x] **14.7.1** `className="twk-panel"` на корневом div. CSS из 14.2.1 превращает в bottom sheet на ≤640px.

### 14.8. Тестирование и финализация

- [x] **14.8.1** Визуальная проверка через Playwright: 375px (iPhone SE), 768px (iPad), 1024px (tablet). Dashboard, Traces, Trace Detail, Help — все breakpoints проверены.
- [x] **14.8.2** Desktop layout (1440px) не изменился — regression check OK.
- [x] **14.8.3** Typecheck clean.
- [x] **14.8.4** Card tap → navigate работает (Traces cards). Sidebar drawer: hamburger → open → nav link → close. Sort dropdown работает. Mobile tabs (code/events/coverage) переключаются.
- [x] **14.8.5** CLAUDE.md обновлён — responsive breakpoints, density modes, срез 14 завершён.
