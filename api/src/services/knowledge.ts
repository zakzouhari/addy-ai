import { prisma } from '../config/prisma';
import config from '../config';
import logger from '../config/logger';

export class KnowledgeService {
  static async processDocument(documentId: string, content: string): Promise<void> {
    try {
      const chunks = KnowledgeService.chunkText(content);
      const embeddings = await KnowledgeService.generateEmbeddings(chunks);

      for (let i = 0; i < chunks.length; i++) {
        const embeddingVector = `[${embeddings[i].join(',')}]`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO "KnowledgeChunk" (id, "documentId", content, embedding, metadata, "createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3::vector, $4::jsonb, NOW())`,
          documentId,
          chunks[i],
          embeddingVector,
          JSON.stringify({ section: `chunk_${i + 1}` })
        );
      }

      await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: 'READY' },
      });

      logger.info(`Processed document ${documentId}: ${chunks.length} chunks created`);
    } catch (err) {
      logger.error(`Failed to process document ${documentId}:`, err);
      await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: 'ERROR' },
      });
    }
  }

  static chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];

    if (words.length <= chunkSize) {
      return [text.trim()];
    }

    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ').trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      if (i + chunkSize >= words.length) break;
    }

    return chunks;
  }

  static async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const batchSize = 8;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.voyage.apiKey}`,
        },
        body: JSON.stringify({
          input: batch,
          model: 'voyage-2',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Voyage AI API error: ${response.status} ${errText}`);
      }

      const data = await response.json() as { data: { embedding: number[] }[] };
      for (const item of data.data) {
        allEmbeddings.push(item.embedding);
      }
    }

    return allEmbeddings;
  }

  static async searchKnowledge(
    userId: string,
    query: string,
    topK: number = 5
  ): Promise<{ content: string; score: number; title: string }[]> {
    const queryEmbedding = await KnowledgeService.generateEmbeddings([query]);
    const embeddingVector = `[${queryEmbedding[0].join(',')}]`;

    const results = await prisma.$queryRawUnsafe<
      { content: string; score: number; title: string }[]
    >(
      `SELECT kc.content, 1 - (kc.embedding <=> $1::vector) as score, kd.title
       FROM "KnowledgeChunk" kc
       JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
       WHERE kd."userId" = $2 AND kd.status = 'READY' AND kc.embedding IS NOT NULL
       ORDER BY kc.embedding <=> $1::vector
       LIMIT $3`,
      embeddingVector,
      userId,
      topK
    );

    return results;
  }

  static async extractPdfText(buffer: Buffer): Promise<string> {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text;
  }

  static async extractUrlText(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }
    const html = await response.text();
    // Basic HTML-to-text extraction
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
