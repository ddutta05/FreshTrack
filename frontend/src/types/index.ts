export type UserRole = 'donor' | 'ngo' | 'admin';

export type DonationStatus = 'available' | 'pending' | 'accepted' | 'completed' | 'expired';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'completed';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  organizationName?: string;
  status?: 'active' | 'disabled';
  createdAt?: string;
}

export interface Donation {
  id: string;
  foodName: string;
  category: string;
  quantity: string;
  description: string;
  image: string;
  location: string;
  availableUntil: string;
  donorId: string;
  donorName: string;
  status: DonationStatus;
  createdAt: string;
}

export interface DonationRequest {
  id: string;
  donationId: string;
  ngoId: string;
  ngoName: string;
  message: string;
  status: RequestStatus;
  createdAt: string;
  donation?: Donation;
}

export interface Notification {
  id: string;
  type: 'request_received' | 'request_accepted' | 'request_rejected' | 'donation_completed' | 'donation_expired';
  message: string;
  read: boolean;
  createdAt: string;
  donationId?: string;
}

export const FOOD_CATEGORIES = [
  'Cooked Food',
  'Rice',
  'Vegetables',
  'Bakery',
  'Fruits',
  'Other',
] as const;

export const DONATION_STATUSES: Record<DonationStatus, { label: string; color: string }> = {
  available: { label: 'Available', color: 'green' },
  pending: { label: 'Request Pending', color: 'amber' },
  accepted: { label: 'Accepted', color: 'blue' },
  completed: { label: 'Completed', color: 'gray' },
  expired: { label: 'Expired', color: 'red' },
};

export const REQUEST_STATUSES: Record<RequestStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'amber' },
  accepted: { label: 'Accepted', color: 'blue' },
  rejected: { label: 'Rejected', color: 'red' },
  completed: { label: 'Completed', color: 'gray' },
};
