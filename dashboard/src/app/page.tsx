'use client';

import Link from 'next/link';

const features = [
  { title: 'Smart Compose', desc: 'Generate complete email drafts from a simple topic description with customizable tone and style.', icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z' },
  { title: 'Email Summarization', desc: 'One-click summaries that extract key points, action items, and deadlines from any email.', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { title: 'Tone Adjustment', desc: 'Highlight text and instantly make it more formal, friendly, concise, or translate it.', icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
  { title: 'Knowledge Base', desc: 'Train your assistant with documents, URLs, and text for context-aware email generation.', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { title: 'Multi-Language', desc: 'Compose and reply in 25+ languages with auto-detection of recipient language.', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' },
  { title: 'Follow-Up Reminders', desc: 'Never forget to follow up. Set smart reminders and generate follow-up emails in one click.', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">S</div>
          <span className="font-semibold text-xl text-gray-900">SmartMail AI</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Sign In</Link>
          <Link href="/login" className="text-sm px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">Get Started</Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-20">
        <div className="text-center mb-20 animate-fadeIn">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Your AI-Powered<br />
            <span className="text-primary-600">Email Assistant</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Compose, reply, summarize, and improve emails in seconds. SmartMail AI learns your writing style and works right inside Gmail and Outlook.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/login" className="px-8 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors text-lg">
              Get Started Free
            </Link>
            <a href="#features" className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-lg">
              Learn More
            </a>
          </div>
        </div>

        <div id="features" className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 hover:border-primary-300 hover:shadow-lg transition-all animate-slideUp" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={f.icon} /></svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
