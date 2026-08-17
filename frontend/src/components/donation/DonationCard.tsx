import { Link } from 'react-router-dom';
import { MapPin, Clock, Package } from 'lucide-react';
import type { Donation } from '@/types';
import StatusBadge from '@/components/common/StatusBadge';

interface DonationCardProps {
  donation: Donation;
  linkTo: string;
  showDonor?: boolean;
  actionLabel?: string;
}

export default function DonationCard({ donation, linkTo, showDonor = false, actionLabel = 'View Details' }: DonationCardProps) {
  return (
    <div className="card overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
        <img src={donation.image} alt={donation.foodName} className="w-full h-full object-cover" />
        <div className="absolute top-3 left-3">
          <StatusBadge status={donation.status} />
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-lg mb-1">{donation.foodName}</h3>
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary-50 text-primary-700">
            {donation.category}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Package className="w-3.5 h-3.5" /> {donation.quantity}
          </span>
        </div>

        <div className="space-y-1.5 mb-4 flex-1">
          <div className="flex items-start gap-1.5 text-sm text-gray-600">
            <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
            <span className="line-clamp-1">{donation.location}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Clock className="w-4 h-4 flex-shrink-0 text-gray-400" />
            <span>Until {new Date(donation.availableUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
          {showDonor && (
            <p className="text-sm text-gray-500">By {donation.donorName}</p>
          )}
        </div>

        <Link to={linkTo} className="btn-secondary w-full">
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}
