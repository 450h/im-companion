import { describe, expect, it } from 'vitest'
import { isTrustedFrame, isTrustedUrl } from './sender'

describe('IPC sender / navigation trust (QA B11)', () => {
  it('accepts only app://imc in production', () => {
    expect(isTrustedUrl('app://imc/index.html')).toBe(true)
    for (const bad of ['app://other/index.html', 'app://imcX/', 'data:text/html,hi', 'file:///C:/x.html', 'about:blank', 'https://evil.example', 'nonsense']) {
      expect(isTrustedUrl(bad), bad).toBe(false)
    }
  })

  it('accepts only the exact dev-server origin in dev', () => {
    const dev = 'http://localhost:5173'
    expect(isTrustedUrl('http://localhost:5173/', dev)).toBe(true)
    expect(isTrustedUrl('http://localhost:5174/', dev)).toBe(false)
    expect(isTrustedUrl('app://imc/index.html', dev)).toBe(false)
  })

  it('rejects null frames and subframes', () => {
    expect(isTrustedFrame(null)).toBe(false)
    expect(isTrustedFrame(undefined)).toBe(false)
    expect(isTrustedFrame({ url: 'app://imc/index.html', parent: {} })).toBe(false)
    expect(isTrustedFrame({ url: 'app://imc/index.html', parent: null })).toBe(true)
  })
})
