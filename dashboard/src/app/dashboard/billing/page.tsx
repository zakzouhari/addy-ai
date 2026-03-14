'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import PlanBadge from '@/components/PlanBadge';

const plans = [
  {
    name: 'Free', price: '$0', period: 'forever', features: [
      '25 emails/month', '3 knowledge documents', 'Basic tone options',
      'Email summarization', 'Follow-up reminders',
    ],
  },
  {
    name: 'Pro', price: '$9.99', period: '/month', featured: true, features: [
      'Unlimited emails', '50 knowledge documents', 'All tone options',
      'Style profile learning', 'Multi-language support', 'Priority AI processing',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise', price: 'Custom', period: '', features: [
      'Everything in Pro', 'Custom API access', 'Team management',
      'SSO integration', 'Dedicated support', 'Custom training',
    ],
  },
];

export default function BillingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await api.createCheckoutSession();
      if (res.success && res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start checkout');
    }
    setLoading(false);
  };

  const handleManage = async () => {
    setLoading(true);
    try {
      const res = await api.createPortalSession();
      if (res.success && res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to open billing portal');
    }
    setLoading(false);
  };

  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your subscription and billing</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Current Plan</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xl font-bold text-gray-900">{user?.plan || 'FREE'}</span>
            <PlanBadge plan={user?.plan || 'FREE'} />
          </div>
        </div>
        {user?.plan === 'PRO' ? (
          <button onClick={handleManage} disabled={loading} className="px-6 py-2.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50">
            Manage Subscription
          </button>
        ) : (
          <button onClick={handleUpgrade} disabled={loading} className="px-6 py-2.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {loading ? 'Loading...' : 'Upgrade to Pro'}
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.name} className={`rounded-xl border p-6 ${plan.featured ? 'border-primary-300 bg-primary-50 ring-2 ring-primary-200' : 'border-gray-200 bg-white'}`}>
            <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
            <div className="mt-2 mb-6">
              <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
              <span className="text-sm text-gray-500">{plan.period}</span>
            </div>
            <ul className="space-y-3">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  {f}
                </li>
              ))}
            </ul>
            {plan.name === 'Pro' && user?.plan !== 'PRO' && (
              <button onClick={handleUpgrade} disabled={loading} className="w-full mt-6 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
                Get Pro
              </button>
            )}
            {plan.name === 'Enterprise' && (
              <a href="mailto:enterprise@smartmail.ai" className="block w-full mt-6 py-2.5 text-center border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                Contact Sales
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
