# Компромиссы по шагам

Фиксация технического долга, заглушек и упрощений, сделанных по ходу реализации.
Чекбокс снимается когда пункт закрыт.

---

## Общие (frontend)

- [ ] Шрифты загружаются через Google Fonts CDN, не self-hosted.
- [ ] Mobile: нет tabs переключателя code/events в Trace Detail (split → tabs на узком экране).
- [ ] localStorage для JWT токенов — не httpOnly cookie. Стандартный подход для SPA без BFF.

## Monaco Editor

- [ ] Monaco загружается с CDN (unpkg). Кешируется браузером, preload при логине компенсирует.
- [ ] Hex цвета в Monaco темах — ограничение Monaco API, не привязаны к CSS vars.
- [ ] Diff view — наивный LCS O(n·m). Не проблема для скриптов <200 строк.

## REST API (backend)

- [x] /api/traces — SQL LIMIT/OFFSET + отдельный COUNT запрос.
- [x] /api/agents/:id → total_runs добавлен из countAgentInvocations.
- [x] JWT secret — warning в лог если не задан. ZS_JWT_SECRET добавлен в .env.
- [x] Seed admin — warning если не задан. ZS_ADMIN_PASSWORD добавлен в .env.
- [x] Rate limiting на /api/auth/login — 10 req/min per IP.
- [x] Тесты для API: 28 тестов (auth, CRUD, role-based access, user management).
- [x] MiniStat определён локально в agents.tsx. Используется только там — выносить не нужно.
- [x] Contract tab — shapes извлекаются через extractCogShapes/extractClassInfo на сервере.
