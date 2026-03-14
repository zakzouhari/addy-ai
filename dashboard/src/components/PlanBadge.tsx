'use client';

const planStyles: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-700',
  PRO: 'bg-amber-100 text-amber-800',
  ENTERPRISE: 'bg-purple-100 text-purple-800',
};

export default function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase ${planStyles[plan] || planStyles.FREE}`}>
      {plan}
    </span>
  );
}
