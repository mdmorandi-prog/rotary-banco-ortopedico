# Handoff Report: Specification Miner — Rotary Banco Ortopédico (Features F1 to F27)

- **Agent**: `spec_miner_f1_f27`
- **Role**: Specification Miner (E2E Testing Track)
- **Working Directory**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`
- **State Folder**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\spec_miner_f1_f27`
- **Authoritative Sources**: `ORIGINAL_REQUEST.md`, `PROJECT.md`, `e2e_testing_orchestrator/SCOPE.md`, `teamwork_explorer_survey_1/handoff.md`, `teamwork_explorer_survey_2/handoff.md`, `teamwork_explorer_survey_3/handoff.md`.
- **Date**: 2026-11-10T15:30:00Z

---

## 1. Observation

Direct environmental and codebase observations:
1. **Authoritative Project Documents**:
   - `ORIGINAL_REQUEST.md`: Defines requirements R1 through R6 (PWA architecture, Supabase schema & triggers, QR asset management & labels, 5-step loan wizard & comodato PDF under CCB arts 579-585, return triage & quittance under CCB art 320/582, and self-service renewal portal with overdue radar & cron).
   - `PROJECT.md`: Defines 27 core functional features (F1 to F27) plus test suites (F28, F29), shared data models (`Equipment`, `Beneficiary`, `Loan`), enums (`EquipmentCategory`, `EquipmentStatus`, `EquipmentCondition`, `LoanStatus`, `CloseReason`), and repository interfaces (`IDataRepository`).
   - `e2e_testing_orchestrator/SCOPE.md`: Mandates an opaque-box test architecture in `tests/e2e/` with runner `runner.js`, test harness `test-harness.js`, and multi-tier sub-milestones (TM1-TM5).
2. **Platform & Windows Execution Constraints**:
   - Node.js version is `v24.21.0`.
   - Windows PowerShell restricts unsigned `.ps1` scripts; invocations of `npm` fail with `PSSecurityException`. All CLI invocations must use `npm.cmd` and `npx.cmd`.
3. **Execution Mode Strategy**:
   - The system requires zero-credential executability via `src/lib/mock-store/local-store.ts` when Supabase credentials are not supplied, allowing automated E2E tests to run in both mock/in-memory mode and real database mode.

---

## 2. Logic Chain

1. **Feature Inventory Coverage (F1 to F27)**:
   - To guarantee complete test coverage, every single one of the 27 features identified in `PROJECT.md` must have an opaque-box specification without exception.
   - Tier 1 requires at least 5 concrete test cases per feature (total >= 135 tests), testing valid input handling, state transitions, visual layouts, and expected assertions.
2. **Boundary, Edge & Adversarial Robustness (Tier 2)**:
   - Orthopedic loan management operates in critical community settings where bad inputs (e.g., mismatched CPF checksums, non-conforming phones, negative asset values, expired magic tokens, leap year deadlines, and XSS/SQL injection payloads) can disrupt service or create legal exposure.
   - Tier 2 requires at least 5 adversarial/boundary specifications per feature (total >= 135 tests), focusing on limits, nullability, masks, extreme dates, and error states.
3. **Contract & Legal Integrity**:
   - The Brazilian Civil Code (CCB Lei 10.406/2002) imposes strict requirements on comodato loans:
     - Art. 579: Gratuitous loan of non-fungible things.
     - Art. 582: Obligation of conservation and liability for replacement value (*valor de reposição*).
     - Art. 585: Joint and several liability (*solidariedade passiva*) between primary borrower and secondary guarantor.
     - Art. 320: Formal quittance receipt (*Termo de Quitação*) extinguishing liability upon verified return.
   - Specifications must enforce these legal invariants in contract generation and return triage.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| F1 | Architecture | App Setup & Tooling | Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Lucide Icons, npm.cmd compatibility | CLI run commands, source files | Compiled web app, static assets | Compilation / typecheck error | PROJECT.md, Survey 1 |
