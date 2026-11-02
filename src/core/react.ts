type Props = Record<string, any>

export interface Fiber {
  key?: string | null
  memoizedProps?: Props | null
  memoizedState?: any
  return?: Fiber | null
}

export interface StateHook {
  value: unknown
  set: (value: unknown) => void
}

const MAX_DEPTH = 40

export function fiberOf(el: Element): Fiber | null {

  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))

  return key ? (el as unknown as Record<string, Fiber>)[key] : null
}

/**
 * Walks up from a DOM element (itself included) to the closest fiber that passes `match`
 */
export function findFiber(el: Element, match: (fiber: Fiber) => boolean): Fiber | null {

  let fiber = fiberOf(el)

  for (let depth = 0; fiber && depth < MAX_DEPTH; depth++) {

    if (match(fiber)) return fiber

    fiber = fiber.return ?? null
  }

  return null
}

/**
 * Walks up from a DOM element to the closest React component whose props pass
 * `match`. Prop names survive minification, unlike Fenrid's class names, which
 * makes this the way to reach data and callbacks the DOM doesn't expose
 */
export function findProps(el: Element, match: (props: Props) => boolean): Props | null {

  const fiber = findFiber(el, (f) => !!f.memoizedProps && typeof f.memoizedProps === 'object' && match(f.memoizedProps))

  return fiber?.memoizedProps ?? null
}

/**
 * The useState values of a function component, in the order it calls them. The
 * DOM can point at an older copy of the fiber, so the value comes from the
 * hook's queue, which both copies share
 */
export function stateHooks(fiber: Fiber): StateHook[] {

  const hooks: StateHook[] = []

  for (let hook = fiber.memoizedState; hook && typeof hook === 'object' && 'next' in hook; hook = hook.next) {

    const queue = hook.queue

    if (typeof queue?.dispatch !== 'function') continue

    hooks.push({ value: 'lastRenderedState' in queue ? queue.lastRenderedState : hook.memoizedState, set: queue.dispatch })
  }

  return hooks
}