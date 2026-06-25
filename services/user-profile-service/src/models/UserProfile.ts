import mongoose, { Document, Schema } from 'mongoose';

export interface IUserProfile extends Document {
  userId: string;       // FK to auth-service User._id
  email: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  jobTitle?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  github?: string;
  phone?: string;
  plan: 'free' | 'pro' | 'admin';
  resumeCount: number;
  preferences: {
    defaultTemplate: string;
    emailNotifications: boolean;
    theme: 'light' | 'dark' | 'system';
  };
  createdAt: Date;
  updatedAt: Date;
}

const userProfileSchema = new Schema<IUserProfile>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true },
    fullName: { type: String, required: true, trim: true },
    avatarUrl: { type: String },
    bio: { type: String, maxlength: 500 },
    jobTitle: { type: String, maxlength: 200 },
    location: { type: String, maxlength: 200 },
    website: { type: String, maxlength: 500 },
    linkedin: { type: String, maxlength: 500 },
    github: { type: String, maxlength: 500 },
    phone: { type: String, maxlength: 50 },
    plan: { type: String, enum: ['free', 'pro', 'admin'], default: 'free' },
    resumeCount: { type: Number, default: 0 },
    preferences: {
      defaultTemplate: { type: String, default: 'modern' },
      emailNotifications: { type: Boolean, default: true },
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    },
  },
  { timestamps: true, versionKey: false }
);

export const UserProfile = mongoose.model<IUserProfile>('UserProfile', userProfileSchema);
