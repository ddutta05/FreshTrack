# FreshTrack Backend

Production-ready backend for FreshTrack (food donation platform).

## Stack
- Node.js + Express
- MongoDB + Mongoose
- JWT auth
- bcryptjs password hashing
- express-validator validation
- multer image upload
- Socket.IO real-time notifications

## Setup
1. Install dependencies:
   npm install
2. Create .env from .env.example
3. Start dev server:
   npm run dev

## Environment Variables
- PORT=5000
- NODE_ENV=development
- MONGODB_URI=mongodb://127.0.0.1:27017/freshtrack
- JWT_SECRET=replace-with-strong-secret
- JWT_EXPIRES_IN=7d
- CLIENT_URL=http://localhost:5173
- ADMIN_NAME=...
- ADMIN_EMAIL=...
- ADMIN_PASSWORD=...
- MAX_FILE_SIZE_MB=5
- EXPIRY_SWEEP_INTERVAL_MS=60000

## Scripts
- npm run dev
- npm start
- npm test
- npm run seed:admin
- npm run seed

## API Base URL
- http://localhost:5000/api

## Auth
Use Bearer token:
Authorization: Bearer <jwt>

## Roles
- donor
- ngo
- admin

## Response Format
Success:
{
  "success": true,
  "message": "...",
  "data": {}
}

Error:
{
  "success": false,
  "message": "...",
  "error": { "code": "..." }
}

## Endpoint Summary
| Module | Method | Path | Description |
|---|---|---|---|
| Health | GET | /health | API and DB status |
| Auth | POST | /auth/register | Public donor/ngo registration |
| Auth | POST | /auth/login | Login |
| Auth | GET | /auth/me | Current user |
| Users | GET | /users/me | Get profile |
| Users | PUT | /users/me | Update profile |
| Users (admin) | GET | /users | List users |
| Users (admin) | GET | /users/:id | User details |
| Users | PUT | /users/:id | Self update or admin update |
| Users (admin) | PUT/POST | /users/:id/disable | Disable/toggle user |
| Users (admin) | PUT/POST | /users/:id/enable | Enable user |
| Donations | GET | /donations | List/search/filter donations |
| Donations | GET | /donations/:id | Donation details |
| Donations | GET | /donations/mine | Donor own donations |
| Donations | POST | /donations | Create donation (donor) |
| Donations | PUT | /donations/:id | Update donation owner/admin |
| Donations | DELETE | /donations/:id | Delete donation owner/admin |
| Requests | GET | /requests | List requests (scope by role) |
| Requests | POST | /requests | Create request (ngo) |
| Requests | GET | /requests/mine | NGO own requests |
| Requests | GET | /requests/:id | Request details |
| Requests | PUT/POST | /requests/:id/accept | Accept request (own donor) |
| Requests | PUT/POST | /requests/:id/reject | Reject request (own donor) |
| Requests | PUT/POST | /requests/:id/complete | Complete request (own donor/ngo) |
| Notifications | GET | /notifications | User notifications |
| Notifications | GET | /notifications/unread-count | Unread count |
| Notifications | PUT/POST | /notifications/:id/read | Mark one read |
| Notifications | PUT/POST | /notifications/read-all | Mark all read |
| Admin | GET | /admin/donations | All donations |
| Admin | GET | /admin/stats | Platform statistics |

## Image Upload
- Endpoint: POST /donations (multipart/form-data)
- Field: image
- Supported mimes: jpeg, png, webp, gif
- Files are stored in /uploads and served from /uploads/<file>

## Socket.IO
- Connect with JWT in auth token:
  io(url, { auth: { token } })
- Event emitted by backend:
  notification:new

## Seed
Admin from env:
- npm run seed:admin

Development sample data:
- npm run seed
- Includes users, donations, requests, notifications

## Test
- npm test
- Uses mongodb-memory-server replica set for transaction coverage
