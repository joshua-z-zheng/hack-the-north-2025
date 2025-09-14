export interface Market {
  threshold: number
  probability: number
  shares?: number
}
export interface Course {
  code: string
  odds: Market[]
}