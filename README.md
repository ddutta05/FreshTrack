# FreshTrack — Food Donation Platform

**Good Food Should Never Go to Waste**

FreshTrack is a modern web application that connects surplus food from restaurants, events, and individuals with nearby NGOs and charitable organizations that can collect and distribute it to people in need.

![React](https://img.shields.io/badge/React-18.3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![Vite](https://img.shields.io/badge/Vite-5.4-purple)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-teal)

---

## 🎯 Overview

FreshTrack is a full-stack food donation platform designed to reduce food waste and help communities in need. The platform facilitates connections between:

- **Donors**: Individuals and businesses with surplus food
- **NGOs**: Charitable organizations that can collect and distribute food
- **Admins**: Platform administrators managing users and donations

The application features role-based access control, real-time notifications, and a user-friendly interface built with React and TypeScript.

---

## ✨ Features

### For Donors
- 🎁 Post surplus food donations with details (quantity, category, expiry time)
- 📍 Specify location and pickup details
- 📸 Add images to donations
- 📊 Track donation status in real-time
- 📋 View all posted donations
- 🔔 Receive notifications when NGOs express interest

### For NGOs
- 🔍 Browse available food donations
- 📍 Search by location and category
- 📝 Request food donations from donors
- 📊 Track request status (pending, accepted, rejected, completed)
- 🎯 Manage multiple food requests
- 🔔 Get notifications when requests are accepted/rejected

### For Admins
- 👥 Manage all users on the platform
- 🚫 Disable/enable user accounts
- 📊 View all donations and their status
- 📈 Monitor platform activity

### General Features
- 🔐 Secure authentication with JWT tokens
- 🎨 Responsive design (mobile, tablet, desktop)
- 🌙 Modern, clean UI with Tailwind CSS
- ⚡ Fast performance with Vite
- 📱 Real-time notifications
- 🔄 Mock API for development/testing

---

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/              # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── Textarea.tsx
│   │   │   └── ProtectedRoute.tsx  # Route protection with role-based access
│   │   ├── donation/            # Donation-related components
│   │   │   ├── DashboardCard.tsx
│   │   │   └── DonationCard.tsx
│   │   └── layout/              # Layout components
│   │       ├── DashboardLayout.tsx
│   │       ├── Footer.tsx
│   │       ├── Navbar.tsx
│   │       └── NotificationDropdown.tsx
│   ├── context/                 # React Context for state management
│   │   ├── AuthContext.tsx      # Authentication state
│   │   └── ToastContext.tsx     # Toast notifications
│   ├── pages/                   # Page components organized by role
│   │   ├── ProfilePage.tsx
│   │   ├── public/
│   │   │   ├── LandingPage.tsx
│   │   │   └── AboutPage.tsx
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── donor/
│   │   │   ├── DonorDashboard.tsx
│   │   │   ├── CreateDonation.tsx
│   │   │   ├── MyDonations.tsx
│   │   │   └── DonationDetails.tsx
│   │   ├── ngo/
│   │   │   ├── NgoDashboard.tsx
│   │   │   ├── AvailableFood.tsx
│   │   │   ├── FoodDetails.tsx
│   │   │   └── MyRequests.tsx
│   │   └── admin/
│   │       ├── AdminDashboard.tsx
│   │       ├── AdminUsers.tsx
│   │       └── AdminDonations.tsx
│   ├── services/                # API and business logic
│   │   ├── api.ts              # Axios configuration and endpoints
│   │   └── services.ts         # Service layer (auth, donations, requests)
│   ├── types/                   # TypeScript type definitions
│   │   └── index.ts
│   ├── data/                    # Mock data for development
│   │   └── mockData.ts
│   ├── context/                 # Global state management
│   │   ├── AuthContext.tsx
│   │   └── ToastContext.tsx
│   ├── App.tsx                  # Main app component with routing
│   ├── main.tsx                 # App entry point
│   └── index.css                # Global styles
├── public/
│── index.html                   # HTML template
├── package.json                 # Dependencies and scripts
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── postcss.config.js           # PostCSS configuration
└── eslint.config.js            # ESLint configuration
```

---

## 🛠️ Tech Stack

### Frontend
- **React 18.3** - UI framework
- **TypeScript 5.5** - Type-safe JavaScript
- **Vite 5.4** - Build tool and dev server
- **React Router v7** - Client-side routing
- **TailwindCSS 3.4** - Utility-first CSS framework
- **Lucide React** - Icon library
- **Axios** - HTTP client for API calls
- **Supabase JS** - Backend integration (optional)

### Development Tools
- **ESLint** - Code linting
- **TypeScript** - Static type checking
- **PostCSS** - CSS transformations
- **Autoprefixer** - CSS vendor prefixes

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the `frontend` directory:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`

---

## 📝 Available Scripts

### Development
```bash
npm run dev
```
Start the Vite development server with hot module replacement (HMR).

### Build
```bash
npm run build
```
Create an optimized production build in the `dist` directory.

### Preview
```bash
npm run preview
```
Preview the production build locally.

### Lint
```bash
npm run lint
```
Run ESLint to check code quality and style compliance.

### Type Check
```bash
npm run typecheck
```
Run TypeScript type checking without emitting files.

---

## 🔐 Authentication & Authorization

### User Roles

1. **Donor**
   - Can post surplus food donations
   - View their posted donations
   - Receive requests from NGOs
   - Accept or reject requests

2. **NGO**
   - Browse available donations
   - Request donations from donors
   - Track request status
   - View accepted donations

3. **Admin**
   - Manage all platform users
   - Disable/enable user accounts
   - Monitor all donations
   - View platform statistics

### Authentication Flow
- Users register with email, password, and role
- Login with email, password, and role selection
- JWT token stored in localStorage
- Token automatically attached to API requests
- ProtectedRoute component restricts access based on roles

---

## 📡 API Integration

### API Endpoints

**Authentication**
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /auth/me` - Get current user

**Donations**
- `GET /donations` - List all donations
- `GET /donations/:id` - Get donation details
- `GET /donations/mine` - Get user's donations
- `POST /donations` - Create new donation
- `PUT /donations/:id` - Update donation
- `DELETE /donations/:id` - Delete donation

**Requests**
- `GET /requests` - List all requests
- `POST /requests` - Create donation request
- `GET /requests/mine` - Get user's requests
- `PUT /requests/:id/accept` - Accept request
- `PUT /requests/:id/reject` - Reject request
- `PUT /requests/:id/complete` - Mark as completed

**Users**
- `GET /users` - List all users (admin only)
- `GET /users/:id` - Get user details
- `PUT /users/:id` - Update user
- `PUT /users/:id/disable` - Disable user account

### Mock Data
The application includes mock data for development. To use real API endpoints, set `USE_MOCK_DATA = false` in [api.ts](frontend/src/services/api.ts).

---

## 🔄 Data Types

### User
```typescript
{
  id: string;
  name: string;
  email: string;
  role: 'donor' | 'ngo' | 'admin';
  phone?: string;
  organizationName?: string;
  status: 'active' | 'disabled';
  createdAt?: string;
}
```

### Donation
```typescript
{
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
  status: 'available' | 'pending' | 'accepted' | 'completed' | 'expired';
  createdAt: string;
}
```

### DonationRequest
```typescript
{
  id: string;
  donationId: string;
  ngoId: string;
  ngoName: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  createdAt: string;
  donation?: Donation;
}
```

### Notification
```typescript
{
  id: string;
  type: 'request_received' | 'request_accepted' | 'request_rejected' | 'donation_completed' | 'donation_expired';
  message: string;
  read: boolean;
  createdAt: string;
  donationId?: string;
}
```

---

## 🎨 Styling

The project uses **TailwindCSS** for styling with a custom color palette:

### Color Scheme
- **Primary**: Green shades (representing fresh, natural, and sustainability)
- **Secondary**: Gray shades (neutral and professional)
- **Status Colors**:
  - Green: Available
  - Amber: Pending
  - Blue: Accepted
  - Red: Expired/Rejected
  - Gray: Completed

### Responsive Design
- Mobile-first approach
- Breakpoints: `sm`, `md`, `lg`, `xl`, `2xl`
- Flexible grid and flex layouts

---

## 🔄 State Management

### Context API
The app uses React Context for global state:

1. **AuthContext** - User authentication and profile
2. **ToastContext** - Toast notifications

### Local Storage
- `freshtrack_token` - JWT authentication token
- `freshtrack_user` - Cached user data

---

## 🚦 Routing

### Public Routes
- `/` - Landing page
- `/about` - About page
- `/login` - Login page
- `/register` - Registration page

### Protected Routes (Donor)
- `/dashboard` - Donor dashboard
- `/create-donation` - Create new donation
- `/my-donations` - View user's donations
- `/donations/:id` - Donation details

### Protected Routes (NGO)
- `/dashboard` - NGO dashboard
- `/available-food` - Browse available donations
- `/food/:id` - Food details
- `/my-requests` - Manage donation requests

### Protected Routes (Admin)
- `/dashboard` - Admin dashboard
- `/admin/users` - Manage users
- `/admin/donations` - Manage donations

### Shared Routes
- `/profile` - User profile (all authenticated users)

---

## 📊 Key Features Explained

### Donation Lifecycle
1. **Donor posts** a donation with details and photo
2. **NGO browses** available donations
3. **NGO sends** a request for the donation
4. **Donor receives** notification and reviews request
5. **Donor accepts/rejects** the request
6. **NGO receives** notification of status
7. **NGO collects** the food
8. **Donation marked** as completed

### Notifications
- Real-time notifications in dropdown menu
- Tracks: requests, acceptances, rejections, and completions
- Mark as read functionality
- Persistent notification history

### Role-Based Access
- ProtectedRoute component validates user role
- Automatic redirect for unauthorized access
- Navbar updates based on user role
- Admin-only pages and features

---

## 🐛 Troubleshooting

### Common Issues

**Port already in use**
```bash
# Change Vite port
npm run dev -- --port 3000
```

**Mock data not loading**
Ensure `USE_MOCK_DATA = true` in [api.ts](frontend/src/services/api.ts)

**TypeScript errors**
```bash
npm run typecheck
```

**Build size too large**
```bash
npm run build -- --analyze
```

---

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- Built with [React](https://react.dev)
- Styled with [Tailwind CSS](https://tailwindcss.com)
- Icons from [Lucide React](https://lucide.dev)
- Photo from [Pexels](https://pexels.com)
- Built with [Vite](https://vitejs.dev)

---

## 📞 Support

For questions or issues, please open an issue on the GitHub repository or contact the development team.

---

**Last Updated**: August 30, 2026
