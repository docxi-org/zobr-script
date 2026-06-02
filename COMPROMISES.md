# Компромиссы по шагам

Фиксация технического долга, заглушек и упрощений, сделанных по ходу реализации.
Чекбокс снимается когда пункт закрыт.

---

## Общие (frontend)

- [x] ~~Шрифты через Google Fonts CDN~~ → self-hosted variable woff2 в public/fonts/ (Inter 352KB + JetBrains Mono 307KB).
- [ ] Mobile: нет tabs переключателя code/events в Trace Detail (split → tabs на узком экране).
- [x] ~~localStorage для JWT токенов~~ → httpOnly cookies (zs_token + zs_refresh). Fallback на Authorization header сохранён.

## Monaco Editor

- [ ] Monaco загружается с CDN (unpkg). Кешируется браузером, preload при логине компенсирует.
- [ ] Hex цвета в Monaco темах — ограничение Monaco API, не привязаны к CSS vars.
- [ ] Diff view — наивный LCS O(n·m). Не проблема для скриптов <200 строк.
