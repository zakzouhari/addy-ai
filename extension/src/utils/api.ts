// IMPORTANT: Change this URL to your Render deployment URL before building
// Example: 'https://smartmail-api.onrender.com/api/v1'
const API_BASE = 'http://localhost:3001/api/v1';

export class SmartMailAPI {
  private static async getAuthToken(): Promise<string | null> {
    const result = await chrome.storage.local.get('authToken');
    return result.authToken || null;
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAuthToken();
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    return response.json();
  }

  static async composeDraft(params: {
    topic: string;
    tone: string;
    recipientEmail?: string;
    threadContext?: { subject: string; messages: { from: string; body: string; date: string }[] };
    language?: string;
    customInstructions?: string;
  }) {
    return this.request<{ success: boolean; data: { draft: string; suggestedSubject?: string; tokensUsed: number } }>(
      '/email/compose', { method: 'POST', body: JSON.stringify(params) }
    );
  }

  static async summarizeEmail(params: { emailContent: string; threadMessages?: { from: string; body: string; date: string }[] }) {
    return this.request<{ success: boolean; data: { summary: string; keyPoints: string[]; actionItems: string[]; deadlines: { text: string; date: string }[]; mentionedPeople: string[] } }>(
      '/email/summarize', { method: 'POST', body: JSON.stringify(params) }
    );
  }

  static async adjustTone(params: { text: string; adjustment: string; targetLanguage?: string }) {
    return this.request<{ success: boolean; data: { original: string; revised: string; changes: { type: string; original: string; revised: string }[] } }>(
      '/email/adjust-tone', { method: 'POST', body: JSON.stringify(params) }
    );
  }

  static async generateFollowUp(params: { originalSubject: string; originalBody: string; recipientEmail: string; daysSinceSent: number; tone?: string }) {
    return this.request<{ success: boolean; data: { draft: string } }>(
      '/email/follow-up/generate', { method: 'POST', body: JSON.stringify(params) }
    );
  }

  static async createReminder(params: { emailId: string; threadId: string; subject: string; recipientEmail: string; followUpDays: number }) {
    return this.request('/email/follow-up/remind', { method: 'POST', body: JSON.stringify(params) });
  }

  static async getReminders() {
    return this.request<{ success: boolean; data: any[] }>('/email/follow-up/reminders');
  }

  static async getUser() {
    return this.request<{ success: boolean; data: any }>('/user/me');
  }

  static async updateSettings(settings: Record<string, any>) {
    return this.request('/user/settings', { method: 'PATCH', body: JSON.stringify(settings) });
  }

  static async detectLanguage(text: string) {
    return this.request<{ success: boolean; data: { language: string } }>(
      '/email/detect-language', { method: 'POST', body: JSON.stringify({ text }) }
    );
  }
}
