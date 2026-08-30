import { USE_MOCK_DATA, api, API_ENDPOINTS } from './api';
import { mockUsers, mockDonations, mockRequests, mockNotifications } from '@/data/mockData';
import type { User, Donation, DonationRequest, Notification, UserRole } from '@/types';

// Simulate network delay
const delay = (ms: number = 400) => new Promise((resolve) => setTimeout(resolve, ms));

const unwrap = <T,>(payload: any): T => {
  if (payload?.data?.items) return payload.data.items as T;
  if (payload?.data !== undefined) return payload.data as T;
  return payload as T;
};

// ===== AUTH =====
export const authService = {
  async login(email: string, password: string, role: UserRole): Promise<User> {
    if (USE_MOCK_DATA) {
      await delay();
      const user = mockUsers.find((u) => u.email === email && u.role === role && u.status !== 'disabled');
      if (!user) throw new Error('Invalid credentials. Please check your email, password, and role.');
      localStorage.setItem('freshtrack_token', `mock-token-${user.id}`);
      localStorage.setItem('freshtrack_user', JSON.stringify(user));
      return user;
    }
    const { data } = await api.post(API_ENDPOINTS.auth.login, { email, password, role });
    const result = unwrap<{ token: string; user: User }>(data);
    localStorage.setItem('freshtrack_token', result.token);
    localStorage.setItem('freshtrack_user', JSON.stringify(result.user));
    return result.user;
  },

  async register(payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
    organizationName?: string;
  }): Promise<User> {
    if (USE_MOCK_DATA) {
      await delay();
      if (mockUsers.some((u) => u.email === payload.email)) {
        throw new Error('An account with this email already exists.');
      }
      const newUser: User = {
        id: `u${Date.now()}`,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        phone: payload.phone,
        organizationName: payload.organizationName,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      mockUsers.push(newUser);
      localStorage.setItem('freshtrack_token', `mock-token-${newUser.id}`);
      localStorage.setItem('freshtrack_user', JSON.stringify(newUser));
      return newUser;
    }
    const { data } = await api.post(API_ENDPOINTS.auth.register, payload);
    const result = unwrap<{ token: string; user: User }>(data);
    localStorage.setItem('freshtrack_token', result.token);
    localStorage.setItem('freshtrack_user', JSON.stringify(result.user));
    return result.user;
  },

  logout(): void {
    localStorage.removeItem('freshtrack_token');
    localStorage.removeItem('freshtrack_user');
  },

  getCurrentUser(): User | null {
    const stored = localStorage.getItem('freshtrack_user');
    return stored ? JSON.parse(stored) : null;
  },
};

// ===== DONATIONS =====
export const donationService = {
  async getAll(): Promise<Donation[]> {
    if (USE_MOCK_DATA) {
      await delay();
      return [...mockDonations];
    }
    const { data } = await api.get(API_ENDPOINTS.donations.list);
    return unwrap<Donation[]>(data);
  },

  async getById(id: string): Promise<Donation> {
    if (USE_MOCK_DATA) {
      await delay();
      const donation = mockDonations.find((d) => d.id === id);
      if (!donation) throw new Error('Donation not found');
      return donation;
    }
    const { data } = await api.get(API_ENDPOINTS.donations.get(id));
    return unwrap<Donation>(data);
  },

  async getByDonor(donorId: string): Promise<Donation[]> {
    if (USE_MOCK_DATA) {
      await delay();
      return mockDonations.filter((d) => d.donorId === donorId);
    }
    const { data } = await api.get(API_ENDPOINTS.donations.myDonations);
    return unwrap<Donation[]>(data);
  },

  async create(payload: Omit<Donation, 'id' | 'donorId' | 'donorName' | 'status' | 'createdAt'>, donor: User): Promise<Donation> {
    if (USE_MOCK_DATA) {
      await delay(600);
      const newDonation: Donation = {
        ...payload,
        id: `d${Date.now()}`,
        donorId: donor.id,
        donorName: donor.name,
        status: 'available',
        createdAt: new Date().toISOString(),
      };
      mockDonations.unshift(newDonation);
      return newDonation;
    }
    const { data } = await api.post(API_ENDPOINTS.donations.create, payload);
    return unwrap<Donation>(data);
  },

  async updateStatus(id: string, status: Donation['status']): Promise<Donation> {
    if (USE_MOCK_DATA) {
      await delay();
      const donation = mockDonations.find((d) => d.id === id);
      if (!donation) throw new Error('Donation not found');
      donation.status = status;
      return donation;
    }
    const { data } = await api.put(API_ENDPOINTS.donations.update(id), { status });
    return unwrap<Donation>(data);
  },

  async remove(id: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await delay();
      const idx = mockDonations.findIndex((d) => d.id === id);
      if (idx !== -1) mockDonations.splice(idx, 1);
      return;
    }
    await api.delete(API_ENDPOINTS.donations.remove(id));
  },
};

