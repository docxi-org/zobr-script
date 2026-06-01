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
