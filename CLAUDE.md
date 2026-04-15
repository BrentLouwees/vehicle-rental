# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Style and Scope

This is a **university-level project** — not enterprise software. Code should be:
- **Simple and readable first**: a single developer should be able to understand any file quickly
- **Complete, not clever**: working and correct beats over-engineered; avoid patterns that exist only for hypothetical scale
- **Minimal abstractions**: don't create layers, base classes, or utilities unless they're used in at least two places
- **Short files over deep nesting**: prefer flat, direct code over abstract hierarchies
- **Comments where logic isn't obvious**, but not on every line

Avoid: factory patterns, dependency injection frameworks, microservice thinking, over-normalized schemas, extensive middleware chains, or anything that would feel out of place in a well-written university capstone project.

## Project Overview

A car and motorcycle rental web application for a mid-sized rental company with multiple locations. Targets three user roles: **Customers** (browsing/booking), **Staff/Admins** (managing rentals/vehicles), and **Managers/Owners** (reports/performance).

## Tech Stack

- **Backend**: Python 3.8+, FastAPI (preferred over Flask), SQLAlchemy ORM, Alembic migrations
- **Database**: MySQL (InnoDB engine), connection pooling
- **Auth**: JWT tokens
- **Frontend**: Vanilla HTML5/CSS3/JavaScript (ES6+) — no jQuery, no heavy frameworks
- **Deployment**: Render (PaaS); environment variables for all config

## Planned Project Structure

```
backend/
  models/       # SQLAlchemy ORM models
  routes/       # FastAPI route definitions
  services/     # Business logic (availability, pricing, validation)
  database/     # DB connection, Alembic migrations
  config/       # Environment config
  utils/        # Helper functions

frontend/
  index.html            # Landing page
  pages/                # search, vehicle-detail, booking, confirmation, dashboard, profile, admin-*
  css/
    style.css           # Main stylesheet
    responsive.css      # Media queries
  js/
    api.js              # fetch wrappers for all backend calls
    app.js              # Main app logic
    forms.js            # Form handling and validation
    ui.js               # DOM manipulation
    utils.js            # Helpers, date formatting
```

## Development Commands

*(Commands will be added here once the backend and frontend are scaffolded.)*

Expected setup:
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload          # start dev server
alembic upgrade head               # run migrations
pytest                             # run all tests
pytest tests/test_bookings.py -k test_name  # run single test

# Frontend
# Served as static files — open index.html directly or via a local server
python -m http.server 8080         # quick local server
```

## Core Business Logic

Critical invariants the backend must enforce:
- **No double-bookings**: a vehicle cannot be booked by two customers for overlapping dates (use DB-level unique constraints + transaction locking)
- **Booking workflow**: search → reserve → confirm → pay → pickup → return
- **Pricing**: daily rate × duration, with vehicle-type discounts and optional add-ons (insurance, GPS, extra driver)
- **Vehicle states**: `available`, `rented`, `maintenance` — only `available` vehicles appear in search results
- **Cancellation fees**: calculated based on how close to pickup date

## API Conventions

- REST with standard HTTP status codes: 400 (bad input), 401 (unauthenticated), 403 (unauthorized), 404 (not found), 409 (conflict/double-booking), 500 (server error)
- All errors return JSON with a meaningful message (never expose raw DB errors)
- Pydantic models for FastAPI request/response validation
- All multi-step operations (booking creation) must be atomic transactions

## Frontend Conventions

- Mobile-first responsive design: 320px → 768px → 1024px+
- CSS custom properties for colors/spacing; CSS Grid or Flexbox (no floats)
- Spacing scale: 4, 8, 12, 16, 24, 32px
- `fetch` API for all backend calls — handle loading states (spinner), success (toast), and error (inline message, never raw API error text)
- LocalStorage for client-side state (auth token, preferences)
- WCAG 2.1 AA accessibility: semantic HTML, ARIA labels, keyboard navigation, 4.5:1 color contrast

## Testing Standards

- **Framework**: pytest for backend, Jest or Playwright for frontend/E2E
- **Test naming**: `test_booking_prevents_double_booking` (describe the behavior)
- Tests must be independent (no shared state between tests) and deterministic
- Coverage target: 70%+ of critical rental business logic paths
- Concurrency test: simultaneous bookings for same vehicle/dates — only one should succeed

## Specialized Agents

This project uses four Claude sub-agents defined in `.claude/agents/`:

| Agent | When to use |
|-------|-------------|
| `project-architect` | Database schema design, REST API specs, feature prioritization, task assignments |
| `backend-agent` | FastAPI routes, SQLAlchemy models, business logic, Alembic migrations |
| `frontend-agent` | HTML pages, CSS styling, JS interactivity, API integration |
| `testing-qa-agent` | Test plans, pytest suites, E2E workflows, bug reports |

The architect's specs are the source of truth — backend and frontend implement exactly what the architect defines. Always consult the architect before making structural changes.
