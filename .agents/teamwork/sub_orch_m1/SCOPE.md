# Scope: Milestone 1 (M1) — PWA Shell, Architecture & Demo Mock Store

## Architecture
- **Framework**: Next.js 14+ (App Router), React 18, TypeScript 5.
- **Styling**: Tailwind CSS 3.4+, PostCSS, Autoprefixer, tailwindcss-animate.
- **Design System**: Rotary Royal Blue (`#17458f`), Rotary Gold (`#f7a81b`), WCAG AA contrast rules (dark blue/charcoal text on gold backgrounds).
- **Navigation**: Mobile fixed bottom navigation (`MobileBottomNav`) with elevated QR scan FAB (`/scan`), responsive desktop header (`DesktopHeader`).
- **PWA**: `public/manifest.json`, theme color `#17458f`, icons (192, 512, maskable, SVG wheel emblem).
- **Data Layer & Demo Store**:
  - `src/lib/data-layer/types.ts` & `src/lib/data-layer/repository.ts`
  - `src/lib/mock-store/mock-data.ts` (8 equipments, 2 beneficiaries, 2 loans)
  - `src/lib/mock-store/local-store.ts` (in-memory + localStorage persistence)
  - `src/components/layout/demo-mode-banner.tsx` (reset initial seed button)
- **Environment**: `.env.example`, `.env.local`
- **Tooling**: Windows command execution strictly via `npm.cmd` and `npx.cmd`.

## Feature Inventory (M1 Scope)
| # | Feature | Description | Milestone | Status |
|---|---------|-------------|-----------|--------|
| 1 | App Setup & Tooling | Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Lucide Icons, npm.cmd compatibility | M1 | DONE |
| 2 | Rotary Brand Theme | Azul Royal (#17458f) and Amarelo Ouro (#f7a81b) design tokens, WCAG AA contrast rules | M1 | DONE |
| 3 | Mobile-First Shell & PWA | PWA manifest.json, icons, mobile bottom bar with elevated scan FAB, desktop navigation | M1 | DONE |
| 4 | Smart Demo Fallback Store | LocalStorage repository with pre-seeded data for 100% offline & zero-credential execution | M1 | DONE |
| 5 | Environment Configuration | Complete `.env.example` with Supabase, WhatsApp, and App settings | M1 | DONE |

## Gate Verdict
- Gate Result: **PASS**
- Build Status: Passing (`npm.cmd run build` code 0)
- Typecheck Status: Passing (`npm.cmd run typecheck` code 0)
- Lint Status: Passing (`npm.cmd run lint` code 0)
- E2E Tests: 135 Tier 1 tests passing (code 0)
- Challenger Stress Tests: 19 build/config stress tests + 41 data layer adversarial tests passing (code 0)
- Forensic Integrity Audit: **CLEAN**
