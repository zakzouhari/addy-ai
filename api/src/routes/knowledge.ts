import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { KnowledgeService } from '../services/knowledge';
import logger from '../config/logger';
// Plan limits
const MAX_FREE_DOCS = 3;
const MAX_PRO_DOCS = 50;

const router = Router();
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const uploadSchema = z.object({
  title: z.string().min(1).max(200),
  sourceType: z.enum(['pdf', 'url', 'text']),
  content: z.string().max(500000).optional(),
  sourceUrl: z.string().url().optional(),
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const data = uploadSchema.parse(req.body);
    const userId = req.user!.id;

    // Check plan limits
    const docCount = await prisma.knowledgeDocument.count({ where: { userId } });
    const maxDocs = req.user!.plan === 'FREE' ? 3 : 50;
    if (docCount >= maxDocs) {
      res.status(403).json({
        success: false,
        error: { code: 'LIMIT_REACHED', message: `You have reached the maximum of ${maxDocs} documents for your plan` },
      });
      return;
    }

    let content = data.content || '';

    if (data.sourceType === 'pdf' && req.file) {
      content = await KnowledgeService.extractPdfText(req.file.buffer);
    } else if (data.sourceType === 'url' && data.sourceUrl) {
      content = await KnowledgeService.extractUrlText(data.sourceUrl);
    }

    if (!content.trim()) {
      res.status(400).json({ success: false, error: { code: 'EMPTY_CONTENT', message: 'Document has no extractable content' } });
      return;
    }

    const doc = await prisma.knowledgeDocument.create({
      data: {
        userId,
        title: data.title,
        sourceType: data.sourceType.toUpperCase() as 'PDF' | 'URL' | 'TEXT',
        sourceUrl: data.sourceUrl,
        content,
        status: 'PROCESSING',
      },
    });

    // Process asynchronously
    KnowledgeService.processDocument(doc.id, content).catch((err) => {
      logger.error(`Async document processing failed for ${doc.id}:`, err);
    });

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.errors } });
      return;
    }
    logger.error('Knowledge upload error:', err);
    res.status(500).json({ success: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload document' } });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const docs = await prisma.knowledgeDocument.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, sourceType: true, sourceUrl: true, status: true, createdAt: true, updatedAt: true },
    });
    res.json({ success: true, data: docs });
  } catch (err) {
    logger.error('Knowledge list error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list documents' } });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await prisma.knowledgeDocument.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { chunks: { select: { id: true, content: true, metadata: true } } },
    });
    if (!doc) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } });
      return;
    }
    res.json({ success: true, data: doc });
  } catch (err) {
    logger.error('Knowledge get error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get document' } });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await prisma.knowledgeDocument.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!doc) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } });
      return;
    }
    await prisma.knowledgeDocument.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: 'Document deleted' } });
  } catch (err) {
    logger.error('Knowledge delete error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete document' } });
  }
});

const searchSchema = z.object({
  query: z.string().min(1).max(1000),
  topK: z.number().min(1).max(20).optional(),
});

router.post('/search', async (req: Request, res: Response) => {
  try {
    const data = searchSchema.parse(req.body);
    const results = await KnowledgeService.searchKnowledge(req.user!.id, data.query, data.topK);
    res.json({ success: true, data: results });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.errors } });
      return;
    }
    logger.error('Knowledge search error:', err);
    res.status(500).json({ success: false, error: { code: 'SEARCH_FAILED', message: 'Failed to search knowledge base' } });
  }
});

export default router;
