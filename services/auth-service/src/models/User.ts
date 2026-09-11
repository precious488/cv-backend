import mongoose, { Document, Schema } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
  email: string
  password: string
  fullName: string
  role: 'free' | 'pro' | 'admin'
  isEmailVerified: boolean
  refreshTokens: string[]
  passwordResetToken?: string
  passwordResetExpires?: Date
  isBlocked: boolean // ← add
  blockedAt?: Date // ← add
  blockedReason?: string
  otpEnabled: boolean
  createdAt: Date
  updatedAt: Date
  failedLoginAttempts: number
  lockedUntil?: Date
  flagged: boolean
  flagReason?: string
  flaggedAt?: Date
  registrationIp?: string
  comparePassword(candidate: string): Promise<boolean>
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    fullName: { type: String, required: true, trim: true },
    role: { type: String, enum: ['free', 'pro', 'admin'], default: 'free' },
    isEmailVerified: { type: Boolean, default: false },
    refreshTokens: { type: [String], default: [], select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    otpEnabled: { type: Boolean, default: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    flagged: { type: Boolean, default: false, index: true },
    flagReason: { type: String },
    flaggedAt: { type: Date },
    registrationIp: { type: String },
    isBlocked: { type: Boolean, default: false, index: true }, // ← add
    blockedAt: { type: Date }, // ← add
    blockedReason: { type: String, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12)
  this.password = await bcrypt.hash(this.password, rounds)
  next()
})

userSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password as string)
}

// Never expose password in JSON
userSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.password
    delete ret.refreshTokens
    delete ret.passwordResetToken
    return ret
  },
})

export const User = mongoose.model<IUser>('User', userSchema)
