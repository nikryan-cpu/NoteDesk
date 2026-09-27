// Runs electron-vite with a clean environment.
// Editors built on Electron (VS Code, Cursor) export ELECTRON_RUN_AS_NODE=1 to child
// processes, which makes the Electron binary start as plain Node and exit immediately.
import { spawn } from 'node:child_process'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn('electron-vite', process.argv.slice(2), { stdio: 'inherit', env, shell: true })
child.on('exit', (code) => process.exit(code ?? 0))
