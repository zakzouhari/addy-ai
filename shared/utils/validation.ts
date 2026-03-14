import { ToneType } from '../types/user';

const VALID_TONES: ToneType[] = [
  'friendly', 'formal', 'casual', 'excited',
  'thankful', 'assertive', 'empathetic', 'custom',
];

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const DANGEROUS_TAGS = /<\s*\/?\s*(script|iframe|object|embed|form|input|link|meta|style)\b[^>]*>/gi;
const EVENT_HANDLERS = /\s+on\w+\s*=\s*(['"])[^'"]*\1/gi;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 254;
}

export function isValidTone(tone: string): tone is ToneType {
  return VALID_TONES.includes(tone as ToneType);
}

export function sanitizeHtml(html: string): string {
  let sanitized = html.replace(DANGEROUS_TAGS, '');
  sanitized = sanitized.replace(EVENT_HANDLERS, '');
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  return sanitized;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function extractPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
