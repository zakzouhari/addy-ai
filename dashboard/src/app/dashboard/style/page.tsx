'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

interface StyleProfile {
  formality: number;
  averageSentenceLength: number;
  vocabularyLevel: string;
  commonPhrases: string[];
  greetingStyle: string;
  closingStyle: string;
  useEmojis: boolean;
  analyzedEmailCount?: number;
}

export default function StylePage() {
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    api.getStyleProfile().then((res) => {
      if (res.success && res.data) setProfile(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleReanalyze = async () => {
    setAnalyzing(true);
    try {
      await api.reanalyzeStyle();
      const res = await api.getStyleProfile();
      if (res.success && res.data) setProfile(res.data);
      toast.success('Style profile updated');
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    }
    setAnalyzing(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    try {
      await api.updateStyleProfile(profile);
      toast.success('Style profile saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!profile) {
    return (
      <div className="animate-fadeIn text-center py-20">
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">No Style Profile Yet</h2>
        <p className="text-sm text-gray-500 mb-6">Analyze your sent emails to create a writing style profile</p>
        <button onClick={handleReanalyze} disabled={analyzing} className="px-6 py-2.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {analyzing ? 'Analyzing...' : 'Analyze from Gmail'}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Style Profile</h1>
          <p className="text-gray-500 text-sm mt-1">Your learned writing patterns</p>
        </div>
        <button onClick={handleReanalyze} disabled={analyzing} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50">
          {analyzing ? 'Analyzing...' : 'Re-analyze'}
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Formality Level</h3>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">Casual</span>
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${profile.formality * 100}%` }} />
            </div>
            <span className="text-xs text-gray-500">Formal</span>
            <span className="text-sm font-bold text-primary-600">{Math.round(profile.formality * 100)}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Vocabulary Level</h3>
            <p className="text-lg font-bold text-gray-900 capitalize">{profile.vocabularyLevel}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Avg. Sentence Length</h3>
            <p className="text-lg font-bold text-gray-900">{profile.averageSentenceLength} words</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Greeting & Closing</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Greeting Style</label>
              <input value={profile.greetingStyle} onChange={(e) => setProfile({ ...profile, greetingStyle: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Closing Style</label>
              <input value={profile.closingStyle} onChange={(e) => setProfile({ ...profile, closingStyle: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Common Phrases</h3>
          <div className="flex flex-wrap gap-2">
            {profile.commonPhrases.map((phrase, i) => (
              <span key={i} className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">{phrase}</span>
            ))}
            {profile.commonPhrases.length === 0 && <p className="text-sm text-gray-400">No common phrases detected yet</p>}
          </div>
        </div>

        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-6">
          <div>
            <p className="text-sm font-medium text-gray-700">Uses Emojis</p>
            <p className="text-xs text-gray-500">Include emojis in generated emails</p>
          </div>
          <button onClick={() => setProfile({ ...profile, useEmojis: !profile.useEmojis })} className={`relative w-11 h-6 rounded-full transition-colors ${profile.useEmojis ? 'bg-primary-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${profile.useEmojis ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        <button onClick={handleSave} className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
          Save Changes
        </button>
      </div>
    </div>
  );
}
