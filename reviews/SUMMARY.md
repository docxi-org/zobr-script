# ZS v0.2 — Review Summary

Дата: 2026-06-03. 8 блоков, 35 вопросов, 8 параллельных ревьюеров.

## Оценки по блокам

| Блок | Тема | Оценка | Critical Issues |
|------|------|--------|-----------------|
| A | Архитектура | 7/10 | validator в runtime, config.json не реализована |
| B | MCP Protocol | 6/10 | register idempotency, guide недостаточна, instructions скудны |
| C | Trust & Coverage | 6/10 | checkpoint fail=verified, coverage без веса, reporting не enforced |
| D | Script Runtime | 6/10 | conclude as-casts фикция, shape не покрывает unions/generics |
| E | Security | 4/10 | cookies без Secure, rate limits только на login, OAuth XSS |
| F | Frontend | 5/10 | ErrorBoundary key баг, router state loss, 0 тестов |
| G | Deployment | 5/10 | не-атомарный rsync, нет бэкапов, нет миграций |
| H | Компромиссы | — | 27 пропусков, 13 хаков, 21 хардкод |

## Top Priority Actions

### CRITICAL (перед production)

| # | Проблема | Блок | Effort |
|---|----------|------|--------|
| 1 | Cookies: добавить Secure flag для HTTPS | E | 30min |
| 2 | Rate limiting: расширить на /refresh, /password | E | 2h |
| 3 | OAuth login: экранировать HTML (XSS) | E | 30min |
| 4 | Max depth check в ZsService.start() | D, H | 1h |
| 5 | OAuth E2E тест (или ручная проверка) | E, H | 2h |

### HIGH (скоро после production)

| # | Проблема | Блок | Effort |
|---|----------|------|--------|
| 6 | ErrorBoundary key → убрать key для Script Detail | F | 1h |
| 7 | EXECUTOR_INSTRUCTION расширить до 7 правил | B | 1h |
| 8 | zs_register: namespace или session-based identity | B | 4h |
| 9 | Бэкапы SQLite: cron + S3/remote | G | 4h |
| 10 | Coverage: добавить final_result_trust к метрике | C | 2h |
| 11 | Empty catch blocks: добавить logging (10 мест) | H | 2h |

### MEDIUM (v0.3)

| # | Проблема | Блок |
|---|----------|------|
| 12 | callTool refactor → ToolContext | A, H |
| 13 | Guide: +5 паттернов, debugging, performance | B |
| 14 | Fence rules: commit/check, ungated-act | H |
| 15 | Per-script budgets | D |
| 16 | Shape: discriminated unions, tuples | D |
| 17 | Mobile tabs для Trace Detail | F |
| 18 | DiffEditor/Monaco adaptive height | F |
| 19 | Deploy: atomic swap / blue-green | G |
| 20 | Schema migrations versioning | G |

## Debt Inventory

- **Type bypasses:** 13 (`as never`, `as unknown`)
- **Empty catch blocks:** 10
- **Hardcoded values:** 21
- **Missing vs spec:** 27 items
- **Web tests:** 0 (228 server tests)
- **Stubs:** zs_retrieve (KB not implemented)

## Security Posture

**Не готово к открытому production без hardening.** Основные gap'ы:
- Cookies без Secure flag
- Rate limiting только на login
- OAuth HTML login page с XSS potential
- Refresh token без rotation
- Per-IP rate limiting без distributed protection

## Positive Findings

- Пакетная архитектура чистая, циклов нет
- 228 тестов зелёные, typecheck clean
- Trust-by-content модель логична
- Per-agent roles работают
- Файловая модель масштабируется
- Hot/cold lifecycle корректен при дисциплине в .srv
- Deploy pipeline работает (GitHub Actions, 27 sec)
