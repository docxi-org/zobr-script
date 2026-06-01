# ZS v0.2 — TODO

---

## Срез 9 — Frontend (SPA)

Спека: `spec/ui/00-overview.md`, `spec/ui/01-wireframes.md`, `spec/ui/02-api.md`.

### 9.4. Deploy

- [x] **9.4.1** Express раздаёт `packages/web/dist/` в production (express.static в main.ts).
- [x] **9.4.2** GitHub Actions: pnpm install → build frontend → rsync → PM2 reload.
- [x] **9.4.3** workflow_dispatch input `reset_db` для разового сброса SQLite.
- [x] **9.4.4** .env шаблон с `ZS_JWT_SECRET` и `ZS_ADMIN_PASSWORD`.
- [ ] **9.4.5** Push на master + ручной запуск с reset_db=true.
