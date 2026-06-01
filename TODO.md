# ZS v0.2 — TODO

## Выполнено

- **Срезы 1–6** — ядро, валидатор, протокол, Express + MCP SDK, scaffold
- **Срез 7** — class-based srv, SQLite storage, agent registration, store tools, shape validation, ambient generation, trace persistence
- **Срез 8** — hot/cold lifecycle, TTL/LRU eviction, full snapshot/restore (Instance + worker state + Set/Map), zs_abort, register response с active_invocations
- **Deployment** — GitHub Actions CI/CD, VPS (zs.docxi.org), SSL, PM2, architect mode

---

## Срез 9 — Frontend (SPA)

Спека: `spec/ui/00-overview.md`, `spec/ui/01-wireframes.md`, `spec/ui/02-api.md`.

### 9.1. REST API для фронтенда

- [x] **9.1.1** Auth endpoints: POST /api/auth/login, POST /api/auth/refresh, GET /api/auth/me. JWT + refresh token. Таблица zs_users в SQLite.
- [x] **9.1.2** User management (admin): GET/POST/PUT/DELETE /api/users.
- [x] **9.1.3** GET /api/status — server info + metrics.
- [x] **9.1.4** GET /api/traces, GET /api/traces/:id — list + detail (paginated, filtered).
- [x] **9.1.5** GET /api/scripts, GET /api/scripts/:ref — list + source + contract.
- [x] **9.1.6** Script write: POST /api/scripts, PUT /api/scripts/:ref, DELETE /api/scripts/:ref, POST /api/scripts/:ref/validate.
- [x] **9.1.6a** Monaco Editor: подключение в Script Detail/New Script, кастомная тема под дизайн-токены, autocomplete для ZS-примитивов, inline validation через API.
- [x] **9.1.7** GET /api/store/collections, GET /api/store/collections/:name, GET /api/store/notes.
- [x] **9.1.8** GET /api/agents, GET /api/agents/:id.
- [x] **9.1.9** GET /api/invocations — active invocations.
- [x] **9.1.10** Auth middleware: JWT validation, role check (admin/architect/executor).

### 9.2. SPA scaffold

- [x] **9.2.1** Vite 8 + React 19 + TanStack Router + TanStack Query.
- [x] **9.2.2** shadcn/ui + Tailwind CSS 4 init.
- [x] **9.2.3** Layout: sidebar + header + content area. Theme toggle (dark/light).
- [x] **9.2.4** Auth: login page, token storage, protected routes, role-based nav.

### 9.3. Страницы

- [x] **9.3.1** Dashboard — stat cards, active invocations, recent traces.
- [x] **9.3.2** Traces list — таблица, фильтры, coverage bars, pagination.
- [x] **9.3.3** Trace Detail — split view (code + events), trust badges, coverage chart.
- [x] **9.3.4** Scripts list — карточки, hasSrv badge.
- [x] **9.3.5** Script Detail — tabs (cognitive/server/contract/runs), Monaco Editor, validate, save.
- [x] **9.3.6** New Script — создание скрипта с шаблоном.
- [x] **9.3.7** Store — collections browser, notes list, document JSON view.
- [x] **9.3.8** Agents — таблица, agent detail, invocation history.
- [x] **9.3.9** Settings — server config (read-only), user management (admin).

### 9.5. Подключение фронтенда к API (убрать моки)

- [x] **9.5.1** API client: fetch wrapper с JWT token (из localStorage), auto-refresh при 401, base URL через Vite proxy.
- [x] **9.5.2** Auth: Login → POST /api/auth/login, сохранение token/refreshToken, GET /api/auth/me при загрузке, refresh flow.
- [x] **9.5.3** Dashboard: GET /api/status + GET /api/invocations + GET /api/traces (recent). Заменить mock imports.
- [x] **9.5.4** Traces: GET /api/traces (paginated, filtered) + GET /api/traces/:id. Убрать mock.ts/mock-traces.ts.
- [x] **9.5.5** Scripts: GET /api/scripts + GET /api/scripts/:ref. Validate → POST /api/scripts/:ref/validate. Save → PUT. Create → POST. Delete → DELETE. Убрать mock-scripts.ts.
- [x] **9.5.6** Store: GET /api/store/collections + GET /api/store/collections/:name + GET /api/store/notes. Убрать mock-store.ts.
- [x] **9.5.7** Agents: GET /api/agents + GET /api/agents/:id. Убрать mock agents из mock.ts.
- [x] **9.5.8** Settings: GET /api/status (config). Users: GET/POST/PUT/DELETE /api/users.
- [x] **9.5.9** Loading/error states: useApi hook с loading/error, страницы показывают loading.
- [x] **9.5.10** Mock-файлы удалены (mock.ts, mock-traces.ts, mock-scripts.ts, mock-store.ts).

### 9.6. Вложенная структура библиотеки (script_ref с `/`)

- [x] **9.6.1** list() — рекурсивный readdir, script_ref = относительный путь от корня библиотеки.
- [x] **9.6.2** Express routes — wildcard для `/api/scripts/*` (GET, PUT, DELETE, validate).
- [x] **9.6.3** Frontend router — wildcard match для `/scripts/*`.
- [x] **9.6.4** MCP tools — zod-схемы: `z.string()`, слэши допустимы. Без изменений.
- [x] **9.6.5** Frontend Scripts page — плоский список с полным path (работает).
- [x] **9.6.6** UI для древовидной структуры скриптов — TreeView, ScriptCrumb, folder picker в New Script.

### 9.7. Файловая модель скриптов (скрипт = файл, не папка)

Скрипт — это файл `name.cog.ts` (+ опционально `name.srv.ts`), не папка.
`script_ref` = путь от корня библиотеки до base name без расширения.
Папки — только группировка, любое количество скриптов в любой папке, любая вложенность.

- [x] **9.7.1** `reader.ts` — резолвить `script_ref` в `${ref}.cog.ts` + `${ref}.srv.ts`.
- [x] **9.7.2** `list()` — рекурсивный поиск `*.cog.ts` файлов, script_ref = path без расширения.
- [x] **9.7.3** `createScript()` — писать `${ref}.cog.ts` + `${ref}.srv.ts`, mkdir промежуточных папок.
- [x] **9.7.4** `deleteScript()` — удалять файлы `${ref}.cog.ts` + `${ref}.srv.ts`.
- [x] **9.7.5** `apiGetScriptDetail()` — адаптируется автоматически через reader.
- [x] **9.7.6** `scaffold.ts` — без изменений, scaffold в корне, не конфликтует.
- [x] **9.7.7** Миграция: скрипты в `zs-lib/examples/`, обёрточные папки удалены.
- [x] **9.7.8** БД чистая (data/ в gitignore, пересоздаётся при старте).
- [x] **9.7.9** Тесты обновлены под файловую модель. 221 тест зелёный.
- [ ] **9.7.10** Обновить CLAUDE.md — описание файловой модели.

### 9.4. Deploy

- [ ] **9.4.1** Vite build → dist/ → nginx static на zs.docxi.org.
- [ ] **9.4.2** GitHub Actions: build frontend + rsync dist/ → VPS.
