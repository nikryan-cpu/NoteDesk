/// <reference types="svelte" />
/// <reference types="vite/client" />
import type { ShellApi } from '@shared/ipc'

declare global {
  interface Window {
    nd: ShellApi
  }
}

export {}
