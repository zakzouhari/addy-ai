import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { StripeService } from '../services/stripe';
import logger from '../config/logger';

const router = Router();

router.post('/checkout', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      customerId = await StripeService.createCustomer(user.email, user.name);
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    const url = await StripeService.createCheckoutSession(customerId, user.id);
    res.json({ success: true, data: { url } });
  } catch (err) {
    logger.error('Checkout error:', err);
    res.status(500).json({ success: false, error: { code: 'CHECKOUT_FAILED', message: 'Failed to create checkout session' } });
  }
});

router.post('/portal', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.stripeCustomerId) {
      res.status(400).json({ success: false, error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription' } });
      return;
    }
    const url = await StripeService.createPortalSession(user.stripeCustomerId);
    res.json({ success: true, data: { url } });
  } catch (err) {
    logger.error('Portal error:', err);
    res.status(500).json({ success: false, error: { code: 'PORTAL_FAILED', message: 'Failed to create portal session' } });
  }
});

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      res.status(400).json({ success: false, error: { code: 'MISSING_SIGNATURE', message: 'Missing Stripe signature' } });
      return;
    }
    const event = StripeService.verifyWebhookSignature(req.body, signature);
    await StripeService.handleWebhook(event);
    res.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook error:', err);
    res.status(400).json({ success: false, error: { code: 'WEBHOOK_FAILED', message: 'Webhook verification failed' } });
  }
});

router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { plan: true, stripeSubscriptionId: true, stripeCustomerId: true },
    });
    res.json({
      success: true,
      data: {
        plan: user?.plan || 'FREE',
        hasSubscription: !!user?.stripeSubscriptionId,
      },
    });
  } catch (err) {
    logger.error('Billing status error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get billing status' } });
  }
});

export default router;
