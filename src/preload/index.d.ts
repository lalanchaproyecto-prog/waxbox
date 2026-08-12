import { ElectronAPI } from '@electron-toolkit/preload'
import type { WaxboxApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: WaxboxApi
  }
}
