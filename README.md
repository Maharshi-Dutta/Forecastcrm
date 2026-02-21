# ForecastCRM - AI Revenue Forecasting Platform

An AI-powered CRM that tracks leads/deals and provides:
- Deal close probability prediction
- Monthly revenue forecasting
- Next best action recommendations
- Auto-generated follow-up emails & call note summaries

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Recharts
- **Backend**: Next.js API Routes
- **Database**: MongoDB
- **AI**: Mock AI mode (deterministic outputs) — can be upgraded to Claude API

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB running locally (default: `mongodb://localhost:27017`)
- Yarn package manager

### Setup

```bash
# Clone the repo
git clone https://github.com/Maharshi-Dutta/Forecastcrm.git
cd Forecastcrm

# Install dependencies
yarn install

# Copy environment variables
cp .env.example .env
# Edit .env if needed (defaults work for local MongoDB)

# Start the dev server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Load Demo Data

1. On the login page, click **"Load Demo Data"**
2. This seeds the database with sample users, accounts, deals, and activities

### Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@forecastcrm.com` | `password123` | ADMIN (sees everything) |
| `manager@forecastcrm.com` | `password123` | MANAGER (sees team data) |
| `rep@forecastcrm.com` | `password123` | REP (sees own data) |

## Features

### Dashboard
- KPI cards: total pipeline, won revenue, win rate, active deals
- Pipeline by stage bar chart
- Monthly won revenue area chart
- Recent activities feed

### Deal Pipeline
- Kanban board with drag-and-drop between stages
- List view with sortable columns
- Stages: PROSPECTING → QUALIFIED → PROPOSAL → NEGOTIATION → WON / LOST
- Won/Lost deal sections

### AI Insights (per deal)
- **Close Probability**: Rule-based model (stage + activity count + deal attributes)
- **Risk Factors**: Identifies issues like low engagement, stalled deals, large deal size
- **Next Best Actions**: 4 stage-specific recommendations
- **Email Draft**: Auto-generated follow-up email with copy-to-clipboard
- **Deal Summary**: Contextual summary of deal status

### Revenue Forecasting
- 6-month forward forecast using weighted pipeline + historical trend
- Optimistic / pessimistic confidence bounds
- Historical vs predicted revenue chart
- Monthly breakdown table with confidence percentages

### Accounts & Contacts
- Account CRUD with search
- Contact management per account
- Deal association

### Role-Based Access Control (RBAC)
- **ADMIN**: Full access to all data and settings
- **MANAGER**: Access to team data, can retrain models
- **REP**: Access to own data only

### Settings
- AI mode indicator (mock/live)
- Model version tracking
- ML model retrain trigger

### User Management (Admin only)
- View all users
- Edit roles and team assignments

## API Endpoints

All endpoints are prefixed with `/api`:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/seed` | No | Seed demo data |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/register` | No | Register |
| GET | `/api/auth/me` | Yes | Current user |
| GET | `/api/dashboard/stats` | Yes | Dashboard KPIs |
| GET/POST | `/api/accounts` | Yes | List/Create accounts |
| GET/PUT/DELETE | `/api/accounts/:id` | Yes | Account CRUD |
| GET/POST | `/api/deals` | Yes | List/Create deals |
| GET/PUT/DELETE | `/api/deals/:id` | Yes | Deal CRUD |
| PUT | `/api/deals/:id/stage` | Yes | Move deal stage |
| GET/POST | `/api/deals/:id/activities` | Yes | Deal activities |
| POST | `/api/deals/:id/insights` | Yes | Generate AI insights |
| GET | `/api/forecast` | Yes | Revenue forecast |
| POST | `/api/ml/retrain` | Yes | Retrain ML model |
| GET | `/api/admin/users` | Yes | List users (admin/manager) |
| PUT | `/api/admin/users/:id` | Yes | Update user (admin only) |

## Project Structure

```
├── app/
│   ├── api/[[...path]]/route.js   # All backend API routes
│   ├── page.js                     # Complete frontend app
│   ├── layout.js                   # Root layout
│   └── globals.css                 # Global styles
├── components/ui/                  # shadcn/ui components
├── lib/
│   ├── db.js                       # MongoDB connection
│   └── utils.js                    # Utility functions
├── .env.example                    # Environment template
├── package.json
└── README.md
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `DB_NAME` | `forecastcrm` | Database name |
| `JWT_SECRET` | (auto-generated) | Secret for JWT tokens |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | App base URL |

## License

MIT
