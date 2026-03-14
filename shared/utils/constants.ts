import { ToneType } from '../types/user';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'cs', name: 'Czech' },
  { code: 'ro', name: 'Romanian' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
] as const;

export const TONE_OPTIONS: { value: ToneType; label: string; description: string }[] = [
  { value: 'friendly', label: 'Friendly', description: 'Warm and approachable tone' },
  { value: 'formal', label: 'Formal', description: 'Professional and business-appropriate' },
  { value: 'casual', label: 'Casual', description: 'Relaxed and conversational' },
  { value: 'excited', label: 'Excited', description: 'Enthusiastic and energetic' },
  { value: 'thankful', label: 'Thankful', description: 'Grateful and appreciative' },
  { value: 'assertive', label: 'Assertive', description: 'Confident and direct' },
  { value: 'empathetic', label: 'Empathetic', description: 'Understanding and compassionate' },
  { value: 'custom', label: 'Custom', description: 'Use your own instructions' },
];

export const MAX_FREE_TIER_EMAILS = 25;
export const MAX_FREE_TIER_KNOWLEDGE_DOCS = 3;
export const MAX_PRO_KNOWLEDGE_DOCS = 50;
export const API_VERSION = 'v1';

export const FOLLOW_UP_OPTIONS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In 1 week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
  { label: 'In 1 month', days: 30 },
];
