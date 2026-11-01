type Props = Record<string, any>

interface Fiber {
  memoizedProps?: Props | null
  return?: Fiber | null
}

const MAX_DEPTH = 40

function fiberOf(el: Element): Fiber | null {

  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))

  return key ? (el as unknown as Record<string, Fiber>)[key] : null
}

/**
 * Walks up from a DOM element to the closest React component whose props pass
 * `match`. Prop names survive minification, unlike Fenrid's class names, which
 * makes this the way to reach data and callbacks the DOM doesn't expose
 */
export function findProps(el: Element, match: (props: Props) => boolean): Props | null {

  let fiber = fiberOf(el)

  for (let depth = 0; fiber && depth < MAX_DEPTH; depth++) {

    const props = fiber.memoizedProps

    if (props && typeof props === 'object' && match(props)) return props

    fiber = fiber.return ?? null
  }

  return null
}