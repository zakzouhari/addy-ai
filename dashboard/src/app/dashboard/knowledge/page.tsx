'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import DocumentList from '@/components/DocumentList';

export default function KnowledgePage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const [activeUpload, setActiveUpload] = useState<'pdf' | 'url' | 'text'>('text');

  const maxDocs = user?.plan === 'PRO' ? 50 : 3;

  const loadDocs = useCallback(async () => {
    try {
      const res = await api.getKnowledgeDocs();
      if (res.success) setDocuments(res.data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setUploading(true);
    try {
      // For PDF, we need to send as text (PDF parsing happens on server)
      // In a real app, use multipart form upload. Here we read as text.
      const text = await file.text();
      await api.uploadDocument({ title: file.name, sourceType: 'text', content: text });
      toast.success('Document uploaded successfully');
      loadDocs();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(false);
  }, [loadDocs]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    maxFiles: 1,
  });

  const handleTextUpload = async () => {
    if (!textTitle.trim() || !textContent.trim()) return;
    setUploading(true);
    try {
      await api.uploadDocument({ title: textTitle, sourceType: 'text', content: textContent });
      toast.success('Document uploaded');
      setTextTitle('');
      setTextContent('');
      loadDocs();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  const handleUrlUpload = async () => {
    if (!urlTitle.trim() || !urlValue.trim()) return;
    setUploading(true);
    try {
      await api.uploadDocument({ title: urlTitle, sourceType: 'url', sourceUrl: urlValue });
      toast.success('URL document added');
      setUrlTitle('');
      setUrlValue('');
      loadDocs();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDocument(id);
      toast.success('Document deleted');
      loadDocs();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        <p className="text-gray-500 text-sm mt-1">Train your AI assistant with custom documents and data</p>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-6 text-sm text-primary-700">
        {documents.length} of {maxDocs} documents used ({user?.plan || 'FREE'} plan)
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex gap-2 mb-4">
          {(['text', 'url', 'pdf'] as const).map((type) => (
            <button key={type} onClick={() => setActiveUpload(type)} className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${activeUpload === type ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {type.toUpperCase()}
            </button>
          ))}
        </div>

        {activeUpload === 'text' && (
          <div className="space-y-3">
            <input type="text" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} placeholder="Document title" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            <textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} placeholder="Paste your text content here..." rows={6} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-vertical focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            <button onClick={handleTextUpload} disabled={uploading} className="px-6 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {uploading ? 'Uploading...' : 'Upload Text'}
            </button>
          </div>
        )}

        {activeUpload === 'url' && (
          <div className="space-y-3">
            <input type="text" value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)} placeholder="Document title" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            <input type="url" value={urlValue} onChange={(e) => setUrlValue(e.target.value)} placeholder="https://example.com/page" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            <button onClick={handleUrlUpload} disabled={uploading} className="px-6 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {uploading ? 'Processing...' : 'Add URL'}
            </button>
          </div>
        )}

        {activeUpload === 'pdf' && (
          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'}`}>
            <input {...getInputProps()} />
            <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            <p className="text-sm text-gray-600">{isDragActive ? 'Drop the file here' : 'Drag & drop a PDF or text file, or click to browse'}</p>
            <p className="text-xs text-gray-400 mt-1">Maximum file size: 10MB</p>
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Documents</h2>
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : (
        <DocumentList documents={documents} onDelete={handleDelete} />
      )}
    </div>
  );
}
