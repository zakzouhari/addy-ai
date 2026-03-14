import { SmartMailAPI } from '../utils/api';

type Tab = 'compose' | 'summarize' | 'reminders' | 'settings';
let activeTab: Tab = 'compose';

function render(): void {
  const root = document.getElementById('sidebar-root')!;
  root.innerHTML = `
    <div style="height:100vh;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
      <div style="display:flex;align-items:center;gap:8px;padding:16px;background:#4F46E5;color:white;">
        <div style="width:28px;height:28px;background:rgba(255,255,255,0.2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;">S</div>
        <span style="font-weight:600;font-size:15px;">SmartMail AI</span>
      </div>

      <div style="display:flex;border-bottom:1px solid #e5e7eb;background:white;">
        ${(['compose', 'summarize', 'reminders', 'settings'] as Tab[]).map((tab) => `
          <button class="sidebar-tab ${activeTab === tab ? 'active' : ''}" data-tab="${tab}" style="flex:1;padding:10px 0;border:none;background:${activeTab === tab ? 'white' : 'transparent'};color:${activeTab === tab ? '#4F46E5' : '#6b7280'};font-size:12px;font-weight:${activeTab === tab ? '600' : '400'};cursor:pointer;border-bottom:2px solid ${activeTab === tab ? '#4F46E5' : 'transparent'};">
            ${tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        `).join('')}
      </div>

      <div style="flex:1;overflow-y:auto;padding:16px;" id="tab-content">
        ${renderTabContent()}
      </div>
    </div>
  `;

  // Tab click handlers
  root.querySelectorAll('.sidebar-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = (btn as HTMLElement).dataset.tab as Tab;
      render();
    });
  });

  // Form handlers
  setupTabHandlers();
}

function renderTabContent(): string {
  switch (activeTab) {
    case 'compose':
      return `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <label style="font-size:13px;font-weight:500;color:#374151;">Topic / Instructions</label>
          <textarea id="sb-topic" style="padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;min-height:80px;" placeholder="What should the email be about?"></textarea>
          <label style="font-size:13px;font-weight:500;color:#374151;">Tone</label>
          <select id="sb-tone" style="padding:8px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;">
            <option value="friendly">Friendly</option>
            <option value="formal">Formal</option>
            <option value="casual">Casual</option>
            <option value="excited">Excited</option>
            <option value="thankful">Thankful</option>
            <option value="assertive">Assertive</option>
            <option value="empathetic">Empathetic</option>
          </select>
          <label style="font-size:13px;font-weight:500;color:#374151;">Language</label>
          <select id="sb-lang" style="padding:8px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;">
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
          <button id="sb-generate" style="padding:10px;background:#4F46E5;color:white;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;">Generate Draft</button>
          <div id="sb-result" style="display:none;background:white;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">
            <label style="font-size:12px;font-weight:600;color:#4F46E5;text-transform:uppercase;">Generated Draft</label>
            <div id="sb-draft" style="margin-top:8px;font-size:13px;line-height:1.6;white-space:pre-wrap;"></div>
            <div style="display:flex;gap:8px;margin-top:12px;">
              <button id="sb-copy" style="flex:1;padding:8px;background:#059669;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;">Copy to Clipboard</button>
              <button id="sb-regen" style="flex:1;padding:8px;background:white;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-size:12px;cursor:pointer;">Regenerate</button>
            </div>
          </div>
          <div id="sb-loading" style="display:none;text-align:center;padding:20px;color:#6b7280;">
            <div style="width:24px;height:24px;border:2px solid #e5e7eb;border-top-color:#4F46E5;border-radius:50%;animation:spin 0.6s linear infinite;margin:0 auto 8px;"></div>
            Generating...
          </div>
        </div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
      `;

    case 'summarize':
      return `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <label style="font-size:13px;font-weight:500;color:#374151;">Paste email content to summarize</label>
          <textarea id="sb-email-content" style="padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;min-height:150px;" placeholder="Paste the email content here..."></textarea>
          <button id="sb-summarize" style="padding:10px;background:#4F46E5;color:white;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;">Summarize</button>
          <div id="sb-summary-result" style="display:none;"></div>
          <div id="sb-sum-loading" style="display:none;text-align:center;padding:20px;color:#6b7280;">
            <div style="width:24px;height:24px;border:2px solid #e5e7eb;border-top-color:#4F46E5;border-radius:50%;animation:spin 0.6s linear infinite;margin:0 auto 8px;"></div>
            Summarizing...
          </div>
        </div>
      `;

    case 'reminders':
      return `
        <div id="sb-reminders" style="display:flex;flex-direction:column;gap:8px;">
          <div style="text-align:center;padding:30px;color:#9ca3af;font-size:13px;">Loading reminders...</div>
        </div>
      `;

    case 'settings':
      return `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div>
            <label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:6px;">Default Tone</label>
            <select id="sb-default-tone" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;">
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="casual">Casual</option>
            </select>
          </div>
          <div>
            <label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:6px;">Default Language</label>
            <select id="sb-default-lang" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>
          <div>
            <label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:6px;">Email Signature</label>
            <textarea id="sb-signature" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;resize:vertical;min-height:60px;" placeholder="Your email signature..."></textarea>
          </div>
          <button id="sb-save-settings" style="padding:10px;background:#4F46E5;color:white;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;">Save Settings</button>
          <a href="http://localhost:3000/dashboard" target="_blank" style="text-align:center;color:#4F46E5;font-size:13px;text-decoration:none;">Open Full Dashboard</a>
        </div>
      `;
  }
}

