import { Schema, model } from 'mongoose'

export interface IEventPost {
  username: string
  rpgName: string
  title: string
  content: string
  image?: string
  createdAt: Date
}

const eventPostSchema = new Schema<IEventPost>({
  username: { type: String, required: true },
  rpgName: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  image: String,
  createdAt: { type: Date, default: Date.now },
})

eventPostSchema.index({ createdAt: -1 })

export default model<IEventPost>('EventPost', eventPostSchema)
