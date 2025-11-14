# Smart Kitchen Inventory

> A lightweight Next.js app to manage kitchen inventory, suggest recipes, and track item consumption using Supabase for auth and storage.

## Quick summary

- Framework: Next.js 16 (App Router)
- Language: TypeScript + React 19
- UI: Tailwind CSS + shadcn/ui components + Radix + Lucide icons
- Backend: Supabase (auth + database)
- Package manager: pnpm (pnpm-lock.yaml present)

## Features

- Sign up / log in (Supabase auth)
- Add, list and consume items in inventory
- Recipe suggestions based on inventory
- Dashboard view for inventory and suggestions
- API routes under `app/api` for items and recipes

## Prerequisites

- Node.js (v20+ recommended)
- pnpm installed globally (or use `npm`/`corepack`):

```bash
pnpm install -g pnpm
```

## Environment variables

Create a `.env.local` in the project root with these variables (Supabase):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
```

Notes:
- The app uses `@supabase/ssr` and server-side helpers — both public URL and anon key are read from `process.env`.

## Install & run (development)

From the project root:

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000

## Build & run (production)

```bash
pnpm build
pnpm start
```

## Available scripts

Taken from `package.json`:

- `pnpm dev` — run Next.js in development mode
- `pnpm build` — build for production
- `pnpm start` — run built app
- `pnpm lint` — run ESLint

## Key files & folders

- `app/` — Next.js App Router routes, UI pages and server API endpoints
  - `app/api/items` — API routes for CRUD on items
  - `app/api/recipes` — recipe suggestion APIs
  - `app/auth` — signup/login pages
  - `app/dashboard` — main dashboard page
- `components/` — UI components and shadcn wrappers
- `components/ui/` — design system primitives and components
- `utils/supabase/client.ts` — Supabase client factory (browser)
- `lib/utils.ts` — assorted helpers used across the app

## Supabase integration

The code uses `@supabase/ssr` helpers for server and `@supabase/ssr`/`@supabase/supabase-js` on the client. The `createClient` helper expects the two env variables listed above. For server-side auth, the app uses cookie helpers via Next's `cookies()` and `createServerClient`.





