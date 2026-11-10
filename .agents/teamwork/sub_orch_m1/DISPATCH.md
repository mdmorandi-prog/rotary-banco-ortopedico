# Task Assignment: Sub-Orchestrator Milestone 1 (M1)

- Milestone: M1 — PWA Shell, Architecture & Demo Mock Store
- Working directory: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico
- State folder: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\sub_orch_m1
- Scope document: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\PROJECT.md
- Authoritative request: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\ORIGINAL_REQUEST.md
- Prior Explorer Survey: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_survey_1\handoff.md

Your scope:
Implement Requirement R1:
1. Next.js 14+ App Router project setup with TypeScript, Tailwind CSS, shadcn/ui components (Button, Card, Input, Badge, Dialog, etc.), and Lucide Icons. Ensure compatibility with `npm.cmd` on Windows.
2. Rotary brand design system: Azul Royal (`#17458f`) and Amarelo Ouro (`#f7a81b`), Tailwind config, CSS variables, WCAG AA compliance.
3. Mobile-first responsive navigation: fixed bottom navigation bar on mobile with elevated scan FAB (`/scan`), responsive desktop header/sidebar.
4. PWA `manifest.json`, theme color meta tags, app icons (192x192, 512x512, SVG emblem).
5. Data Layer repository facade (`src/lib/data-layer/`) and Smart Local Demo Store (`src/lib/mock-store/`) with pre-seeded items, beneficiaries, and loans enabling 100% offline & zero-credential execution.
6. Complete `.env.example` with Supabase, WhatsApp, and App settings.
7. Verification: `npm.cmd run build` or `npm.cmd run type-check` passes cleanly with zero errors.

Execute your milestone using the standard sub-orchestrator procedure: Explorer (3) -> Worker (1) -> Reviewer (2) -> Challenger (2) -> Forensic Auditor (1) -> Gate.
When gate passes, record DONE in your SCOPE.md and send handoff message to parent orchestrator.
