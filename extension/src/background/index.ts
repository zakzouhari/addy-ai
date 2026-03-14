chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ onboarded: false });
  }

  chrome.contextMenus.create({
    id: 'smartmail-parent',
    title: 'SmartMail AI',
    contexts: ['selection'],
  });

  const menuItems = [
    { id: 'smartmail-formal', title: 'Make more formal' },
    { id: 'smartmail-friendly', title: 'Make friendlier' },
    { id: 'smartmail-grammar', title: 'Fix grammar & spelling' },
    { id: 'smartmail-shorter', title: 'Make shorter' },
    { id: 'smartmail-longer', title: 'Make longer' },
  ];

  menuItems.forEach((item) => {
    chrome.contextMenus.create({
      id: item.id,
      parentId: 'smartmail-parent',
      title: item.title,
      contexts: ['selection'],
    });
  });
});

const ADJUSTMENT_MAP: Record<string, string> = {
  'smartmail-formal': 'more_formal',
  'smartmail-friendly': 'friendlier',
  'smartmail-grammar': 'fix_grammar',
  'smartmail-shorter': 'shorter',
  'smartmail-longer': 'longer',
};

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const adjustment = ADJUSTMENT_MAP[info.menuItemId as string];
  if (adjustment && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'ADJUST_TONE',
      data: { text: info.selectionText, adjustment },
    });
  }
});

// Follow-up reminder alarm
chrome.alarms.create('check-reminders', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'check-reminders') return;

  const { authToken } = await chrome.storage.local.get('authToken');
  if (!authToken) return;

  try {
    const response = await fetch('http://localhost:3001/api/v1/email/follow-up/reminders', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await response.json();
    if (!data.success) return;

    const triggered = (data.data || []).filter((r: any) => r.status === 'TRIGGERED');
    for (const reminder of triggered) {
      chrome.notifications.create(`reminder-${reminder.id}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Follow-up Reminder',
        message: `Time to follow up on: ${reminder.subject}`,
        buttons: [{ title: 'Write Follow-up' }],
      });
    }
  } catch {
    // Silently fail if API is unavailable
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_AUTH_STATUS') {
    chrome.storage.local.get(['authToken', 'user'], (result) => {
      sendResponse({ isLoggedIn: !!result.authToken, user: result.user });
    });
    return true;
  }

  if (message.type === 'LOGIN') {
    chrome.tabs.create({ url: 'http://localhost:3001/api/v1/auth/google' });
    return false;
  }

  if (message.type === 'LOGOUT') {
    chrome.storage.local.remove(['authToken', 'refreshToken', 'user'], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'SAVE_AUTH') {
    chrome.storage.local.set({
      authToken: message.data.accessToken,
      refreshToken: message.data.refreshToken,
      user: message.data.user,
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});
