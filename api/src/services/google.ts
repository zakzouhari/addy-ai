import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import config from '../config';

function createOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

export class GoogleService {
  static getAuthUrl(): string {
    const client = createOAuth2Client();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
    });
  }

  static async getTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    idToken: string;
  }> {
    const client = createOAuth2Client();
    const { tokens } = await client.getToken(code);
    return {
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || '',
      idToken: tokens.id_token || '',
    };
  }

  static async getUserProfile(accessToken: string): Promise<{
    email: string;
    name: string;
    picture: string;
    googleId: string;
  }> {
    const client = createOAuth2Client();
    client.setCredentials({ access_token: accessToken });

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();

    return {
      email: data.email || '',
      name: data.name || '',
      picture: data.picture || '',
      googleId: data.id || '',
    };
  }

  static async getSentEmails(accessToken: string, maxResults: number = 50): Promise<string[]> {
    const client = createOAuth2Client();
    client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: client });
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['SENT'],
      maxResults,
    });

    const messages = listResponse.data.messages || [];
    const emailBodies: string[] = [];

    for (const msg of messages.slice(0, maxResults)) {
      if (!msg.id) continue;
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const parts = detail.data.payload?.parts || [];
      let body = '';

      if (detail.data.payload?.body?.data) {
        body = Buffer.from(detail.data.payload.body.data, 'base64').toString('utf-8');
      } else {
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          }
        }
      }

      if (body.trim()) {
        emailBodies.push(body);
      }
    }

    return emailBodies;
  }

  static async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt: number;
  }> {
    const client = createOAuth2Client();
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();
    return {
      accessToken: credentials.access_token || '',
      expiresAt: credentials.expiry_date || Date.now() + 3600 * 1000,
    };
  }
}
