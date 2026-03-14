'use client';

import { useState } from 'react';

interface Doc {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  createdAt: string;
}

interface DocumentListProps {
  documents: Doc[];
  onDelete: (id: string) => void;
}

const statusColors: Record<string, string> = {
  READY: 'bg-green-100 text-green-800',
  PROCESSING: 'bg-yellow-100 text-yellow-800',
  ERROR: 'bg-red-100 text-red-800',
};

const typeIcons: Record<string, string> = {
  PDF: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  URL: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  TEXT: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
};

export default function DocumentList({ documents, onDelete }: DocumentListProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
        <p className="text-gray-500 text-sm">No documents uploaded yet</p>
        <p className="text-gray-400 text-xs mt-1">Upload PDFs, paste URLs, or add text to train your assistant</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={typeIcons[doc.sourceType] || typeIcons.TEXT} /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
            <p className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[doc.status] || 'bg-gray-100 text-gray-600'}`}>
            {doc.status}
          </span>
          {confirmId === doc.id ? (
            <div className="flex gap-1">
              <button onClick={() => { onDelete(doc.id); setConfirmId(null); }} className="text-xs px-2 py-1 bg-red-600 text-white rounded">Confirm</button>
              <button onClick={() => setConfirmId(null)} className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmId(doc.id)} className="text-gray-400 hover:text-red-500 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
