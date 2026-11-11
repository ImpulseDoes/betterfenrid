export interface Frame {
  width: number
  height: number
  scale: number
  step: number
  // Real seconds since the start
  time: number
  // 0..1, lightning
  flash: number
  amount: number
  fog: boolean
  quality: number
  // Cursor location in pixels
  pointer: { x: number; y: number } | null
}

export interface Effect {
  draw(frame: Frame): void
  destroy(): void
}