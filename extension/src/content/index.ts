import './styles.css';
import { DOMUtils } from '../utils/dom';
import { SmartMailAPI } from '../utils/api';
import { SmartMailUI } from './ui';

let toolbarInjected = false;
let lastComposeBody: HTMLElement | null = null;
let lastGeneratedDraft = '';
let lastTopic = '';
let lastTone = '';
let lastLanguage = '';

function injectComposeToolbar(): void {
  if (toolbarInjected) return;

  const composeBody = DOMUtils.getComposeBody();
  if (!composeBody || composeBody === lastComposeBody) return;

  lastComposeBody = composeBody;
  toolbarInjected = true;

  const toolbar = SmartMailUI.createComposeToolbar({
    onGenerate: handleGenerate,
    onRegenerate: handleRegenerate,
  });

  document.body.appendChild(toolbar);

  // Auto-fill thread context if replying
  if (DOMUtils.isReplyMode()) {
    const topicInput = toolbar.querySelector('.smartmail-topic') as HTMLTextAreaElement;
    if (topicInput) {
      topicInput.placeholder = 'Instructions for your reply (or leave blank for auto-reply)...';
    }
  }
}

async function handleGenerate(topic: string, tone: string, language: string): Promise<void> {
  lastTopic = topic;
  lastTone = tone;
  lastLanguage = language;

  const loadingEl = document.querySelector('.smartmail-loading-inline') as HTMLElement;
  const generateBtn = document.querySelector('.smartmail-generate-btn') as HTMLElement;

  if (loadingEl) loadingEl.style.display = 'flex';
  if (generateBtn) generateBtn.style.display = 'none';

  try {
    const threadContext = DOMUtils.isReplyMode() ? DOMUtils.getEmailThread() : undefined;
    const recipients = DOMUtils.getRecipients();

    const response = await SmartMailAPI.composeDraft({
      topic,
      tone,
      language: language !== 'en' ? language : undefined,
      recipientEmail: recipients[0],
      threadContext: threadContext || undefined,
    });

    if (response.success && response.data) {
      lastGeneratedDraft = response.data.draft;
      DOMUtils.insertTextIntoCompose(response.data.draft);

      if (response.data.suggestedSubject && !DOMUtils.isReplyMode()) {
        DOMUtils.setSubject(response.data.suggestedSubject);
      }

      SmartMailUI.createToast('Email draft generated!', 'success');
    }
  } catch (err: any) {
    SmartMailUI.createToast(err.message || 'Failed to generate draft', 'error');
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
    if (generateBtn) generateBtn.style.display = 'inline-flex';
  }
}

async function handleRegenerate(): Promise<void> {
  if (lastTopic) {
    await handleGenerate(lastTopic, lastTone, lastLanguage);
  }
}

function injectSummarizeButtons(): void {
  const platform = DOMUtils.detectPlatform();
  if (!platform) return;

  // Check if we already injected
  if (document.querySelector('.smartmail-summarize-btn')) return;

  let headerTargets: NodeListOf<HTMLElement>;
  if (platform === 'gmail') {
    headerTargets = document.querySelectorAll<HTMLElement>('div.gE.iv.gt h2.hP, tr.acZ td.gH div.gE');
  } else {
    headerTargets = document.querySelectorAll<HTMLElement>('div[class*="ConversationHeader"], div[class*="subject"]');
  }

  // Also try to inject near the email subject area
  const subjectArea = platform === 'gmail'
    ? document.querySelector<HTMLElement>('h2.hP, div.ha h2')
    : document.querySelector<HTMLElement>('span[class*="SubjectLine"]');

  if (subjectArea && !subjectArea.querySelector('.smartmail-summarize-btn')) {
    const btn = document.createElement('button');
    btn.className = 'smartmail-summarize-btn';
    btn.textContent = 'Summarize';
    btn.addEventListener('click', handleSummarize);
    subjectArea.appendChild(btn);
  }
}

async function handleSummarize(): Promise<void> {
  const thread = DOMUtils.getEmailThread();
  if (!thread || thread.messages.length === 0) {
    SmartMailUI.createToast('No email content found to summarize', 'error');
    return;
  }

  const loading = SmartMailUI.createLoadingOverlay('Summarizing email...');
  document.body.appendChild(loading);

  try {
    const emailContent = thread.messages.map((m) => `From: ${m.from}\n${m.body}`).join('\n---\n');

    const response = await SmartMailAPI.summarizeEmail({
      emailContent,
      threadMessages: thread.messages,
    });

    loading.remove();

    if (response.success && response.data) {
      const card = SmartMailUI.createSummaryCard(response.data);
      document.body.appendChild(card);
    }
  } catch (err: any) {
    loading.remove();
    SmartMailUI.createToast(err.message || 'Failed to summarize email', 'error');
  }
}

async function handleToneAdjust(text: string, adjustment: string): Promise<void> {
  if (!text.trim()) return;

  const loading = SmartMailUI.createLoadingOverlay('Improving text...');
  document.body.appendChild(loading);

  try {
    const response = await SmartMailAPI.adjustTone({ text, adjustment });
    loading.remove();

    if (response.success && response.data) {
      const diffPreview = SmartMailUI.createDiffPreview(
        response.data.original,
        response.data.revised,
        () => {
          DOMUtils.replaceSelectedText(response.data.revised);
          SmartMailUI.createToast('Text updated!', 'success');
        },
        () => { /* cancelled */ }
      );
      document.body.appendChild(diffPreview);
    }
  } catch (err: any) {
    loading.remove();
    SmartMailUI.createToast(err.message || 'Failed to adjust text', 'error');
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ADJUST_TONE') {
    const selectedText = DOMUtils.getSelectedText() || message.data.text;
    handleToneAdjust(selectedText, message.data.adjustment);
    sendResponse({ received: true });
  }
  return false;
});

// Initialize
function init(): void {
  const platform = DOMUtils.detectPlatform();
  if (!platform) return;

  // Watch for compose window
  DOMUtils.observeComposeOpen(() => {
    injectComposeToolbar();
  });

  // Watch for email view changes to inject summarize buttons
  DOMUtils.observeEmailView(() => {
    injectSummarizeButtons();
  });

  // Check if compose is already open
  if (DOMUtils.isComposeOpen()) {
    injectComposeToolbar();
  }

  // Initial summarize button injection
  setTimeout(injectSummarizeButtons, 2000);

  // Reset toolbar state when compose closes
  const composeObserver = new MutationObserver(() => {
    if (!DOMUtils.isComposeOpen() && toolbarInjected) {
      toolbarInjected = false;
      lastComposeBody = null;
      const existingToolbar = document.querySelector('.smartmail-toolbar');
      if (existingToolbar) existingToolbar.remove();
    }
  });
  composeObserver.observe(document.body, { childList: true, subtree: true });
}

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
