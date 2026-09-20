export type UserRole = 'donor' | 'ngo' | 'admin';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

export interface ChatResponse {
  message: string;
  recommendations: ChatRecommendation[];
}

export interface NgoChatRecommendation {
  type: 'ngo';
  id: string;
  name: string;
  organizationName?: string;
  location: string;
  distanceKm: number;
  acceptedCategories: string[];
  isAcceptingDonations: boolean;
  currentNeedDescription?: string;
}

export interface DonationChatRecommendation {
  type: 'donation';
  id: string;
  foodName: string;
  category: string;
  quantity: string;
  quantityValue?: number;
  quantityUnit?: string;
  location: string;
  distanceKm: number;
  availableUntil: string;
}

export type ChatRecommendation = NgoChatRecommendation | DonationChatRecommendation;

export type DonationStatus = 'available' | 'pending' | 'accepted' | 'completed' | 'expired';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'completed';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export const QUANTITY_UNITS = [
  'servings',
  'kg',
  'g',
  'liters',
  'loaves',
  'boxes',
  'pieces',
  'other',
] as const;

export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  organizationName?: string;
  location?: string;
  status?: 'active' | 'disabled';
  geoLocation?: GeoPoint;
  acceptedCategories?: string[];
  operatingRadiusKm?: number;
  isAcceptingDonations?: boolean;
  currentNeedDescription?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NgoProfile {
  id: string;
  name: string;
  organizationName?: string;
  location: string;
  phone?: string;
  acceptedCategories: string[];
  isAcceptingDonations: boolean;
  currentNeedDescription: string;
  operatingRadiusKm?: number;
  offeredDonations?: Array<{ id: string; foodName: string; category: string; quantity: string; description: string; availableUntil: string; location: string; status: DonationStatus; image?: string }>;
}

export interface NgoBrowseResult extends NgoProfile {
  ngoId: string;
  distanceKm?: number;
}

export interface Donation {
  id: string;
  foodName: string;
  category: string;
  quantity: string;
  quantityValue?: number;
  quantityUnit?: QuantityUnit | string;
  description: string;
  image?: string;
  location: string;
  geoLocation?: GeoPoint;
  availableUntil: string;
  donorId: string;
  donorName: string;
  targetNgoId?: string;
  targetNgoName?: string;
  offerStatus?: RequestStatus;
  status: DonationStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface DonationOffer {
  id: string;
  donorId: string;
  donorName: string;
  ngoId: string;
  ngoName: string;
  targetNgoId?: string;
  targetNgoName?: string;
  foodName: string;
  category: string;
  quantity: string;
  quantityValue?: number;
  quantityUnit?: QuantityUnit | string;
  description: string;
  image?: string;
  location: string;
  geoLocation?: GeoPoint;
  availableUntil: string;
  message?: string;
  status: RequestStatus;
  donorCompletedAt?: string;
  ngoCompletedAt?: string;
  createdAt: string;
  updatedAt?: string;
  direction?: 'donor_offer';
  donation?: Donation;
  contact?: {
    donor?: { name?: string; phone?: string; email?: string };
    ngo?: { name?: string; phone?: string; email?: string; location?: string };
    handoffMessage: string;
  };
}

export interface DonationRequest {
  id: string;
  donationId?: string;
  donorId?: string;
  donorName?: string;
  ngoId: string;
  ngoName: string;
  ngo?: NgoProfile;
  direction?: 'ngo_request' | 'donor_offer';
  message: string;
  status: RequestStatus;
  donorCompletedAt?: string;
  ngoCompletedAt?: string;
  contact?: {
    donor?: { name?: string; phone?: string; email?: string };
    ngo?: { name?: string; phone?: string; email?: string; location?: string };
    handoffMessage: string;
  };
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
  requestId?: string;
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
