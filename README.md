# craft-your-career — Backend

Full microservice backend for the **craft-your-career** CV builder application.

---

## Architecture Overview

```
Browser / Frontend (React + Vite)
         │
         ▼
   ┌─────────────┐
   │    Nginx     │  ← Load balancer, rate limiting, SSL termination
   │  (port 80)   │
   └──────┬──────┘
          │
   ┌──────▼──────┐
   │ API Gateway  │  ← Single entry point, circuit breakers, correlation IDs
   │  (port 4000) │    http-proxy-middleware + opossum
   └──────┬──────┘
          │
    ┌─────┼──────────────────────────────┐
    │     │                              │
    ▼     ▼     ▼      ▼       ▼       ▼
 Auth  Profile  CV  Document  ATS    AI
 :3001  :3002 :3003  :3004   :3005  :3006
    │     │     │       │
    └──┬──┘     └───────┘
       │
  ┌────┼────────────────────┐
  │    │                    │
  ▼    ▼                    ▼
MongoDB Redis           RabbitMQ
(×3 DBs) Cache/RateLimit EventBroker
```

---

## Services

| Service | Port | Database | Responsibility |
|---|---|---|---|
| **auth-service** | 3001 | auth-db (MongoDB) | Registration, login, JWT, refresh tokens |
| **user-profile-service** | 3002 | profile-db (MongoDB) | User profile, settings, account |
| **cv-service** | 3003 | cv-db (MongoDB) | Resume CRUD, caching |
| **document-service** | 3004 | — (stateless) | PDF generation via Puppeteer |
| **ats-service** | 3005 | — (Redis cache) | ATS scoring, keyword analysis |
| **ai-service** | 3006 | — (Redis cache) | Groq/llama-3.1 AI autocomplete |
| **api-gateway** | 4000 | — | Routing, circuit breakers |
| **nginx** | 80/443 | — | Load balancing, security headers |

---

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Node.js 20+

### 1. Clone and install

```bash
cd craft-your-career-backend
bash scripts/dev-setup.sh
```

### 2. Configure environment

```bash
# Edit .env — add your real secrets
nano .env
```

**Required values:**
```env
JWT_ACCESS_SECRET=<at least 64 random chars>
JWT_REFRESH_SECRET=<at least 64 different random chars>
GROQ_API_KEY=<your Groq API key from console.groq.com>
```

Generate strong secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Start infrastructure + services

**Option A — Full Docker (production-like):**
```bash
docker compose up --build
```

**Option B — Docker infra + local Node services (faster dev):**
```bash
bash scripts/dev-start.sh
```

### 4. Verify everything is healthy

```bash
bash scripts/health-check.sh
```

---

## API Reference

All routes go through `http://localhost:80/api/...`

### Auth  `/api/auth`

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/register` | — | `{email, password, fullName}` | Create account |
| POST | `/login` | — | `{email, password}` | Login, returns tokens |
| POST | `/refresh` | — | `{refreshToken}` | Rotate access token |
| POST | `/logout` | ✓ | `{refreshToken}` | Revoke refresh token |
| GET | `/me` | ✓ | — | Current user info |
| PUT | `/change-password` | ✓ | `{currentPassword, newPassword}` | Change password |

### Resumes  `/api/resumes`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✓ | List all user's resumes |
| GET | `/:id` | ✓ | Get single resume |
| POST | `/` | ✓ | Create resume (free plan: max 3) |
| PUT | `/:id` | ✓ | Update resume (invalidates cache) |
| DELETE | `/:id` | ✓ | Delete resume (invalidates cache) |
| POST | `/:id/duplicate` | ✓ | Duplicate a resume |

### Documents  `/api/documents`

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/generate` | ✓ | `{resumeData, format:"pdf"}` | Stream PDF download |

### ATS  `/api/ats`

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/analyze` | ✓ | `{resumeData, jobDescription?, cvId?}` | Score resume, keyword match |

### AI  `/api/ai`

| Method | Path | Auth | Plan | Body | Description |
|---|---|---|---|---|---|
| POST | `/autocomplete` | ✓ | Free | `{field, partialText, context?}` | Inline text autocomplete |
| POST | `/suggest-skills` | ✓ | Free | `{jobTitle, existingSkills?}` | Suggest skills |
| POST | `/improve-summary` | ✓ | **Pro** | `{currentSummary, jobTitle?, skills?}` | AI rewrite summary |
| POST | `/bullet-points` | ✓ | **Pro** | `{position, company?, existingDescription?}` | Generate bullet points |

### Profile  `/api/profile`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/me` | ✓ | Get profile |
| PUT | `/me` | ✓ | Update profile |
| DELETE | `/me` | ✓ | Delete account data |

