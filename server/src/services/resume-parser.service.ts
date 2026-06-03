/**
 * Resume Parser Service
 *
 * Extracts raw text from uploaded resume files (PDF, DOCX, DOC, TXT).
 * Also computes a content hash so duplicate uploads of the same resume
 * can reuse the existing analysis instead of re-running AI.
 */

import crypto from 'crypto';

/* ── PDF ─────────────────────────────────────────────────────────── */
async function extractPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
  const result = await pdfParse(buffer);
  return result.text ?? '';
}

/* ── DOCX / DOC ─────────────────────────────────────────────────── */
async function extractDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth') as {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? '';
}

/* ── Normalise whitespace ───────────────────────────────────────── */
function normalise(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ── Public API ─────────────────────────────────────────────────── */

/**
 * Extract full text from a resume file buffer.
 * Supports: PDF, DOCX, DOC, TXT, plain-text.
 */
export async function extractResumeText(
  buffer: Buffer,
  filename: string,
  mimetype: string,
  fallbackText?: string,
): Promise<string> {
  // Pasted plain text takes priority (user typed/pasted it themselves)
  if (fallbackText?.trim() && fallbackText.trim().length > 50) {
    return normalise(fallbackText.trim());
  }

  try {
    const lower = filename.toLowerCase();
    const isPdf  = mimetype === 'application/pdf'       || lower.endsWith('.pdf');
    const isDocx = mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lower.endsWith('.docx');
    const isDoc  = mimetype === 'application/msword'    || lower.endsWith('.doc');
    const isTxt  = mimetype.startsWith('text/')         || lower.endsWith('.txt');

    if (isPdf) {
      const text = await extractPdf(buffer);
      if (text.trim().length > 30) return normalise(text);
    }

    if (isDocx || isDoc) {
      const text = await extractDocx(buffer);
      if (text.trim().length > 30) return normalise(text);
    }

    if (isTxt) {
      return normalise(buffer.toString('utf8'));
    }

    // Last resort: try both parsers and pick the longer result
    let pdfText = '';
    let docxText = '';
    try { pdfText  = await extractPdf(buffer); }  catch {}
    try { docxText = await extractDocx(buffer); } catch {}

    const best = pdfText.length >= docxText.length ? pdfText : docxText;
    if (best.trim().length > 30) return normalise(best);
  } catch (err) {
    console.warn('[resume-parser] extraction error:', err);
  }

  // Absolute fallback — at least preserve the filename
  return fallbackText?.trim() || `File: ${filename}. Text extraction failed; please paste resume text.`;
}

/**
 * Compute a SHA-256 hash of the extracted text (normalised).
 * Used to detect duplicate resume uploads.
 */
export function resumeContentHash(text: string): string {
  const canonical = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(canonical).digest('hex');
}
