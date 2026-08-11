import { Schema, model } from 'mongoose'

export interface IReviewReply {
  reviewId: string
  username: string
  content: string
  createdAt: Date
}

const reviewReplySchema = new Schema<IReviewReply>({
  reviewId: { type: String, required: true },
  username: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
})

reviewReplySchema.index({ reviewId: 1, createdAt: 1 })

export default model<IReviewReply>('ReviewReply', reviewReplySchema)