function setupTabHandlers(): void {
  if (activeTab === 'compose') {
    const generateBtn = document.getElementById('sb-generate');
    generateBtn?.addEventListener('click', async () => {
      const topic = (document.getElementById('sb-topic') as HTMLTextAreaElement).value.trim();
      if (!topic) return;

      const tone = (document.getElementById('sb-tone') as HTMLSelectElement).value;
      const lang = (document.getElementById('sb-lang') as HTMLSelectElement).value;
      const loading = document.getElementById('sb-loading')!;
      const result = document.getElementById('sb-result')!;

      generateBtn.style.display = 'none';
      loading.style.display = 'block';
      result.style.display = 'none';

      try {
        const response = await SmartMailAPI.composeDraft({ topic, tone, language: lang !== 'en' ? lang : undefined });
        if (response.success && response.data) {
          document.getElementById('sb-draft')!.textContent = response.data.draft;
          result.style.display = 'block';
        }
      } catch (err: any) {
        document.getElementById('sb-draft')!.textContent = `Error: ${err.message}`;
        result.style.display = 'block';
      } finally {
        loading.style.display = 'none';
        generateBtn.style.display = 'block';
      }
    });

    document.getElementById('sb-copy')?.addEventListener('click', () => {
      const text = document.getElementById('sb-draft')!.textContent || '';
      navigator.clipboard.writeText(text);
    });

    document.getElementById('sb-regen')?.addEventListener('click', () => {
      document.getElementById('sb-generate')?.click();
    });
  }

  if (activeTab === 'summarize') {
    document.getElementById('sb-summarize')?.addEventListener('click', async () => {
      const content = (document.getElementById('sb-email-content') as HTMLTextAreaElement).value.trim();
      if (!content) return;

      const loading = document.getElementById('sb-sum-loading')!;
      const resultEl = document.getElementById('sb-summary-result')!;
      loading.style.display = 'block';
      resultEl.style.display = 'none';

      try {
        const response = await SmartMailAPI.summarizeEmail({ emailContent: content });
        if (response.success && response.data) {
          const d = response.data;
          resultEl.innerHTML = `
            <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-size:13px;line-height:1.6;">
              <h4 style="color:#4F46E5;font-size:12px;text-transform:uppercase;margin-bottom:6px;">Summary</h4>
              <p>${d.summary}</p>
              ${d.keyPoints.length > 0 ? `<h4 style="color:#4F46E5;font-size:12px;text-transform:uppercase;margin:12px 0 6px;">Key Points</h4><ul style="padding-left:16px;">${d.keyPoints.map((p: string) => `<li>${p}</li>`).join('')}</ul>` : ''}
              ${d.actionItems.length > 0 ? `<h4 style="color:#4F46E5;font-size:12px;text-transform:uppercase;margin:12px 0 6px;">Action Items</h4><ul style="padding-left:16px;">${d.actionItems.map((a: string) => `<li>${a}</li>`).join('')}</ul>` : ''}
            </div>
          `;
          resultEl.style.display = 'block';
        }
      } catch (err: any) {
        resultEl.innerHTML = `<p style="color:#dc2626;font-size:13px;">${err.message}</p>`;
        resultEl.style.display = 'block';
      } finally {
        loading.style.display = 'none';
      }
    });
  }

  if (activeTab === 'reminders') {
    loadReminders();
  }

  if (activeTab === 'settings') {
    document.getElementById('sb-save-settings')?.addEventListener('click', async () => {
      const tone = (document.getElementById('sb-default-tone') as HTMLSelectElement).value;
      const lang = (document.getElementById('sb-default-lang') as HTMLSelectElement).value;
      const sig = (document.getElementById('sb-signature') as HTMLTextAreaElement).value;

      try {
        await SmartMailAPI.updateSettings({ defaultTone: tone, language: lang, signature: sig });
        const btn = document.getElementById('sb-save-settings')!;
        btn.textContent = 'Saved!';
        btn.style.background = '#059669';
        setTimeout(() => { btn.textContent = 'Save Settings'; btn.style.background = '#4F46E5'; }, 2000);
      } catch (err: any) {
        alert(`Failed to save: ${err.message}`);
      }
    });
  }
}

async function loadReminders(): Promise<void> {
  const container = document.getElementById('sb-reminders');
  if (!container) return;

  try {
    const response = await SmartMailAPI.getReminders();
    if (response.success && response.data.length > 0) {
      container.innerHTML = response.data.map((r: any) => `
        <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">
          <div style="font-weight:500;font-size:13px;margin-bottom:4px;">${r.subject}</div>
          <div style="font-size:12px;color:#6b7280;">To: ${r.recipientEmail}</div>
          <div style="font-size:12px;color:#6b7280;">Due: ${new Date(r.scheduledAt).toLocaleDateString()}</div>
          <div style="margin-top:6px;">
            <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${r.status === 'PENDING' ? '#dbeafe' : '#fef3c7'};color:${r.status === 'PENDING' ? '#1d4ed8' : '#92400e'};">${r.status}</span>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:#9ca3af;font-size:13px;">No active reminders</div>';
    }
  } catch {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:#dc2626;font-size:13px;">Failed to load reminders</div>';
  }
}

render();
