// Replace services/user-profile-service/src/models/Feedback.ts ENTIRELY
import mongoose, { Document, Schema } from 'mongoose'

export interface IFeedback extends Document {
  userId: string
  name: string
  location: string
  jobTitle: string
  message: string
  rating?: number
  photoUrl?: string // base64 data URL e.g. "data:image/jpeg;base64,..."
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

const feedbackSchema = new Schema<IFeedback>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    location: { type: String, trim: true, maxlength: 100 },
    jobTitle: { type: String, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    rating: { type: Number, min: 1, max: 5 },
    photoUrl: { type: String, maxlength: 2_000_000 }, // ~1.5MB base64 ceiling
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
)

export const Feedback = mongoose.model<IFeedback>('Feedback', feedbackSchema)
