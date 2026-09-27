import { app } from 'electron'
import { join } from 'node:path'

// Resources ship under `resources/**` and are unpacked from the asar (see asarUnpack in
// electron-builder.yml) so native APIs such as Tray/nativeImage can open them as real files.
export function resourcePath(file: string): string {
  const dir = join(__dirname, '../../resources', file)
  if (app.isPackaged) return dir.replace('app.asar', 'app.asar.unpacked')
  return dir
}
