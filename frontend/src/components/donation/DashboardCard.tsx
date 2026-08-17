import type { ReactNode } from 'react';

interface DashboardCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  color?: 'primary' | 'blue' | 'amber' | 'gray' | 'red';
}

const colorClasses: Record<string, string> = {
  primary: 'bg-primary-50 text-primary-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  gray: 'bg-gray-100 text-gray-600',
  red: 'bg-red-50 text-red-600',
};

export default function DashboardCard({ icon, label, value, color = 'primary' }: DashboardCardProps) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClasses[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
