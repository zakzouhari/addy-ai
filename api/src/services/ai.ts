import Anthropic from '@anthropic-ai/sdk';
import config from '../config';
import { redis } from '../config/redis';
import logger from '../config/logger';

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
const MODEL = 'claude-sonnet-4-6-20250929';

interface StyleHints {
  formality: number;
  averageSentenceLength: number;
  vocabularyLevel: string;
  commonPhrases: string[];
  greetingStyle: string;
  closingStyle: string;
  useEmojis: boolean;
}

export class AIService {
  static async composeDraft(params: {
    topic: string;
    tone: string;
    recipientEmail?: string;
    threadContext?: { subject: string; messages: { from: string; body: string; date: string }[] };
    language?: string;
    knowledgeContext?: string[];
    customInstructions?: string;
    styleProfile?: StyleHints;
  }): Promise<{ draft: string; suggestedSubject?: string; tokensUsed: number }> {
    let systemPrompt = `You are an expert email writer. Write a complete, natural-sounding email based on the user's instructions.

Tone: ${params.tone}
${params.language ? `Language: Write the email in ${params.language}` : ''}
${params.recipientEmail ? `Recipient: ${params.recipientEmail}` : ''}

Guidelines:
- Write only the email body (no subject line unless asked)
- Be natural and human-sounding, avoid AI-like phrasing
- Match the requested tone precisely
- Keep the email focused and concise unless told otherwise`;

    if (params.styleProfile) {
      const sp = params.styleProfile;
      systemPrompt += `\n\nMatch this writing style:
- Formality level: ${Math.round(sp.formality * 100)}%
- Average sentence length: ~${sp.averageSentenceLength} words
- Vocabulary: ${sp.vocabularyLevel}
- Typical greeting: "${sp.greetingStyle}"
- Typical closing: "${sp.closingStyle}"
- ${sp.useEmojis ? 'Uses emojis occasionally' : 'Does not use emojis'}
${sp.commonPhrases.length > 0 ? `- Common phrases: ${sp.commonPhrases.slice(0, 5).join(', ')}` : ''}`;
    }

    if (params.knowledgeContext && params.knowledgeContext.length > 0) {
      systemPrompt += `\n\nRelevant context from the user's knowledge base (use if applicable):\n${params.knowledgeContext.join('\n---\n')}`;
    }

    let userMessage = `Write an email about: ${params.topic}`;
    if (params.customInstructions) {
      userMessage += `\n\nAdditional instructions: ${params.customInstructions}`;
    }

    if (params.threadContext) {
      const threadSummary = params.threadContext.messages
        .map((m) => `From: ${m.from} (${m.date})\n${m.body}`)
        .join('\n---\n');
      userMessage += `\n\nThis is a reply to the following email thread (subject: "${params.threadContext.subject}"):\n${threadSummary}\n\nWrite an appropriate reply that continues this conversation.`;
    }

    userMessage += '\n\nAlso suggest a subject line if this is a new email (not a reply). Format: put the subject on the first line as "Subject: ..." followed by a blank line, then the email body.';

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '';
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    let draft = text;
    let suggestedSubject: string | undefined;

    const subjectMatch = text.match(/^Subject:\s*(.+)\n\n/);
    if (subjectMatch) {
      suggestedSubject = subjectMatch[1].trim();
      draft = text.slice(subjectMatch[0].length);
    }

    return { draft: draft.trim(), suggestedSubject, tokensUsed };
  }

  static async summarizeEmail(params: {
    emailContent: string;
    threadMessages?: { from: string; body: string; date: string }[];
  }): Promise<{
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    deadlines: { text: string; date: string }[];
    mentionedPeople: string[];
  }> {
    const systemPrompt = `You are an email analysis assistant. Analyze the email content and extract structured information.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "2-3 sentence summary",
  "keyPoints": ["point 1", "point 2"],
  "actionItems": ["action 1", "action 2"],
  "deadlines": [{"text": "description", "date": "YYYY-MM-DD or relative date"}],
  "mentionedPeople": ["Name 1", "Name 2"]
}

If a field has no items, use an empty array.`;

    let userMessage = `Analyze this email:\n\n${params.emailContent}`;
    if (params.threadMessages && params.threadMessages.length > 0) {
      const thread = params.threadMessages
        .map((m) => `From: ${m.from} (${m.date})\n${m.body}`)
        .join('\n---\n');
      userMessage += `\n\nFull thread context:\n${thread}`;
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '{}';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      return {
        summary: parsed.summary || '',
        keyPoints: parsed.keyPoints || [],
        actionItems: parsed.actionItems || [],
        deadlines: parsed.deadlines || [],
        mentionedPeople: parsed.mentionedPeople || [],
      };
    } catch {
      return {
        summary: text,
        keyPoints: [],
        actionItems: [],
        deadlines: [],
        mentionedPeople: [],
      };
    }
  }

