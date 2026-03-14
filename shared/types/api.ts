import { ToneType } from './user';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface AnalyticsData {
  emailsComposed: number;
  emailsSummarized: number;
  toneAdjustments: number;
  timeSavedMinutes: number;
  mostUsedTones: { tone: ToneType; count: number }[];
  dailyUsage: { date: string; count: number }[];
}
