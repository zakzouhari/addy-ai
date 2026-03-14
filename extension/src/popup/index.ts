async function init(): Promise<void> {
  const { authToken, user } = await chrome.storage.local.get(['authToken', 'user']);

  const loggedInEl = document.getElementById('logged-in')!;
  const loggedOutEl = document.getElementById('logged-out')!;

  if (authToken && user) {
    loggedInEl.classList.remove('hidden');
    loggedOutEl.classList.add('hidden');

    const avatarEl = document.getElementById('user-avatar') as HTMLImageElement;
    const nameEl = document.getElementById('user-name')!;
    const emailEl = document.getElementById('user-email')!;
    const planEl = document.getElementById('user-plan')!;

    avatarEl.src = user.avatarUrl || '';
    nameEl.textContent = user.name || 'User';
    emailEl.textContent = user.email || '';
    planEl.textContent = user.plan || 'FREE';
    if (user.plan === 'PRO') planEl.classList.add('pro');
  } else {
    loggedInEl.classList.add('hidden');
    loggedOutEl.classList.remove('hidden');
  }

  // Event listeners
  document.getElementById('btn-login')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LOGIN' });
  });

  document.getElementById('btn-sidebar')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.sidePanel.open({ tabId: tab.id });
    }
    window.close();
  });

  document.getElementById('btn-compose')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'OPEN_COMPOSE' });
    }
    window.close();
  });

  const dashboardBtn = document.getElementById('btn-dashboard') as HTMLAnchorElement;
  if (dashboardBtn) {
    dashboardBtn.href = 'http://localhost:3000/dashboard';
  }

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
      location.reload();
    });
  });
}

init();
