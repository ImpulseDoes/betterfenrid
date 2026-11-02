import { createLogger } from './logger'

// Fenrid is bundled by Turbopack. Every module hands its exports to the runtime through one method that all modules
// share, which is wrapped here so a plugin can swap an export by its name. Vencord patches source code instead, but
// Fenrid's CSP forbids eval, so changing what a module exports is as far as this goes.
//
// Only calls made from other modules go through the export: a module's calls to its own functions are not affected.
// Modules export once, when they first load, so the names must be known before that: declare them with exportHook()
// at the top of the plugin file, the plugin can then patch and unpatch freely

type AnyFn = (...args: any[]) => any
type Patch<F extends AnyFn> = (original: F, ...args: Parameters<F>) => ReturnType<F>

const log = createLogger('Modules')
const patches = new Map<string, Patch<AnyFn>[]>()
const wrapped = new WeakMap<AnyFn, AnyFn>()
const found = new Set<string>()

let hooked = false

function wrap(name: string, original: AnyFn): AnyFn {

    const cached = wrapped.get(original)

    if (cached) return cached

    found.add(name)

    const fn = function (this: unknown, ...args: unknown[]) {

        const list = patches.get(name)

        if (!list?.length) return original.apply(this, args)

        const call = list.reduceRight<AnyFn>((next, patch) => (...a: unknown[]) => patch(next, ...a), (...a: unknown[]) => original.apply(this, a))

        return call(...args)
    }

    wrapped.set(original, fn)

    return fn
}

// The runtime's own export format: name, then 0 and a value, or a getter and maybe a setter
function wrapExports(list: unknown[]) {

    let i = 0

    while (i < list.length) {

        const name = list[i++]
        const tag = list[i++]

        if (typeof tag === 'number') {

            if (tag !== 0) return

            const at = i++

            if (typeof name === 'string' && patches.has(name) && typeof list[at] === 'function') list[at] = wrap(name, list[at] as AnyFn)

            continue
        }

        const getterAt = i - 1

        if (typeof list[i] === 'function') i++

        if (typeof name === 'string' && patches.has(name) && typeof tag === 'function') {

            const getter = tag as () => unknown

            list[getterAt] = () => {

                const value = getter()

                return typeof value === 'function' ? wrap(name, value as AnyFn) : value
            }
        }
    }
}

function hookContext(context: unknown) {

    const proto = context && typeof context === 'object' ? Object.getPrototypeOf(context) : null

    if (!proto || typeof proto.s !== 'function') return

    const register = proto.s

    proto.s = function (this: unknown, list: unknown, ...rest: unknown[]) {

        if (Array.isArray(list)) {

            try {

                wrapExports(list)

            } catch (error) {

                log.error('Could not patch a module', error)

            }
        }

        return register.call(this, list, ...rest)
    }

    hooked = true
}

// A chunk is [script, ...module ids and factories]. The first factory to run hands over the shared context
function wrapChunk(chunk: unknown) {

    if (hooked || !Array.isArray(chunk)) return

    for (let i = 0; i < chunk.length; i++) {

        const factory = chunk[i]

        if (typeof factory !== 'function') continue

        chunk[i] = function (this: unknown, context: unknown, ...rest: unknown[]) {

            if (!hooked) hookContext(context)

            return factory.call(this, context, ...rest)
        }
    }
}

/**
 * Runs before Fenrid's scripts. Chunks queue up in an array until the runtime loads and swaps it for an object
 */
export function installModuleHooks() {

    const global = globalThis as { TURBOPACK?: unknown }
    const existing = global.TURBOPACK

    if (existing !== undefined && !Array.isArray(existing)) {

        log.warn('Fenrid loaded before Better Fenrid, module patches are off until a reload')
        return

    }

    const watchPush = (target: { push: AnyFn }) => {

        const push = target.push

        target.push = function (this: unknown, ...chunks: unknown[]) {

            chunks.forEach(wrapChunk)

            return push.apply(this, chunks)
        }
    }

    const queue: unknown[] = existing ?? []

    queue.forEach(wrapChunk)
    watchPush(queue)

    let current: unknown = queue

    Object.defineProperty(global, 'TURBOPACK', {
        configurable: true,
        get: () => current,
        set(value) {

            current = value

            if (value && typeof value === 'object' && typeof (value as { push?: unknown }).push === 'function') watchPush(value as { push: AnyFn })

        },
    })
}

/**
 * Declares an export to patch. Call it when the plugin file loads, not in start()
 */
export function exportHook<F extends AnyFn>(name: string) {

    if (!patches.has(name)) patches.set(name, [])

    return {
        /** Whether Fenrid has exported it (yet) */
        get found() {

            return found.has(name)
        },
        patch(patch: Patch<F>): () => void {

            const list = patches.get(name)!

            list.push(patch as Patch<AnyFn>)

            return () => {

                const at = list.indexOf(patch as Patch<AnyFn>)

                if (at >= 0) list.splice(at, 1)
            }
        },
    }
}