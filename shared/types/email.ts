import { ToneType } from './user';

export type EmailPlatform = 'gmail' | 'outlook';

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  htmlBody: string;
  date: string;
  isRead: boolean;
  labels: string[];
}

export interface EmailThread {
  id: string;
  subject: string;
  messages: EmailMessage[];
  participants: string[];
}

export interface ComposeRequest {
  topic: string;
  tone: ToneType;
  recipientEmail?: string;
  threadContext?: EmailThread;
  language?: string;
  knowledgeContext?: string[];
  customInstructions?: string;
}

export interface ComposeResponse {
  draft: string;
  suggestedSubject?: string;
  tokensUsed: number;
}

export interface SummarizeRequest {
  emailContent: string;
  threadMessages?: EmailMessage[];
}

export interface SummarizeResponse {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  deadlines: { text: string; date: string }[];
  mentionedPeople: string[];
}

export type ToneAdjustment =
  | 'more_formal'
  | 'friendlier'
  | 'fix_grammar'
  | 'shorter'
  | 'longer'
  | 'translate';

export interface ToneAdjustRequest {
  text: string;
  adjustment: ToneAdjustment;
  targetLanguage?: string;
}

export interface ToneAdjustResponse {
  original: string;
  revised: string;
  changes: { type: string; original: string; revised: string }[];
}

export interface FollowUpReminder {
  id: string;
  userId: string;
  emailId: string;
  threadId: string;
  subject: string;
  recipientEmail: string;
  scheduledAt: string;
  status: 'pending' | 'triggered' | 'completed' | 'cancelled';
  createdAt: string;
}
