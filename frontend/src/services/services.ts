import { api, API_ENDPOINTS, clearAuthStorage } from './api';
import type { User, Donation, DonationRequest, DonationOffer, Notification, UserRole, DonationStatus, GeoPoint, ChatRequest, ChatResponse, NgoProfile, NgoBrowseResult } from '@/types';

export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  location?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  availability?: 'requestable';
  donationId?: string;
}

export interface CreateDonationPayload {
  foodName: string;
  category: string;
  quantity: string;
  quantityValue?: number;
  quantityUnit?: string;
  description: string;
  location: string;
  geoLocation?: GeoPoint | null;
  availableUntil: string;
  imageFile?: File;
  targetNgoId?: string;
  offerMessage?: string;
}

export interface UpdateProfilePayload {
  name?: string;
  phone?: string;
  organizationName?: string;
  location?: string;
  geoLocation?: GeoPoint | null;
  acceptedCategories?: string[];
  operatingRadiusKm?: number | null;
  isAcceptingDonations?: boolean;
  currentNeedDescription?: string;
}

export interface PlatformStats {
  totalUsers: number;
  totalDonors: number;
  totalNgos: number;
  totalDonations: number;
  availableDonations: number;
  pendingDonations: number;
  acceptedDonations: number;
  completedDonations: number;
  expiredDonations: number;
  totalRequests: number;
  pendingRequests: number;
  acceptedRequests: number;
  rejectedRequests: number;
  completedRequests: number;
}

export interface ImpactStats {
  foodDonations: number;
  ngosConnected: number;
  mealsRedistributed: number;
}

const unwrap = <T,>(payload: unknown): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const wrapped = payload as {
      data?: unknown | { items?: unknown };
    };

    if (wrapped.data && typeof wrapped.data === 'object' && 'items' in wrapped.data) {
      return (wrapped.data as { items: T }).items;
    }

    if (wrapped.data !== undefined) {
      return wrapped.data as T;
    }
  }

  return payload as T;
};

