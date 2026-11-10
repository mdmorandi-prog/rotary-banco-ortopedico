# Scope: E2E Testing Track - Rotary Banco Ortopédico

## Architecture
- **Test Strategy**: Opaque-box, requirement-driven E2E test architecture based on `ORIGINAL_REQUEST.md` and `PROJECT.md`.
- **Runner**: Node.js automated test runner in `tests/e2e/runner.js` supporting granular tier execution (`--tier=1`, `--tier=all`), colored terminal output, timing, and exit code 0 (pass) / 1 (fail) semantics.
- **Directory Layout**:
  ```
  tests/
  └── e2e/
      ├── runner.js              # Central test runner with CLI flags & summary
      ├── test-harness.js        # Shared opaque-box testing utilities, contract validators, fixtures
      ├── tier1-features/        # Tier 1: Core Feature Coverage (>= 5 tests per feature)
      ├── tier2-boundaries/      # Tier 2: Boundary & Corner Cases (>= 5 tests per feature)
      ├── tier3-interactions/    # Tier 3: Cross-Feature Pairwise Interactions
      └── tier4-scenarios/       # Tier 4: Realistic Rotary Banco Ortopédico operational scenarios
  ```
- **Requirements**:
  - Minimum Tier 1: >= 5 tests per feature across core features
  - Minimum Tier 2: >= 5 tests per feature with boundaries, edge cases, invalid masks
  - Minimum Tier 3: Pairwise combinations (Loan + Renewal + Overdue + Return + Triage)
  - Minimum Tier 4: Real-world operational scenarios simulating Rotary workflows

## Feature Inventory Coverage Mapping
| # | Feature | Core Area | Tier 1 Target | Tier 2 Target | Tier 3 Target | Tier 4 Target |
|---|---------|-----------|---------------|---------------|---------------|---------------|
| 1 | App Setup & Tooling | Config & Tooling | >=5 | >=5 | Yes | Yes |
| 2 | Rotary Brand Theme | Design tokens & Contrast | >=5 | >=5 | Yes | Yes |
| 3 | Mobile-First Shell & PWA | Manifest & Nav | >=5 | >=5 | Yes | Yes |
| 4 | Smart Demo Fallback Store | Local Storage & Data Store | >=5 | >=5 | Yes | Yes |
| 5 | Environment Configuration | .env.example Validation | >=5 | >=5 | Yes | Yes |
| 6 | Supabase Schema & Enums | Schema & Enums (6 enums) | >=5 | >=5 | Yes | Yes |
| 7 | Core Database Tables | 6 tables integrity | >=5 | >=5 | Yes | Yes |
| 8 | Automated Triggers & State | Triggers & status updates | >=5 | >=5 | Yes | Yes |
| 9 | Row Level Security (RLS) | Security & policies | >=5 | >=5 | Yes | Yes |
| 10 | Initial Seed Dataset | Seed equipment & loans | >=5 | >=5 | Yes | Yes |
| 11 | Equipment Catalog (/equipments) | Filter, search, create | >=5 | >=5 | Yes | Yes |
| 12 | Mobile QR Scanner (/scan) | Scan token & camera UI | >=5 | >=5 | Yes | Yes |
| 13 | Contextual Action Route (/item/[qr_token]) | State machine per status | >=5 | >=5 | Yes | Yes |
| 14 | Printable Asset Labels (/equipments/labels) | Label layout & contents | >=5 | >=5 | Yes | Yes |
| 15 | Multi-step Loan Wizard (/loans/new) | Wizard steps & validation | >=5 | >=5 | Yes | Yes |
| 16 | Mandatory Secondary Contact Validation | Contact validation | >=5 | >=5 | Yes | Yes |
| 17 | Client-side Image Compression | Photo compression | >=5 | >=5 | Yes | Yes |
| 18 | Digital Signature Canvas | Canvas signature data | >=5 | >=5 | Yes | Yes |
| 19 | Termo de Comodato PDF (CCB 579-585) | Legal clauses & PDF | >=5 | >=5 | Yes | Yes |
| 20 | Return Triage Workflow (/loans/[id]/return) | Triage checklist | >=5 | >=5 | Yes | Yes |
| 21 | Return Reasons & Routing | Routing destination | >=5 | >=5 | Yes | Yes |
| 22 | Digital Discharge Receipt | Quittance receipt CCB 320 | >=5 | >=5 | Yes | Yes |
| 23 | Public Self-Service Renewal (/renovar/[magic_token]) | 1-click renewal token | >=5 | >=5 | Yes | Yes |
| 24 | Overdue Radar & Dashboard (/overdue, /dashboard) | Overdue KPIs & stages | >=5 | >=5 | Yes | Yes |
| 25 | WhatsApp Notification Generator | Stage messages & wa.me | >=5 | >=5 | Yes | Yes |
| 26 | Cron Automation (/api/cron/check-loans) | D-7, D0, D+1, D+7 rules | >=5 | >=5 | Yes | Yes |
| 27 | Project Documentation (README.md) | Docs & deployment instructions | >=5 | >=5 | Yes | Yes |

## Sub-Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| TM1 | Test Infrastructure & Runner | Create TEST_INFRA.md, tests/e2e/runner.js, test-harness.js, npm test integration | none | IN_PROGRESS |
| TM2 | Tier 1 Feature Coverage Suite | Build tests/e2e/tier1-features/ with >= 5 tests per feature | TM1 | PLANNED |
| TM3 | Tier 2 Boundary & Corner Suite | Build tests/e2e/tier2-boundaries/ with >= 5 boundary tests per feature | TM1 | PLANNED |
| TM4 | Tier 3 & Tier 4 Integrated Suites | Build tests/e2e/tier3-interactions/ and tests/e2e/tier4-scenarios/ | TM2, TM3 | PLANNED |
| TM5 | Runner Verification & TEST_READY.md | Execute full suite, verify pass rates, publish TEST_READY.md | TM1, TM2, TM3, TM4 | PLANNED |
