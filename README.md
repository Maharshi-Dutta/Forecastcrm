Screenshots are live. Here's the complete README — **copy-paste everything below:**

---

```markdown
<img width="1920" height="800" alt="image" src="https://github.com/user-attachments/assets/56c0ba20-79e7-4be5-8590-1617791f268a" />


---

An AI-powered CRM that tracks leads/deals and provides:
- 🎯 Deal close probability prediction
- 📈 Monthly revenue forecasting with confidence bounds
- 💡 Next best action recommendations
- ✉️ Auto-generated follow-up emails & call note summaries

## Screenshots

### Dashboard
> KPI cards, pipeline charts, monthly revenue trends, and recent activity feed
![Dashboard](screenshots/02-dashboard.png)

### Deal Pipeline (Kanban)
> Drag-and-drop deals across stages: Prospecting → Qualified → Proposal → Negotiation → Won/Lost
![Deal Pipeline](screenshots/03-deals-pipeline.png)

### AI Insights
> Close probability, risk factors, recommended actions, and auto-generated follow-up emails
![AI Insights](screenshots/04-ai-insights.png)

### Revenue Forecast
> 6-month forward forecast with optimistic/pessimistic bounds and historical comparison
![Revenue Forecast](screenshots/05-forecast.png)

### Accounts Management
> Company accounts with deal counts, pipeline values, and contact management
![Accounts](screenshots/06-accounts.png)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Recharts |
| **Backend** | Next.js API Routes |
| **Database** | MongoDB |
| **Auth** | JWT (custom, zero-dependency) |
| **AI** | Mock AI mode (deterministic) — upgradable to Claude API |

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

---

## Features

### 📊 Dashboard
- KPI cards: total pipeline, won revenue, win rate, active deals
- Pipeline by stage bar chart
- Monthly won revenue area chart
- Recent activities feed

### 🔄 Deal Pipeline
- **Kanban board** with drag-and-drop between stages
- **List view** with sortable columns
- Stages: `PROSPECTING` → `QUALIFIED` → `PROPOSAL` → `NEGOTIATION` → `WON` / `LOST`
- Won/Lost deal tracking sections
- Audit trail for all stage changes

### 🤖 AI Insights (per deal)
- **Close Probability**: Rule-based model (stage + activity count + deal attributes)
- **Risk Factors**: Identifies low engagement, stalled deals, large deal size concerns
- **Next Best Actions**: 4 stage-specific recommendations
- **Email Draft**: Auto-generated follow-up email with copy-to-clipboard
- **Deal Summary**: Contextual summary of deal status and timeline

### 📈 Revenue Forecasting
- 6-month forward forecast using weighted pipeline + historical trend
- Optimistic / pessimistic confidence bounds
- Historical vs predicted revenue chart
- Monthly breakdown table with confidence percentages

### 🏢 Accounts & Contacts
- Account CRUD with search and filtering
- Contact management per account
- Deal association and pipeline value tracking

### 🔐 Role-Based Access Control (RBAC)
| Role | Access |
|------|--------|
| **ADMIN** | Full access to all data, settings, and user management |
| **MANAGER** | Team-level data access, can retrain ML models |
| **REP** | Own data only |

### ⚙️ Settings & Admin
- AI mode indicator (mock/live)
- Model version tracking
- ML model retrain trigger
- User management (admin only): edit roles and team assignments

---

## API Endpoints

All endpoints are prefixed with `/api`:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/seed` | ❌ | Seed demo data |
| `POST` | `/api/auth/login` | ❌ | Login (returns JWT) |
| `POST` | `/api/auth/register` | ❌ | Register new user |
| `GET` | `/api/auth/me` | ✅ | Get current user |
| `GET` | `/api/dashboard/stats` | ✅ | Dashboard KPIs (RBAC-filtered) |
| `GET/POST` | `/api/accounts` | ✅ | List/Create accounts |
| `GET/PUT/DELETE` | `/api/accounts/:id` | ✅ | Account CRUD |
| `GET/POST` | `/api/deals` | ✅ | List/Create deals |
| `GET/PUT/DELETE` | `/api/deals/:id` | ✅ | Deal CRUD |
| `PUT` | `/api/deals/:id/stage` | ✅ | Move deal stage |
| `GET/POST` | `/api/deals/:id/activities` | ✅ | Deal activities |
| `POST` | `/api/deals/:id/insights` | ✅ | Generate AI insights |
| `GET` | `/api/forecast` | ✅ | Revenue forecast |
| `POST` | `/api/ml/retrain` | ✅ | Retrain ML model (Manager/Admin) |
| `GET` | `/api/admin/users` | ✅ | List users (Admin/Manager) |
| `PUT` | `/api/admin/users/:id` | ✅ | Update user (Admin only) |

---

## Project Structure

```
├── app/
│   ├── api/[[...path]]/route.js   # All backend API routes
│   ├── page.js                     # Complete frontend application
│   ├── layout.js                   # Root layout
│   └── globals.css                 # Global styles + CSS variables
├── components/ui/                  # shadcn/ui components
├── lib/
│   ├── db.js                       # MongoDB connection helper
│   └── utils.js                    # Utility functions
├── public/
│   └── screenshots/                # App screenshots
├── .env.example                    # Environment variable template
├── package.json
├── tailwind.config.js
└── README.md
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `DB_NAME` | `forecastcrm` | Database name |
| `JWT_SECRET` | (auto-generated) | Secret for JWT token signing |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | Application base URL |

## How to Retrain the Model

1. Login as **Manager** or **Admin**
2. Navigate to **Settings**
3. Click **"Retrain Model"**
4. The model recalculates close probabilities for all active deals using historical WON/LOST data

## How to Generate Forecasts

1. Navigate to **Forecast** page
2. Forecasts are auto-generated based on:
   - Weighted pipeline (deal amount × close probability)
   - Historical won revenue trends
   - Expected close dates
3. View monthly breakdown with confidence levels

---

## License

MIT
```

---

**For the screenshots**, save these 6 images into a `screenshots/` folder in your repo root:

| File | URL to download |
|------|----------------|
| `01-login.png` | https://deal-intelligence-3.preview.emergentagent.com/screenshots/01-login.png |
| `02-dashboard.png` | https://deal-intelligence-3.preview.emergentagent.com/screenshots/02-dashboard.png |
| `03-deals-pipeline.png` | https://deal-intelligence-3.preview.emergentagent.com/screenshots/03-deals-pipeline.png |
| `04-ai-insights.png` | https://deal-intelligence-3.preview.emergentagent.com/screenshots/04-ai-insights.png |
| `05-forecast.png` | https://deal-intelligence-3.preview.emergentagent.com/screenshots/05-forecast.png |
| `06-accounts.png` | https://deal-intelligence-3.preview.emergentagent.com/screenshots/06-accounts.png |

Just right-click each link → **Save As** → put them in `screenshots/` folder in your repo. The README references them with relative paths so they'll render perfectly on GitHub!