// ===== REQUESTS =====
export const requestService = {
  async getByDonation(donationId: string): Promise<DonationRequest[]> {
    if (USE_MOCK_DATA) {
      await delay();
      return mockRequests.filter((r) => r.donationId === donationId);
    }
    const { data } = await api.get(`${API_ENDPOINTS.requests.list}?donationId=${donationId}`);
    return unwrap<DonationRequest[]>(data);
  },

  async getByNGO(ngoId: string): Promise<DonationRequest[]> {
    if (USE_MOCK_DATA) {
      await delay();
      const requests = mockRequests.filter((r) => r.ngoId === ngoId);
      return requests.map((r) => ({
        ...r,
        donation: mockDonations.find((d) => d.id === r.donationId),
      }));
    }
    const { data } = await api.get(API_ENDPOINTS.requests.myRequests);
    return unwrap<DonationRequest[]>(data);
  },

  async create(payload: { donationId: string; ngoId: string; ngoName: string; message: string }): Promise<DonationRequest> {
    if (USE_MOCK_DATA) {
      await delay(500);
      const newRequest: DonationRequest = {
        id: `r${Date.now()}`,
        donationId: payload.donationId,
        ngoId: payload.ngoId,
        ngoName: payload.ngoName,
        message: payload.message,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      mockRequests.push(newRequest);
      // Update donation status to pending
      const donation = mockDonations.find((d) => d.id === payload.donationId);
      if (donation && donation.status === 'available') {
        donation.status = 'pending';
      }
      return newRequest;
    }
    const { data } = await api.post(API_ENDPOINTS.requests.create, payload);
    return unwrap<DonationRequest>(data);
  },

  async accept(id: string): Promise<DonationRequest> {
    if (USE_MOCK_DATA) {
      await delay();
      const request = mockRequests.find((r) => r.id === id);
      if (!request) throw new Error('Request not found');
      request.status = 'accepted';
      // Update donation status
      const donation = mockDonations.find((d) => d.id === request.donationId);
      if (donation) donation.status = 'accepted';
      // Reject other pending requests for same donation
      mockRequests
        .filter((r) => r.donationId === request.donationId && r.id !== id && r.status === 'pending')
        .forEach((r) => (r.status = 'rejected'));
      return request;
    }
    const { data } = await api.post(API_ENDPOINTS.requests.accept(id));
    return unwrap<DonationRequest>(data);
  },

  async reject(id: string): Promise<DonationRequest> {
    if (USE_MOCK_DATA) {
      await delay();
      const request = mockRequests.find((r) => r.id === id);
      if (!request) throw new Error('Request not found');
      request.status = 'rejected';
      // If no more pending requests, set donation back to available
      const remaining = mockRequests.filter((r) => r.donationId === request.donationId && r.status === 'pending');
      if (remaining.length === 0) {
        const donation = mockDonations.find((d) => d.id === request.donationId);
        if (donation && donation.status === 'pending') donation.status = 'available';
      }
      return request;
    }
    const { data } = await api.post(API_ENDPOINTS.requests.reject(id));
    return unwrap<DonationRequest>(data);
  },

  async complete(id: string): Promise<DonationRequest> {
    if (USE_MOCK_DATA) {
      await delay();
      const request = mockRequests.find((r) => r.id === id);
      if (!request) throw new Error('Request not found');
      request.status = 'completed';
      // Mark donation as completed
      const donation = mockDonations.find((d) => d.id === request.donationId);
      if (donation) donation.status = 'completed';
      return request;
    }
    const { data } = await api.post(API_ENDPOINTS.requests.complete(id));
    return unwrap<DonationRequest>(data);
  },
};

// ===== USERS =====
export const userService = {
  async getAll(): Promise<User[]> {
    if (USE_MOCK_DATA) {
      await delay();
      return [...mockUsers];
    }
    const { data } = await api.get(API_ENDPOINTS.users.list);
    return unwrap<User[]>(data);
  },

  async getById(id: string): Promise<User> {
    if (USE_MOCK_DATA) {
      await delay();
      const user = mockUsers.find((u) => u.id === id);
      if (!user) throw new Error('User not found');
      return user;
    }
    const { data } = await api.get(API_ENDPOINTS.users.get(id));
    return unwrap<User>(data);
  },

  async update(id: string, payload: Partial<User>): Promise<User> {
    if (USE_MOCK_DATA) {
      await delay();
      const user = mockUsers.find((u) => u.id === id);
      if (!user) throw new Error('User not found');
      Object.assign(user, payload);
      localStorage.setItem('freshtrack_user', JSON.stringify(user));
      return user;
    }
    const { data } = await api.put(API_ENDPOINTS.users.update(id), payload);
    return unwrap<User>(data);
  },

  async disable(id: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await delay();
      const user = mockUsers.find((u) => u.id === id);
      if (user) user.status = user.status === 'active' ? 'disabled' : 'active';
      return;
    }
    await api.post(API_ENDPOINTS.users.disable(id));
  },

  async enable(id: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await delay();
      const user = mockUsers.find((u) => u.id === id);
      if (user) user.status = 'active';
      return;
    }
    await api.post(API_ENDPOINTS.users.enable(id));
  },
};

// ===== NOTIFICATIONS =====
export const notificationService = {
  async getAll(userId: string): Promise<Notification[]> {
    if (USE_MOCK_DATA) {
      await delay(200);
      return [...mockNotifications];
    }
    const { data } = await api.get('/notifications');
    return unwrap<Notification[]>(data);
  },

  async markRead(id: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await delay(100);
      const notif = mockNotifications.find((n) => n.id === id);
      if (notif) notif.read = true;
      return;
    }
    await api.post(`/notifications/${id}/read`);
  },
};