---

## Caching Strategy

### Cache-Aside (Lazy Loading)
Used on all GET routes. On a cache miss, data is fetched from MongoDB and stored in Redis with a TTL.

```
Request → Redis? → HIT → return
                 → MISS → MongoDB → store in Redis → return
```

| Cache Key | TTL | Contents |
|---|---|---|
| `cv:{id}` | 5 min | Single resume |
| `cv:list:{userId}` | 2 min | User's resume list |
| `profile:{userId}` | 5 min | User profile |
| `ats:{cvId}:{jdHash}` | 10 min | ATS score for CV+JD pair |
| `ai:summary:{hash}` | 1 hr | AI summary improvement |
| `ai:skills:{hash}` | 2 hr | AI skill suggestions |

### Write-Through / Cache Invalidation
On every `PUT`, `POST`, or `DELETE` that mutates data, the relevant Redis keys are **immediately deleted** before the response is returned. This prevents stale reads.

```
PUT /resumes/:id → MongoDB update → Redis DEL cv:{id} + cv:list:{userId} → return
```

---

## Resilience Features

### Circuit Breakers (opossum)
Each downstream service has a circuit breaker in the API Gateway:
- **Timeout:** 10s (60s for document service)
- **Error threshold:** 50% failure rate opens the circuit
- **Reset:** After 30s, the circuit enters half-open and tests one request

### RabbitMQ Events
Services communicate asynchronously for decoupled operations:

| Event | Publisher | Consumer | Action |
|---|---|---|---|
| `user.registered` | auth-service | user-profile-service | Auto-create profile |
| `cv.created/updated/deleted` | cv-service | (extensible) | Cache invalidation hooks |
| `document.generate.*` | (extensible) | document-service | Async PDF generation |

---

## Frontend Integration Changes

The following files need to be updated in your frontend project:

| File | Action |
|---|---|
| `src/lib/api.ts` | **ADD** — new file, centralised API client |
| `src/contexts/AuthContext.tsx` | **ADD** — new file, real auth state |
| `src/contexts/ResumeContext.tsx` | **REPLACE** — swaps localStorage for API |
| `src/App.tsx` | **REPLACE** — adds AuthProvider, auth routes |
| `src/pages/AuthPage.tsx` | **ADD** — login/register page |
| `src/components/ProtectedRoute.tsx` | **ADD** — redirects unauthenticated users |
| `src/components/landing/Navbar.tsx` | **REPLACE** — real auth state in nav |
| `src/components/builder/ATSScorePanel.tsx` | **ADD** — ATS score UI |
| `src/components/builder/AIAssistPanel.tsx` | **ADD** — AI assist buttons |
| `src/hooks/useDownloadPDF.ts` | **ADD** — server-side PDF download |
| `.env.local` | **ADD** — `VITE_API_URL=http://localhost:80/api` |

---

## Security Checklist

- [x] JWT access tokens (15m) + refresh tokens (7d) with rotation
- [x] bcrypt password hashing (12 rounds)
- [x] Helmet security headers on every service
- [x] CORS restricted to frontend origin
- [x] Rate limiting: global (Nginx), per-route (Express), per-user (AI/PDF)
- [x] Input validation with Zod on all endpoints
- [x] Passwords/tokens redacted from all logs
- [x] MongoDB documents owned by userId — cross-user access blocked
- [x] Non-root Docker user in all containers
- [x] Free plan resume limit (max 3) enforced server-side

---

## Project Structure

```
craft-your-career-backend/
├── docker-compose.yml
├── .env.example
├── nginx/
│   ├── nginx.conf
│   └── conf.d/default.conf
├── rabbitmq/
│   └── rabbitmq.conf
├── shared/                        ← Shared library (types, logger, Redis, broker)
│   └── src/
│       ├── types/index.ts
│       ├── utils/{logger,redis}.ts
│       ├── events/broker.ts
│       └── middleware/index.ts
├── services/
│   ├── auth-service/
│   ├── user-profile-service/
│   ├── cv-service/
│   ├── document-service/
│   ├── ats-service/
│   └── ai-service/
├── api-gateway/
├── frontend-changes/              ← Drop these into your frontend project
│   └── src/
│       ├── lib/api.ts
│       ├── contexts/{Auth,Resume}Context.tsx
│       ├── pages/AuthPage.tsx
│       ├── components/{ProtectedRoute,builder/ATS,builder/AI,landing/Navbar}.tsx
│       └── hooks/useDownloadPDF.ts
└── scripts/
    ├── dev-setup.sh
    ├── dev-start.sh
    └── health-check.sh
```