  static async adjustTone(params: {
    text: string;
    adjustment: 'more_formal' | 'friendlier' | 'fix_grammar' | 'shorter' | 'longer' | 'translate';
    targetLanguage?: string;
  }): Promise<{ original: string; revised: string; changes: { type: string; original: string; revised: string }[] }> {
    const adjustmentInstructions: Record<string, string> = {
      more_formal: 'Rewrite this text in a more formal, professional tone. Use proper business language.',
      friendlier: 'Rewrite this text in a warmer, friendlier tone. Make it more approachable and personable.',
      fix_grammar: 'Fix all grammar, spelling, and punctuation errors. Improve clarity while preserving the original meaning and tone.',
      shorter: 'Make this text more concise. Remove unnecessary words and phrases while preserving the key message.',
      longer: 'Expand this text with more detail and elaboration. Add supporting context while keeping the same tone.',
      translate: `Translate this text to ${params.targetLanguage || 'English'}. Preserve the tone and meaning.`,
    };

    const systemPrompt = `You are a text editing assistant. ${adjustmentInstructions[params.adjustment]}

Respond ONLY with valid JSON:
{
  "revised": "the full revised text",
  "changes": [{"type": "description of change type", "original": "original snippet", "revised": "revised snippet"}]
}

List up to 5 most significant changes.`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: params.text }],
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '{}';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      return {
        original: params.text,
        revised: parsed.revised || text,
        changes: parsed.changes || [],
      };
    } catch {
      return { original: params.text, revised: text, changes: [] };
    }
  }

  static async generateFollowUp(params: {
    originalSubject: string;
    originalBody: string;
    recipientEmail: string;
    daysSinceSent: number;
    tone?: string;
  }): Promise<{ draft: string }> {
    const systemPrompt = `You are an email assistant. Write a polite follow-up email.
Tone: ${params.tone || 'friendly'}
It has been ${params.daysSinceSent} day(s) since the original email was sent.
Be brief, professional, and not pushy.`;

    const userMessage = `Write a follow-up to this email I sent to ${params.recipientEmail}:
Subject: ${params.originalSubject}

${params.originalBody}`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = response.content[0];
    const draft = content.type === 'text' ? content.text : '';
    return { draft: draft.trim() };
  }

  static async analyzeStyle(sentEmails: string[]): Promise<{
    formality: number;
    averageSentenceLength: number;
    vocabularyLevel: string;
    commonPhrases: string[];
    greetingStyle: string;
    closingStyle: string;
    useEmojis: boolean;
  }> {
    const sample = sentEmails.slice(0, 20).join('\n\n---EMAIL SEPARATOR---\n\n');

    const systemPrompt = `Analyze the writing style of these sent emails. Respond ONLY with valid JSON:
{
  "formality": 0.0 to 1.0 (0 = very casual, 1 = very formal),
  "averageSentenceLength": number of words,
  "vocabularyLevel": "simple" | "moderate" | "advanced",
  "commonPhrases": ["phrase1", "phrase2", ...] (up to 10 recurring phrases),
  "greetingStyle": "typical greeting used",
  "closingStyle": "typical closing used",
  "useEmojis": boolean
}`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: sample }],
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '{}';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      return {
        formality: Math.max(0, Math.min(1, parsed.formality || 0.5)),
        averageSentenceLength: parsed.averageSentenceLength || 15,
        vocabularyLevel: parsed.vocabularyLevel || 'moderate',
        commonPhrases: parsed.commonPhrases || [],
        greetingStyle: parsed.greetingStyle || 'Hi',
        closingStyle: parsed.closingStyle || 'Best regards',
        useEmojis: parsed.useEmojis || false,
      };
    } catch {
      return {
        formality: 0.5,
        averageSentenceLength: 15,
        vocabularyLevel: 'moderate',
        commonPhrases: [],
        greetingStyle: 'Hi',
        closingStyle: 'Best regards',
        useEmojis: false,
      };
    }
  }

  static async detectLanguage(text: string): Promise<string> {
    const cacheKey = `lang:${text.slice(0, 100)}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return cached;
    } catch {
      // Redis unavailable, continue without cache
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 10,
      system: 'Detect the language of the text. Respond with ONLY the ISO 639-1 language code (e.g., "en", "fr", "es").',
      messages: [{ role: 'user', content: text.slice(0, 500) }],
    });

    const content = response.content[0];
    const lang = (content.type === 'text' ? content.text : 'en').trim().toLowerCase().slice(0, 5);

    try {
      await redis.set(cacheKey, lang, 'EX', 3600);
    } catch {
      // Redis unavailable
    }

    return lang;
  }
}
