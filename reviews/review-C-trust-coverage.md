# Review C — Trust Model & Coverage

## 9. Trust by content origin — корректность модели

**Модель логична, но содержит граничные случаи с ложным trust:**

### Что работает правильно:
- report = asserted (control.ts:43) — сервер пассивно записывает данные от агента
- checkpoint = verified (control.ts:71) — сервер активно evaluates и отвечает Directive
- start/transition = n/a (instance.ts:64, 89) — инфраструктурные события исключены

### Критические граничные случаи:

1. **checkpoint с schema_mismatch маркируется verified** — `#recordFail` (control.ts:87) записывает fail-event с trust:"verified", хотя данные отвергнуты. Сервер проверил форму, но результат не прошёл. Это накапливает "верифицированные" события при множественных fails.

2. **@sandbox результат не фиксируется в трейсе как отдельное verified событие** — документация говорит "@sandbox = verified", но в trace нет явного события. Аудитор не видит "это верифицировано".

3. **retrieve из KB: trust = verified без проверки качества KB** — если KB содержит ложные данные, retrieve = verified создаёт ложный сигнал.

4. **report доставка не гарантирована** — если onReport обработчик отсутствует или падает, событие всё равно маркируется asserted. Нет различия между "доставлена" и "потеряна".

5. **ask_user (authority) — нет верификации что ответил именно user** — агент может солгать о user-ответе.

### Рекомендации:
- Разделить schema_mismatch checkpoint на отдельный trust class
- Явно фиксировать @sandbox результат как event с trust="verified"
- Различать verified_from_trusted_source и verified_form_only

---

## 10. Coverage metric — информативность

**Метрика слаба и может быть обманчива без учёта веса.**

### Проблемы:

1. **Одно verified = одно asserted** — checkpoint (critical gate) весит столько же сколько report (logging). 1 checkpoint + 99 reports = 1% verified — ложный сигнал.

2. **0/0 = 0** — скрипт без verified/asserted событий даёт 0% verified. Может означать "ничего не проверено" или "скрипт пуст".

3. **Нет учёта критичности** — метрика не маркирует trust класс conclude() как отдельный риск-сигнал.

4. **grounded_claims и asserted_claims вычисляются но не используются** — в ratio не влияют, confusing.

### Рекомендация:
Раздельный breakdown вместо единой дроби:
```
coverage: {
  verified: 40%,
  asserted: 60%,
  authority_gates: 2,
  grounded_claims: 5,
  asserted_claims: 20,
  final_result_trust: "asserted"  // trust класс conclude()
}
```

---

## 11. Reporting convention — enforceability

**Не enforceable в agent-driven модели.**

### Почему агенты будут пропускать:

1. **Рекомендация, не обязательство** — "recommended (not required)" в guide. Honor system.
2. **Нет детектирования пропуска** — сервер не знает что survey вообще была, если agent не call zs_report.
3. **Финансовый стимул против** — каждый report = MCP round-trip + tokens. Агент может оптимизировать пропуском.
4. **Нет мониторинга** — контроллер может отсутствовать, onReport не вызывается.

### Что enforceable:
- **Mandatory seams**: @sandbox, run, conclude — агент не может skip
- **Shape-based gating**: conclude shape требует verified data
- **Post-hoc analysis**: сервер анализирует trace на пропуски после conclude

### Вывод:
Полнота trace зависит от дисциплины агента. Enforcement — только через mandatory seams и shape validation.

---

## Итог

| Вопрос | Оценка |
|--------|--------|
| 9. Trust model | Логична, но 5 граничных случаев с ложным trust |
| 10. Coverage metric | Слаба без веса. Нужен раздельный breakdown |
| 11. Reporting convention | Не enforceable. Зависит от дисциплины агента |
