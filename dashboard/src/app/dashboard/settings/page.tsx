'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const TONES = ['friendly', 'formal', 'casual', 'excited', 'thankful', 'assertive', 'empathetic'];
const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' }, { code: 'it', name: 'Italian' }, { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' }, { code: 'ko', name: 'Korean' }, { code: 'zh-CN', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' }, { code: 'ru', name: 'Russian' }, { code: 'nl', name: 'Dutch' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    defaultTone: 'friendly',
    language: 'en',
    signature: '',
    followUpDefaultDays: 3,
    knowledgeBaseEnabled: true,
    autoDetectLanguage: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.settings) {
      setSettings((prev) => ({ ...prev, ...user.settings }));
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <div className="animate-fadeIn max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure your SmartMail AI preferences</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Default Tone</label>
          <select value={settings.defaultTone} onChange={(e) => setSettings({ ...settings, defaultTone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none capitalize">
            {TONES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Default Language</label>
          <select value={settings.language} onChange={(e) => setSettings({ ...settings, language: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email Signature</label>
          <textarea value={settings.signature} onChange={(e) => setSettings({ ...settings, signature: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-vertical focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="Best regards,&#10;Your Name" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Default Follow-Up Timeframe</label>
          <select value={settings.followUpDefaultDays} onChange={(e) => setSettings({ ...settings, followUpDefaultDays: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>1 week</option>
            <option value={14}>2 weeks</option>
            <option value={30}>1 month</option>
          </select>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Auto-detect recipient language</p>
            <p className="text-xs text-gray-500">Automatically detect and offer to reply in the recipient&apos;s language</p>
          </div>
          <button onClick={() => setSettings({ ...settings, autoDetectLanguage: !settings.autoDetectLanguage })} className={`relative w-11 h-6 rounded-full transition-colors ${settings.autoDetectLanguage ? 'bg-primary-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.autoDetectLanguage ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Knowledge Base integration</p>
            <p className="text-xs text-gray-500">Include relevant knowledge base context when composing emails</p>
          </div>
          <button onClick={() => setSettings({ ...settings, knowledgeBaseEnabled: !settings.knowledgeBaseEnabled })} className={`relative w-11 h-6 rounded-full transition-colors ${settings.knowledgeBaseEnabled ? 'bg-primary-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.knowledgeBaseEnabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        <button onClick={handleSave} disabled={saving} className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {user && (
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Connected Accounts</h2>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            {user.avatarUrl && <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />}
            <div>
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <span className="ml-auto text-xs text-green-600 font-medium">Connected</span>
          </div>
        </div>
      )}
    </div>
  );
}