const withQuery = (path: string, query?: ListQuery) => {
  if (!query) return path;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

// ===== AUTH =====
export const authService = {
  async login(email: string, password: string, role: UserRole, rememberMe = false): Promise<User> {
    const { data } = await api.post(API_ENDPOINTS.auth.login, { email, password, role });
    const result = unwrap<{ token: string; user: User }>(data);
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('freshtrack_token', result.token);
    storage.setItem('freshtrack_user', JSON.stringify(result.user));
    return result.user;
  },

  async register(payload: {
    name?: string;
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
    organizationName?: string;
    location?: string;
    geoLocation?: GeoPoint;
    acceptedCategories?: string[];
  }): Promise<User> {
    const { data } = await api.post(API_ENDPOINTS.auth.register, payload);
    const result = unwrap<{ token: string; user: User }>(data);
    localStorage.setItem('freshtrack_token', result.token);
    localStorage.setItem('freshtrack_user', JSON.stringify(result.user));
    return result.user;
  },

  async me(): Promise<User> {
    const { data } = await api.get(API_ENDPOINTS.auth.me);
    return unwrap<User>(data);
  },

  logout(): void {
    clearAuthStorage();
  },

  getCurrentUser(): User | null {
    const stored = localStorage.getItem('freshtrack_user') || sessionStorage.getItem('freshtrack_user');
    return stored ? JSON.parse(stored) : null;
  },
};

// ===== DONATIONS =====
export const donationService = {
  async getAll(query?: ListQuery): Promise<Donation[]> {
    const { data } = await api.get(withQuery(API_ENDPOINTS.donations.list, query));
    return unwrap<Donation[]>(data);
  },

  async getImpactStats(): Promise<ImpactStats> {
    const { data } = await api.get(API_ENDPOINTS.donations.impactStats);
    return unwrap<ImpactStats>(data);
  },

  async getById(id: string): Promise<Donation> {
    const { data } = await api.get(API_ENDPOINTS.donations.get(id));
    return unwrap<Donation>(data);
  },

  async getByDonor(_donorId: string, query?: ListQuery): Promise<Donation[]> {
    const { data } = await api.get(withQuery(API_ENDPOINTS.donations.myDonations, query));
    return unwrap<Donation[]>(data);
  },

  async create(payload: CreateDonationPayload): Promise<Donation> {
    const formData = new FormData();
    formData.append('foodName', payload.foodName);
    formData.append('category', payload.category);
    formData.append('quantity', payload.quantity);
    if (payload.quantityValue !== undefined && payload.quantityValue !== null) {
      formData.append('quantityValue', String(payload.quantityValue));
    }
    if (payload.quantityUnit) {
      formData.append('quantityUnit', payload.quantityUnit);
    }
    formData.append('description', payload.description);
    formData.append('location', payload.location);
    if (payload.geoLocation) {
      formData.append('geoLocation', JSON.stringify(payload.geoLocation));
    }
    formData.append('availableUntil', payload.availableUntil);
    if (payload.imageFile) {
      formData.append('image', payload.imageFile);
    }
    if (payload.targetNgoId) formData.append('targetNgoId', payload.targetNgoId);
    if (payload.offerMessage) formData.append('offerMessage', payload.offerMessage);

    const { data } = await api.post(API_ENDPOINTS.donations.create, formData);
    return unwrap<Donation>(data);
  },

  async update(id: string, payload: Partial<Donation> & { imageFile?: File }): Promise<Donation> {
    if (payload.imageFile) {
      const formData = new FormData();
      Object.entries(payload).forEach(([key, val]) => {
        if (key === 'imageFile' && val instanceof File) {
          formData.append('image', val);
        } else if (key === 'geoLocation' && val && typeof val === 'object') {
          formData.append('geoLocation', JSON.stringify(val));
        } else if (val !== undefined && val !== null) {
          formData.append(key, String(val));
        }
      });
      const { data } = await api.put(API_ENDPOINTS.donations.update(id), formData);
      return unwrap<Donation>(data);
    }
    const { data } = await api.put(API_ENDPOINTS.donations.update(id), payload);
    return unwrap<Donation>(data);
  },

  async updateStatus(id: string, status: DonationStatus): Promise<Donation> {
    const { data } = await api.put(API_ENDPOINTS.donations.update(id), { status });
    return unwrap<Donation>(data);
  },

  async remove(id: string): Promise<void> {
    await api.delete(API_ENDPOINTS.donations.remove(id));
  },
};

// ===== REQUESTS =====
export const requestService = {
  async getByDonation(donationId: string, query?: Omit<ListQuery, 'donationId'>): Promise<DonationRequest[]> {
    const { data } = await api.get(withQuery(API_ENDPOINTS.requests.list, { ...query, donationId }));
    return unwrap<DonationRequest[]>(data);
  },

  async getByNGO(_ngoId: string, query?: ListQuery): Promise<DonationRequest[]> {
    const { data } = await api.get(withQuery(API_ENDPOINTS.requests.myRequests, query));
    return unwrap<DonationRequest[]>(data);
  },

  async getAll(query?: ListQuery): Promise<DonationRequest[]> {
    const { data } = await api.get(withQuery(API_ENDPOINTS.requests.list, query));
    return unwrap<DonationRequest[]>(data);
  },

  async getById(id: string): Promise<DonationRequest> {
    const { data } = await api.get(API_ENDPOINTS.requests.get(id));
    return unwrap<DonationRequest>(data);
  },

  async create(payload: { donationId?: string; ngoId?: string; foodName?: string; category?: string; quantity?: string; message?: string }): Promise<DonationRequest> {
    const { data } = await api.post(API_ENDPOINTS.requests.create, payload);
    return unwrap<DonationRequest>(data);
  },

  async accept(id: string): Promise<DonationRequest> {
    const { data } = await api.put(API_ENDPOINTS.requests.accept(id));
    return unwrap<DonationRequest>(data);
  },

  async reject(id: string): Promise<DonationRequest> {
    const { data } = await api.put(API_ENDPOINTS.requests.reject(id));
    return unwrap<DonationRequest>(data);
  },

  async complete(id: string): Promise<DonationRequest> {
    const { data } = await api.put(API_ENDPOINTS.requests.complete(id));
    return unwrap<DonationRequest>(data);
  },
};

// ===== OFFERS =====
export const offerService = {
  async getAll(query?: ListQuery): Promise<DonationOffer[]> {
    const { data } = await api.get(withQuery(API_ENDPOINTS.offers.list, query));
    return unwrap<DonationOffer[]>(data);
  },

  async getMine(query?: ListQuery): Promise<DonationOffer[]> {
    const { data } = await api.get(withQuery(API_ENDPOINTS.offers.mine, query));
    return unwrap<DonationOffer[]>(data);
  },

  async getReceived(query?: ListQuery): Promise<DonationOffer[]> {
    const { data } = await api.get(withQuery(API_ENDPOINTS.offers.received, query));
    return unwrap<DonationOffer[]>(data);
  },

  async getById(id: string): Promise<DonationOffer> {
    const { data } = await api.get(API_ENDPOINTS.offers.get(id));
    return unwrap<DonationOffer>(data);
  },

  async create(payload: {
    ngoId: string;
    foodName: string;
    category: string;
    quantity: string;
    quantityValue?: number;
    quantityUnit?: string;
    description: string;
    location: string;
    geoLocation?: GeoPoint | null;
    availableUntil: string;
    imageFile?: File;
    message?: string;
  }): Promise<DonationOffer> {
    const formData = new FormData();
    formData.append('ngoId', payload.ngoId);
    formData.append('foodName', payload.foodName);
    formData.append('category', payload.category);
    formData.append('quantity', payload.quantity);
    if (payload.quantityValue !== undefined && payload.quantityValue !== null) {
      formData.append('quantityValue', String(payload.quantityValue));
    }
    if (payload.quantityUnit) {
      formData.append('quantityUnit', payload.quantityUnit);
    }
    formData.append('description', payload.description);
    formData.append('location', payload.location);
    if (payload.geoLocation) {
      formData.append('geoLocation', JSON.stringify(payload.geoLocation));
    }
    formData.append('availableUntil', payload.availableUntil);
    if (payload.imageFile) {
      formData.append('image', payload.imageFile);
    }
    if (payload.message) {
      formData.append('message', payload.message);
    }

    const { data } = await api.post(API_ENDPOINTS.offers.create, formData);
    return unwrap<DonationOffer>(data);
  },

  async accept(id: string): Promise<DonationOffer> {
    const { data } = await api.put(API_ENDPOINTS.offers.accept(id));
    return unwrap<DonationOffer>(data);
  },

  async reject(id: string): Promise<DonationOffer> {
    const { data } = await api.put(API_ENDPOINTS.offers.reject(id));
    return unwrap<DonationOffer>(data);
  },

  async complete(id: string): Promise<DonationOffer> {
    const { data } = await api.put(API_ENDPOINTS.offers.complete(id));
    return unwrap<DonationOffer>(data);
  },
};

export const recommendationService = {
  async browseNgos(query?: { category?: string; maxDistanceKm?: number }): Promise<NgoBrowseResult[]> {
    const params = new URLSearchParams();
    if (query?.category) params.set('category', query.category);
    if (query?.maxDistanceKm !== undefined) params.set('maxDistanceKm', String(query.maxDistanceKm));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const { data } = await api.get(`${API_ENDPOINTS.recommendations.ngosBrowse}${suffix}`);
    return unwrap<NgoBrowseResult[]>(data);
  },
};

// ===== USERS =====
export const userService = {
  async getMe(): Promise<User> {
    const { data } = await api.get('/users/me');
    return unwrap<User>(data);
  },

  async updateMe(payload: UpdateProfilePayload): Promise<User> {
    const { data } = await api.put('/users/me', payload);
    return unwrap<User>(data);
  },

  async getAll(query?: ListQuery): Promise<User[]> {
    const { data } = await api.get(withQuery(API_ENDPOINTS.users.list, query));
    return unwrap<User[]>(data);
  },

  async getById(id: string): Promise<User> {
    const { data } = await api.get(API_ENDPOINTS.users.get(id));
    return unwrap<User>(data);
  },

  async getNgoProfile(id: string): Promise<NgoProfile> {
    const { data } = await api.get(API_ENDPOINTS.users.ngo(id));
    return unwrap<NgoProfile>(data);
  },

  async update(id: string, payload: Partial<User>): Promise<User> {
    const { data } = await api.put(API_ENDPOINTS.users.update(id), payload);
    return unwrap<User>(data);
  },

  async disable(id: string): Promise<User> {
    const { data } = await api.put(API_ENDPOINTS.users.disable(id));
    return unwrap<User>(data);
  },

  async enable(id: string): Promise<User> {
    const { data } = await api.put(API_ENDPOINTS.users.enable(id));
    return unwrap<User>(data);
  },
};

// ===== NOTIFICATIONS =====
export const notificationService = {
  async getAll(query?: ListQuery): Promise<Notification[]> {
    const { data } = await api.get(withQuery(API_ENDPOINTS.notifications.list, query));
    return unwrap<Notification[]>(data);
  },

  async getUnreadCount(): Promise<number> {
    const { data } = await api.get(API_ENDPOINTS.notifications.unreadCount);
    return unwrap<{ unreadCount: number }>(data).unreadCount;
  },

  async markRead(id: string): Promise<Notification> {
    const { data } = await api.put(API_ENDPOINTS.notifications.markRead(id));
    return unwrap<Notification>(data);
  },

  async markAllRead(): Promise<void> {
    await api.put(API_ENDPOINTS.notifications.markAllRead);
  },
};

// ===== ADMIN =====
export const adminService = {
  async getStats(): Promise<PlatformStats> {
    const { data } = await api.get(API_ENDPOINTS.admin.stats);
    return unwrap<PlatformStats>(data);
  },

  async getDonations(query?: ListQuery): Promise<Donation[]> {
    const { data } = await api.get(withQuery(API_ENDPOINTS.admin.donations, query));
    return unwrap<Donation[]>(data);
  },
};

// ===== AI =====
export const aiService = {
  async chat(payload: ChatRequest): Promise<ChatResponse> {
    const { data } = await api.post(API_ENDPOINTS.ai.chat, payload);
    return unwrap<ChatResponse>(data);
  },
};
