# FreshTrack

FreshTrack is a food donation platform that connects donors with NGOs and helps redistribute surplus food before it goes to waste.

## Features

- Donor accounts for posting surplus food listings
- NGO accounts for discovering and requesting food
- Donation workflow with create, request, accept, reject, and completion states
- Direct DonationOffer workflow for matched donor/NGO offers
- Contact and handoff coordination after acceptance
- Location-aware discovery and profile data
- Real-time notifications through Socket.IO
- AI assistant for food donation guidance and recommendations
- Image uploads with validation, resizing, and compression
- Admin management for users and platform activity

## Roles

### Donor
- create food donations
- manage donation listings
- view incoming requests
- send direct offers to NGOs
- confirm completion when both parties have finished the handoff

### NGO
- browse available donations
- request food from donors
- receive direct offers from donors
- accept, reject, and complete flows
- manage request history

### Admin
- view platform statistics
- manage users
- inspect donation data

## Architecture

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Auth: JWT
- Real-time: Socket.IO
- AI: Groq

## Repository structure

```text
FreshTrack/
├── backend/
│   ├── src/
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   └── README.md
├── frontend/
│   ├── src/
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
├── .gitignore
├── README.md
└── .github/ (if present)
```

## Local setup

### 1) Install backend dependencies

```bash
cd backend
npm install
```

### 2) Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 3) Create environment files

Backend example:

```bash
cp .env.example .env
```

Frontend example:

```bash
cp .env.example .env
```

Use production-safe values in `.env`. Do not commit real secrets.

### 4) Start the backend

```bash
cd backend
npm run dev
```

Backend local URL:

```text
http://localhost:5000
```

### 5) Start the frontend

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Frontend local URL:

```text
http://localhost:5173
```

## Required environment variables

### Backend

```env
PORT=5000
NODE_ENV=development
MONGODB_USERNAME=your_mongodb_username
MONGODB_PASSWORD=your_mongodb_password
MONGODB_CLUSTER=your-cluster-host.mongodb.net
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-host>/<database>?retryWrites=true&w=majority
MONGODB_DB_NAME=freshtrack
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,https://your-render-frontend.onrender.com
ADMIN_NAME=FreshTrack Admin
ADMIN_EMAIL=admin@freshtrack.local
ADMIN_PASSWORD=replace_with_secure_admin_password
MAX_FILE_SIZE_MB=5
EXPIRY_SWEEP_INTERVAL_MS=60000
GROQ_API_KEY=replace_with_groq_api_key
```

### Frontend

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## Database

FreshTrack uses MongoDB Atlas for persistent data storage. The backend reads the application database URI from `MONGODB_URI` and the database name from `MONGODB_DB_NAME`.

## Image storage

Images are validated, resized, compressed, and stored in MongoDB as data URLs rather than as files on the server filesystem. Legacy `/uploads/...` paths are still normalized when present in older records.

## AI assistant

The backend AI assistant uses the Groq SDK. The API key must be kept server-side and must not be exposed to the frontend.

## Deployment

This project is prepared for Render deployment with the following structure:

- Frontend: Render Static Site
- Backend: Render Web Service
- Database: MongoDB Atlas

Typical configuration:

- Frontend root: `frontend/`
- Backend root: `backend/`
- Frontend build command: `npm run build`
- Frontend publish directory: `dist`
- Backend start command: `npm run start`
- Frontend SPA rewrite: rewrite all unknown paths to `index.html`

## Known limitations

- Render free backend services may sleep after inactivity.
- Image payloads are intentionally constrained to keep responses lightweight and storage manageable.
- Local development still uses a local Atlas-backed database configuration.

## Validation

```bash
cd backend
npm test -- --runInBand

cd ../frontend
npm run typecheck
npm run build
```

## License

This project is for university coursework and demo use.


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
