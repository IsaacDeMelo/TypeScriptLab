import { Schema, model } from 'mongoose'

export interface IUser {
  username: string
  passwordHash: string
  role: 'user' | 'admin'
  bio?: string
  avatar?: string
  contact?: string
}

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, minlength: 3 },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  bio: String,
  avatar: String,
  contact: String,
})

export default model<IUser>('User', userSchema)
