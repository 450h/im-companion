import type { ImcApi } from '../shared/ipc'

declare global {
  interface Window {
    imc: ImcApi
  }
}

export {}
