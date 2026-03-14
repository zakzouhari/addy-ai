'use client';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: { value: number; isUp: boolean };
  color?: 'indigo' | 'green' | 'amber' | 'rose';
}

const colorMap = {
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600' },
  green: { bg: 'bg-green-50', icon: 'text-green-600' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600' },
  rose: { bg: 'bg-rose-50', icon: 'text-rose-600' },
};

export default function StatsCard({ title, value, icon, trend, color = 'indigo' }: StatsCardProps) {
  const colors = colorMap[color];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 ${trend.isUp ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isUp ? '+' : '-'}{Math.abs(trend.value)}% from last week
            </p>
          )}
        </div>
        <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center`}>
          <svg className={`w-5 h-5 ${colors.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
        </div>
      </div>
    </div>
  );
}
