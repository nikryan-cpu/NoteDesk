# NoteDesk

*Читать по-русски: [README.ru.md](README.ru.md)*

A desktop app for Gemini Notebook and Gemini, so you're not living in a browser tab.

[![Latest release](https://img.shields.io/github/v/release/nikryan-cpu/NoteDesk)](https://github.com/nikryan-cpu/NoteDesk/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/nikryan-cpu/NoteDesk/ci.yml?branch=main&label=CI)](https://github.com/nikryan-cpu/NoteDesk/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/nikryan-cpu/NoteDesk)](LICENSE)

> **Unofficial project.** NoteDesk is not affiliated with, endorsed by, or sponsored by
> Google LLC. "Gemini", "Gemini Notebook" and "NotebookLM" are trademarks of Google LLC.
> You sign in on Google's own sign-in page, inside the app — NoteDesk never sees your
> password.

## Screenshots

| | |
|---|---|
| ![Overview](docs/screenshots/overview.png)<br>Overview | ![Command palette](docs/screenshots/palette.png)<br>Command palette |
| ![Themes](docs/screenshots/themes.png)<br>Themes | ![Sidebar layout, dark](docs/screenshots/sidebar-dark.png)<br>Sidebar layout, dark |

## Features

### Tabs and accounts
- Tabs for both Gemini Notebook and Gemini, in one window.
- On startup only the tab you had active actually loads; the rest wake up the moment you
  click them.
- Background tabs go to sleep on their own — by default after 10 minutes of being idle —
  and free their memory completely. At most 4 background tabs stay awake at once, and a
  tab playing audio never sleeps. Waking a sleeping tab just reloads it.
- While NoteDesk is hidden in the tray, every tab can go to sleep after a set time (30
  minutes by default), so the app sits close to zero memory when you're not using it.
- Several Google accounts side by side. Each one gets its own isolated sign-in (separate
  cookies, cache and storage), and its tabs are colour-coded so you can tell them apart at
  a glance.

### Command palette and prompts
- `Ctrl+K` opens a command palette: open tabs, recently opened notebooks and chats,
  commands, and themes, all in one search box. The recent list comes from NoteDesk's own
  navigation history — nothing is scraped off Google's pages.
- `Ctrl+P` opens a prompt library: short reusable prompts you can drop straight into
  whichever chat box currently has focus. Comes with a handful of starter prompts
  (summarize, explain simply, glossary, critique, study plan) and you can add your own.

### Appearance
- 10 themes: Minimal, Mica, Material You, Liquid Glass, Aurora, Nord, Catppuccin, AMOLED,
  Neo-Brutal and Paper — each with its own light and dark palette (AMOLED is dark-only).
- Custom accent colour, compact or comfortable density, and tabs on top or in a sidebar.
- On Windows 11 the Mica and Liquid Glass themes use the real Mica/Acrylic window
  material; on macOS they use native vibrancy. Everywhere else they fall back to their own
  background colours.
- Optional floating content card (a small gap and rounded corners around the page) and a
  reduce-motion toggle.

### Tray, hotkeys and Quick Ask
- Lives in the system tray; closing the window keeps it running in the background if you
  want it to.
- Global hotkeys, configurable, work from any app: `Ctrl+Shift+Space` shows or hides
  NoteDesk, `Ctrl+Alt+Space` opens **Quick Ask** — a small always-on-top window for a
  one-off question without switching to the main window. It can be pinned on top and
  closes itself (freeing its memory) a few minutes after you last used it.

### Downloads and notifications
- A native downloads panel (`Ctrl+J`): pause, resume, cancel, open, or show a file in its
  folder, with a notification when a download finishes in the background.
- Experimental notification for "Studio output ready" — Audio and Video Overviews and
  other Studio items that finish generating while NoteDesk isn't in the foreground.

### Network
- Per-app proxy: system settings, no proxy, or a custom HTTP/SOCKS5 proxy — independent
  of your system-wide network settings.
- Optional "Google only" mode that routes just Google's own domains (and close relatives
  like YouTube, used during sign-in) through the proxy, leaving everything else direct.

### Browsing and window
- Focus mode (`F11`) hides everything but the page.
- Find in page, per-site zoom, and spell checking (Russian and English, configurable).
- `notedesk://` links so other apps or scripts can jump straight into NoteDesk:
  `notedesk://open?url=…` opens a specific Google URL, `notedesk://new/gemini` (or
  `/notebook`) opens a new tab, `notedesk://quick` opens Quick Ask.
- An offline indicator, and a memory monitor that breaks down what's actually using
  memory and lets you put tabs to sleep on the spot.

### Sign-in and updates
- A sign-in compatibility setting for when Google's page doesn't recognize the app (see
  below).
- Updates itself from GitHub Releases on Windows and the Linux AppImage; see
  [Install notes](#install-notes) for macOS and `.deb`.
- English and Russian interface, auto-detected from your system language.

## Keyboard shortcuts

On macOS, use `Cmd` wherever this says `Ctrl`.

| Action | Shortcut |
|---|---|
| Command palette | `Ctrl+K` |
| Insert a prompt | `Ctrl+P` |
| New tab | `Ctrl+T` |
| New Gemini tab | `Ctrl+Shift+G` |
| Close tab | `Ctrl+W` |
| Reopen closed tab | `Ctrl+Shift+T` |
| Next / previous tab | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Go to tab 1–9 | `Ctrl+1` … `Ctrl+9` |
| Find in page | `Ctrl+F` or `F3` |
| Zoom in / out / reset | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` |
| Reload | `Ctrl+R` or `F5` |
| Back / forward | `Alt+←` / `Alt+→` |
| Focus mode | `F11` |
| Toggle sidebar | `Ctrl+B` |
| Settings | `Ctrl+,` |
| Downloads | `Ctrl+J` |
| Memory monitor | `Ctrl+Shift+M` |
| This cheat sheet | `Ctrl+/` or `F1` |

Global hotkeys (work even when NoteDesk isn't focused, and can be changed in Settings):

| Action | Default |
|---|---|
| Show / hide NoteDesk | `Ctrl+Shift+Space` |
| Quick Ask | `Ctrl+Alt+Space` |

## Download

Get the latest build from the [Releases page](https://github.com/nikryan-cpu/NoteDesk/releases/latest).

| Platform | File |
|---|---|
| Windows — installer | `NoteDesk-<version>-Setup.exe` |
| Windows — portable | `NoteDesk-<version>-Portable.exe` |
| macOS — universal | `NoteDesk-<version>-universal.dmg` |
| Linux — AppImage | `NoteDesk-<version>-x86_64.AppImage` |
| Linux — Debian/Ubuntu | `notedesk_<version>_amd64.deb` |

### Install notes

**Windows.** Builds aren't code-signed, so SmartScreen will warn you the first time you
run the installer. Click **More info → Run anyway**.

**macOS.** Builds aren't notarized either. After copying NoteDesk to Applications, run:

```sh
xattr -cr /Applications/NoteDesk.app
```

This strips the quarantine flag macOS attaches to anything downloaded from outside the
App Store; without it, Gatekeeper refuses to open an app that isn't notarized. You only
need to do this once per install.

**Linux — AppImage.** Make it executable first:

```sh
chmod +x NoteDesk-*.AppImage
```

**Self-updating.** Windows installs and the Linux AppImage update themselves in the
background. The macOS build and the `.deb` package can't self-update (no code signing on
macOS, and `.deb` is meant to be managed by your package manager) — NoteDesk instead
shows a link to the new release when one is available.

## Can't sign in to Google?

Google sometimes refuses to let you sign in from an "embedded browser" it doesn't
recognize, showing something like *"This browser or app may not be secure"*. NoteDesk
tries to avoid this by presenting itself consistently as desktop Chrome — matching the
user-agent string, browser hint headers and JavaScript-visible browser info to the actual
Chromium version it runs on — but Google's detection changes over time and occasionally
still trips on it.

If sign-in fails:

1. Go to **Settings → Advanced → Sign-in compatibility** and try the modes in order:
   **Chrome** (default) → **Firefox** → **Honest**. Restart NoteDesk after each change.
2. Wait a minute before retrying — Google sometimes rate-limits repeated sign-in
   attempts.
3. If it's a **Workspace** account, your organization's admin may be restricting
   sign-in from apps like this one; there's nothing NoteDesk can do about that.
4. Still stuck? [Open an issue](https://github.com/nikryan-cpu/NoteDesk/issues/new?template=sign_in.yml)
   with the sign-in template — it asks for the details that actually help track this
   down.

## Proxy

NoteDesk can route its traffic through a proxy you already run, independent of your
system's network settings — useful for a local proxy client listening on
`127.0.0.1`, for example. A few things worth knowing:

- A proxy doesn't bypass anything by itself, and using one doesn't guarantee access to
  Google's services — that's between you and Google.
- Chromium (which NoteDesk is built on) doesn't support a username and password on a
  SOCKS5 proxy. If your proxy needs authentication, use an HTTP proxy instead.
- "Google only" mode sends just Google's own domains through the proxy and connects to
  everything else — update checks, external links — directly.

## Memory

Most of the memory NoteDesk uses belongs to the Google web app running in each awake
tab, not to NoteDesk itself. A sleeping tab uses none of it.

What I measured for NoteDesk 1.0.0 on Linux (Xvfb with software rendering, which makes
the GPU process bigger than on real hardware), as proportional set size so shared memory
is counted once:

| | Memory |
|---|---|
| Whole app, window open, every tab asleep | about 310 MB |
| …of which the app's own interface | about 60 MB |
| An awake tab with an empty page | about 40 MB more |

Gemini Notebook and Gemini pages take a lot more than an empty page, and how much depends
on the notebook or chat. The memory panel (`Ctrl+Shift+M`) shows the live numbers for
each tab on your machine; on Windows it reports private memory, so the figures there
won't match the table above exactly.

## Privacy

- No telemetry, no analytics, nothing phoning home about how you use the app.
- Your data stays on your machine, in NoteDesk's local profile folder. Cookies are
  encrypted with a key kept by the OS (DPAPI on Windows, Keychain on macOS, the secret
  service on Linux), and so is the proxy password if you set one.
- The app only talks to Google — the pages you actually open — and to GitHub, to check
  for new releases.

## Building from source

Requires Node 22 or newer (24 recommended).

```sh
npm install
npm run dev          # start the app in development mode
npm run typecheck    # TypeScript + Svelte type checking
npm test             # unit tests (vitest)
npm run test:e2e     # end-to-end tests (Playwright; on Linux run it under xvfb-run)
npm run dist:win     # package for Windows
npm run dist:mac     # package for macOS
npm run dist:linux   # package for Linux
npm run icons        # regenerate app icons from the SVG sources
```

If you launch `npm run dev` from inside VS Code (or another Electron-based editor),
`scripts/run.mjs` strips the `ELECTRON_RUN_AS_NODE` environment variable those editors
set for their own child processes — without it, Electron would start as plain Node and
exit immediately instead of opening a window.

## Planned

These depend on how stable Google keeps the relevant page layouts, and may ship behind a
flag first:

- Split view (two tabs side by side)
- Export a chat to Markdown
- WAV → MP3 conversion for downloaded Audio Overviews
- "Send to NoteDesk" in the Windows Explorer context menu
- Bulk URL import
- Folders for organizing tabs

## License

[MIT](LICENSE)
