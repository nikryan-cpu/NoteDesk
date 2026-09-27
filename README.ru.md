# NoteDesk

*[English version](README.md)*

Приложение для Gemini Notebook и Gemini на компьютере: вкладки, несколько Google-аккаунтов,
палитра команд и 10 тем. Windows, macOS и Linux.

[![Latest release](https://img.shields.io/github/v/release/nikryan-cpu/NoteDesk)](https://github.com/nikryan-cpu/NoteDesk/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/nikryan-cpu/NoteDesk/ci.yml?branch=main&label=CI)](https://github.com/nikryan-cpu/NoteDesk/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/nikryan-cpu/NoteDesk)](LICENSE)

> Неофициальное приложение, не связано с Google. Gemini, Gemini Notebook и NotebookLM —
> товарные знаки Google LLC. Вход происходит на странице Google, пароль NoteDesk не видит.

| | |
|---|---|
| ![Палитра команд](docs/screenshots/overview.png) | ![Поиск](docs/screenshots/palette.png) |
| ![Темы](docs/screenshots/themes.png) | ![Боковая панель](docs/screenshots/sidebar-dark.png) |

## Скачать

[Последний релиз](https://github.com/nikryan-cpu/NoteDesk/releases/latest):

- **Windows:** `NoteDesk-<версия>-Setup.exe` — установщик, создаёт ярлыки на рабочем столе и
  в «Пуске» и обновляется сам. `Portable.exe` работает без установки, но не обновляется.
  Сборки не подписаны, поэтому SmartScreen спросит: **Подробнее → Выполнить в любом случае**.
- **macOS:** `.dmg`, затем один раз `xattr -cr /Applications/NoteDesk.app` (сборка не
  нотаризована).
- **Linux:** `.AppImage` (сначала `chmod +x`, обновляется сам) или `.deb`.

## Возможности

- Вкладки Gemini Notebook и Gemini. При запуске грузится только активная, фоновые засыпают
  через 10 минут и освобождают память.
- Несколько Google-аккаунтов одновременно, у каждого свой изолированный вход.
- Палитра команд (`Ctrl+K`): открытые вкладки, недавние ноутбуки и чаты, команды, темы.
- Библиотека промптов (`Ctrl+P`) — вставляет текст в поле чата.
- 10 тем, акцентный цвет, вкладки сверху или сбоку; Mica/Acrylic на Windows 11.
- Трей и глобальные хоткеи (`Ctrl+Shift+Space` — показать/скрыть, `Ctrl+Alt+Space` — окно
  Quick Ask).
- Загрузки, уведомления, свой прокси, режим фокуса (`F11`), проверка орфографии, ссылки
  `notedesk://`, монитор памяти (`Ctrl+Shift+M`), интерфейс на русском и английском.

Все горячие клавиши — `F1` в приложении.

## Не получается войти?

Если Google пишет «Этот браузер или приложение могут быть небезопасными», переключите **Настройки →
Дополнительно → Совместимость входа** (Chrome → Firefox → Честный) и перезапустите. Аккаунты
Workspace может блокировать администратор. Не помогло — [создайте issue](https://github.com/nikryan-cpu/NoteDesk/issues/new?template=sign_in.yml).

## Заметки

- **Прокси.** HTTP или SOCKS5, можно только для доменов Google. Сам по себе доступ к Google
  не гарантирует. SOCKS5 с логином Chromium не поддерживает — для авторизации нужен HTTP.
- **Память.** Спящая вкладка не занимает ничего. Когда все вкладки спят, NoteDesk занимает
  около 310 МБ, из них около 60 МБ — сам интерфейс (замер на Linux). Остальное — страницы
  Google; точные цифры по вкладкам показывает панель памяти.
- **Приватность.** Никакой телеметрии. Данные хранятся в локальной папке профиля, куки
  шифрует ОС. Приложение обращается только к Google и к GitHub за обновлениями.

## Сборка

Node 22+:

```sh
npm install
npm run dev          # запуск в режиме разработки
npm test             # юнит-тесты
npm run test:e2e     # e2e-тесты (на Linux через xvfb-run)
npm run dist:win     # установщики для Windows (есть и dist:mac, dist:linux)
```

## Лицензия

[MIT](LICENSE)
