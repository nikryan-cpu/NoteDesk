# NoteDesk

*[Русская версия](README.ru.md)*

Desktop app for Gemini Notebook and Gemini, plus an Ask window that sends one prompt to Gemini,
Claude, ChatGPT, DeepSeek or Qwen. Tabs, several Google accounts, a command palette and 10
themes. Windows, macOS and Linux.

[![Latest release](https://img.shields.io/github/v/release/nikryan-cpu/NoteDesk)](https://github.com/nikryan-cpu/NoteDesk/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/nikryan-cpu/NoteDesk/ci.yml?branch=main&label=CI)](https://github.com/nikryan-cpu/NoteDesk/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/nikryan-cpu/NoteDesk)](LICENSE)

> Unofficial app, not affiliated with Google, Anthropic, OpenAI, DeepSeek or Alibaba Cloud.
> Gemini, Gemini Notebook and NotebookLM are trademarks of Google LLC; Claude, ChatGPT, DeepSeek
> and Qwen belong to their owners. You sign in on each service's own page; NoteDesk never sees
> your passwords.

| | |
|---|---|
| ![Command palette](docs/screenshots/overview.png) | ![Search](docs/screenshots/palette.png) |
| ![Themes](docs/screenshots/themes.png) | ![Sidebar layout](docs/screenshots/sidebar-dark.png) |

## Download

[Latest release](https://github.com/nikryan-cpu/NoteDesk/releases/latest):

- **Windows:** `NoteDesk-<version>-Setup.exe` installs the app with desktop and Start menu
  shortcuts and updates itself. `Portable.exe` runs without installing but doesn't update.
  The builds aren't signed, so SmartScreen asks first: **More info → Run anyway**.
- **macOS:** `.dmg`, then run `xattr -cr /Applications/NoteDesk.app` once (the build isn't
  notarized).
- **Linux:** `.AppImage` (`chmod +x` first, updates itself) or `.deb`.

## Features

- Gemini Notebook and Gemini tabs (Claude, ChatGPT, DeepSeek and Qwen can be opened as tabs
  too). Only the active tab loads on startup; background tabs fall asleep after 10 minutes and
  free their memory.
- **Ask window** (`Ctrl+Alt+Space`): one prompt to one model or to up to four side by side.
  Conversations are kept in the app, and each one continues its own chats on the services.
  Sign in to each service once in **Settings → Models** (Google sign-in works on all of them).
- Several Google accounts side by side, each with its own isolated sign-in.
- Command palette (`Ctrl+K`): open tabs, recent notebooks and chats, commands, themes.
- Prompt library (`Ctrl+P`) that pastes into the focused chat box.
- 10 themes, accent colour, tabs on top or in a sidebar; Mica/Acrylic on Windows 11.
- Tray and a global hotkey to show/hide the app (`Ctrl+Shift+Space`).
- Downloads panel, notifications, per-app proxy, focus mode (`F11`), spell check,
  `notedesk://` links, memory monitor (`Ctrl+Shift+M`), English and Russian UI.

All shortcuts: `F1` in the app.

## Can't sign in?

If Google says "This browser or app may not be secure", switch **Settings → Advanced →
Sign-in compatibility** (Chrome → Firefox → Honest) and restart. Workspace accounts can be
blocked by the admin. Still stuck: [open an issue](https://github.com/nikryan-cpu/NoteDesk/issues/new?template=sign_in.yml).

## Notes

- **Ask window.** NoteDesk types your prompt into each service's page in the background and
  reads the answer back. The services don't officially support this, so keep to normal personal
  use; when a site changes its layout, answers from it may stop working until an update.
- **Proxy.** HTTP or SOCKS5, optionally only for Google and the chat services. It doesn't
  guarantee access by itself. SOCKS5 with a login isn't supported by Chromium; use HTTP for that.
- **Memory.** A sleeping tab uses nothing. With every tab asleep NoteDesk takes about 310 MB,
  about 60 MB of it the app's own UI (measured on Linux). Google's pages take the rest; the
  memory panel shows the numbers for each tab.
- **Privacy.** No telemetry. Data stays in the local profile folder, cookies are encrypted by
  the OS. The app talks only to the services you open and to GitHub for updates.

## Building

Node 22+:

```sh
npm install
npm run dev          # run in development mode
npm test             # unit tests
npm run test:e2e     # end-to-end tests (xvfb-run on Linux)
npm run dist:win     # installers for Windows (also dist:mac, dist:linux)
```

## License

[MIT](LICENSE)
