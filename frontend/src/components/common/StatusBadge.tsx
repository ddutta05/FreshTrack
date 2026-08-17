import type { DonationStatus, RequestStatus } from '@/types';
import { DONATION_STATUSES, REQUEST_STATUSES } from '@/types';

const colorClasses: Record<string, string> = {
  green: 'bg-primary-100 text-primary-700 border-primary-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
  red: 'bg-red-100 text-red-700 border-red-200',
};

interface StatusBadgeProps {
  status: DonationStatus | RequestStatus;
  type?: 'donation' | 'request';
}

export default function StatusBadge({ status, type = 'donation' }: StatusBadgeProps) {
  const config = type === 'donation' ? DONATION_STATUSES[status as DonationStatus] : REQUEST_STATUSES[status as RequestStatus];
  if (!config) return null;

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${colorClasses[config.color]}`}>
      {config.label}
    </span>
  );
}
