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

- [ ] **9.1.1** Auth endpoints: POST /api/auth/login, POST /api/auth/refresh, GET /api/auth/me. JWT + refresh token. Таблица zs_users в SQLite.
- [ ] **9.1.2** User management (admin): GET/POST/PUT/DELETE /api/users.
- [ ] **9.1.3** GET /api/status — server info + metrics.
- [ ] **9.1.4** GET /api/traces, GET /api/traces/:id — list + detail (paginated, filtered).
- [ ] **9.1.5** GET /api/scripts, GET /api/scripts/:ref — list + source + contract.
- [ ] **9.1.6** Script write: POST /api/scripts, PUT /api/scripts/:ref, DELETE /api/scripts/:ref, POST /api/scripts/:ref/validate.
- [ ] **9.1.7** GET /api/store/collections, GET /api/store/collections/:name, GET /api/store/notes.
- [ ] **9.1.8** GET /api/agents, GET /api/agents/:id.
- [ ] **9.1.9** GET /api/invocations — active invocations.
- [ ] **9.1.10** Auth middleware: JWT validation, role check (admin/architect/executor).

### 9.2. SPA scaffold

- [ ] **9.2.1** Vite 8 + React 19 + TanStack Router + TanStack Query.
- [ ] **9.2.2** shadcn/ui + Tailwind CSS 4 init.
- [ ] **9.2.3** Layout: sidebar + header + content area. Theme toggle (dark/light).
- [ ] **9.2.4** Auth: login page, token storage, protected routes, role-based nav.

### 9.3. Страницы

- [ ] **9.3.1** Dashboard — stat cards, active invocations, recent traces.
- [ ] **9.3.2** Traces list — таблица, фильтры, coverage bars, pagination.
- [ ] **9.3.3** Trace Detail — split view (code + events), trust badges, coverage chart.
- [ ] **9.3.4** Scripts list — карточки, hasSrv badge.
- [ ] **9.3.5** Script Detail — tabs (cognitive/server/contract/runs), Monaco Editor, validate, save.
- [ ] **9.3.6** New Script — создание скрипта с шаблоном.
- [ ] **9.3.7** Store — collections browser, notes list, document JSON view.
- [ ] **9.3.8** Agents — таблица, agent detail, invocation history.
- [ ] **9.3.9** Settings — server config (read-only), user management (admin).

### 9.4. Deploy

- [ ] **9.4.1** Vite build → dist/ → nginx static на zs.docxi.org.
- [ ] **9.4.2** GitHub Actions: build frontend + rsync dist/ → VPS.
