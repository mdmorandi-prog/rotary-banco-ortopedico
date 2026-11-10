## 2026-11-10T15:28:01Z
You are Worker 1 for Milestone 1 (M1) of Rotary Banco Ortopédico.
Authoritative request: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\ORIGINAL_REQUEST.md
Read ORIGINAL_REQUEST.md first.
Your state folder: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_worker_m1_1
Working directory: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico
Scope document: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\sub_orch_m1\SCOPE.md
Project document: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\PROJECT.md
Explorer 1 handoff: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m1_1\handoff.md
Explorer 2 handoff: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m1_2\handoff.md
Explorer 3 handoff: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m1_3\handoff.md

CRITICAL WINDOWS EXECUTION RULE:
You MUST invoke `npm.cmd` and `npx.cmd` (NEVER `npm` or `npx` directly) for all command invocations in PowerShell.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE BOUNDARIES:
You exclusively own and will implement:
- `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `next.config.mjs`, `components.json`, `.gitignore`, `next-env.d.ts`
- `scripts/generate-pwa-icons.mjs` and execute it via `node scripts/generate-pwa-icons.mjs`
- `public/manifest.json`, `public/icons/*` (192x192.png, 512x512.png, maskable-icon-512x512.png, apple-touch-icon.png, rotary-wheel.svg)
- `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/dashboard/page.tsx`
- `src/components/layout/*` (`mobile-bottom-nav.tsx`, `desktop-header.tsx`, `demo-mode-banner.tsx`, `rotary-logo.tsx`)
- `src/components/ui/*` (shadcn components: button.tsx, card.tsx, badge.tsx, dialog.tsx, input.tsx, label.tsx, separator.tsx, tabs.tsx, sonner.tsx)
- `src/lib/utils.ts`, `src/lib/constants.ts`
- `src/lib/data-layer/*` (`types.ts`, `repository.ts`)
- `src/lib/mock-store/*` (`mock-data.ts`, `local-store.ts`)
- `src/types/*` (`index.ts`)
- `.env.example`
DO NOT write or modify `supabase/migrations/` (owned by concurrent milestone M2).
