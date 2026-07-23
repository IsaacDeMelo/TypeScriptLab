import { Schema, model } from 'mongoose'

export interface ISession {
  token: string
  userId: string
  createdAt: Date
}

const sessionSchema = new Schema<ISession>({
  token: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 604800 },
})

export default model<ISession>('Session', sessionSchema)
