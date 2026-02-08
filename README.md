# DP-IATRA (Cosmic Watch)
Interstellar Asteroid Tracker & Risk Analyser(IATRA)
Cosmic Watch: A Full-Stack Platform for Real-Time Near-Earth Object (NEO) Monitoring


Cosmic Watch is a NASA NeoWS-powered dashboard for monitoring Near-Earth Objects (NEOs). It includes a login flow, a live hazard dashboard, tracking for saved asteroids, and a Three.js visualization.

## Features
- Login/signup (Supabase auth if configured, local fallback otherwise)
- Live NEO feed with filters, search, and date ranges
- Hazard scoring, close-approach highlights, and summary stats
- Track/untrack asteroids per user
- 3D asteroid + Earth simulation

## Tech Stack
- Frontend: HTML, CSS, Vanilla JS, Three.js
- Backend: Node.js, Express
- Data Sources: NASA NeoWS API
- Auth/Storage: Supabase
- Docker: Compose for frontend, backend, and PostgreSQL

## Repository Structure
- iatra_frontend/ - Static frontend app
- iatra_backend/ - Express API server
- docker-compose.yml - Local Docker setup
- postman_collection.json - API collection

## Local Setup (No Docker)
1. Backend
1. Install dependencies:
   - `cd iatra_backend`
   - `npm install`
1. Create `.env` in `iatra_backend/` with:
   - `neows_api=YOUR_NASA_API_KEY`
1. Start the server:
   - `npm start`
   - Server runs at `http://localhost:5000`

2. Frontend
1. Serve the static files (any static server works). Example with Python:
   - `cd iatra_frontend`
   - `python -m http.server 8080`
1. Open `http://localhost:8080` in your browser.

Note: The frontend is currently configured to call the hosted API.
If you want local backend calls, update `iatra_frontend/script.js`:
- `API_URL` to `http://localhost:5000/api/asteroids`
- `TRACK_URL` to `http://localhost:5000/api/tracked`

## Docker Setup
1. Ensure Docker is running.
1. From the project root:
   - `docker compose up --build`
1. Access:
   - Frontend: `http://localhost:8080`
   - Backend: `http://localhost:5000`

The compose file expects `iatra_backend/.env` to exist with `neows_api`.

## Configuration
Backend environment variables (iatra_backend/.env):
- `neows_api`: NASA NeoWS API key (required)
- `PORT`: Backend port (default: 5000)

Supabase (optional):
- Edit `iatra_frontend/supabase-config.js` with your Supabase URL and anon key.
- If Supabase is unreachable or unset, the app falls back to local storage + `users.json`.

## API Endpoints
- `GET /api/asteroids?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - Returns the NeoWS feed, normalized and merged across date ranges.
- `GET /api/tracked?user=email@example.com`
  - Returns tracked asteroids for a user.
- `POST /api/tracked`
  - Body: `{ id, name, approachDate, missKm, isHazardous, hazardLabel, user }`
- `DELETE /api/tracked/:id?user=email@example.com`
  - Removes a tracked asteroid for a user.

## Default Local Users (Fallback Auth)
See `iatra_frontend/users.json` for demo accounts. Example:
- `cadet@iatra.space` / `orbit123`
- `nova@iatra.space` / `neows2026`

## Notes
- The backend chunks date ranges to comply with NeoWS feed limits.
- Tracked items are stored in `iatra_backend/tracked.json` when not using Supabase.
- PostgreSQL in `docker-compose.yml` is optional and not required unless you extend the backend.

## Postman
Import `postman_collection.json` to test the API quickly.
