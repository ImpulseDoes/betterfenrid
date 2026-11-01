import { settings } from './settings'

const PREFIX = ['%cBetter Fenrid', 'color:#fff;background:#3f56f5;padding:1px 6px;border-radius:4px']

export function createLogger(scope?: string) {

  const tag = scope ? [...PREFIX, `[${scope}]`] : PREFIX

  return {
    info: (...args: unknown[]) => console.log(...tag, ...args),
    warn: (...args: unknown[]) => console.warn(...tag, ...args),
    error: (...args: unknown[]) => console.error(...tag, ...args),
    debug: (...args: unknown[]) => {
      if (settings.get().core.debug) console.debug(...tag, ...args)
    },
  }
}

export type Logger = ReturnType<typeof createLogger>