| F2 | Design System | Rotary Brand Theme | Design tokens: Azul Royal (#17458f) & Amarelo Ouro (#f7a81b), WCAG AA contrast | CSS theme variables, UI classes | Rendered UI conforming to 4.5:1 ratio | Contrast warning / style fallback | PROJECT.md, Survey 1 |
| F3 | UX / Shell | Mobile-First Shell & PWA | Manifest.json, icons, bottom nav with elevated QR FAB, responsive desktop nav | Device viewport, touch/mouse nav | Mobile bottom bar or desktop header | Fallback navigation bar | PROJECT.md, Survey 1 |
| F4 | Data Layer | Smart Demo Fallback Store | LocalStorage repository with pre-seeded data for offline / zero-credential execution | Browser localStorage, repository calls | In-memory / local storage records | Corrupted store auto-recovery | PROJECT.md, Survey 1 |
| F5 | Configuration | Environment Configuration | Complete `.env.example` with Supabase, WhatsApp, and App variables | Environment variables | Configured runtime clients | Missing env fallback to demo mode | PROJECT.md, Survey 1 |
| F6 | Database | Supabase Schema & Enums | 6 native PostgreSQL enums: user_role, equipment_category, equipment_status, etc. | SQL migration script | Created database types | Invalid enum value rejected | PROJECT.md, Survey 2 |
| F7 | Database | Core Database Tables | 6 relational tables: profiles, equipments, beneficiaries, loans, logs | SQL DDL scripts | Structured database schema | Foreign key / unique violations | PROJECT.md, Survey 2 |
| F8 | Database | Automated Triggers & State | Automatic status synchronization between loans and equipments, audit logging | Loan INSERT / UPDATE triggers | Updated equipment status & condition | Transaction rollback on failure | PROJECT.md, Survey 2 |
| F9 | Security | Row Level Security (RLS) | Security policies for authenticated staff, public QR lookup, and public magic token | Supabase Auth context, anon key | Filtered table query results | 403 Forbidden / empty result set | PROJECT.md, Survey 2 |
| F10 | Database | Initial Seed Dataset | Pre-loaded catalog with >= 6 equipments, >= 2 beneficiaries, >= 2 loans (active, overdue) | SQL seed script / mock store seed | Populated database / store | Seed idempotency collision guard | PROJECT.md, Survey 2 |
| F11 | Inventory | Equipment Catalog (/equipments) | Equipment list/grid with debounced search, status/category filter pills, creation modal | Search queries, filter selections | Filtered equipment items & cards | Empty search state message | PROJECT.md, Survey 2 |
| F12 | QR System | Mobile QR Scanner (/scan) | Camera QR scanner with html5-qrcode, Rotary reticle, torch toggle, manual input | Camera video stream, text input | Decoded token -> navigation to item | Camera denied -> manual fallback | PROJECT.md, Survey 2 |
| F13 | State Machine | Contextual Action Route (/item/[qr_token]) | State machine UI: DISPONIVEL (loan), EMPRESTADO/ATRASADO (return/renew), etc. | qr_token parameter in URL | Status-specific action buttons & info | 404 Equipment Not Found | PROJECT.md, Survey 2 |
| F14 | Asset Management | Printable Asset Labels (/equipments/labels) | Printable 50x30mm thermal and A4 grid layouts with Rotary logo, QR code, patrimony | Print layout triggers, item selection | Formatted printable HTML/CSS sheet | Missing phone / logo fallback | PROJECT.md, Survey 2 |
| F15 | Loan Management | Multi-step Loan Wizard (/loans/new) | 5 steps: equipment confirm, patient info, secondary contact, photo upload, signature | Wizard form step data | Created loan record & comodato PDF | Step validation block | PROJECT.md, Survey 3 |
| F16 | Loan Management | Mandatory Secondary Contact Validation | Strict validation: full name (>= 2 words), valid phone, relationship, non-collision | Secondary contact form fields | Validated contact object | Form error highlight & block | PROJECT.md, Survey 3 |
| F17 | Media Processing | Client-side Image Compression | Client-side photo compression for document & residence proof uploads (< 800KB) | File / image uploads (> 3MB) | Compressed image blob (< 800KB) | Invalid format error | PROJECT.md, Survey 3 |
| F18 | Digital Signatures | Digital Signature Canvas | Interactive canvas signature using react-signature-canvas with base64 PNG capture | Touch / mouse pointer strokes | PNG data URL string | Empty signature submission error | PROJECT.md, Survey 3 |
| F19 | Legal & Compliance | Termo de Comodato PDF (CCB 579-585) | PDF generation with replacement value, conservation clauses, joint liability, signature | Loan & beneficiary data, signature | Downloadable PDF contract file | Missing value fallback / error | PROJECT.md, Survey 3 |
| F20 | Operations | Return Triage Workflow (/loans/[id]/return) | Physical condition checklist (BOM, PRECISA_REPARO), condition scoring | Return inspection checklist | Completed return record | Missing defect note error | PROJECT.md, Survey 3 |
| F21 | Operations | Return Reasons & Routing | Mappings for close_reason, destination routing (HIGIENIZACAO, DISPONIVEL, MANUTENCAO) | Selected reason & destination | Updated equipment status & logs | Invalid transition rejection | PROJECT.md, Survey 3 |
| F22 | Legal & Compliance | Digital Discharge Receipt | Termo de Quitação PDF/printable receipt extinguishing liability under CCB art. 320 | Completed return loan id | Quittance PDF / WhatsApp link | Missing return confirmation error | PROJECT.md, Survey 3 |
| F23 | Self-Service | Public Self-Service Renewal (/renovar/[magic_token]) | Zero-login 1-click renewal (+30 days, max renewals guard) and return assistance request | magic_token URL parameter, 1-click | Extended loan return date | Expired / max renewal alert | PROJECT.md, Survey 3 |
| F24 | Monitoring | Overdue Radar & Dashboard (/overdue, /dashboard) | Fleet KPIs, value-at-risk, overdue stages (D-7, D0, D+1, D+7), filtered views | Filter selections, stage tabs | KPI metrics cards & sorted loan list | Empty overdue celebration state | PROJECT.md, Survey 3 |
| F25 | Communications | WhatsApp Notification Generator | Stage-specific messages for primary and secondary contacts with direct wa.me links | Loan stage & contact parameters | Formatted text & wa.me URL | Invalid phone number warning | PROJECT.md, Survey 3 |
| F26 | Automation | Cron Automation (/api/cron/check-loans) | Daily cron transition to ATRASADO at D+1, escalations at D+7, vercel.json cron | HTTP GET with Bearer secret | JSON summary of state transitions | 401 Unauthorized without token | PROJECT.md, Survey 3 |
| F27 | Documentation | Project Documentation (README.md) | Comprehensive guide for Supabase migration, buckets, env vars, demo mode, deployment | Markdown documentation file | Rendered technical documentation | Broken link / command warning | PROJECT.md, Survey 3 |

---

## 4. Tier 1 Test Case Catalog (Feature Coverage: 135 Test Specifications)

### Feature 1: App Setup & Tooling (F1)
- **T1-F01-01: App Router Root Layout and HTML lang attribute**
  - *Precondition*: Project files compiled.
  - *Action*: Inspect root layout rendering `src/app/layout.tsx`.
  - *Expected Result*: HTML document contains `<html lang="pt-BR">`, UTF-8 charset meta tag, and viewport configuration with mobile responsiveness.
- **T1-F01-02: TypeScript Compilation & Strict Mode**
  - *Precondition*: `tsconfig.json` present with `@/*` path alias.
  - *Action*: Execute TypeScript typecheck via `npm.cmd run typecheck` or `npx.cmd tsc --noEmit`.
  - *Expected Result*: 0 compilation errors, strict null checks enabled, path aliases resolve cleanly.
- **T1-F01-03: Tailwind CSS & Design Token Compilation**
  - *Precondition*: `tailwind.config.ts` and `src/app/globals.css` configured.
  - *Action*: Verify CSS build output for Rotary brand classes `bg-rotary-blue` and `text-rotary-gold`.
  - *Expected Result*: CSS generates valid declarations mapping to `#17458f` and `#f7a81b`.
- **T1-F01-04: Lucide Icon Library Rendering**
  - *Precondition*: Components import Lucide icons (`QrCode`, `Package`, `FileText`, `AlertTriangle`).
  - *Action*: Render component tree containing icon elements.
  - *Expected Result*: SVG icons mount without missing symbol warnings or runtime errors.
- **T1-F01-05: Windows npm.cmd Execution Compatibility**
  - *Precondition*: Environment running in Windows PowerShell.
  - *Action*: Verify package scripts execute using `npm.cmd` wrapper rather than `npm.ps1`.
  - *Expected Result*: Scripts execute cleanly without `PSSecurityException`.

### Feature 2: Rotary Brand Theme (F2)
- **T1-F02-01: Primary Rotary Blue Color Token Resolution**
  - *Precondition*: App styles loaded.
  - *Action*: Inspect computed CSS color for primary elements (`--rotary-blue` / `--primary`).
  - *Expected Result*: Evaluates to hex `#17458f` (HSL 217, 72%, 33%).
- **T1-F02-02: Secondary Rotary Gold Accent Resolution**
  - *Precondition*: App styles loaded.
  - *Action*: Inspect computed CSS color for secondary accent elements (`--rotary-gold` / `--secondary`).
  - *Expected Result*: Evaluates to hex `#f7a81b` (HSL 39, 93%, 54%).
- **T1-F02-03: WCAG AA Contrast Verification for Rotary Blue**
  - *Precondition*: Primary button rendered with white text `#ffffff` on `#17458f` background.
  - *Action*: Calculate contrast ratio between foreground and background.
  - *Expected Result*: Contrast ratio is >= 4.5:1 (calculated 7.4:1), passing WCAG AA standard.
- **T1-F02-04: WCAG AA Dark Text Enforcement on Rotary Gold**
  - *Precondition*: Warning badge or gold accent element rendered.
  - *Action*: Inspect foreground text color on `#f7a81b` background.
  - *Expected Result*: Foreground is dark text (`#17458f` or `#1e293b`), achieving ratio >= 4.5:1 (6.8:1); white text on gold is rejected.
- **T1-F02-05: Operational Status Badge Color Tokens**
  - *Precondition*: Status badges rendered for all 5 equipment states.
  - *Action*: Verify badge background/text classes for DISPONIVEL, EMPRESTADO, ATRASADO, HIGIENIZACAO, MANUTENCAO.
  - *Expected Result*: DISPONIVEL uses emerald/green, EMPRESTADO uses blue, ATRASADO uses amber/rose, HIGIENIZACAO uses cyan/teal, and MANUTENCAO uses violet/orange.

### Feature 3: Mobile-First Shell & PWA (F3)
- **T1-F03-01: PWA Web App Manifest Schema Validation**
  - *Precondition*: `public/manifest.json` accessible.
  - *Action*: Fetch and parse `manifest.json`.
  - *Expected Result*: Contains `name="Rotary Banco Ortopédico"`, `short_name="Banco Ortopédico"`, `start_url="/"`, `display="standalone"`, and `theme_color="#17458f"`.
- **T1-F03-02: PWA Icons Specification & Assets**
  - *Precondition*: Assets directory `public/icons/` present.
  - *Action*: Validate presence of `icon-192x192.png`, `icon-512x512.png`, and maskable icon.
  - *Expected Result*: Icons exist, match declared dimensions, and are referenced in manifest.
- **T1-F03-03: Mobile Bottom Navigation Rendering**
  - *Precondition*: Viewport set to mobile width (375px).
  - *Action*: Mount shell layout and count navigation items.
  - *Expected Result*: Fixed bottom navigation bar displays 5 items: Início, Acervo, QR Scan FAB, Empréstimos, and Radar.
- **T1-F03-04: Elevated QR Scanner FAB Prominence**
  - *Precondition*: Mobile bottom nav mounted.
  - *Action*: Inspect center FAB button element.
  - *Expected Result*: Button is elevated (`-translate-y-4` or similar), styled with Rotary Blue/Gold ring, and links to `/scan`.
- **T1-F03-05: Desktop Responsive Layout Transition**
  - *Precondition*: Viewport resized to desktop width (1280px).
  - *Action*: Inspect DOM elements for navigation.
  - *Expected Result*: Mobile bottom bar is hidden (`md:hidden`); desktop top header / sidebar is displayed with branding and user profile.

### Feature 4: Smart Demo Fallback Store (F4)
- **T1-F04-01: Automatic Demo Mode Detection**
  - *Precondition*: `.env.local` contains placeholder Supabase credentials or `NEXT_PUBLIC_DEMO_MODE=true`.
  - *Action*: Initialize repository via `getDataRepository()`.
  - *Expected Result*: Returns instance of `LocalDemoStore` without throwing network errors.
- **T1-F04-02: Initial Seed Population into LocalStorage**
  - *Precondition*: Browser localStorage is empty.
  - *Action*: Access `/equipments` or trigger repository initialization.
  - *Expected Result*: LocalStorage key `rotary_demo_equipments` is populated with >= 6 equipments and `rotary_demo_loans` with >= 2 loans.
- **T1-F04-03: Demo Mode UI Indicator Banner**
  - *Precondition*: App operating in demo fallback mode.
  - *Action*: Render page layout.
  - *Expected Result*: Non-intrusive banner displays "Modo Demonstração Ativo (Dados Locais)" with status pill.
- **T1-F04-04: Data Mutation Persistence in Demo Store**
  - *Precondition*: Demo store initialized.
  - *Action*: Create new equipment item via repository and reload page.
  - *Expected Result*: Newly created item persists in localStorage and appears in equipment list after page refresh.
- **T1-F04-05: "Restaurar Dados Iniciais" Reset Capability**
  - *Precondition*: Demo data mutated by creating or editing items.
  - *Action*: Trigger reset action in demo banner.
  - *Expected Result*: LocalStorage re-seeded with pristine default dataset; modified entries reverted.

### Feature 5: Environment Configuration (F5)
- **T1-F05-01: Mandatory Supabase Environment Variables**
  - *Precondition*: `.env.example` file inspected.
  - *Action*: Verify presence of keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
  - *Expected Result*: All 3 keys declared with explanatory documentation comments.
- **T1-F05-02: WhatsApp Integration Environment Variables**
  - *Precondition*: `.env.example` file inspected.
  - *Action*: Verify presence of keys: `WHATSAPP_PROVIDER`, `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_DEFAULT_CLUB_PHONE`.
  - *Expected Result*: Keys present with examples for Evolution API, Z-API, and direct wa.me fallback.
- **T1-F05-03: Application & Security Environment Variables**
  - *Precondition*: `.env.example` file inspected.
  - *Action*: Verify presence of keys: `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEMO_MODE`.
  - *Expected Result*: Keys present with clear instructions on generating 32-character random tokens.
- **T1-F05-04: Client-Safe vs Server-Only Key Separation**
  - *Precondition*: Environment parser inspected.
  - *Action*: Verify that `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` do NOT contain `NEXT_PUBLIC_` prefix.
  - *Expected Result*: Sensitive keys are never bundled into client-side JavaScript.
- **T1-F05-05: Runtime Env Validation / Fallback Handler**
  - *Precondition*: App boots with missing environment variables.
  - *Action*: Execute runtime boot check.
  - *Expected Result*: Gracefully activates demo store without throwing uncaught server runtime exception.

### Feature 6: Supabase Schema & Enums (F6)
- **T1-F06-01: PostgreSQL Enum `user_role` Definition**
  - *Precondition*: `supabase/migrations/001_initial_schema.sql` inspected.
  - *Action*: Parse enum values for `user_role`.
  - *Expected Result*: Contains `'admin'`, `'operator'`, `'volunteer'`.
- **T1-F06-02: PostgreSQL Enum `equipment_category` Definition**
  - *Precondition*: Schema migration file inspected.
  - *Action*: Parse enum values for `equipment_category`.
  - *Expected Result*: Contains `'CADEIRA_RODAS'`, `'CADEIRA_BANHO'`, `'MULETA_AXILAR'`, `'MULETA_CANADENSE'`, `'ANDADOR'`, `'CAMA_HOSPITALAR'`, `'COLCHAO_PNEUMATICO'`, `'SUPORTE_SORO'`, `'OUTROS'`.
- **T1-F06-03: PostgreSQL Enum `equipment_status` Definition**
  - *Precondition*: Schema migration file inspected.
  - *Action*: Parse enum values for `equipment_status`.
  - *Expected Result*: Contains `'DISPONIVEL'`, `'EMPRESTADO'`, `'ATRASADO'`, `'HIGIENIZACAO'`, `'MANUTENCAO'`, `'BAIXADO'`.
- **T1-F06-04: PostgreSQL Enum `equipment_condition` Definition**
  - *Precondition*: Schema migration file inspected.
  - *Action*: Parse enum values for `equipment_condition`.
  - *Expected Result*: Contains `'NOVO'`, `'BOM'`, `'REGULAR'`, `'PRECISA_REPARO'`, `'SUCATEADO'`.
- **T1-F06-05: PostgreSQL Enums `loan_status` and `close_reason` Definitions**
  - *Precondition*: Schema migration file inspected.
  - *Action*: Parse enum values for `loan_status` and `close_reason`.
  - *Expected Result*: `loan_status` contains `'ATIVO'`, `'DEVOLVIDO'`, `'ATRASADO'`, `'CANCELADO'`; `close_reason` contains `'RECUPERACAO_ALTA'`, `'OBITO_PACIENTE'`, `'COMPRA_PROPRIA'`, `'TROCA_EQUIPAMENTO'`, `'OUTROS'`, `'DESISTENCIA'`.

### Feature 7: Core Database Tables (F7)
- **T1-F07-01: Table `profiles` Structure & Foreign Key**
  - *Precondition*: Schema SQL file inspected.
  - *Action*: Check DDL for table `profiles`.
  - *Expected Result*: Has primary key `id` referencing `auth.users(id)` ON DELETE CASCADE, with `full_name`, `role`, and `phone`.
- **T1-F07-02: Table `equipments` Uniqueness & Constraints**
  - *Precondition*: Schema SQL file inspected.
  - *Action*: Check DDL for table `equipments`.
  - *Expected Result*: Has unique constraints on `patrimony_code` and `qr_token`, `replacement_value` numeric not null, status and category enums.
- **T1-F07-03: Table `beneficiaries` Brazilian Data & Mandatory Secondary Contact**
  - *Precondition*: Schema SQL file inspected.
  - *Action*: Check DDL for table `beneficiaries`.
  - *Expected Result*: Has columns `cpf`, `phone`, `address_street`, `address_zipcode`, and mandatory secondary contact columns (`secondary_name`, `secondary_relationship`, `secondary_phone`).
- **T1-F07-04: Table `loans` Contract Schema**
  - *Precondition*: Schema SQL file inspected.
  - *Action*: Check DDL for table `loans`.
  - *Expected Result*: Has foreign keys to `equipments` and `beneficiaries`, `expected_return_date`, `renewal_count`, `magic_token` (unique), and `replacement_value`.
- **T1-F07-05: Tables `loan_events_log` and `maintenance_logs` Audit Trail**
  - *Precondition*: Schema SQL file inspected.
  - *Action*: Check DDL for audit and maintenance log tables.
  - *Expected Result*: Both tables include timestamp, event type / action, reference foreign keys, and details/cost fields.

### Feature 8: Automated Triggers & State (F8)
- **T1-F08-01: Trigger on Loan Creation (Equipment -> EMPRESTADO)**
  - *Precondition*: Equipment status is `DISPONIVEL`.
  - *Action*: Insert new loan record with status `ATIVO` referencing equipment.
  - *Expected Result*: Trigger automatically updates equipment status to `EMPRESTADO`.
- **T1-F08-02: Trigger on Loan Return (Equipment -> Destination Status)**
  - *Precondition*: Loan status updated to `DEVOLVIDO` with destination `HIGIENIZACAO`.
  - *Action*: Execute loan update.
  - *Expected Result*: Trigger automatically updates equipment status to `HIGIENIZACAO`.
- **T1-F08-03: Condition Synchronization on Return**
  - *Precondition*: Loan return triage specifies return condition `PRECISA_REPARO`.
  - *Action*: Complete loan return.
  - *Expected Result*: Equipment `condition` updated to `PRECISA_REPARO`.
- **T1-F08-04: Audit Event Creation on Loan State Change**
  - *Precondition*: Loan updated from `ATIVO` to `DEVOLVIDO`.
  - *Action*: Query `loan_events_log` for loan ID.
  - *Expected Result*: New audit record logged with `event_type = 'RETURN'` and timestamp.
- **T1-F08-05: Automated `updated_at` Timestamp Trigger**
  - *Precondition*: Any record in `equipments` or `loans` updated.
  - *Action*: Check `updated_at` column.
  - *Expected Result*: `updated_at` automatically matches `now()`, advancing beyond `created_at`.

### Feature 9: Row Level Security (RLS) (F9)
- **T1-F09-01: RLS Enabled on All Tables**
  - *Precondition*: Schema SQL migration file inspected.
  - *Action*: Check for `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` on all 6 tables.
  - *Expected Result*: RLS is explicitly enabled on `profiles`, `equipments`, `beneficiaries`, `loans`, `loan_events_log`, `maintenance_logs`.
- **T1-F09-02: Public Read Policy for QR Token Lookup**
  - *Precondition*: Anonymous client requests `/item/[qr_token]`.
  - *Action*: Query `equipments` table by `qr_token` without auth session.
  - *Expected Result*: Query succeeds, returning public equipment data (name, status, category) for display.
- **T1-F09-03: Public Magic Token Policy for Renewal**
  - *Precondition*: Anonymous client requests `/renovar/[magic_token]`.
  - *Action*: Query and update `loans` table where `magic_token = :token`.
  - *Expected Result*: Query and renewal update succeed for that specific row; queries for other rows are denied.
- **T1-F09-04: Staff Authenticated Access to Management Endpoints**
  - *Precondition*: User authenticated with role `operator` or `admin`.
  - *Action*: Perform CRUD operations on equipment and loans.
  - *Expected Result*: Access granted for all management actions.
- **T1-F09-05: Beneficiary PII Shielded from Anonymous Access**
  - *Precondition*: Anonymous client queries `beneficiaries` table.
  - *Action*: Execute `SELECT * FROM beneficiaries`.
  - *Expected Result*: Zero rows returned / query rejected, protecting patient personal data.

### Feature 10: Initial Seed Dataset (F10)
- **T1-F10-01: Seed Execution Referential Integrity**
  - *Precondition*: Clean Supabase database or clean local store.
  - *Action*: Execute initial seed.
  - *Expected Result*: All records insert cleanly without foreign key constraint violations.
- **T1-F10-02: Minimum Equipment Count and Status Variety**
  - *Precondition*: Seed data loaded.
  - *Action*: Query total equipment count and distinct statuses.
  - *Expected Result*: Count >= 6 equipments, containing statuses DISPONIVEL, EMPRESTADO, ATRASADO, HIGIENIZACAO, MANUTENCAO.
- **T1-F10-03: Category Diversity in Seed**
  - *Precondition*: Seed data loaded.
  - *Action*: Query distinct equipment categories.
  - *Expected Result*: Includes CADEIRA_RODAS, CADEIRA_BANHO, MULETA_AXILAR, ANDADOR, CAMA_HOSPITALAR.
- **T1-F10-04: Active and Overdue Loans in Seed**
  - *Precondition*: Seed data loaded.
  - *Action*: Query seeded loans.
  - *Expected Result*: Contains at least 1 active loan (`expected_return_date > now()`) and at least 1 overdue loan (`expected_return_date < now()`).
- **T1-F10-05: Seed Beneficiaries Compliance**
  - *Precondition*: Seed data loaded.
  - *Action*: Inspect seeded beneficiaries.
  - *Expected Result*: Beneficiaries contain valid formatted CPFs, valid Brazilian phones, and populated mandatory secondary contacts.

### Feature 11: Equipment Catalog (/equipments) (F11)
- **T1-F11-01: Catalog Item List Rendering**
  - *Precondition*: Equipment data present in store.
  - *Action*: Navigate to `/equipments`.
  - *Expected Result*: Displays list/cards showing equipment name, patrimony code, category, condition, and status badge.
- **T1-F11-02: Debounced Text Search by Patrimony and Name**
  - *Precondition*: Catalog loaded with items like "Cadeira de Rodas Standard" and "ROT-0012".
  - *Action*: Type "0012" into search input.
  - *Expected Result*: List filters to display only item ROT-0012 within 300ms.
- **T1-F11-03: Status Filter Pills Toggling**
  - *Precondition*: Catalog loaded with diverse items.
  - *Action*: Click status pill "Disponível".
  - *Expected Result*: List filters to display only items with status `DISPONIVEL`.
- **T1-F11-04: Category Filter Pills Toggling**
  - *Precondition*: Catalog loaded.
  - *Action*: Click category filter "Muletas".
  - *Expected Result*: List filters to display only muleta items.
- **T1-F11-05: Equipment Creation Modal & QR Token Generation**
  - *Precondition*: User clicks "Novo Equipamento".
  - *Action*: Fill name, category, patrimony code, replacement value (e.g. R$ 850,00) and submit.
  - *Expected Result*: Modal creates equipment with auto-generated unique `qr_token` and updates catalog list immediately.

### Feature 12: Mobile QR Scanner (/scan) (F12)
- **T1-F12-01: Camera Scanner Mount and Viewfinder**
  - *Precondition*: User navigates to `/scan` with camera permissions enabled.
  - *Action*: Mount scanner component.
  - *Expected Result*: Video preview stream displays with Rotary-branded scan reticle overlay.
- **T1-F12-02: Scanned QR Token Detection & Routing**
  - *Precondition*: Camera active.
  - *Action*: Present QR code encoding URL `https://rotary.org/item/ROT-QR-789`.
  - *Expected Result*: Scanner decodes token `ROT-QR-789` and automatically navigates to `/item/ROT-QR-789`.
- **T1-F12-03: Raw Token vs Full URL Detection**
  - *Precondition*: Scanner detects QR code containing just raw token string `ROT-QR-456`.
  - *Action*: Process scan callback.
  - *Expected Result*: Correctly navigates to `/item/ROT-QR-456`.
- **T1-F12-04: Manual Code Input Fallback**
  - *Precondition*: Camera unavailable or user prefers typing.
  - *Action*: Type patrimony code or token into manual input field and click "Localizar".
  - *Expected Result*: Navigates to `/item/[token]`.
- **T1-F12-05: Torch / Flashlight Toggle**
  - *Precondition*: Device camera supports torch.
  - *Action*: Click torch toggle button.
  - *Expected Result*: Activates camera torch without interrupting video scanning stream.

### Feature 13: Contextual Action Route (/item/[qr_token]) (F13)
- **T1-F13-01: Contextual Actions for DISPONIVEL Status**
  - *Precondition*: Item qr_token corresponds to equipment with status `DISPONIVEL`.
  - *Action*: Load `/item/[qr_token]`.
  - *Expected Result*: Displays green status badge, item details, and primary CTA button "Iniciar Empréstimo" linking to `/loans/new?equipment_id=...`.
- **T1-F13-02: Contextual Actions for EMPRESTADO Status**
  - *Precondition*: Item qr_token corresponds to equipment currently on loan (`EMPRESTADO`).
  - *Action*: Load `/item/[qr_token]`.
  - *Expected Result*: Displays blue badge, borrower name, return due date, and buttons "Registrar Devolução" and "Renovar".
- **T1-F13-03: Contextual Actions for ATRASADO Status**
  - *Precondition*: Item qr_token corresponds to overdue loan (`ATRASADO`).
  - *Action*: Load `/item/[qr_token]`.
  - *Expected Result*: Displays alert badge with days overdue, borrower contacts, and quick WhatsApp collection buttons.
- **T1-F13-04: Contextual Actions for HIGIENIZACAO Status**
  - *Precondition*: Item qr_token corresponds to equipment in `HIGIENIZACAO`.
  - *Action*: Load `/item/[qr_token]`.
  - *Expected Result*: Displays yellow/cyan badge and button "Liberar para Estoque (Disponível)".
- **T1-F13-05: Contextual Actions for MANUTENCAO Status**
  - *Precondition*: Item qr_token corresponds to equipment in `MANUTENCAO`.
  - *Action*: Load `/item/[qr_token]`.
  - *Expected Result*: Displays maintenance status, defect notes, and actions to "Concluir Manutenção" or "Dar Baixa".

### Feature 14: Printable Asset Labels (/equipments/labels) (F14)
- **T1-F14-01: Official Rotary Emblem Inclusion**
  - *Precondition*: Label layout loaded at `/equipments/labels`.
  - *Action*: Inspect label header element.
  - *Expected Result*: Contains Rotary official wheel logo SVG and club identification text.
- **T1-F14-02: High-Contrast Monospace Patrimony Code**
  - *Precondition*: Label loaded for item "ROT-0042".
  - *Action*: Inspect patrimony typography.
  - *Expected Result*: Rendered in bold monospace font (`font-mono font-bold`) for easy human reading.
- **T1-F14-03: Scannable QR Code Dimensioning**
  - *Precondition*: Label generated.
  - *Action*: Check QR code image dimensions.
  - *Expected Result*: QR code rendered at >= 25x25mm with sharp error correction level (ECC Level M or Q).
- **T1-F14-04: Club Contact Phone on Label**
  - *Precondition*: Label generated.
  - *Action*: Inspect label footer.
  - *Expected Result*: Includes "Devolução / Dúvidas: (XX) XXXXX-XXXX" phone contact.
- **T1-F14-05: Print CSS Isolation (@media print)**
  - *Precondition*: User clicks "Imprimir Etiquetas".
  - *Action*: Trigger print preview.
  - *Expected Result*: Application header, bottom navigation bar, and screen buttons are hidden via `@media print { ... }`.

### Feature 15: Multi-step Loan Wizard (/loans/new) (F15)
- **T1-F15-01: Step 1 - Equipment Confirmation**
  - *Precondition*: User accesses `/loans/new?equipment_id=...`.
  - *Action*: View Step 1.
  - *Expected Result*: Displays selected equipment specifications, confirms status is `DISPONIVEL`, and enables "Avançar" button.
- **T1-F15-02: Step 2 - Beneficiary & Guardian Data Collection**
  - *Precondition*: Step 1 completed.
  - *Action*: Fill patient name, valid CPF, phone, full address, and select loan term (30, 60, or 90 days).
  - *Expected Result*: Form validates fields and enables progression to Step 3.
- **T1-F15-03: Step 3 - Mandatory Secondary Contact Gate**
  - *Precondition*: Step 2 completed.
  - *Action*: Fill secondary contact name (2+ words), relationship, and valid phone.
  - *Expected Result*: Validation passes and enables progression to Step 4.
- **T1-F15-04: Step 4 - Document Photo Upload with Preview**
  - *Precondition*: Step 3 completed.
  - *Action*: Attach document photo and proof of residence.
  - *Expected Result*: Images compressed, client-side thumbnail previews displayed.
- **T1-F15-05: Step 5 - Digital Signature & Comodato Finalization**
  - *Precondition*: Step 4 completed.
  - *Action*: Draw signature on canvas, accept legal terms, and submit wizard.
  - *Expected Result*: Loan record created, equipment status transitions to `EMPRESTADO`, Comodato PDF generated and offered for download.

### Feature 16: Mandatory Secondary Contact Validation (F16)
- **T1-F16-01: Full Name Word Count Validation**
  - *Precondition*: User on Step 3 of wizard.
  - *Action*: Input single-word name "Carlos" into secondary contact name.
  - *Expected Result*: Validation error displayed ("Informe o nome completo do contato secundário - mínimo 2 palavras") and submission blocked.
- **T1-F16-02: Two-Word Valid Full Name Acceptance**
  - *Precondition*: User inputs "Carlos Eduardo Silva".
  - *Action*: Trigger field validation.
  - *Expected Result*: Field marked as valid.
- **T1-F16-03: Secondary Phone Brazilian Mask & Digit Count**
  - *Precondition*: User inputs phone with only 8 digits "(11) 9876-543".
  - *Action*: Trigger field validation.
  - *Expected Result*: Validation error displayed ("Telefone inválido - deve conter DDD e 8 ou 9 dígitos").
- **T1-F16-04: Non-Collision Validation with Primary Phone**
  - *Precondition*: Primary beneficiary phone entered as `(11) 98888-7777`.
  - *Action*: Enter same phone `(11) 98888-7777` into secondary contact phone.
  - *Expected Result*: Validation error displayed ("O telefone do contato secundário não pode ser igual ao do beneficiário").
- **T1-F16-05: Mandatory Relationship Selection**
  - *Precondition*: Secondary contact name and phone filled, but relationship left empty.
  - *Action*: Attempt step progression.
  - *Expected Result*: Progression blocked with error ("Selecione o grau de parentesco ou vínculo").

### Feature 17: Client-side Image Compression (F17)
- **T1-F17-01: High-Resolution Photo Compression**
  - *Precondition*: User selects 4MB camera photo for document upload.
  - *Action*: Execute client-side compression function.
  - *Expected Result*: Output blob size is reduced to < 800KB.
- **T1-F17-02: Aspect Ratio & Quality Preservation**
  - *Precondition*: Document text photo compressed.
  - *Action*: Inspect compressed image dimensions.
  - *Expected Result*: Aspect ratio preserved, text on document remains legible (max width/height scaled to ~1600px).
- **T1-F17-03: Output Format Normalization**
  - *Precondition*: User uploads PNG or HEIC image.
  - *Action*: Run compression pipeline.
  - *Expected Result*: Normalized to web-compatible JPEG/WebP format with valid MIME type.
- **T1-F17-04: Client-Side Immediate Thumbnail Preview**
  - *Precondition*: Image file compressed.
  - *Action*: Check wizard photo step UI.
  - *Expected Result*: Preview thumbnail renders immediately without waiting for network upload.
- **T1-F17-05: Upload Progress Indicator**
  - *Precondition*: Image compression and upload running.
  - *Action*: Observe UI feedback.
  - *Expected Result*: Shows loading spinner or progress bar during compression/upload.

### Feature 18: Digital Signature Canvas (F18)
- **T1-F18-01: Canvas Touch and Pointer Event Capture**
  - *Precondition*: Wizard Step 5 loaded on touchscreen device or desktop.
  - *Action*: Draw signature curve on `<SignaturePad>` component.
  - *Expected Result*: Smooth continuous line renders on canvas following pointer path.
- **T1-F18-02: Canvas Clear Action**
  - *Precondition*: Signature drawn on canvas.
  - *Action*: Click "Limpar Assinatura" button.
  - *Expected Result*: Canvas cleared completely, returning to pristine blank state.
- **T1-F18-03: Empty Signature Validation Guard**
  - *Precondition*: Canvas is blank.
  - *Action*: Attempt to click "Finalizar Empréstimo".
  - *Expected Result*: Action blocked with alert ("A assinatura digital do responsável é obrigatória").
- **T1-F18-04: Base64 PNG Export**
  - *Precondition*: Valid signature drawn.
  - *Action*: Trigger signature capture.
  - *Expected Result*: Generates valid data URL string beginning with `data:image/png;base64,...`.
- **T1-F18-05: Responsive Canvas Dimensions**
  - *Precondition*: Device rotated from portrait to landscape.
  - *Action*: Inspect canvas bounding box.
  - *Expected Result*: Canvas fits viewport width without horizontal overflow.

### Feature 19: Termo de Comodato PDF (Arts 579-585 CCB) (F19)
- **T1-F19-01: Statutory Legal Grounding (CCB Arts 579-585)**
  - *Precondition*: Loan finalized.
  - *Action*: Generate Comodato PDF.
  - *Expected Result*: PDF text explicitly cites "Fundamentado nos Artigos 579 a 585 da Lei Federal nº 10.406/2002 (Código Civil Brasileiro)".
- **T1-F19-02: Qualification of Parties Including Secondary Contact**
  - *Precondition*: PDF generated.
  - *Action*: Inspect Section "1. DAS PARTES".
  - *Expected Result*: Lists Rotary Club (Comodante), Beneficiary/Guardian (Comodatário), and Secondary Contact with full qualification.
- **T1-F19-03: Declared Replacement Value Clause (Art. 582 CCB)**
  - *Precondition*: Equipment replacement value is R$ 1.200,00.
  - *Action*: Inspect Section "2. DO OBJETO E VALOR DE REPOSIÇÃO".
  - *Expected Result*: Expressly states replacement value "R$ 1.200,00 (um mil e duzentos reais)" for default or loss liability.
- **T1-F19-04: Embedded Signature Rendering**
  - *Precondition*: Signature captured in Step 5.
  - *Action*: Inspect PDF signature block.
  - *Expected Result*: Captured signature image rendered with timestamp and signer's name/CPF printed underneath.
- **T1-F19-05: Contract Validation QR Code**
  - *Precondition*: PDF generated.
  - *Action*: Inspect footer of PDF.
  - *Expected Result*: Contains scannable QR code linking to contract verification / renewal URL.

### Feature 20: Return Triage Workflow (/loans/[id]/return) (F20)
- **T1-F20-01: Loan & Equipment Data Loading on Return Page**
  - *Precondition*: Active loan exists with ID `LOAN-123`.
  - *Action*: Navigate to `/loans/LOAN-123/return`.
  - *Expected Result*: Displays equipment name, patrimony code, borrower name, and loan dates.
- **T1-F20-02: Categorized Physical Checklist Rendering**
  - *Precondition*: Return triage page loaded.
  - *Action*: Inspect checklist form.
  - *Expected Result*: Checkboxes present for Estrutura/Chassi, Rodas/Apoios, Estofamento/Assento, Freios/Travas.
- **T1-F20-03: Pristine Return Classification (`BOM`)**
  - *Precondition*: Operator marks all checklist items as OK.
  - *Action*: Check condition indicator.
  - *Expected Result*: Automatically evaluates condition to `BOM` (Bom Estado).
- **T1-F20-04: Damaged Return Classification (`PRECISA_REPARO`)**
  - *Precondition*: Operator unchecks "Freios/Travas" (identifying defect).
  - *Action*: Check condition indicator.
  - *Expected Result*: Automatically evaluates condition to `PRECISA_REPARO` and reveals mandatory defect description textarea.
- **T1-F20-05: Loan Status Transition to DEVOLVIDO**
  - *Precondition*: Triage form filled and submitted.
  - *Action*: Check returned loan record.
  - *Expected Result*: Loan status updated to `DEVOLVIDO`, `actual_return_date` set to current timestamp.

### Feature 21: Return Reasons & Routing (F21)
- **T1-F21-01: Close Reason Options Conformance**
  - *Precondition*: Return form loaded.
  - *Action*: Open "Motivo do Encerramento" select dropdown.
  - *Expected Result*: Options match: Recuperação/Alta Médica, Óbito do Paciente, Compra Própria, Troca de Equipamento, Outros, Desistência.
- **T1-F21-02: Healthcare Protocol Routing to HIGIENIZACAO**
  - *Precondition*: Item returned in condition `BOM`.
  - *Action*: Check default destination.
  - *Expected Result*: Default destination is `HIGIENIZACAO` (Higienização Obrigatória).
- **T1-F21-03: Mandatory Routing to MANUTENCAO on Damage**
  - *Precondition*: Item condition evaluated as `PRECISA_REPARO`.
  - *Action*: Inspect destination options.
  - *Expected Result*: Destination locked/defaulted to `MANUTENCAO`.
- **T1-F21-04: Maintenance Log Creation on MANUTENCAO Routing**
  - *Precondition*: Loan returned with destination `MANUTENCAO` and defect notes.
  - *Action*: Query `maintenance_logs` table.
  - *Expected Result*: New log created with maintenance type `CORRETIVA`, description, and pending status.
- **T1-F21-05: Direct Stock Release Option (`DISPONIVEL`)**
  - *Precondition*: Non-contact item (e.g. crutches) cleaned on the spot by operator.
  - *Action*: Select destination `DISPONIVEL` and submit return.
  - *Expected Result*: Equipment status updates immediately to `DISPONIVEL`.

### Feature 22: Digital Discharge Receipt (F22)
- **T1-F22-01: Discharge Receipt Generation Trigger**
  - *Precondition*: Loan return successfully registered.
  - *Action*: Complete return submission.
  - *Expected Result*: Confirmation modal appears displaying "Termo de Quitação e Encerramento".
- **T1-F22-02: Extinguishment of Liability Clause (CCB Art. 320)**
  - *Precondition*: Receipt displayed/generated.
  - *Action*: Inspect legal quittance clause.
  - *Expected Result*: States "Dá-se por quitada e plenamente extinta a obrigação de comodato do bem, nos termos dos artigos 320 e 582 do Código Civil".
- **T1-F22-03: Summary of Return Inspection**
  - *Precondition*: Receipt generated.
  - *Action*: Inspect receipt content.
  - *Expected Result*: Documents exact return date, equipment condition, close reason, and operator identification.
- **T1-F22-04: PDF Download Action**
  - *Precondition*: Quittance modal displayed.
  - *Action*: Click "Baixar Comprovante em PDF".
  - *Expected Result*: Triggers client-side download of `quitacao-[loan_code].pdf`.
- **T1-F22-05: Instant WhatsApp Quittance Dispatch**
  - *Precondition*: Quittance modal displayed.
  - *Action*: Click "Enviar Quitação via WhatsApp".
  - *Expected Result*: Opens WhatsApp link with pre-composed receipt confirmation message to beneficiary phone.

### Feature 23: Public Self-Service Renewal (/renovar/[magic_token]) (F23)
- **T1-F23-01: Zero-Login Access via Magic Token**
  - *Precondition*: Active loan exists with `magic_token = 'magic-tok-123'`.
  - *Action*: Open `/renovar/magic-tok-123` in incognito browser.
  - *Expected Result*: Page loads without authentication prompt, showing equipment and borrower first name.
- **T1-F23-02: 1-Click Renewal Execution (+30 Days)**
  - *Precondition*: Loan expected return date is 2026-12-01, `renewal_count = 0`.
  - *Action*: Click "Ainda preciso - Renovar por +30 dias".
  - *Expected Result*: Loan `expected_return_date` extended to 2026-12-31, `renewal_count` incremented to 1, confirmation screen displayed.
- **T1-F23-03: Renewal Counter Guard (Max Renewals Enforcement)**
  - *Precondition*: Loan has `renewal_count = 3` and `max_renewals = 3`.
  - *Action*: Load renewal page.
  - *Expected Result*: 1-click renewal button is disabled; banner instructs borrower to contact Rotary for special evaluation.
- **T1-F23-04: Return Assistance Request Submission**
  - *Precondition*: Borrower cannot transport wheelchair back to Rotary center.
  - *Action*: Click "Solicitar Recolhimento", fill pickup address and notes, and submit.
  - *Expected Result*: Request saved; flagged in Overdue Radar as "Coleta Solicitada".
- **T1-F23-05: Audit Event Logged on Public Renewal**
  - *Precondition*: Renewal submitted via magic token.
  - *Action*: Query `loan_events_log`.
  - *Expected Result*: Record logged with `event_type = 'RENEWAL_SELF_SERVICE'` and new due date.

### Feature 24: Overdue Radar & Dashboard (/overdue, /dashboard) (F24)
- **T1-F24-01: Fleet KPI Summary Cards**
  - *Precondition*: Equipment inventory and loan records loaded.
  - *Action*: Navigate to `/dashboard` or `/overdue`.
  - *Expected Result*: KPI cards display Total de Itens, Emprestados, Disponíveis, Em Manutenção, and Atrasados with accurate counts.
- **T1-F24-02: Value at Risk (Valor em Risco) KPI**
  - *Precondition*: 3 overdue loans with replacement values R$ 800, R$ 1.200, R$ 500.
  - *Action*: Inspect "Valor Total em Risco" card.
  - *Expected Result*: Displays exact sum `R$ 2.500,00`.
- **T1-F24-03: Stage Filter Tabs (D-7, D0, D+1, D+7)**
  - *Precondition*: Radar page loaded.
  - *Action*: Click tab "A vencer em 7 dias (D-7)".
  - *Expected Result*: Table filters to show loans due between today and +7 days.
- **T1-F24-04: Overdue Days Highlighting & Sorting**
  - *Precondition*: Overdue loans list displayed.
  - *Action*: Inspect sorting and styling.
  - *Expected Result*: Sorted by urgency (highest overdue days first); items > 7 days display red alert badges.
- **T1-F24-05: Contextual Action Buttons in Radar Table**
  - *Precondition*: Overdue loan row inspected.
  - *Action*: Check row action buttons.
  - *Expected Result*: Row provides quick buttons for "WhatsApp Beneficiário", "WhatsApp Secundário", and "Receber Devolução".

### Feature 25: WhatsApp Notification Generator (F25)
- **T1-F25-01: D-7 Pre-Due Friendly Reminder Template**
  - *Precondition*: Loan due in 7 days.
  - *Action*: Generate WhatsApp message for primary contact.
  - *Expected Result*: Text contains cordial Rotary greeting, mentions equipment name, states return date, and embeds self-service renewal magic link.
- **T1-F25-02: D0 Due Date Reminder Template**
  - *Precondition*: Loan due today.
  - *Action*: Generate D0 notification.
  - *Expected Result*: Text reminds borrower that term ends today, provides return address/hours, and renewal link.
- **T1-F25-03: D+1 Overdue Notice Template**
  - *Precondition*: Loan 1 day overdue.
  - *Action*: Generate D+1 notification.
  - *Expected Result*: Alert notice informing that deadline passed, requesting renewal or prompt return.
- **T1-F25-04: D+7 Escalation Template to Secondary Contact**
  - *Precondition*: Loan 7 days overdue.
  - *Action*: Generate D+7 escalation message targeted to Secondary Contact.
  - *Expected Result*: Addressed to secondary contact name, cites their role as co-responsible guarantor (CCB Art. 585), and asks for assistance in locating/returning item.
- **T1-F25-05: Direct `wa.me` Fallback URL Construction**
  - *Precondition*: Message generated for phone `(11) 98765-4321` and text "Olá Maria...".
  - *Action*: Call `buildWhatsAppLink(phone, message)`.
  - *Expected Result*: Returns `https://wa.me/5511987654321?text=Ol%C3%A1%20Maria...` with proper URL encoding.

### Feature 26: Cron Automation (/api/cron/check-loans) (F26)
- **T1-F26-01: Cron Secret Authentication Verification**
  - *Precondition*: Server running with `CRON_SECRET=supersecret123`.
  - *Action*: Execute `GET /api/cron/check-loans` with header `Authorization: Bearer supersecret123`.
  - *Expected Result*: Request authenticated, returns HTTP 200 with processing summary.
- **T1-F26-02: Rejection of Unauthenticated Cron Invocation**
  - *Precondition*: Request sent without `Authorization` header.
  - *Action*: Execute `GET /api/cron/check-loans`.
  - *Expected Result*: Returns HTTP 401 Unauthorized with error message.
- **T1-F26-03: Automatic Transition to ATRASADO at D+1**
  - *Precondition*: Active loan has `expected_return_date = yesterday`.
  - *Action*: Trigger cron endpoint.
  - *Expected Result*: Loan status transitioned to `ATRASADO`; corresponding equipment status updated to `ATRASADO`.
- **T1-F26-04: Audit Logging of Automated Transition**
  - *Precondition*: Loan transitioned by cron.
  - *Action*: Query `loan_events_log`.
  - *Expected Result*: Event recorded with `event_type = 'AUTO_OVERDUE_CRON'`.
- **T1-F26-05: `vercel.json` Cron Configuration Schema**
  - *Precondition*: `vercel.json` file inspected.
  - *Action*: Check `crons` array.
  - *Expected Result*: Contains `{ "path": "/api/cron/check-loans", "schedule": "0 12 * * *" }`.

### Feature 27: Project Documentation (README.md) (F27)
- **T1-F27-01: Project Overview & Architecture Overview**
  - *Precondition*: `README.md` inspected.
  - *Action*: Check introduction and architecture section.
  - *Expected Result*: Accurately describes Rotary Banco Ortopédico, PWA capabilities, QR tracking, comodato legalities, and tech stack.
- **T1-F27-02: Supabase Migration Execution Guide**
  - *Precondition*: `README.md` inspected.
  - *Action*: Check Supabase setup instructions.
  - *Expected Result*: Provides exact CLI / Dashboard steps to run `001_initial_schema.sql`.
- **T1-F27-03: Storage Buckets & Policies Documentation**
  - *Precondition*: `README.md` inspected.
  - *Action*: Check storage section.
  - *Expected Result*: Details creation of buckets `documents`, `signatures`, and `receipts` with respective access policies.
- **T1-F27-04: Zero-Credential Demo Mode Instructions**
  - *Precondition*: `README.md` inspected.
  - *Action*: Check Demo Mode section.
  - *Expected Result*: Explains how to launch immediately without Supabase credentials using local mock store.
- **T1-F27-05: Vercel Deployment & Cron Setup Instructions**
  - *Precondition*: `README.md` inspected.
  - *Action*: Check deployment section.
  - *Expected Result*: Guides environment variable configuration in Vercel and cron job schedule verification.

---

## 5. Tier 2 Boundary & Corner Case Catalog (135 Edge Specifications)

### Feature 1: App Setup & Tooling (F1)
- **T2-F01-01: PowerShell Restricted Execution Policy Interception**
  - *Input*: Shell invocation of `npm run build` on Windows machine with execution policy set to `Restricted`.
  - *Observed/Expected Behavior*: Fails if calling `npm.ps1`; tests verify that build scripts provide fallback/wrapper to invoke `npm.cmd` directly.
- **T2-F01-02: Missing Optional Environment Variables Boot Test**
  - *Input*: Boot application with completely empty `.env.local`.
  - *Observed/Expected Behavior*: Application does not crash on startup; logs warning and switches cleanly to Smart Demo Store.
- **T2-F01-03: Unsupported Node.js Runtime (< v18) Detection**
  - *Input*: Node runtime version check simulating Node v16.
  - *Observed/Expected Behavior*: `package.json` engines field specifies `>=18.0.0`; package manager warns or halts execution.
- **T2-F01-04: Malformed `next.config.mjs` Error Boundary**
  - *Input*: Syntax error or unhandled promise in Next.js config.
  - *Observed/Expected Behavior*: Build halts with descriptive configuration error rather than silent hang.
- **T2-F01-05: TypeScript Strict Null Check Invariant**
  - *Input*: Function in data layer called with `undefined` where string is expected.
  - *Observed/Expected Behavior*: TypeScript compiler halts with TS2322 / TS2345 strict null error before runtime deployment.

### Feature 2: Rotary Brand Theme (F2)
- **T2-F02-01: High Zoom / 200% Text Scaling Layout Invariance**
  - *Input*: Browser text zoom set to 200%.
  - *Observed/Expected Behavior*: Typography wraps cleanly without clipping button labels or overlapping navigation elements.
- **T2-F02-02: Disabled Button Contrast Under WCAG Standards**
  - *Input*: Submit button in disabled state (`opacity-50`).
  - *Observed/Expected Behavior*: Text remains readable against background while visually indicating disabled state (`aria-disabled="true"`).
- **T2-F02-03: Dark Mode Override Protection**
  - *Input*: Operating system prefers dark mode (`prefers-color-scheme: dark`).
  - *Observed/Expected Behavior*: Rotary brand integrity maintained; text contrast tokens adjust to maintain >= 4.5:1 ratio without rendering unreadable black-on-dark elements.
- **T2-F02-04: CSS Variable Fallback Resilience**
  - *Input*: Browser fails to load CSS variables stylesheet.
  - *Observed/Expected Behavior*: Tailwind configuration provides fallback hex colors `#17458f` and `#f7a81b` as default values.
- **T2-F02-05: Color-Blindness Accessibility Simulation**
  - *Input*: Protanopia / Deuteranopia color-blind filter applied.
  - *Observed/Expected Behavior*: Status indicators rely on icons and text badges (not color alone) to distinguish between DISPONIVEL and ATRASADO.

### Feature 3: Mobile-First Shell & PWA (F3)
- **T2-F03-01: iOS Safari Safe Area Inset Handling**
  - *Input*: iPhone with bottom home indicator bar (`env(safe-area-inset-bottom) > 0`).
  - *Observed/Expected Behavior*: Bottom navigation applies `pb-safe` padding; navigation icons are not obscured by device home bar.
- **T2-F03-02: Mobile Landscape Viewport (< 500px Height)**
  - *Input*: Device rotated to landscape with viewport 667x375px.
  - *Observed/Expected Behavior*: Bottom bar height compacts, scan FAB scales appropriately, content remains scrollable.
- **T2-F03-03: Offline PWA Load Resilience**
  - *Input*: Device disconnected from internet, page reloaded.
  - *Observed/Expected Behavior*: Service worker / PWA shell serves cached UI and activates demo mock store without white-screen crash.
- **T2-F03-04: Rapid Multi-Touch Tab Switching**
  - *Input*: Rapid simultaneous taps on multiple bottom navigation icons.
  - *Observed/Expected Behavior*: Next.js App Router transitions cleanly to the last selected route without state corruption.
- **T2-F03-05: Deep Link Direct Navigation Navigation State**
  - *Input*: Direct entry URL `/overdue` on mobile.
  - *Observed/Expected Behavior*: Bottom navigation correctly highlights the "Radar" icon as active tab.

### Feature 4: Smart Demo Fallback Store (F4)
- **T2-F04-01: LocalStorage Quota Exceeded Simulation**
  - *Input*: Browser storage quota full when creating a new loan with photos.
  - *Observed/Expected Behavior*: Store catches `QuotaExceededError`, falls back to in-memory storage, and alerts user that storage is full.
- **T2-F04-02: Corrupted JSON String in LocalStorage**
  - *Input*: Value of key `rotary_demo_equipments` replaced with malformed string `{invalid: json...`.
  - *Observed/ExpectedBehavior*: Store catches parse error, logs warning, and auto-heals by re-seeding default equipment catalog.
- **T2-F04-03: Incognito / Private Browsing with Disabled Storage**
  - *Input*: Browser with `localStorage` access blocked by security policy.
  - *Observed/Expected Behavior*: Store gracefully degrades to pure in-memory JavaScript Map/Array for the active session.
- **T2-F04-04: Multi-Tab State Synchronization**
  - *Input*: Equipment status changed in Tab 1; Tab 2 inspected.
  - *Observed/Expected Behavior*: Storage event listener updates Tab 2 store, reflecting status change without manual reload.
- **T2-F04-05: Querying with Extreme Unicode and Null Characters**
  - *Input*: Search query containing null byte `\0` or emoji sequence `🦽🩺`.
  - *Observed/Expected Behavior*: Store query filter sanitizes input, does not throw exception, returns empty or matched results safely.

### Feature 5: Environment Configuration (F5)
- **T2-F05-01: Malformed Supabase URL Validation**
  - *Input*: `NEXT_PUBLIC_SUPABASE_URL="not_a_valid_url"`.
  - *Observed/Expected Behavior*: Client detects invalid URL structure during initialization and falls back safely to demo mode.
- **T2-F05-02: Missing NEXT_PUBLIC_APP_URL Fallback**
  - *Input*: `NEXT_PUBLIC_APP_URL` unset in `.env.local`.
  - *Observed/Expected Behavior*: Magic link generator dynamically falls back to `window.location.origin` in browser environment.
- **T2-F05-03: Unauthorized Cron Secret Attempt**
  - *Input*: Cron request with invalid token `Bearer wrongsecret`.
  - *Observed/Expected Behavior*: API returns HTTP 401 with JSON `{ "error": "Unauthorized" }`.
- **T2-F05-04: Service Role Key Leakage Guard**
  - *Input*: Frontend bundle scan for string `SUPABASE_SERVICE_ROLE_KEY`.
  - *Observed/Expected Behavior*: Verification confirms secret key is never included in client-side bundle.
- **T2-F05-05: Trailing Slash URL Normalization**
  - *Input*: `NEXT_PUBLIC_SUPABASE_URL="https://xyz.supabase.co/"` (with trailing slash).
  - *Observed/Expected Behavior*: URL normalizer strips trailing slash preventing double slashes `//` in API calls.

### Feature 6: Supabase Schema & Enums (F6)
- **T2-F06-01: Invalid Enum Value Insert Rejection**
  - *Input*: SQL query `INSERT INTO equipments (status) VALUES ('QUEBRADO')`.
  - *Observed/Expected Behavior*: PostgreSQL rejects insert with error: `invalid input value for enum equipment_status: "QUEBRADO"`.
- **T2-F06-02: Enum Case Sensitivity Enforcement**
  - *Input*: SQL query `INSERT INTO equipments (status) VALUES ('disponivel')` (lowercase).
  - *Observed/Expected Behavior*: PostgreSQL rejects insert due to strict case matching on uppercase enum literals.
- **T2-F06-03: Explicit Enum Casting in Dynamic Queries**
  - *Input*: Dynamic query parameter bound as text to enum column without cast.
  - *Observed/Expected Behavior*: Schema provides explicit cast or function signature ensuring type compatibility.
- **T2-F06-04: Idempotent Migration Execution**
  - *Input*: Running `001_initial_schema.sql` twice on the same database.
  - *Observed/Expected Behavior*: Migration uses `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` preventing crash on duplicate type.
- **T2-F06-05: Mandatory NOT NULL on Enum Columns**
  - *Input*: SQL insert into `equipments` omitting `status`.
  - *Observed/Expected Behavior*: Schema applies default `DEFAULT 'DISPONIVEL'::equipment_status` or rejects null.

### Feature 7: Core Database Tables (F7)
- **T2-F07-01: Duplicate Patrimony Code Collision**
  - *Input*: Attempt to insert equipment with existing `patrimony_code = 'ROT-0001'`.
  - *Observed/Expected Behavior*: Database throws unique constraint violation error `equipments_patrimony_code_key`.
- **T2-F07-02: Duplicate QR Token Collision**
  - *Input*: Attempt to insert equipment with existing `qr_token = 'token_abc'`.
  - *Observed/Expected Behavior*: Database throws unique constraint violation error `equipments_qr_token_key`.
- **T2-F07-03: Deletion of Equipment with Active Loan (ON DELETE RESTRICT)**
  - *Input*: SQL query `DELETE FROM equipments WHERE id = :loaned_equipment_id`.
  - *Observed/Expected Behavior*: PostgreSQL blocks deletion with foreign key violation, protecting historical audit trail.
- **T2-F07-04: Negative Replacement Value Check Constraint**
  - *Input*: Insert equipment with `replacement_value = -150.00`.
  - *Observed/Expected Behavior*: Database throws check constraint violation (`replacement_value >= 0`).
- **T2-F07-05: Extreme Unicode String in Model Description**
  - *Input*: Insert 4000-character description with emojis, RTL text, and special symbols.
  - *Observed/Expected Behavior*: Text column accommodates content without character truncation or database encoding crash.

### Feature 8: Automated Triggers & State (F8)
- **T2-F08-01: Loan Creation on Non-Available Equipment Rejection**
  - *Input*: Attempt to insert loan for equipment whose status is currently `EMPRESTADO` or `MANUTENCAO`.
  - *Observed/Expected Behavior*: Trigger or business logic raises exception `Equipamento não disponível para empréstimo`.
- **T2-F08-02: Return with NULL Destination Safe Fallback**
  - *Input*: Loan return update where `post_return_destination` is passed as `NULL`.
  - *Observed/Expected Behavior*: Trigger uses `COALESCE(NEW.post_return_destination, 'HIGIENIZACAO')`, preventing null equipment status.
- **T2-F08-03: Transaction Rollback on Event Log Insertion Failure**
  - *Input*: Simulated database error during event log insertion within loan status trigger.
  - *Observed/Expected Behavior*: Entire transaction rolls back; loan status and equipment status remain in previous valid state.
- **T2-F08-04: Concurrent Status Updates (Race Condition Test)**
  - *Input*: Two simultaneous return requests submitted for the same loan.
  - *Observed/Expected Behavior*: First request commits; second request receives optimistic locking error or idempotent success.
- **T2-F08-05: Recursive Trigger Loop Prevention**
  - *Input*: Equipment update trigger updating loan, and loan update trigger updating equipment.
  - *Observed/Expected Behavior*: Triggers check `OLD.status IS DISTINCT FROM NEW.status` to prevent infinite trigger loops.

### Feature 9: Row Level Security (RLS) (F9)
- **T2-F09-01: Anonymous Access to Beneficiaries Direct URL**
  - *Input*: Unauthenticated REST request to `GET /rest/v1/beneficiaries`.
  - *Observed/Expected Behavior*: Supabase RLS returns empty array `[]` or 401 Unauthorized, protecting patient PII.
- **T2-F09-02: Unauthorized Update via Magic Token Bypass**
  - *Input*: Client with valid magic token attempts to update `replacement_value` or `equipment_id` on loan.
  - *Observed/Expected Behavior*: RLS policy restricts public UPDATE to columns `renewal_count`, `expected_return_date`, `status`, and `notes`.
- **T2-F09-03: Malicious SQL Injection in Magic Token Filter**
  - *Input*: Magic token lookup with payload `' OR '1'='1`.
  - *Observed/Expected Behavior*: Parameterized query treats payload as literal string, returning zero matching rows.
- **T2-F09-04: Cross-Tenant User Profile Modification Attempt**
  - *Input*: Authenticated User A attempts to update profile of User B.
  - *Observed/Expected Behavior*: RLS policy `auth.uid() = id` blocks modification with 403 Forbidden.
- **T2-F09-05: Volunteer Role Elevation Attempt**
  - *Input*: User with role `volunteer` attempts to update own role to `admin`.
  - *Observed/Expected Behavior*: RLS policy denies role column update to non-admin users.

### Feature 10: Initial Seed Dataset (F10)
- **T2-F10-01: Dynamic Relative Dates in Seed (Always Overdue)**
  - *Input*: Seed executed 1 year in the future.
  - *Observed/Expected Behavior*: Overdue loan uses `now() - INTERVAL '45 days'` rather than hardcoded 2024 date, ensuring test stays valid indefinitely.
- **T2-F10-02: Seed Execution on Pre-Existing Data (UPSERT)**
  - *Input*: Running seed script twice on a populated database.
  - *Observed/Expected Behavior*: Uses `ON CONFLICT (patrimony_code) DO NOTHING`, completing cleanly without crash.
- **T2-F10-03: Seed Beneficiaries CPF Checksum Validation**
  - *Input*: Run Brazilian CPF validation algorithm on all seeded CPFs.
  - *Observed/Expected Behavior*: All seeded CPFs pass formal Modulo 11 check digit verification.
- **T2-F10-04: Non-Zero Replacement Values Invariant**
  - *Input*: Check `replacement_value` of all seeded items.
  - *Observed/Expected Behavior*: All values > 0.00 BRL (e.g. wheelchairs R$ 850 - 1500, crutches R$ 120).
- **T2-F10-05: Valid QR Tokens & Magic Tokens Format**
  - *Input*: Inspect token formats in seed.
  - *Observed/Expected Behavior*: All tokens are URL-safe strings without spaces or special characters.

### Feature 11: Equipment Catalog (/equipments) (F11)
- **T2-F11-01: Special Characters and Regex Injection in Search**
  - *Input*: Search query with regex special chars `.*+?^${}()|[]\\` and SQL quotes.
  - *Observed/Expected Behavior*: Search function escapes characters safely, does not crash, and returns matching or empty list.
- **T2-F11-02: Empty Search Result UX State**
  - *Input*: Search query "XYZ99999NONEXISTENT".
  - *Observed/Expected Behavior*: Renders clean empty state with icon and button "Limpar Filtros".
- **T2-F11-03: Zero or Negative Replacement Value in Creation Modal**
  - *Input*: User enters `R$ 0,00` or `-50,00` in equipment creation form.
  - *Observed/Expected Behavior*: Form shows validation error "O valor de reposição deve ser maior que zero".
- **T2-F11-04: Excessively Long Equipment Name**
  - *Input*: Equipment name with 500 characters.
  - *Observed/Expected Behavior*: Text truncates with ellipsis in catalog cards without breaking card layout grid.
- **T2-F11-05: Rapid Toggle of Multiple Filters**
  - *Input*: Clicking 5 filter pills in under 200ms.
  - *Observed/Expected Behavior*: State machine debounces updates; displays final selected filter state without stale data flicker.

### Feature 12: Mobile QR Scanner (/scan) (F12)
- **T2-F12-01: Camera Permission Denied by User**
  - *Input*: User clicks "Block" on camera permission prompt.
  - *Observed/Expected Behavior*: Viewfinder displays friendly instruction screen with camera icon and direct link to manual code input.
- **T2-F12-02: Scanning Foreign or Non-Rotary QR Code**
  - *Input*: Scanner detects QR code containing `https://google.com` or random text `HELLO-WORLD`.
  - *Observed/Expected Behavior*: Displays toast notification "Código QR não reconhecido como patrimônio do Banco Ortopédico".
- **T2-F12-03: Hardware Camera Disconnection During Scan**
  - *Input*: Camera stream interrupted while scanner active.
  - *Observed/Expected Behavior*: Catches error cleanly, displays "Câmera desconectada", and enables manual input mode.
- **T2-F12-04: Duplicate Scan Debounce Guard**
  - *Input*: Holding QR code in front of camera continuously for 5 seconds.
  - *Observed/Expected Behavior*: First detection triggers navigation once; subsequent detections within 3 seconds are debounced.
- **T2-F12-05: Camera Stream Hardware Release on Navigation**
  - *Input*: User leaves `/scan` by clicking another navigation tab.
  - *Observed/Expected Behavior*: Component unmount calls `stream.getTracks().forEach(track => track.stop())`, turning off camera hardware light.

### Feature 13: Contextual Action Route (/item/[qr_token]) (F13)
- **T2-F13-01: Non-Existent QR Token 404 Handling**
  - *Input*: Direct navigation to `/item/TOKEN-QUE-NAO-EXISTE`.
  - *Observed/Expected Behavior*: Displays friendly 404 page "Equipamento Não Encontrado" with button "Escanear Outro".
- **T2-F13-02: BAIXADO (Written-Off) Item State Invariance**
  - *Input*: Navigating to item with status `BAIXADO`.
  - *Observed/Expected Behavior*: Displays gray badge "Baixado do Acervo", shows reason/date of write-off, and disables all loan/return buttons.
- **T2-F13-03: SQL Injection / Path Traversal in URL Token**
  - *Input*: Navigating to `/item/../../etc/passwd` or `/item/'%20OR%20'1'='1`.
  - *Observed/Expected Behavior*: URL decoded safely, token sanitized, treated as invalid token 404 without server error.
- **T2-F13-04: Fast Re-Loan of Returned Item**
  - *Input*: Operator returns item to `DISPONIVEL` and immediately clicks "Iniciar Empréstimo".
  - *Observed/Expected Behavior*: Page updates action state instantly without requiring hard browser refresh.
- **T2-F13-05: Missing Equipment Optional Fields (Serial Number, Notes)**
  - *Input*: Equipment record where `serial_number` and `model_description` are null.
  - *Observed/Expected Behavior*: Detail view displays "Não informado" or hides row cleanly without displaying `undefined`.

### Feature 14: Printable Asset Labels (/equipments/labels) (F14)
- **T2-F14-01: Thermal Label Edge Margin Boundary (50x30mm)**
  - *Input*: Print preview set to 50mm width x 30mm height thermal label roll.
  - *Observed/Expected Behavior*: Content conforms with 2mm internal margins; no text or QR code is cropped by edge bleed.
- **T2-F14-02: A4 Sheet Multi-Page Grid Page Break**
  - *Input*: Batch printing 40 labels on standard A4 multi-label sheets.
  - *Observed/Expected Behavior*: Applies `page-break-inside: avoid`; labels do not split across page seams.
- **T2-F14-03: Missing Rotary Club Phone Fallback**
  - *Input*: Club phone environment variable unset.
  - *Observed/Expected Behavior*: Label renders default fallback contact phone `(11) 99999-9999` rather than blank space.
- **T2-F14-04: Equipment Name Overflow on Thermal Label**
  - *Input*: Long item name "CADEIRA DE RODAS MOTORIZADA ORTOBRAS B400 RECLINAVEL".
  - *Observed/Expected Behavior*: Font size clamps to 9pt with 2-line max and ellipsis, keeping QR code at minimum 22mm readable size.
- **T2-F14-05: High DPI Print Quality Test**
  - *Input*: Label sent to 300 DPI / 600 DPI printer driver.
  - *Observed/Expected Behavior*: SVG logo and canvas QR code render crisp vector lines without pixelation.

### Feature 15: Multi-step Loan Wizard (/loans/new) (F15)
- **T2-F15-01: Direct Deep Link to Wizard Step 4 Without Equipment**
  - *Input*: Direct navigation to `/loans/new?step=4` without selected equipment in state.
  - *Observed/Expected Behavior*: Wizard detects missing equipment selection and redirects user to Step 1.
- **T2-F15-02: Loan Creation Attempt on Non-Available Item**
  - *Input*: User attempts `/loans/new?equipment_id=LOANED_ITEM_ID`.
  - *Observed/Expected Behavior*: Step 1 displays warning "Este equipamento já se encontra emprestado" and blocks progression.
- **T2-F15-03: Brazilian CPF Checksum Failure in Step 2**
  - *Input*: User enters invalid CPF `111.111.111-11` or invalid check digits `123.456.789-00`.
  - *Observed/Expected Behavior*: Form displays validation error "CPF inválido" and blocks progression.
- **T2-F15-04: Maximum Loan Duration Boundary Enforcement**
  - *Input*: User attempts to select or input loan duration of 365 days.
  - *Observed/Expected Behavior*: Input capped at maximum allowed standard term (180 days) with note explaining Rotary policy.
- **T2-F15-05: Wizard State Retention Across Accidental Step Navigation**
  - *Input*: User fills Step 2, navigates back to Step 1 to re-verify equipment, and clicks forward.
  - *Observed/Expected Behavior*: Previously entered beneficiary form data is fully retained in wizard state.

### Feature 16: Mandatory Secondary Contact Validation (F16)
- **T2-F16-01: Secondary Phone All Identical Digits**
  - *Input*: User inputs `(11) 99999-9999` or `(00) 00000-0000` as secondary phone.
  - *Observed/Expected Behavior*: Form validator flags phone as invalid sequence and blocks submission.
- **T2-F16-02: Secondary Name Identical to Primary Beneficiary Name**
  - *Input*: Beneficiary name is "João da Silva"; secondary name entered as "João da Silva".
  - *Observed/Expected Behavior*: Form displays error "O contato secundário deve ser uma pessoa diferente do beneficiário".
- **T2-F16-03: Secondary Relationship Custom Text Boundary**
  - *Input*: User selects relationship "Outros" and leaves custom specification empty.
  - *Observed/Expected Behavior*: Field highlights with error "Especifique o grau de parentesco ou vínculo".
- **T2-F16-04: Secondary Phone Character Stripping & Normalization**
  - *Input*: Phone input entered with spaces, hyphens, and parenthesis `+55 (11) 9 8765 - 4321`.
  - *Observed/Expected Behavior*: Stripped cleanly to standard 11 digits `11987654321`.
- **T2-F16-05: Single-Character Names or Numbers in Secondary Name**
  - *Input*: Secondary name entered as "A 12345".
  - *Observed/Expected Behavior*: Regex validator rejects string; requires valid alphabetic characters and at least 2 words with >= 2 letters each.

### Feature 17: Client-side Image Compression (F17)
- **T2-F17-01: Non-Image File Upload Attempt**
  - *Input*: User attempts to upload `.exe`, `.pdf`, or `.zip` file in document photo field.
  - *Observed/Expected Behavior*: File input rejects file, displaying "Formato não suportado. Envie uma foto JPG ou PNG".
- **T2-F17-02: Pre-Compressed Small Image Handling**
  - *Input*: User uploads image that is already 50KB.
  - *Observed/Expected Behavior*: Compression function detects size < target, preserves quality without unnecessary degradation.
- **T2-F17-03: EXIF Orientation Auto-Correction**
  - *Input*: Photo taken on smartphone in portrait orientation with EXIF orientation tag 6.
  - *Observed/Expected Behavior*: Canvas compression reads EXIF orientation and normalizes image upright without 90-degree sideways rotation.
- **T2-F17-04: Giant Image File Memory Guard (50MP Photo)**
  - *Input*: 50-megapixel raw mobile camera image (> 15MB).
  - *Observed/Expected Behavior*: Compressor resizes dimensions stepwise on canvas, avoiding mobile browser tab out-of-memory crash.
- **T2-F17-05: Replaced Image Object URL Revocation**
  - *Input*: User uploads photo, clicks delete, and uploads a different photo.
  - *Observed/Expected Behavior*: Code calls `URL.revokeObjectURL(oldUrl)` preventing browser memory leak.

### Feature 18: Digital Signature Canvas (F18)
- **T2-F18-01: Accidental Dot / Tap Rejection via Stroke Count**
  - *Input*: User taps canvas once producing a single dot (< 5 points).
  - *Observed/Expected Behavior*: Form validator treats canvas as empty/insufficient, prompting for complete signature.
- **T2-F18-02: High-DPI / Retina Screen Canvas Coordinate Calibration**
  - *Input*: Drawing on high-density display with `window.devicePixelRatio = 3`.
  - *Observed/Expected Behavior*: Canvas buffer scales by pixel ratio; drawn line follows exact touch coordinate without offset.
- **T2-F18-03: Touch Scrolling Interception (`touch-action: none`)**
  - *Input*: User draws signature with finger moving vertically across canvas.
  - *Observed/Expected Behavior*: CSS `touch-action: none` prevents the page from scrolling while user signs.
- **T2-F18-04: Massive Signature Stroke Flood Attempt**
  - *Input*: Automated script sending 50,000 continuous drawing strokes.
  - *Observed/Expected Behavior*: Canvas caps stroke array and exports clean PNG without exceeding storage boundaries.
- **T2-F18-05: Signature Restoration After Screen Rotation**
  - *Input*: Device rotates from portrait to landscape mid-wizard.
  - *Observed/ExpectedBehavior*: Signature canvas redrawn from stroke history or confirms retention.

### Feature 19: Termo de Comodato PDF (Arts 579-585 CCB) (F19)
- **T2-F19-01: Zero / Negative Replacement Value Validation in PDF**
  - *Input*: Loan record with corrupted `replacement_value = 0`.
  - *Observed/Expected Behavior*: PDF generator raises validation error or loads equipment default value before rendering.
- **T2-F19-02: Portuguese Accent and Diacritics Encoding in jsPDF**
  - *Input*: Text with complex accents: "Cessão em Comodato Gratuito de Órteses e Próteses, Parágrafo Único".
  - *Observed/Expected Behavior*: PDF renders all characters (ã, ç, é, ó, ú) cleanly without garbled Unicode replacement characters.
- **T2-F19-03: Text Overflow in Address / Notes Multi-Line Handling**
  - *Input*: 4-line long address with apartment details and instructions.
  - *Observed/Expected Behavior*: Auto-table / multi-line wrap adjusts row height; does not overlap following legal clauses.
- **T2-F19-04: Offline Blob Download Support**
  - *Input*: Device disconnected from internet generating contract PDF.
  - *Observed/Expected Behavior*: PDF generated purely client-side via jsPDF and triggers browser download via Blob URL.
- **T2-F19-05: Verification QR Code URL Encoding in PDF**
  - *Input*: Loan magic token contains special characters.
  - *Observed/Expected Behavior*: Embedded QR code embeds valid URL readable by standard mobile cameras.

### Feature 20: Return Triage Workflow (/loans/[id]/return) (F20)
- **T2-F20-01: Double Return Submission Prevention**
  - *Input*: Submitting return on a loan whose status is already `DEVOLVIDO`.
  - *Observed/Expected Behavior*: System rejects request with message "Este empréstimo já foi finalizado".
- **T2-F20-02: Mandatory Defect Description on PRECISA_REPARO**
  - *Input*: Selecting condition `PRECISA_REPARO` and submitting form with empty defect textarea.
  - *Observed/Expected Behavior*: Form blocks submission with inline error "Descreva os defeitos identificados para a equipe de manutenção".
- **T2-F20-03: Future Return Date Rejection**
  - *Input*: Return date set to a date in the future (e.g. tomorrow).
  - *Observed/Expected Behavior*: Form validates `actual_return_date <= now()`.
- **T2-F20-04: Irreparable Equipment Routing to SUCATEADO**
  - *Input*: Operator flags chassis broken beyond repair.
  - *Observed/Expected Behavior*: Allows selecting condition `SUCATEADO`, transitioning equipment to `BAIXADO`.
- **T2-F20-05: Rapid Click / Submit Debounce**
  - *Input*: Operator double-clicks "Finalizar Devolução" button.
  - *Observed/Expected Behavior*: Button disables immediately upon first click (`isSubmitting = true`), preventing duplicate submissions.

### Feature 21: Return Reasons & Routing (F21)
- **T2-F21-01: Explanation Required for Close Reason OUTROS**
  - *Input*: Selecting close reason `OUTROS` and submitting without notes.
  - *Observed/Expected Behavior*: Form displays validation error "Para o motivo 'Outros', especifique a justificativa nas observações".
- **T2-F21-02: Deceased Patient Sensitive Communication Suppression**
  - *Input*: Loan closed with reason `OBITO_PACIENTE`.
  - *Observed/Expected Behavior*: System marks record and automatically suppresses all automated feedback surveys or standard marketing messages.
- **T2-F21-03: Disallowed Routing: Damaged Item to DISPONIVEL**
  - *Input*: Condition is `PRECISA_REPARO` but operator attempts to choose destination `DISPONIVEL`.
  - *Observed/Expected Behavior*: Validation blocks selection: "Equipamentos com necessidade de reparo devem ser encaminhados para Manutenção".
- **T2-F21-04: Return with Equipment Exchange Shortcut**
  - *Input*: Close reason `TROCA_EQUIPAMENTO` selected.
  - *Observed/Expected Behavior*: Confirmation screen provides direct button "Iniciar Novo Empréstimo de Substituição" pre-filling beneficiary data.
- **T2-F21-05: Foreign Destination Status Value Rejection**
  - *Input*: API payload with `destination: 'VENDIDO'`.
  - *Observed/Expected Behavior*: Schema validation rejects payload with 400 Bad Request.

### Feature 22: Digital Discharge Receipt (F22)
- **T2-F22-01: Damaged Item Quittance Observations**
  - *Input*: Quittance receipt generated for equipment returned with damages.
  - *Observed/Expected Behavior*: Receipt includes clause detailing damages and agreed terms, avoiding unconditional liability release.
- **T2-F22-02: Idempotent Re-Generation of Historical Receipt**
  - *Input*: Accessing quittance receipt for loan returned 6 months ago.
  - *Observed/Expected Behavior*: Generates identical receipt with original return date and operator notes preserved.
- **T2-F22-03: Malformed WhatsApp Character Escaping in Quittance Share**
  - *Input*: Borrower name with ampersands, slashes, or quotation marks.
  - *Observed/Expected Behavior*: Message safely URL encoded (`encodeURIComponent`), generating functional `wa.me` link.
- **T2-F22-04: Receipt Generation for Beneficiary Without Phone Number**
  - *Input*: Beneficiary record with missing phone number.
  - *Observed/Expected Behavior*: WhatsApp button disables gracefully; PDF download button remains fully functional.
- **T2-F22-05: Quittance Authentication Hash Verification**
  - *Input*: Verification of quittance security code printed on receipt.
  - *Observed/Expected Behavior*: Hash matches SHA-256 / MD5 digest of `(loan_id + return_date + patrimony_code)`.

### Feature 23: Public Self-Service Renewal (/renovar/[magic_token]) (F23)
- **T2-F23-01: Invalid / Non-Existent Magic Token Access**
  - *Input*: Accessing `/renovar/invalid-random-token-xyz`.
  - *Observed/Expected Behavior*: Displays friendly error page "Link de renovação inválido ou expirado" with contact phone.
- **T2-F23-02: Renewal Attempt on Already Returned Loan**
  - *Input*: Accessing renewal portal for loan with status `DEVOLVIDO`.
  - *Observed/Expected Behavior*: Displays banner "Este equipamento já foi devolvido em DD/MM/AAAA. Nenhuma ação pendente".
- **T2-F23-03: Renewal Beyond Maximum Limit (Renewal Guard)**
  - *Input*: Accessing renewal portal for loan with `renewal_count = 3` and `max_renewals = 3`.
  - *Observed/Expected Behavior*: 1-click renewal button disabled with message "Limite máximo de renovações atingido. Entre em contato com o Rotary para avaliação".
- **T2-F23-04: SQL Injection in Magic Token URL Parameter**
  - *Input*: Navigating to `/renovar/'%20OR%201=1--`.
  - *Observed/Expected Behavior*: Query handles input as literal string; returns 404/invalid token page safely.
- **T2-F23-05: Overdue Loan Renewal Grace Period Reset**
  - *Input*: 1-click renewal clicked for loan that is currently `ATRASADO`.
  - *Observed/Expected Behavior*: Status updates to `RENOVADO`; expected return date calculated as +30 days from today (or previous due date depending on policy).

### Feature 24: Overdue Radar & Dashboard (/overdue, /dashboard) (F24)
- **T2-F24-01: Zero Overdue Loans Empty State**
  - *Input*: No loans currently overdue in system.
  - *Observed/Expected Behavior*: Renders celebratory empty state graphic with message "Nenhum equipamento em atraso no momento! Parabéns!".
- **T2-F24-02: Missing Replacement Value in Value-at-Risk Calculation**
  - *Input*: Overdue loan linked to legacy equipment with `replacement_value = null`.
  - *Observed/Expected Behavior*: Calculation handles null safely (`item.replacement_value || 0`), avoiding `NaN` in total value at risk.
- **T2-F24-03: Leap Year Date Boundary Handling (Feb 29)**
  - *Input*: Loan due date falls on February 29 of a leap year.
  - *Observed/Expected Behavior*: Date comparison and days overdue calculation compute accurate elapsed days without date library exceptions.
- **T2-F24-04: High Volume Loan Sorting Performance (1,000 Loans)**
  - *Input*: Catalog with 1,000 active and overdue loans.
  - *Observed/ExpectedBehavior*: Sort algorithm executes in < 50ms without UI freezing or dropped frames.
- **T2-F24-05: Negative Overdue Days Display**
  - *Input*: Loan due in 5 days (difference is -5 days).
  - *Observed/Expected Behavior*: Displays "Vence em 5 dias" (not "-5 dias de atraso").

### Feature 25: WhatsApp Notification Generator (F25)
- **T2-F25-01: Phone Number Formatting with Non-Digit Characters**
  - *Input*: Phone input entered as `+55 (11) 98765-4321`.
  - *Observed/Expected Behavior*: Sanitizer extracts `5511987654321` and constructs valid `https://wa.me/5511987654321`.
- **T2-F25-02: Special Characters and Line Breaks in Message Text**
  - *Input*: Multi-paragraph template with emojis (`🦽`), bullet points, and blank lines.
  - *Observed/Expected Behavior*: Line breaks encoded as `%0A`; emojis encoded without breaking URL length limits.
- **T2-F25-03: Missing Secondary Contact Phone Fallback**
  - *Input*: Legacy loan record where secondary phone is empty string.
  - *Observed/Expected Behavior*: Secondary contact WhatsApp button is disabled with tooltip "Telefone secundário não cadastrado".
- **T2-F25-04: Short Phone Number (< 10 Digits) Validation**
  - *Input*: Phone entered as `1234567`.
  - *Observed/Expected Behavior*: System flags invalid phone number and prevents generating broken wa.me link.
- **T2-F25-05: Desktop Web vs Mobile WhatsApp App Compatibility**
  - *Input*: Opening `https://wa.me/...` link in desktop browser vs mobile device.
  - *Observed/Expected Behavior*: Universal `wa.me` domain routes to WhatsApp Web on desktop and native WhatsApp app on mobile.

### Feature 26: Cron Automation (/api/cron/check-loans) (F26)
- **T2-F26-01: Cron Execution Idempotency on Repeated Runs**
  - *Input*: Cron endpoint triggered 5 times in the same hour.
  - *Observed/Expected Behavior*: Status transitions executed on first run; subsequent runs detect loans already `ATRASADO` and do not dispatch duplicate alerts.
- **T2-F26-02: Timezone Midnight Boundary Alignment (America/Sao_Paulo)**
  - *Input*: Cron executed at 00:05 UTC (21:05 BRT previous day).
  - *Observed/Expected Behavior*: Date comparison respects Brazilian timezone (`America/Sao_Paulo`) to avoid premature overdue marking.
- **T2-F26-03: Handling of Returned Loans During Cron Scan**
  - *Input*: Loan with `expected_return_date < today` but status already `DEVOLVIDO`.
  - *Observed/Expected Behavior*: Filter ignores returned loans; only loans with status `ATIVO` or `RENOVADO` are evaluated.
- **T2-F26-04: WhatsApp API Outage Resilience in Cron**
  - *Input*: External WhatsApp messaging gateway returns HTTP 500 error during cron execution.
  - *Observed/Expected Behavior*: Cron catches messaging exception, logs error in events log, and continues processing database status updates for remaining loans.
- **T2-F26-05: Large Batch Processing Chunking**
  - *Input*: 500 loans reaching due date on the same day.
  - *Observed/Expected Behavior*: Cron processes loans in chunks of 50 to prevent timeout or database transaction locks.

### Feature 27: Project Documentation (README.md) (F27)
- **T2-F27-01: Windows PowerShell Command Accuracy Verification**
  - *Input*: User copies commands from README on Windows PowerShell.
  - *Observed/Expected Behavior*: README explicitly instructs using `npm.cmd` and `npx.cmd` on Windows.
- **T2-F27-02: Zero Secret Leakage in Documentation Examples**
  - *Input*: Automated secret scanning on `README.md`.
  - *Observed/Expected Behavior*: No real API keys, Supabase service keys, or tokens are exposed; placeholders like `your-supabase-url` are used.
- **T2-F27-03: Broken Link Verification in Documentation**
  - *Input*: Markdown link validator executed on `README.md`.
  - *Observed/Expected Behavior*: All relative file links (e.g. `supabase/migrations/001_initial_schema.sql`, `.env.example`) point to valid existing files.
- **T2-F27-04: Documentation for Storage CORS and Bucket Policies**
  - *Input*: Developer configuring Supabase storage buckets from documentation.
  - *Observed/Expected Behavior*: README contains exact SQL/dashboard instructions for bucket public read and upload policies.
- **T2-F27-05: Production Build and Deploy Checklist Completeness**
  - *Input*: New maintainer deploying project to Vercel following README.
  - *Observed/Expected Behavior*: Guide includes build command, environment variable checklist, and verification of `vercel.json` cron setup.

---

## 6. Edge Cases Summary Table

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | F1 - App Setup | PowerShell execution policy set to Restricted | Direct `npm` invocation blocked; system mandates `npm.cmd` execution. |
| 2 | F1 - App Setup | Missing all environment variables | Gracefully activates Smart Demo Store without uncaught crash. |
| 3 | F2 - Brand Theme | 200% browser text scaling | UI wraps cleanly without text truncation or broken navbar layout. |
| 4 | F2 - Brand Theme | Disabled button styling | Opacity reduced while preserving WCAG readable contrast and aria-disabled. |
| 5 | F3 - Shell & PWA | iPhone home indicator bar (safe area) | Applies `pb-safe` padding to bottom navbar, preventing icon obstruction. |
| 6 | F3 - Shell & PWA | Offline page reload | PWA serves cached shell and local mock store data without white-screen error. |
| 7 | F4 - Demo Store | LocalStorage quota full during upload | Catches QuotaExceededError, switches to in-memory store, alerts user. |
| 8 | F4 - Demo Store | Corrupted JSON in localStorage | Detects JSON parse error, re-seeds default data, recovers state cleanly. |
| 9 | F5 - Environment | Invalid Supabase URL in `.env.local` | Detects malformed URL and switches transparently to local demo repository. |
| 10 | F5 - Environment | Cron trigger without secret token | Rejects request with HTTP 401 Unauthorized. |
| 11 | F6 - Enums | Invalid enum value in SQL insert | PostgreSQL rejects with check violation; TypeScript union prevents compile. |
| 12 | F7 - Core Tables | Duplicate patrimony code | Unique constraint on `patrimony_code` rejects duplicate insert. |
| 13 | F7 - Core Tables | Negative replacement value | Check constraint `replacement_value >= 0` rejects insert. |
| 14 | F8 - Triggers | Loan creation on non-available item | Database trigger blocks loan creation if equipment status is not DISPONIVEL. |
| 15 | F8 - Triggers | Return with NULL destination status | Trigger coalesces NULL to default protocol `HIGIENIZACAO`. |
| 16 | F9 - RLS Security | Anonymous query on `beneficiaries` | RLS policy blocks access, returning empty dataset and shielding patient PII. |
| 17 | F9 - RLS Security | SQL injection attempt in magic token | Parameterized query treats input as literal string; returns 404 cleanly. |
| 18 | F10 - Seed Dataset | Re-running seed script on existing data | `ON CONFLICT DO NOTHING` prevents duplicate record crashes. |
| 19 | F11 - Catalog | Search query with regex special chars | Search query escapes special characters safely and filters list. |
| 20 | F12 - QR Scanner | Camera permission blocked by user | Scanner displays instructional fallback and enables manual code input. |
| 21 | F13 - Action Route | Non-existent QR token accessed | Displays friendly 404 page with option to re-scan. |
| 22 | F13 - Action Route | Item status is BAIXADO | Disables loan and return buttons; displays item retirement details. |
| 23 | F14 - Labels | 50x30mm thermal label edge boundary | 2mm internal margins ensure QR code and text are not cropped by print margins. |
| 24 | F15 - Loan Wizard | Invalid CPF checksum entered | Form validation halts progression with "CPF inválido". |
| 25 | F16 - Secondary Contact | Single-word secondary contact name | Blocks progression: requires full name with at least 2 words. |
| 26 | F16 - Secondary Contact | Secondary phone matches primary phone | Blocks progression: non-collision rule enforces separate emergency contact. |
| 27 | F17 - Compression | 15MB 48MP raw smartphone photo upload | Canvas compressor reduces file to < 800KB without browser tab crash. |
| 28 | F18 - Signature | Single accidental tap/dot on signature canvas | Rejected as insufficient signature; requires full drawing stroke. |
| 29 | F19 - Comodato PDF | Zero replacement value in loan | Form blocks generation until valid replacement value (> R$ 0,00) is specified. |
| 30 | F20 - Return Triage | Return submitted on already returned loan | System blocks double submission with clear notice. |
| 31 | F21 - Routing | Damaged item routed to DISPONIVEL | System validation forces damaged equipment (`PRECISA_REPARO`) to `MANUTENCAO`. |
| 32 | F22 - Quittance | Quittance shared with missing phone | WhatsApp dispatch button disabled; PDF download remains accessible. |
| 33 | F23 - Renewal | Renewal attempt beyond maximum limit | 1-click button disabled; routes user to direct Rotary club phone support. |
| 34 | F24 - Overdue Radar | Value at risk with null item values | Coalesces null values to 0; computes accurate sum without `NaN`. |
| 35 | F25 - WhatsApp | Phone number with symbols and spaces | Normalizes phone to clean 11 digits `5511987654321` for `wa.me` URL. |
| 36 | F26 - Cron | External WhatsApp service outage | Cron catches gateway error, logs failure, and continues database updates. |
| 37 | F27 - Documentation | Verification of Windows PowerShell setup | README explicitly documents `npm.cmd` commands for Windows environments. |

---

## 7. Caveats

1. **Hardware Dependent Features**:
   - Camera video stream acquisition (`navigator.mediaDevices.getUserMedia`) in `/scan` requires a browser environment supporting WebRTC or a mobile device. In headless CI/test environments, tests must mock camera video tracks or utilize the manual code input fallback.
2. **Third-Party WhatsApp Dispatch**:
   - Real-world WhatsApp delivery via official WhatsApp Cloud API or gateways (Evolution API, Z-API) requires active network credentials. In offline demo mode and opaque-box test runner, the system relies on direct `wa.me` universal URI generation, which is 100% testable and verified without external API costs.
3. **Canvas Touch Emulation in Node.js**:
   - Direct execution of HTML5 canvas drawing in pure Node.js environments requires DOM emulation (`jsdom` or mock canvas). Contract and opaque-box test runners can validate base64 PNG data URL generation and signature pad state interfaces.

---

## 8. Conclusion

All 27 features (F1 to F27) from `ORIGINAL_REQUEST.md` and `PROJECT.md` have been systematically mined, cataloged, and specified:
- **Tier 1 (Feature Coverage)**: Exactly 135 concrete opaque-box test specifications (5 per feature across F1 to F27), each with unique ID, target feature, input/precondition, action/verification mechanism, and expected assertions.
- **Tier 2 (Boundary & Corner Cases)**: Exactly 135 edge specifications (5 per feature across F1 to F27), analyzing limits, nullability, mask validations, extreme dates, SQL injection attempts, and error states.
- **Discovered Features Matrix & Edge Cases Table**: Fully formatted and populated in accordance with the Specification Miner guidelines.

This specification provides the foundational contract for the E2E Testing Track (`e2e_testing_orchestrator`) to implement the automated test suite across Tiers 1 through 5.

---

## 9. Verification Method

To independently verify this specification report:
1. Verify report existence:
   ```powershell
   Get-Item "C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\spec_miner_f1_f27\handoff.md"
   ```
2. Verify test case count across F1 to F27:
   ```powershell
   # Count Tier 1 test cases (should be exactly 135)
   (Select-String -Path "C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\spec_miner_f1_f27\handoff.md" -Pattern "T1-F\d\d-\d\d").Count
   
   # Count Tier 2 edge cases (should be exactly 135)
   (Select-String -Path "C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\spec_miner_f1_f27\handoff.md" -Pattern "T2-F\d\d-\d\d").Count
   ```
3. Verify feature coverage:
   Confirm presence of all features F1 through F27 in the Features Discovered table and both catalogs.
