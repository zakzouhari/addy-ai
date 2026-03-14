export type ToneType =
  | 'friendly'
  | 'formal'
  | 'casual'
  | 'excited'
  | 'thankful'
  | 'assertive'
  | 'empathetic'
  | 'custom';

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

export interface StyleProfile {
  formality: number;
  averageSentenceLength: number;
  vocabularyLevel: 'simple' | 'moderate' | 'advanced';
  commonPhrases: string[];
  greetingStyle: string;
  closingStyle: string;
  useEmojis: boolean;
  analyzedEmailCount: number;
}

export interface UserSettings {
  defaultTone: ToneType;
  signature: string;
  language: string;
  followUpDefaultDays: number;
  knowledgeBaseEnabled: boolean;
  autoDetectLanguage: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  googleId: string;
  plan: SubscriptionPlan;
  styleProfile: StyleProfile | null;
  settings: UserSettings;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  defaultTone: 'friendly',
  signature: '',
  language: 'en',
  followUpDefaultDays: 3,
  knowledgeBaseEnabled: true,
  autoDetectLanguage: true,
};
