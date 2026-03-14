import Stripe from 'stripe';
import config from '../config';
import { prisma } from '../config/prisma';
import logger from '../config/logger';

const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2024-04-10' as any });

export class StripeService {
  static async createCustomer(email: string, name: string): Promise<string> {
    const customer = await stripe.customers.create({ email, name });
    return customer.id;
  }

  static async createCheckoutSession(customerId: string, userId: string): Promise<string> {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: config.stripe.proPriceId, quantity: 1 }],
      success_url: `${config.dashboardUrl}/dashboard/billing?success=true`,
      cancel_url: `${config.dashboardUrl}/dashboard/billing?canceled=true`,
      metadata: { userId },
    });
    return session.url || '';
  }

  static async createPortalSession(customerId: string): Promise<string> {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${config.dashboardUrl}/dashboard/billing`,
    });
    return session.url;
  }

  static async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (userId && session.subscription) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: 'PRO',
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
            },
          });
          logger.info(`User ${userId} upgraded to PRO`);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { plan: 'FREE', stripeSubscriptionId: null },
          });
          logger.info(`User ${user.id} downgraded to FREE`);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        logger.warn(`Payment failed for customer ${invoice.customer}`);
        break;
      }
      default:
        logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  static async cancelSubscription(subscriptionId: string): Promise<void> {
    await stripe.subscriptions.cancel(subscriptionId);
  }

  static verifyWebhookSignature(body: string | Buffer, signature: string): Stripe.Event {
    return stripe.webhooks.constructEvent(body, signature, config.stripe.webhookSecret);
  }
}
