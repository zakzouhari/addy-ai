const TONES = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'excited', label: 'Excited' },
  { value: 'thankful', label: 'Thankful' },
  { value: 'assertive', label: 'Assertive' },
  { value: 'empathetic', label: 'Empathetic' },
  { value: 'custom', label: 'Custom' },
];

export class SmartMailUI {
  static createComposeToolbar(handlers: {
    onGenerate: (topic: string, tone: string, language: string) => void;
    onRegenerate: () => void;
  }): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'smartmail-toolbar';
    toolbar.innerHTML = `
      <div class="smartmail-toolbar-header">
        <span class="smartmail-toolbar-logo">S</span>
        <span class="smartmail-toolbar-title">SmartMail AI</span>
        <button class="smartmail-toolbar-close">&times;</button>
      </div>
      <div class="smartmail-toolbar-body">
        <textarea class="smartmail-input smartmail-topic" placeholder="What should the email be about?" rows="2"></textarea>
        <div class="smartmail-toolbar-row">
          <select class="smartmail-select smartmail-tone">
            ${TONES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
          </select>
          <select class="smartmail-select smartmail-language">
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="zh-CN">Chinese</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
        <div class="smartmail-toolbar-actions">
          <button class="smartmail-btn smartmail-btn-primary smartmail-generate-btn">Generate</button>
          <button class="smartmail-btn smartmail-btn-secondary smartmail-regenerate-btn" style="display:none;">Regenerate</button>
        </div>
        <div class="smartmail-loading-inline" style="display:none;">
          <div class="smartmail-spinner-small"></div>
          <span>Generating...</span>
        </div>
      </div>
    `;

    const closeBtn = toolbar.querySelector('.smartmail-toolbar-close') as HTMLElement;
    closeBtn.addEventListener('click', () => toolbar.remove());

    const generateBtn = toolbar.querySelector('.smartmail-generate-btn') as HTMLElement;
    const regenerateBtn = toolbar.querySelector('.smartmail-regenerate-btn') as HTMLElement;
    const topicInput = toolbar.querySelector('.smartmail-topic') as HTMLTextAreaElement;
    const toneSelect = toolbar.querySelector('.smartmail-tone') as HTMLSelectElement;
    const langSelect = toolbar.querySelector('.smartmail-language') as HTMLSelectElement;

    generateBtn.addEventListener('click', () => {
      const topic = topicInput.value.trim();
      if (!topic) { topicInput.focus(); return; }
      handlers.onGenerate(topic, toneSelect.value, langSelect.value);
      regenerateBtn.style.display = 'inline-flex';
    });

    regenerateBtn.addEventListener('click', () => handlers.onRegenerate());

    return toolbar;
  }

  static createSummaryCard(summary: {
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    deadlines: { text: string; date: string }[];
    mentionedPeople: string[];
  }): HTMLElement {
    const card = document.createElement('div');
    card.className = 'smartmail-summary-card';
    card.innerHTML = `
      <div class="smartmail-summary-header">
        <span class="smartmail-toolbar-logo">S</span>
        <span>Email Summary</span>
        <button class="smartmail-summary-close">&times;</button>
      </div>
      <div class="smartmail-summary-body">
        <div class="smartmail-summary-section">
          <h4>Summary</h4>
          <p>${summary.summary}</p>
        </div>
        ${summary.keyPoints.length > 0 ? `
          <div class="smartmail-summary-section">
            <h4>Key Points</h4>
            <ul>${summary.keyPoints.map((p) => `<li>${p}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${summary.actionItems.length > 0 ? `
          <div class="smartmail-summary-section">
            <h4>Action Items</h4>
            <ul>${summary.actionItems.map((a) => `<li>${a}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${summary.deadlines.length > 0 ? `
          <div class="smartmail-summary-section">
            <h4>Deadlines</h4>
            <ul>${summary.deadlines.map((d) => `<li><strong>${d.date}</strong>: ${d.text}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${summary.mentionedPeople.length > 0 ? `
          <div class="smartmail-summary-section">
            <h4>People Mentioned</h4>
            <p>${summary.mentionedPeople.join(', ')}</p>
          </div>
        ` : ''}
      </div>
    `;

    const closeBtn = card.querySelector('.smartmail-summary-close') as HTMLElement;
    closeBtn.addEventListener('click', () => card.remove());
    return card;
  }

  static createDiffPreview(original: string, revised: string, onApply: () => void, onCancel: () => void): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'smartmail-diff-overlay';
    overlay.innerHTML = `
      <div class="smartmail-diff-card">
        <div class="smartmail-diff-header">
          <span>Text Improvement Preview</span>
          <button class="smartmail-diff-close">&times;</button>
        </div>
        <div class="smartmail-diff-content">
          <div class="smartmail-diff-col">
            <h4>Original</h4>
            <div class="smartmail-diff-text smartmail-diff-original">${original}</div>
          </div>
          <div class="smartmail-diff-col">
            <h4>Revised</h4>
            <div class="smartmail-diff-text smartmail-diff-revised">${revised}</div>
          </div>
        </div>
        <div class="smartmail-diff-actions">
          <button class="smartmail-btn smartmail-btn-primary smartmail-diff-apply">Apply Changes</button>
          <button class="smartmail-btn smartmail-btn-secondary smartmail-diff-cancel">Cancel</button>
        </div>
      </div>
    `;

    overlay.querySelector('.smartmail-diff-close')!.addEventListener('click', () => { overlay.remove(); onCancel(); });
    overlay.querySelector('.smartmail-diff-apply')!.addEventListener('click', () => { overlay.remove(); onApply(); });
    overlay.querySelector('.smartmail-diff-cancel')!.addEventListener('click', () => { overlay.remove(); onCancel(); });

    return overlay;
  }

  static createFollowUpPrompt(onSet: (days: number) => void): HTMLElement {
    const prompt = document.createElement('div');
    prompt.className = 'smartmail-followup-prompt';
    prompt.innerHTML = `
      <div class="smartmail-followup-content">
        <span class="smartmail-toolbar-logo">S</span>
        <span>Set a follow-up reminder?</span>
        <select class="smartmail-select smartmail-followup-days">
          <option value="1">Tomorrow</option>
          <option value="3" selected>In 3 days</option>
          <option value="7">In 1 week</option>
          <option value="14">In 2 weeks</option>
          <option value="30">In 1 month</option>
        </select>
        <button class="smartmail-btn smartmail-btn-primary smartmail-followup-set">Set Reminder</button>
        <button class="smartmail-followup-dismiss">&times;</button>
      </div>
    `;

    const select = prompt.querySelector('.smartmail-followup-days') as HTMLSelectElement;
    prompt.querySelector('.smartmail-followup-set')!.addEventListener('click', () => {
      onSet(parseInt(select.value, 10));
      prompt.remove();
    });
    prompt.querySelector('.smartmail-followup-dismiss')!.addEventListener('click', () => prompt.remove());

    return prompt;
  }

  static createLoadingOverlay(message: string = 'Processing...'): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'smartmail-loading-overlay';
    overlay.innerHTML = `
      <div class="smartmail-loading-card">
        <div class="smartmail-spinner"></div>
        <p>${message}</p>
      </div>
    `;
    return overlay;
  }

  static createToast(message: string, type: 'success' | 'error' | 'info'): HTMLElement {
    const toast = document.createElement('div');
    toast.className = `smartmail-toast smartmail-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('smartmail-toast-visible'));
    setTimeout(() => {
      toast.classList.remove('smartmail-toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
    return toast;
  }

  static cleanup(): void {
    document.querySelectorAll('[class^="smartmail-"]').forEach((el) => el.remove());
  }
}
