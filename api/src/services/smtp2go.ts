import config from '../config';
import logger from '../config/logger';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SMTP2GoService {
  private static readonly API_URL = 'https://api.smtp2go.com/v3/email/send';

  /**
   * Send an email via SMTP2Go.
   * Emails are sent from the configured sender address (e.g., zzouhari@rmchomemortgage.com).
   */
  static async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const apiKey = config.smtp2go.apiKey;
    const senderEmail = config.smtp2go.senderEmail;
    const senderName = config.smtp2go.senderName;

    if (!apiKey) {
      logger.error('SMTP2Go API key is not configured');
      return { success: false, error: 'Email sending is not configured' };
    }

    const recipients = Array.isArray(params.to) ? params.to : [params.to];

    try {
      const response = await fetch(SMTP2GoService.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          to: recipients,
          sender: `${senderName} <${senderEmail}>`,
          subject: params.subject,
          ...(params.isHtml
            ? { html_body: params.body }
            : { text_body: params.body }),
          ...(params.replyTo ? { custom_headers: [{ header: 'Reply-To', value: params.replyTo }] } : {}),
          ...(params.cc && params.cc.length > 0 ? { cc: params.cc } : {}),
          ...(params.bcc && params.bcc.length > 0 ? { bcc: params.bcc } : {}),
        }),
      });

      const data = await response.json();

      if (data.data?.succeeded > 0) {
        logger.info(`Email sent successfully to ${recipients.join(', ')}`);
        return {
          success: true,
          messageId: data.data?.email_id,
        };
      } else {
        const errorMsg = data.data?.failures?.[0]?.error || data.data?.error || 'Unknown SMTP2Go error';
        logger.error(`SMTP2Go send failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      logger.error('SMTP2Go API error:', err);
      return { success: false, error: 'Failed to connect to email service' };
    }
  }
}
