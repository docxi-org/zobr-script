# Review G — Deployment & Operations

## 26. GitHub Actions → rsync → PM2 — downtime и атомарность

**ВЫСОКИЙ РИСК: не-атомарный деплой.**

- rsync с `--delete` удаляет файлы на хосте. При обрыве — полуудалённое состояние
- Двухэтапный деплой (rsync → pnpm install + PM2 reload) = окно несовместимости
- Нет blue-green deployment, нет smoke-test до переключения трафика
- Реверт невозможен без повторного деплоя

**Рекомендации:**
- Атомарный swap (`mv old new`) вместо `--delete`
- Blue-green: запуск на другом порту → smoke test → переключение
- Graceful shutdown: `pm2 startOrReload --wait-ready`

---

## 27. SQLite WAL — concurrent access

**УМЕРЕННЫЙ РИСК: возможен при пиковой нагрузке.**

- Express (основной) + worker threads — каждый со своим connection к тому же файлу
- WAL: параллельные reads + одна write. `busy_timeout = 5000` откладывает, не устраняет
- Нет транзакций для группировки snapshot + trace в атомарную операцию
- При >50 параллельных invocations — возможны 5sec timeouts

**Рекомендация:** обернуть critical paths (snapshot save + trace save) в транзакции.

---

## 28. Бэкапы и миграции

**КРИТИЧЕСКИЙ: полностью отсутствуют.**

### Бэкапы:
- Не настроены. `--exclude='data'` в rsync = данные не синхронизируются
- При потере VPS = все traces, agents, users потеряны
- OAuth DB (`store-oauth.sqlite`) содержит password hashes — без бэкапа и без шифрования

### Миграции:
- `CREATE TABLE IF NOT EXISTS` — only-add pattern
- `ALTER TABLE ... ADD COLUMN` в try-catch — хрупко
- Нет версионирования схемы, нет миграционной системы
- Невозможно: переименовать колонку, удалить таблицу, откатить миграцию

**Рекомендация:** cron-бэкап → S3, версионированные миграции с _schema_version таблицей.

---

## 29. Шрифты в git

**Приемлемо: 645KB — небольшая цена.**

- Fonts статичны, не меняются
- Критичны для offline разработки
- Экономия <1% от node_modules
- CI проще без дополнительного fetch

**Рекомендация:** оставить как есть.

---

## Итог

| Вопрос | Severity |
|--------|----------|
| 26. Деплой | CRITICAL — не-атомарен |
| 27. WAL race | MEDIUM — транзакции нужны |
| 28. Бэкапы/миграции | CRITICAL — отсутствуют |
| 29. Шрифты | LOW — приемлемо |
