import { Schema, model } from 'mongoose'

export type AdPlacement = 'hero' | 'catalog' | 'both'
export type AdFormat = 'wide' | 'square' | 'poster'

export interface IAd {
  title: string
  image: string
  link?: string
  active: boolean
  placement: AdPlacement
  slot: number
  format: AdFormat
  createdAt: Date
}

const adSchema = new Schema<IAd>({
  title: { type: String, required: true },
  image: { type: String, required: true },
  link: String,
  active: { type: Boolean, default: true },
  placement: { type: String, enum: ['hero', 'catalog', 'both'], default: 'hero' },
  slot: { type: Number, default: 0 },
  format: { type: String, enum: ['wide', 'square', 'poster'], default: 'wide' },
  createdAt: { type: Date, default: Date.now },
})

export default model<IAd>('Ad', adSchema)