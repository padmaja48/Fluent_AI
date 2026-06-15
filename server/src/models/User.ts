import bcrypt from 'bcryptjs';
import mongoose, { Document, Model, Schema } from 'mongoose';

export type UserRole = 'candidate' | 'admin' | 'recruiter' | 'student';
export type AuthProvider = 'email' | 'google';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  role: UserRole;
  authProvider: AuthProvider;
  googleId?: string;
  isEmailVerified: boolean;
  authMetadata: {
    lastLoginAt?: Date;
    passwordChangedAt?: Date;
    failedLoginAttempts: number;
    lockUntil?: Date;
  };
  totalSessions: number;
  averageScore: number;
  streak: number;
  phone?: string;
  institution?: string;
  preferredLanguage: 'English' | 'Telugu' | 'Hindi';
  skills: {
    listening: number;
    speaking: number;
    reading: number;
    writing: number;
  };
  profileImageUrl?: string;
  comparePassword(password: string): Promise<boolean>;
}

interface UserModel extends Model<IUser> {}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, select: false },
    level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], default: 'B1' },
    role: { type: String, enum: ['candidate', 'admin', 'recruiter', 'student'], default: 'candidate' },
    authProvider: { type: String, enum: ['email', 'google'], default: 'email' },
    googleId: { type: String, index: true, sparse: true },
    isEmailVerified: { type: Boolean, default: false },
    authMetadata: {
      lastLoginAt: Date,
      passwordChangedAt: Date,
      failedLoginAttempts: { type: Number, default: 0 },
      lockUntil: Date,
    },
    totalSessions: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    phone: { type: String, trim: true, default: '' },
    institution: { type: String, trim: true, default: '' },
    preferredLanguage: { type: String, enum: ['English', 'Telugu', 'Hindi'], default: 'English' },
    skills: {
      listening: { type: Number, default: 0 },
      speaking: { type: Number, default: 0 },
      reading: { type: Number, default: 0 },
      writing: { type: Number, default: 0 },
    },
    profileImageUrl: String,
  },
  { timestamps: true },
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 12);
  this.authMetadata.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = async function comparePassword(password: string) {
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(password, this.password);
};

export const User =
  (mongoose.models.User as UserModel | undefined) ??
  mongoose.model<IUser, UserModel>('User', userSchema);
