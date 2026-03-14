export type Platform = 'gmail' | 'outlook' | null;

export class DOMUtils {
  static detectPlatform(): Platform {
    const url = window.location.hostname;
    if (url.includes('mail.google.com')) return 'gmail';
    if (url.includes('outlook.live.com') || url.includes('outlook.office')) return 'outlook';
    return null;
  }

  static isComposeOpen(): boolean {
    const platform = this.detectPlatform();
    if (platform === 'gmail') {
      return !!document.querySelector('div[aria-label="Message Body"], div.Am.Al.editable, div[g_editable="true"]');
    }
    if (platform === 'outlook') {
      return !!document.querySelector('div[aria-label="Message body"], div[role="textbox"][contenteditable="true"]');
    }
    return false;
  }

  static getComposeBody(): HTMLElement | null {
    const platform = this.detectPlatform();
    if (platform === 'gmail') {
      return document.querySelector<HTMLElement>(
        'div[aria-label="Message Body"], div.Am.Al.editable, div[g_editable="true"]'
      );
    }
    if (platform === 'outlook') {
      return document.querySelector<HTMLElement>(
        'div[aria-label="Message body"], div[role="textbox"][contenteditable="true"]'
      );
    }
    return null;
  }

  static getSubjectField(): HTMLInputElement | null {
    const platform = this.detectPlatform();
    if (platform === 'gmail') {
      return document.querySelector<HTMLInputElement>('input[name="subjectbox"], input[aria-label="Subject"]');
    }
    if (platform === 'outlook') {
      return document.querySelector<HTMLInputElement>('input[aria-label="Add a subject"]');
    }
    return null;
  }

  static getRecipients(): string[] {
    const platform = this.detectPlatform();
    const emails: string[] = [];

    if (platform === 'gmail') {
      const chips = document.querySelectorAll<HTMLElement>('div[data-hovercard-id], span[email]');
      chips.forEach((el) => {
        const email = el.getAttribute('data-hovercard-id') || el.getAttribute('email');
        if (email && email.includes('@')) emails.push(email);
      });
    }
    if (platform === 'outlook') {
      const pills = document.querySelectorAll<HTMLElement>('div[class*="wellItem"] span[title]');
      pills.forEach((el) => {
        const title = el.getAttribute('title');
        if (title && title.includes('@')) emails.push(title);
      });
    }
    return emails;
  }

  static insertTextIntoCompose(text: string): void {
    const body = this.getComposeBody();
    if (!body) return;
    body.innerHTML = text.replace(/\n/g, '<br>');
    body.dispatchEvent(new Event('input', { bubbles: true }));
    body.dispatchEvent(new Event('change', { bubbles: true }));
  }

  static setSubject(subject: string): void {
    const field = this.getSubjectField();
    if (!field) return;
    field.value = subject;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  static getEmailThread(): { subject: string; messages: { from: string; body: string; date: string }[] } | null {
    const platform = this.detectPlatform();

    if (platform === 'gmail') {
      const subjectEl = document.querySelector<HTMLElement>('h2[data-thread-perm-id], h2.hP');
      const subject = subjectEl?.textContent?.trim() || '';
      const messageEls = document.querySelectorAll<HTMLElement>('div.ii.gt, div[data-message-id]');
      const messages: { from: string; body: string; date: string }[] = [];

      messageEls.forEach((el) => {
        const parentRow = el.closest('div[class*="adn"]') || el.closest('tr');
        const senderEl = parentRow?.querySelector<HTMLElement>('span[email], span.gD');
        const dateEl = parentRow?.querySelector<HTMLElement>('span.g3, span[title]');
        messages.push({
          from: senderEl?.getAttribute('email') || senderEl?.textContent?.trim() || 'Unknown',
          body: el.textContent?.trim() || '',
          date: dateEl?.getAttribute('title') || dateEl?.textContent?.trim() || '',
        });
      });

      return messages.length > 0 ? { subject, messages } : null;
    }

    if (platform === 'outlook') {
      const subjectEl = document.querySelector<HTMLElement>('span[class*="SubjectLine"], div[class*="subject"]');
      const subject = subjectEl?.textContent?.trim() || '';
      const messageEls = document.querySelectorAll<HTMLElement>('div[class*="ItemBody"], div[aria-label*="message body"]');
      const messages: { from: string; body: string; date: string }[] = [];

      messageEls.forEach((el) => {
        const container = el.closest('div[class*="ConversationItem"]');
        const senderEl = container?.querySelector<HTMLElement>('span[class*="SenderName"], span[title]');
        const dateEl = container?.querySelector<HTMLElement>('span[class*="DateSent"]');
        messages.push({
          from: senderEl?.textContent?.trim() || 'Unknown',
          body: el.textContent?.trim() || '',
          date: dateEl?.textContent?.trim() || '',
        });
      });

      return messages.length > 0 ? { subject, messages } : null;
    }

    return null;
  }

  static getSelectedText(): string {
    return window.getSelection()?.toString() || '';
  }

  static replaceSelectedText(newText: string): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const frag = document.createDocumentFragment();
    const lines = newText.split('\n');
    lines.forEach((line, i) => {
      frag.appendChild(document.createTextNode(line));
      if (i < lines.length - 1) frag.appendChild(document.createElement('br'));
    });
    range.insertNode(frag);
    selection.collapseToEnd();
  }

  static isReplyMode(): boolean {
    const platform = this.detectPlatform();
    if (platform === 'gmail') {
      return !!document.querySelector('div[aria-label="Message Body"]')?.closest('div.ip.iq');
    }
    if (platform === 'outlook') {
      return !!document.querySelector('div[class*="reply"], button[aria-label*="Reply"]');
    }
    return false;
  }

  static observeComposeOpen(callback: () => void): MutationObserver {
    const observer = new MutationObserver(() => {
      if (this.isComposeOpen()) callback();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
  }

  static observeEmailView(callback: () => void): MutationObserver {
    const observer = new MutationObserver(() => {
      const platform = this.detectPlatform();
      if (platform === 'gmail' && document.querySelector('div.ii.gt')) callback();
      if (platform === 'outlook' && document.querySelector('div[class*="ItemBody"]')) callback();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
  }
}
