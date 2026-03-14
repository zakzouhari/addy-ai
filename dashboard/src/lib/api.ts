const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

class DashboardAPI {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('smartmail_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      const refreshed = await this.tryRefresh();
      if (refreshed) return this.request(endpoint, options);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('smartmail_token');
        localStorage.removeItem('smartmail_refresh_token');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error: ${response.status}`);
    }

    return response.json();
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('smartmail_refresh_token') : null;
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.success && data.data) {
        localStorage.setItem('smartmail_token', data.data.accessToken);
        localStorage.setItem('smartmail_refresh_token', data.data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Email + Password auth (no bearer token needed)
  async emailLogin(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Login failed');
    return data;
  }

  async emailRegister(email: string, password: string, name: string) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Registration failed');
    return data;
  }

  async getUser() {
    return this.request<{ success: boolean; data: any }>('/user/me');
  }

  async updateSettings(settings: Record<string, any>) {
    return this.request('/user/settings', { method: 'PATCH', body: JSON.stringify(settings) });
  }

  async getAnalytics() {
    return this.request<{ success: boolean; data: any }>('/analytics');
  }

  async getStyleProfile() {
    return this.request<{ success: boolean; data: any }>('/user/style-profile');
  }

  async updateStyleProfile(profile: Record<string, any>) {
    return this.request('/user/style-profile', { method: 'PATCH', body: JSON.stringify(profile) });
  }

  async reanalyzeStyle() {
    return this.request('/email/analyze-style', { method: 'POST', body: JSON.stringify({ emails: [] }) });
  }

  async getKnowledgeDocs() {
    return this.request<{ success: boolean; data: any[] }>('/knowledge');
  }

  async uploadDocument(data: { title: string; sourceType: string; content?: string; sourceUrl?: string }) {
    return this.request('/knowledge/upload', { method: 'POST', body: JSON.stringify(data) });
  }

  async deleteDocument(id: string) {
    return this.request(`/knowledge/${id}`, { method: 'DELETE' });
  }

  async createCheckoutSession() {
    return this.request<{ success: boolean; data: { url: string } }>('/billing/checkout', { method: 'POST' });
  }

  async createPortalSession() {
    return this.request<{ success: boolean; data: { url: string } }>('/billing/portal', { method: 'POST' });
  }

  async getBillingStatus() {
    return this.request<{ success: boolean; data: { plan: string; hasSubscription: boolean } }>('/billing/status');
  }

  async deleteAccount() {
    return this.request('/auth/account', { method: 'DELETE' });
  }
}

export const api = new DashboardAPI();
