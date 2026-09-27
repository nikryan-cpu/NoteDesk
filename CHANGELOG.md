# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-09-27

### Added
- Tabs for Gemini Notebook and Gemini, with session restore on launch (only the active
  tab loads right away) and background tabs that sleep automatically to keep memory use
  low.
- Support for multiple Google accounts side by side, each with an isolated sign-in and
  colour-coded tabs.
- Command palette (`Ctrl+K`) covering open tabs, recently opened notebooks and chats,
  commands and themes.
- Prompt library (`Ctrl+P`) for reusable prompts inserted directly into the focused chat
  box, with a handful of built-in starter prompts.
- 10 themes (Minimal, Mica, Material You, Liquid Glass, Aurora, Nord, Catppuccin, AMOLED,
  Neo-Brutal, Paper) with custom accent colour, density and tab layout (top or sidebar).
- Native Mica/Acrylic window material on Windows 11 and vibrancy on macOS for the themes
  that use them.
- System tray with quick actions, global hotkeys, and a Quick Ask floating window for
  one-off questions.
- Native downloads panel with pause/resume/cancel, plus desktop notifications for
  finished downloads and an experimental "Studio output ready" notification.
- Per-app proxy support (HTTP or SOCKS5) with an optional "Google only" routing mode.
- Focus mode, find in page, per-site zoom, and spell checking in Russian and English.
- `notedesk://` deep links for opening notebooks, chats and Quick Ask from outside the
  app.
- Sign-in compatibility modes (Chrome / Firefox / Honest) for when Google doesn't
  recognize the embedded browser.
- Memory monitor showing a breakdown of what's using memory, with one-click sleep.
- Automatic updates from GitHub Releases on Windows and the Linux AppImage.
- English and Russian interface, auto-detected from the system locale.

[1.0.0]: https://github.com/nikryan-cpu/NoteDesk/releases/tag/v1.0.0
