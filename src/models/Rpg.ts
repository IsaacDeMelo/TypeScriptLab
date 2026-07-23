import { Schema, model } from 'mongoose'

export interface IRpg {
  name: string
  owner: string
  genre: string
  image: string
  banner: string
  description: string
  link?: string
  whatsapp?: string
  year?: string
  ageRating: string
  featured?: boolean
  tags?: { name: string; weight: number }[]
}

const tagSchema = new Schema({ name: String, weight: Number }, { _id: false })

const rpgSchema = new Schema<IRpg>({
  name: { type: String, required: true, unique: true },
  owner: { type: String, required: true },
  genre: { type: String, required: true },
  image: { type: String, required: true },
  banner: { type: String, default: '' },
  description: { type: String, required: true },
  link: String,
  whatsapp: String,
  year: String,
  ageRating: { type: String, required: true },
  featured: { type: Boolean, default: false },
  tags: { type: [tagSchema], default: [] },
})

export default model<IRpg>('Rpg', rpgSchema)
