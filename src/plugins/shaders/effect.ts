export interface Frame {
  width: number
  height: number
  scale: number
  step: number
  flow: number
  // Real seconds since the start
  time: number
  // 0..1, lightning
  flash: number
  amount: number
  wind: number
  color: [number, number, number]
  drops: boolean
  fog: boolean
  quality: number
}

export interface Effect {
  draw(frame: Frame): void
  destroy(): void
}