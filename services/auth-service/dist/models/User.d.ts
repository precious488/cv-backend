import mongoose, { Document } from 'mongoose';
export interface IUser extends Document {
    email: string;
    password: string;
    fullName: string;
    role: 'free' | 'pro' | 'admin';
    isEmailVerified: boolean;
    refreshTokens: string[];
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    otpEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidate: string): Promise<boolean>;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
