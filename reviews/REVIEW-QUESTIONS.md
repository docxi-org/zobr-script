# ZS v0.2 — System Review Questions

Дата: 2026-06-03
Ревьюер получает доступ к полному репо и отвечает по каждому блоку.

---

## A. Архитектура и разделение ответственности

1. Насколько чисто разделены пакеты (core / scaffold / validator / protocol / server / web)? Есть ли нарушения слоёв — зависимости вверх или циклические?
2. `ZsApp.callTool` — god-method с switch на ~25 cases. Какова реальная стоимость этого решения? Стоит ли рефакторить и как?
3. `http.ts` — создаёт MCP transport, Express app, auth, OAuth. Не перегружен ли? Нужно ли разделить?
4. Файловая модель скриптов (script = file, не folder) — работает ли на масштабе? Есть ли сценарии где ломается?

## B. MCP Protocol & Tools

5. 27 MCP tools — полнота: есть ли операции, которые агент не может выполнить через MCP? Есть ли лишние tools?
6. `zs_guide` — 11 топиков. Достаточно ли для самостоятельной работы архитектора? Что недостаёт?
7. `zs_register` — idempotent по имени. Два разных клиента с одним именем получают одного агента. Это проблема?
8. MCP server instructions (2 строки) + START_PREAMBLE (1 строка) — достаточно ли для ориентации агента? Или слишком скудно?

## C. Trust Model & Coverage

9. Trust по содержанию (report=asserted, checkpoint=verified, start=n/a) — корректна ли модель? Есть ли edge cases где trust назначается неправильно?
10. Coverage metric — `verified / (verified + asserted)` без учёта weight. Показательна ли метрика? Есть ли способ сделать её полезнее без чрезмерного усложнения?
11. Конвенция отчётности (agent recommended to call zs_report) — работоспособна ли в agent-driven модели? Будут ли реальные агенты это делать?

## D. Script Execution & Runtime

12. `conclude<T>(result: T)` — explicit mapping через `as` casts (pattern as string). Type-safe ли это де-факто? Какие подводные камни?
13. Hot/cold lifecycle — snapshot/restore через SQLite. Есть ли потеря данных при eviction? Worker state сериализуется полностью?
14. Shape validation (`checkShape`) — проверяет форму, не истину. Достаточно ли? Какие типы не покрываются (unions, generics, recursive)?
15. Budgets (steps, iterations) — настраиваемы ли per-script или только глобально? Достаточно ли двух метрик?

## E. Security

16. OAuth 2.1 (better-auth + MCP plugin) — оценить реализацию: типизация через `as never`/`as unknown`, inline HTML login page, seed admin. Готово ли к production?
17. JWT httpOnly cookies — правильно ли реализовано? SameSite=Lax vs Strict, Secure flag в production, cookie path scope.
18. Per-agent roles — gating в `callTool`. Агент executor видит architect tools в листинге но не может вызвать. Утечка информации?
19. Rate limiting — in-memory Map, 10 req/min на login. Достаточно ли? Что при перезапуске? Что при DDoS?
20. `store.d.ts` skip-if-exists — если злоумышленник подменит файл, scaffold не перезапишет. Вектор атаки?

## F. Frontend SPA

21. Hash router (кастомный, не TanStack) — ограничения? SEO не актуально, но deep linking, browser back, session persistence?
22. Monaco Editor self-hosted (Vite bundle) — размер билда? Lazy loading? Время первой загрузки?
23. i18n (кастомный, 0 deps) — ~180 ключей. Масштабируется ли? Что при добавлении 3-го языка?
24. Error boundary с key={route.path} — перезапускается при навигации. Теряется ли state компонентов при переключении tab в Script Detail?
25. DiffEditor (Monaco) — фиксированная высота 400px. Адаптивна ли на разных экранах?

## G. Deployment & Operations

26. GitHub Actions → rsync → PM2 reload — downtime при deploy? Atomic ли обновление? Что если rsync прервётся?
27. SQLite WAL mode — concurrent access от Express + worker threads. Есть ли конфликты записи?
28. `data/store.sqlite` + `data/store-oauth.sqlite` — backup strategy? Migration strategy при schema changes?
29. Fonts + Monaco в git (352KB + 307KB woff2) — стоит ли? Или лучше скачивать в CI?

## H. Компромиссы (стандартный блок)

По каждому компоненту системы:

30. **Что пропущено** — какие части спеки не реализованы, какие проверки не сделаны, какие случаи не покрыты?
31. **Что упрощено** — где реализация беднее чем предполагалось? Пропущены ветки логики, урезаны граничные случаи?
32. **Где срезаны углы** — заглушки вместо реализации, mock вместо реального вызова, копированный код?
33. **Где костыли** — обход типизации (`as never`, `as unknown`), подавление ошибок, нарушение слоёв?
34. **Где необоснованный хардкод** — магические числа, строки, пути, конфигурационные значения?
35. **Какие TODO и заглушки** — незаконченные ветки, pending-тесты, временные значения?

---

## Порядок работы

Ревью проводится по блокам A–H. Каждый блок — отдельный агент (или группа вопросов для одного ревьюера). Отчёты складываются в `reviews/` как `review-A-architecture.md`, `review-B-mcp.md`, и т.д. Финальная сводка — `reviews/SUMMARY.md`.
