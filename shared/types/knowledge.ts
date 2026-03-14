export type DocumentSourceType = 'pdf' | 'url' | 'text';
export type DocumentStatus = 'processing' | 'ready' | 'error';

export interface KnowledgeDocument {
  id: string;
  userId: string;
  title: string;
  sourceType: DocumentSourceType;
  sourceUrl: string | null;
  content: string;
  chunks: KnowledgeChunk[];
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: { page?: number; section?: string };
}

export interface KnowledgeSearchResult {
  chunk: KnowledgeChunk;
  score: number;
  document: KnowledgeDocument;
}

export interface UploadDocumentRequest {
  title: string;
  sourceType: DocumentSourceType;
  content?: string;
  sourceUrl?: string;
}
