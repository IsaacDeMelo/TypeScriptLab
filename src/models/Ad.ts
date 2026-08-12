import { Schema, model } from 'mongoose'

export type AdPlacement = 'hero' | 'catalog' | 'both'
export type AdFormat = 'wide' | 'square' | 'poster'

export interface IAdCreative {
  image: string
  placement: AdPlacement
  slot: number
  format: AdFormat
}

export interface IAd {
  title: string
  link?: string
  active: boolean
  creatives: IAdCreative[]
  createdAt: Date
}

const adCreativeSchema = new Schema<IAdCreative>({
  image: { type: String, required: true },
  placement: { type: String, enum: ['hero', 'catalog', 'both'], default: 'hero' },
  slot: { type: Number, default: 0 },
  format: { type: String, enum: ['wide', 'square', 'poster'], default: 'wide' },
}, { _id: false })

const adSchema = new Schema<IAd>({
  title: { type: String, required: true },
  link: String,
  active: { type: Boolean, default: true },
  creatives: { type: [adCreativeSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
})

export default model<IAd>('Ad', adSchema)
