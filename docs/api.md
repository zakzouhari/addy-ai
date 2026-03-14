# SmartMail AI - API Documentation

Base URL: `http://localhost:3001/api/v1`

## Authentication

All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

### Endpoints

#### `GET /auth/google`
Redirects to Google OAuth consent screen.

#### `GET /auth/google/callback`
Handles OAuth callback. Creates/updates user and redirects to dashboard with tokens.

#### `POST /auth/refresh`
Refresh an expired access token.
- Body: `{ "refreshToken": "string" }`
- Response: `{ "success": true, "data": { "accessToken": "...", "refreshToken": "...", "expiresAt": number } }`

#### `POST /auth/logout`
Invalidate refresh token. Requires auth.
- Body: `{ "refreshToken": "string" }`

#### `DELETE /auth/account`
GDPR: Delete user account and all data. Requires auth.

---

## Email

#### `POST /email/compose`
Generate an email draft using AI.
- Body:
  ```json
  {
    "topic": "string (required)",
    "tone": "friendly|formal|casual|excited|thankful|assertive|empathetic|custom (required)",
    "recipientEmail": "string (optional)",
    "threadContext": { "subject": "string", "messages": [...] } (optional),
    "language": "string (optional, ISO 639-1)",
    "customInstructions": "string (optional)"
  }
  ```
- Response: `{ "success": true, "data": { "draft": "...", "suggestedSubject": "...", "tokensUsed": number } }`

#### `POST /email/summarize`
Summarize an email or thread.
- Body: `{ "emailContent": "string (required)", "threadMessages": [...] (optional) }`
- Response: `{ "success": true, "data": { "summary": "...", "keyPoints": [...], "actionItems": [...], "deadlines": [...], "mentionedPeople": [...] } }`

#### `POST /email/adjust-tone`
Adjust the tone of selected text.
- Body: `{ "text": "string", "adjustment": "more_formal|friendlier|fix_grammar|shorter|longer|translate", "targetLanguage": "string (optional)" }`
- Response: `{ "success": true, "data": { "original": "...", "revised": "...", "changes": [...] } }`

#### `POST /email/follow-up/generate`
Generate a follow-up email draft.
- Body: `{ "originalSubject": "string", "originalBody": "string", "recipientEmail": "string", "daysSinceSent": number, "tone": "string (optional)" }`

#### `POST /email/follow-up/remind`
Create a follow-up reminder.
- Body: `{ "emailId": "string", "threadId": "string", "subject": "string", "recipientEmail": "string", "followUpDays": number }`

#### `GET /email/follow-up/reminders`
List active reminders for the authenticated user.

#### `DELETE /email/follow-up/remind/:id`
Cancel a follow-up reminder.

#### `POST /email/analyze-style`
Analyze writing style from sent emails.
- Body: `{ "emails": ["string", ...] }`

#### `POST /email/detect-language`
Detect the language of text.
- Body: `{ "text": "string" }`

---

## Knowledge Base

#### `POST /knowledge/upload`
Upload a document to the knowledge base.
- Body: `{ "title": "string", "sourceType": "pdf|url|text", "content": "string (optional)", "sourceUrl": "string (optional)" }`
- For PDF uploads, use multipart/form-data with a `file` field.

#### `GET /knowledge`
List all knowledge documents for the authenticated user.

#### `GET /knowledge/:id`
Get a specific document with its chunks.

#### `DELETE /knowledge/:id`
Delete a knowledge document.

#### `POST /knowledge/search`
Search the knowledge base using semantic search.
- Body: `{ "query": "string", "topK": number (optional, default 5) }`

---

## User

#### `GET /user/me`
Get current user profile.

#### `PATCH /user/settings`
Update user settings.
- Body: `{ "defaultTone": "...", "signature": "...", "language": "...", "followUpDefaultDays": number, "knowledgeBaseEnabled": boolean, "autoDetectLanguage": boolean }`

#### `GET /user/style-profile`
Get the user's writing style profile.

#### `PATCH /user/style-profile`
Update style profile manually.

#### `DELETE /user/data`
GDPR: Export all user data as JSON, then delete the account.

---

## Billing

#### `POST /billing/checkout`
Create a Stripe checkout session for Pro upgrade. Returns `{ "url": "..." }`.

#### `POST /billing/portal`
Create a Stripe billing portal session. Returns `{ "url": "..." }`.

#### `POST /billing/webhook`
Stripe webhook endpoint (no auth required, signature verified).

#### `GET /billing/status`
Get current subscription status.

---

## Analytics

#### `GET /analytics`
Get user analytics data (emails composed, summarized, time saved, etc.).

---

## Health

#### `GET /api/health`
Health check endpoint. Returns `{ "status": "ok", "timestamp": "..." }`.

## Rate Limits

- General API: 100 requests per 15 minutes
- Auth endpoints: 10 requests per 15 minutes
- AI generation: 30 requests per 15 minutes (Free), 200 (Pro)

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {} // optional
  }
}
```
