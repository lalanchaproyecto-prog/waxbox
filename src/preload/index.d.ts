import { ElectronAPI } from '@electron-toolkit/preload'
import type { MelofyleApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: MelofyleApi
  }
}
