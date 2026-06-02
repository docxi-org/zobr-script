# Review E — Security

## 16. OAuth 2.1 — production-readiness

**MEDIUM RISK. Не готово к production.**

- 4 `as never`/`as unknown` каста в oauth.ts — скрывают type incompatibility с better-auth
- HTML login page: URLSearchParams из query **без экранирования** → XSS через `redirect` параметр
- Seed admin при каждом рестарте — если ZS_ADMIN_PASSWORD не задан, admin с паролем 'admin'

**Fix:** экранировать HTML, убрать seed-on-restart (only first boot), использовать правильные типы.

---

## 17. JWT httpOnly cookies

**HIGH RISK. Отсутствует Secure flag.**

- Cookies без `Secure` — в production (HTTPS) работает, но уязвимо при HTTP fallback
- SameSite=Lax — приемлемо для API, но Strict безопаснее
- Refresh token не rotation — переиспользуется
- Нет Domain атрибута — ок для single domain, проблема при поддоменах

**Fix:** `Secure` flag conditional на NODE_ENV=production, SameSite=Strict.

---

## 18. Per-agent role information leak

**LOW RISK. Приемлемо.**

Executor видит architect tools в listing, но не может вызвать. Раскрывается только имена tools и что они "Architect only". Данные скриптов/трейсов не утекают. Это умышленный design — прозрачность ролей.

---

## 19. Rate limiting

**HIGH RISK. Незащищённые endpoints.**

- Только `/auth/login` защищён (10 req/min). Остальное открыто:
  - `/auth/refresh` — brute-force refresh tokens без лимита
  - `/auth/password` — password change без лимита
  - `/api/traces` — data exfiltration
- In-memory Map: обнуляется при restart, растёт без cleanup → OOM
- Per-IP: уязвим к distributed attack (botnet)

**Fix:** limits на refresh/password, cleanup interval, Redis для persistent store.

---

## 20. store.d.ts skip-if-exists

**MEDIUM RISK. Type poisoning при compromised system.**

- Attacker с write access подменяет store.d.ts → type checking отключается
- Нет проверки целостности (checksum, version)
- Нет backup/reset механизма

**Fix:** версионирование + checksum, validation при load, `--reset-schema` CLI flag.

---

## Итог

| Вопрос | Риск | Production-ready |
|--------|------|-----------------|
| 16. OAuth types + HTML | MEDIUM | NO |
| 17. Cookies Secure flag | HIGH | NO |
| 18. Role leak | LOW | YES |
| 19. Rate limiting | HIGH | NO |
| 20. store.d.ts | MEDIUM | CONDITIONAL |

**Заключение: ZS v0.2 не готово к открытому production без security hardening.**
