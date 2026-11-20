# Aircraft Turnaround Planner

See how delays move an aircraft's departure, using critical path scheduling.

![Planner showing an A320 turnaround timeline](public/screenshot.png)

**Live:** https://aircraft-turnaround-planner.vercel.app

## What it does

A turnaround is everything that happens between a plane parking at the gate and pushing back again: passengers off, cleaning, catering, fuel, bags, and passengers on. The planner lays these out as a timeline for four Cebu Pacific aircraft types (A320neo, A321neo, A330neo, ATR 72-600) and lets you try "what if" changes:

- catering arrives 10 minutes late
- the inbound flight lands 15 minutes behind schedule
- passengers board through one door instead of two
- refuelling happens with or without passengers on board

The line at the top always answers one question: does the plane still leave on time, and if not, by how much? Any scenario can be saved and shared by link.

## How it works

Each task has a duration and a list of tasks it has to wait for. The app works out the earliest each task can start and finish, then works backwards from pushback to find how late each one could start without delaying departure. Tasks with no spare time form the critical path, shown in yellow; delaying anything on it moves pushback by the same amount.

The scheduling code lives in `src/lib/schedule.ts` and has no framework or database dependencies, so it runs the same in the browser and on the server, and is covered by unit tests.

## Stack

- Next.js 16 (App Router, Cache Components) and TypeScript
- Tailwind CSS
- PostgreSQL with Prisma 7
- zod for validating saved scenarios
- Vitest
- Docker (local database and production image)
- Neon (hosted Postgres) and Vercel

The timeline is plain SVG, no charting library.

## Running it locally

You need Node 20.19 or newer and Docker.

```bash
git clone https://github.com/danil-tzn31/aircraft-turnaround-planner.git
cd aircraft-turnaround-planner
npm install
```

Create a `.env` file:

```
DATABASE_URL="postgresql://turn:turn@localhost:5432/turnaround"
DIRECT_URL="postgresql://turn:turn@localhost:5432/turnaround"
```

Start the database, create the tables, load the aircraft data and run the app:

```bash
docker compose up -d
npx prisma migrate dev
npm run db:seed
npm run dev
```

Then open http://localhost:3000.

## Tests

```bash
npm test
```

## Production image

```bash
docker build \
  --build-arg DATABASE_URL="postgresql://turn:turn@host.docker.internal:5432/turnaround" \
  -t aircraft-turnaround-planner .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://turn:turn@host.docker.internal:5432/turnaround" \
  aircraft-turnaround-planner
```

The build needs the database running because the planner pages are generated ahead of time.

## Data sources

Timings for the A320neo, A321neo and A330neo are based on Airbus's Aircraft Characteristics – Airport and Maintenance Planning documents (section 5-2, turnaround time charts). Airbus's boarding and deplaning rates are applied to Cebu Pacific's seat counts. Cleaning times and all ATR 72-600 timings are estimates. Details are in `data/sources.md`.

Durations are approximate, based on public manufacturer planning documents. Not for operational use. This is a personal project and isn't affiliated with Airbus, ATR or Cebu Pacific.
