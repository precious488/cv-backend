import mongoose, { Document, Schema } from 'mongoose';

// Sub-schemas mirror the frontend ResumeData type exactly
const PersonalInfoSchema = new Schema(
  {
    fullName: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    location: { type: String, default: '' },
    title: { type: String, default: '' },
    website: { type: String, default: '' },
    linkedin: { type: String, default: '' },
  },
  { _id: false }
);

const ExperienceSchema = new Schema(
  {
    id: { type: String, required: true },
    company: { type: String, default: '' },
    position: { type: String, default: '' },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    current: { type: Boolean, default: false },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const EducationSchema = new Schema(
  {
    id: { type: String, required: true },
    school: { type: String, default: '' },
    degree: { type: String, default: '' },
    field: { type: String, default: '' },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const ProjectSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    technologies: { type: String, default: '' },
    link: { type: String, default: '' },
  },
  { _id: false }
);

const CertificationSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, default: '' },
    issuer: { type: String, default: '' },
    date: { type: String, default: '' },
  },
  { _id: false }
);

export interface IResume extends Document {
  userId: string;
  title: string;
  personalInfo: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    title: string;
    website: string;
    linkedin: string;
  };
  summary: string;
  experience: Array<{
    id: string;
    company: string;
    position: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string;
  }>;
  education: Array<{
    id: string;
    school: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  skills: string[];
  projects: Array<{
    id: string;
    name: string;
    description: string;
    technologies: string;
    link: string;
  }>;
  certifications: Array<{
    id: string;
    name: string;
    issuer: string;
    date: string;
  }>;
  languages: string[];
  template: 'modern' | 'classic' | 'minimal' | 'corporate';
  createdAt: Date;
  updatedAt: Date;
}

const resumeSchema = new Schema<IResume>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, default: 'Untitled Resume', trim: true, maxlength: 200 },
    personalInfo: { type: PersonalInfoSchema, default: () => ({}) },
    summary: { type: String, default: '', maxlength: 2000 },
    experience: { type: [ExperienceSchema], default: [] },
    education: { type: [EducationSchema], default: [] },
    skills: { type: [String], default: [] },
    projects: { type: [ProjectSchema], default: [] },
    certifications: { type: [CertificationSchema], default: [] },
    languages: { type: [String], default: [] },
    template: {
      type: String,
      enum: ['modern', 'classic', 'minimal', 'corporate'],
      default: 'modern',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index for user's resumes sorted by updatedAt
resumeSchema.index({ userId: 1, updatedAt: -1 });

export const Resume = mongoose.model<IResume>('Resume', resumeSchema);
