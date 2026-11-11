# IntellMeet

[![CI](https://github.com/anupam0806/intellmeet/actions/workflows/ci.yml/badge.svg)](https://github.com/anupam0806/intellmeet/actions/workflows/ci.yml)

A web app for video meetings with AI-written summaries and task tracking.

Stack: React 19, Vite, Tailwind CSS v4, Node.js, Express 5, Socket.io, Mongoose, and WebRTC.

## Install and Run

```bash
npm install
npm run dev
```

## Deployment

IntellMeet deploys as a single unified service on Render that serves the Vite React SPA, the REST API under `/api/v1`, and Socket.io WebRTC signalling from the same origin.

### Render Settings

- **Environment**: Node
- **Node Version**: 22 (`NODE_VERSION=22`)
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Health Check Path**: `/api/v1/health`

> **Note on Free-Tier Instances**: Render free-tier web services spin down after 15 minutes of idle time. The first request after a sleep period may take approximately one minute while the instance boots up.

### Environment Variables

Configure the following environment variable names in Render (supply values directly in Render's dashboard; never commit them):

- `NODE_ENV` — Application environment mode (`production` for live deployments).
- `PORT` — Port number for the HTTP server (provided automatically by Render).
- `MONGODB_URI` — Connection string for MongoDB Atlas.
- `JWT_ACCESS_SECRET` — 48+ byte random secret for signing short-lived JWT access tokens.
- `JWT_REFRESH_SECRET` — 48+ byte random secret for signing JWT refresh tokens.
- `CLIENT_ORIGIN` — Allowed CORS origin for local development (not needed in production single-origin).
- `DEMO_LOGIN_ENABLED` — Set to `true` to allow one-click demo persona sign-ins on the login page.
- `AI_PROVIDER` — AI summary provider: `openai` or `mock`.
- `AI_BASE_URL` — Base endpoint URL for OpenAI-compatible chat completions (when provider is openai).
- `AI_API_KEY` — API authentication key for the AI provider (when provider is openai).
- `AI_MODEL` — Model name used for summary and action-item generation (when provider is openai).
- `AI_MAX_INPUT_CHARS` — Maximum character limit for transcript/chat prompt inputs (default 30000).
- `STUN_URLS` — Comma-separated STUN server URLs for WebRTC ICE candidate discovery.
- `TURN_URL` — Optional TURN server URL for relaying media across strict symmetric NATs.
- `TURN_USERNAME` — Optional TURN server authentication username.
- `TURN_CREDENTIAL` — Optional TURN server authentication credential/password.
- `MAX_PARTICIPANTS` — Maximum concurrent participants allowed per room (default 4).
- `LOG_LEVEL` — Logging verbosity level (`info`, `warn`, `error`, `debug`).
- `CLIENT_DIST_DIR` — Optional custom path to client build output folder (defaults to `client/dist`).

### Deployment Scripts

- `npm run env:check` — Audits the environment variables against the example configuration and reports status without exposing secret values.
- `npm run seed` — Populates the MongoDB database with initial demo data (Brightwell team, meetings, tasks, and notifications).

### Seeding Demo Data

To populate the database with the Brightwell Design Co. demo team (5 accounts, 8 meetings across 6 weeks with realistic transcripts and summaries, 12 tasks, and notifications):

```bash
# Run seed idempotently
npm run seed

# Or reset and re-seed the Brightwell team data
npm run seed -- --reset
```

## Docker and CI

### Docker Commands

Build image:
```bash
docker build -t intellmeet .
```

Run standalone container:
```bash
docker run -p 10000:10000 --env-file server/.env intellmeet
```

Run with Docker Compose:
```bash
# Using MongoDB Atlas
docker compose up --build

# Or using local MongoDB container
docker compose --profile localdb up --build
```

### Compose Configuration

`docker-compose.yml` loads configuration from `server/.env` (created from `server/.env.example`) and maps port `10000`. The container health check queries `/api/v1/health`. An optional `localdb` profile runs MongoDB 7.0 at `mongodb://mongo:27017/intellmeet` with a persistent volume.

### CI Workflow

GitHub Actions runs `.github/workflows/ci.yml` on push and pull requests targeting `main`:
1. **test**: Runs on `ubuntu-latest` with Node 22 and npm cache, installs dependencies (`npm install --no-audit --no-fund`), runs `npm run lint`, `npm run build`, and `npm test` across client and server.
2. **docker-build**: Runs on `ubuntu-latest` after `test` succeeds, checks out the code, and verifies image compilation via `docker build -t intellmeet:ci .`.

### Verification Status

The image build is checked by the CI "docker-build" job; running the container and the compose setup have not been tested by the author. Docker is not installed on the author's local machine, so the Dockerfile and compose file were not built or run locally.

