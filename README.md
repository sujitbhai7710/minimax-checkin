# MiniMax Auto Check-in System

A comprehensive system for automatically checking in to MiniMax accounts daily to earn free credits.

## Features

- **Automatic Daily Check-in**: Cron job runs every 30 minutes starting from 5:30 AM IST
- **Multi-Account Support**: Add and manage multiple MiniMax accounts
- **Credit Tracking**: Real-time credit balance updates and history
- **Detailed Logging**: Comprehensive logs for all operations
- **Secure Storage**: Cookies are encrypted before storage
- **Modern UI**: Responsive dashboard with dark theme

## Architecture

```
├── frontend/          # React + Vite frontend for Netlify
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components
│   │   ├── store/        # Zustand state management
│   │   ├── utils/        # API utilities
│   │   └── types/        # TypeScript types
│   └── ...
│
├── worker/            # Cloudflare Worker backend
│   ├── src/
│   │   ├── routes/       # API route handlers
│   │   ├── utils/        # Utility functions
│   │   └── types/        # TypeScript types
│   ├── schema.sql        # D1 database schema
│   └── ...
│
└── README.md
```

## Deployment Guide

### Prerequisites

1. Cloudflare account
2. Netlify account
3. Node.js 20+
4. Wrangler CLI (`npm install -g wrangler`)

### Step 1: Deploy Cloudflare Worker

```bash
cd worker

# Install dependencies
npm install

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create minimax-checkin-db

# Note the database ID and update wrangler.toml

# Create KV namespace
wrangler kv:namespace create KV

# Note the KV ID and update wrangler.toml

# Set secrets
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY

# Initialize database
wrangler d1 execute minimax-checkin-db --file=./schema.sql

# Deploy
npm run deploy
```

### Step 2: Deploy Frontend to Netlify

1. Push code to GitHub
2. Connect repository to Netlify
3. Set build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Base directory: `frontend`
4. Add environment variable:
   - `VITE_API_URL` = Your Cloudflare Worker URL
5. Update `netlify.toml` with your Worker URL

### Step 3: Configure CORS

Update the Worker's CORS settings to allow requests from your Netlify domain.

## How It Works

### Check-in Schedule

- Cron runs every 30 minutes
- Starting from 5:30 AM IST
- Processes one account per run
- Sequential processing to avoid rate limits

### Example Timeline

```
5:30 AM - Account 1 check-in
6:00 AM - Account 2 check-in
6:30 AM - Account 3 check-in
...
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Accounts

- `GET /api/accounts` - List all accounts
- `POST /api/accounts` - Add new account
- `GET /api/accounts/:id` - Get account details
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account
- `POST /api/accounts/:id/checkin` - Manual check-in
- `POST /api/accounts/:id/refresh` - Refresh credits

### Admin

- `GET /api/admin/logs` - Get system logs
- `GET /api/admin/status` - Get system status
- `GET /api/admin/summary/:date` - Get daily summary
- `POST /api/admin/trigger-cron` - Manually trigger cron

## Security

- Cookies are encrypted using AES-GCM
- Passwords are hashed using SHA-256
- JWT tokens for authentication
- HTTPS enforced

## Development

```bash
# Worker development
cd worker
npm run dev

# Frontend development
cd frontend
npm run dev
```

## License

MIT
