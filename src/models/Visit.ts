import { Schema, model } from 'mongoose'

export type VisitType = 'pageview' | 'rpgview' | 'search'

export interface IVisit {
  type: VisitType
  rpg?: string
  query?: string
  createdAt: Date
}

const visitSchema = new Schema<IVisit>({
  type: {
    type: String,
    enum: ['pageview', 'rpgview', 'search'],
    required: true,
  },
  rpg: String,
  query: String,
  createdAt: { type: Date, default: Date.now },
})

visitSchema.index({ type: 1, createdAt: -1 })
visitSchema.index({ createdAt: 1 })

export default model<IVisit>('Visit', visitSchema)
