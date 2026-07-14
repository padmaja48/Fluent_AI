import { z } from 'zod';
import { Resume } from '../models/Resume';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { analyzeResume } from '../services/ai.service';
import { uploadBuffer } from '../services/storage.service';
import { extractResumeText, resumeContentHash } from '../services/resume-parser.service';

export const resumeParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const uploadResume = asyncHandler(async (req, res) => {
  const pastedText = typeof req.body.resumeText === 'string' ? req.body.resumeText.trim() : '';

  if (!req.file && pastedText.length < 50) {
    throw new AppError('Resume file or pasted resume text is required', 400, 'RESUME_REQUIRED');
  }

  // 1. Extract full text from the file (PDF / DOCX / TXT)
  const rawText = await extractResumeText(
    req.file?.buffer ?? Buffer.from(pastedText),
    req.file?.originalname ?? 'pasted-resume.txt',
    req.file?.mimetype ?? 'text/plain',
    pastedText,
  );

  if (!rawText || rawText.length < 50) {
    throw new AppError(
      'Could not extract readable text from the resume. Please upload a PDF or DOCX with selectable text, or paste your resume text in the form.',
      400,
      'RESUME_PARSE_FAILED',
    );
  }

  // 2. Compute content hash to detect duplicate uploads
  const hash = resumeContentHash(rawText);

  // 3. If this user already uploaded the exact same resume content, return the existing record
  const existing = await Resume.findOne({ userId: req.userId, contentHash: hash });
  if (existing) {
    return res.status(200).json({ ...existing.toJSON(), _duplicate: true });
  }

  // 4. Upload original file, or store pasted resume text as a text resume artifact.
  const storedFile = req.file
    ? await uploadBuffer(req.file, 'resumes')
    : await uploadBuffer({
        buffer: Buffer.from(rawText),
        originalname: 'pasted-resume.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File, 'resumes');

  // 5. AI analysis — always run fresh on new unique resumes
  const analysis = await analyzeResume(rawText);

  // 6. Save to DB
  const resume = await Resume.create({
    userId: req.userId,
    fileUrl: storedFile.url,
    filePublicId: storedFile.publicId,
    fileName: req.file?.originalname ?? 'Pasted Resume Text',
    rawText,
    contentHash: hash,
    analysis,
  });

  return res.status(201).json(resume);
});

export const getResumeHistory = asyncHandler(async (req, res) => {
  const resumes = await Resume.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(resumes);
});

export const getResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.userId });
  if (!resume) {
    throw new AppError('Resume not found', 404, 'RESUME_NOT_FOUND');
  }
  res.json(resume);
});
