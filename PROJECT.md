# Project: Rotary Banco Ortopédico

## Architecture
- **Framework**: Next.js 14+ (App Router), React 18, TypeScript 5.
- **Styling & UI**: Tailwind CSS 3.4+, shadcn/ui (Radix UI primitives), Lucide Icons.
- **Brand Palette**:
  - Azul Royal Rotary: `#17458f` (HSL: `217, 72%, 33%` - primary, dark text/buttons, 7.4:1 contrast on white).
  - Amarelo Ouro Rotary: `#f7a81b` (HSL: `39, 93%, 54%` - secondary accents, warning badges, high-contrast text on gold).
- **PWA**: `manifest.json`, mobile-first bottom navigation bar with elevated QR scan FAB, responsive desktop sidebar/header.
- **Data Layer Architecture**:
  - Unified `dataRepository` abstraction (`src/lib/data-layer/`).
  - Seamless dual-mode: Real Supabase Client when configured in `.env.local`, or Smart Local Demo Store (`localStorage` + mock data) when unconfigured or in demo mode.
- **Database**: PostgreSQL / Supabase SQL schema (`supabase/migrations/001_initial_schema.sql`), 6 enums, 6 tables, triggers, RLS, and seed data.
- **Digital Signatures & Documents**: `react-signature-canvas`, `browser-image-compression`, `jspdf`, `qrcode`.
- **Communications & Automation**: Modular `src/lib/whatsapp.ts`, universal `wa.me` links, `/api/cron/check-loans` scheduled via `vercel.json`.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | App Setup & Tooling | Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Lucide Icons, npm.cmd compatibility | M1 | Survey 1 |
| 2 | Rotary Brand Theme | Azul Royal (#17458f) and Amarelo Ouro (#f7a81b) design tokens, WCAG AA contrast rules | M1 | Survey 1 |
| 3 | Mobile-First Shell & PWA | PWA manifest.json, icons, mobile bottom bar with elevated scan FAB, desktop navigation | M1 | Survey 1 |
| 4 | Smart Demo Fallback Store | LocalStorage repository with pre-seeded data for 100% offline & zero-credential execution | M1 | Survey 1 |
| 5 | Environment Configuration | Complete `.env.example` with Supabase, WhatsApp, and App settings | M1 | Survey 1 |
| 6 | Supabase Schema & Enums | 6 enums: user_role, equipment_category, equipment_status, equipment_condition, loan_status, close_reason | M2 | Survey 2 |
| 7 | Core Database Tables | 6 tables: profiles, equipments, beneficiaries, loans, loan_events_log, maintenance_logs | M2 | Survey 2 |
| 8 | Automated Triggers & State | Triggers for loan creation (EMPRESTADO) and return (destination status), audit logging | M2 | Survey 2 |
| 9 | Row Level Security (RLS) | Security policies for authenticated staff, public QR lookup, and public magic token access | M2 | Survey 2 |
| 10 | Initial Seed Dataset | >= 6 equipments across categories/statuses, >= 2 loans (active, overdue), beneficiaries | M2 | Survey 2 |
| 11 | Equipment Catalog (/equipments) | List/grid with debounced search, status/category filter pills, creation modal with qr_token | M3 | Survey 2 |
| 12 | Mobile QR Scanner (/scan) | Camera scanner with html5-qrcode, Rotary reticle, torch toggle, manual code fallback | M3 | Survey 2 |
| 13 | Contextual Action Route (/item/[qr_token]) | State machine: DISPONIVEL (loan), EMPRESTADO/ATRASADO (return/renew), HIGIENIZACAO/MANUTENCAO (release) | M3 | Survey 2 |
| 14 | Printable Asset Labels (/equipments/labels) | Printable 50x30mm thermal and A4 grid layouts with Rotary emblem, QR code, patrimony code | M3 | Survey 2 |
| 15 | Multi-step Loan Wizard (/loans/new) | 5 steps: equipment confirm, patient info, secondary contact, photo compression, contract | M4 | Survey 3 |
| 16 | Mandatory Secondary Contact Validation | Strict validation: full name (>= 2 words), valid phone, relationship, non-collision check | M4 | Survey 3 |
| 17 | Client-side Image Compression | Client-side photo compression for document & residence proof uploads (< 800KB) | M4 | Survey 3 |
| 18 | Digital Signature Canvas | Interactive canvas signature using react-signature-canvas with base64 PNG capture | M4 | Survey 3 |
| 19 | Termo de Comodato PDF (Arts 579-585 CCB) | PDF generation with replacement value, conservation clauses, joint liability, signature, QR code | M4 | Survey 3 |
| 20 | Return Triage Workflow (/loans/[id]/return) | Physical condition checklist (BOM, PRECISA_REPARO), condition scoring | M5 | Survey 3 |
| 21 | Return Reasons & Routing | Mappings for close_reason, destination routing (HIGIENIZACAO, DISPONIVEL, MANUTENCAO) | M5 | Survey 3 |
| 22 | Digital Discharge Receipt | Termo de Quitação PDF/printable receipt extinguishing liability under CCB art. 320 | M5 | Survey 3 |
| 23 | Public Self-Service Renewal (/renovar/[magic_token]) | Zero-login 1-click renewal (+30 days, max renewals guard) and return assistance request | M6 | Survey 3 |
| 24 | Overdue Radar & Dashboard (/overdue, /dashboard) | Fleet KPIs, value-at-risk, overdue stages (D-7, D0, D+1, D+7), filtered views | M6 | Survey 3 |
| 25 | WhatsApp Notification Generator | Stage-specific messages for primary and secondary contacts with direct wa.me fallback links | M6 | Survey 3 |
| 26 | Cron Automation (/api/cron/check-loans) | Daily cron transition to ATRASADO at D+1, escalations at D+7, vercel.json configuration | M6 | Survey 3 |
| 27 | Project Documentation (README.md) | Comprehensive guide for Supabase migration, buckets, env vars, demo mode, and deployment | M6 | Survey 3 |
| 28 | Comprehensive E2E Test Suite | Automated opaque-box test runner covering Tiers 1-4 across all 27 features | Final | Dual Track |
| 29 | Adversarial Coverage Hardening | Tier 5 white-box challenger stress tests, boundary conditions, and invariant tests | Final | Dual Track |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | PWA Shell & Architecture | Next.js 14, Rotary theme (#17458f, #f7a81b), PWA manifest, bottom nav, Demo Mock Store, .env.example | none | DONE (Gate PASS - Build code 0) |
| M2 | Supabase Schema & Seed | `001_initial_schema.sql`, 6 enums, 6 tables, triggers, RLS, seed data (6+ items, 2+ loans) | none | DONE (Gate PASS - 1,179 lines SQL verified) |
| M3 | Catalog, QR Scanner & Labels | `/equipments`, `/scan`, `/item/[qr_token]` contextual state machine, `/equipments/labels` print | M1, M2 | DONE (Gate PASS - TypeScript & Build verified) |
| M4 | Loan Wizard & Comodato PDF | `/loans/new`, secondary contact, photo compression, canvas signature, Comodato PDF (CCB 579-585) | M1, M2, M3 | DONE (Gate PASS - TypeScript & Build verified) |
| M5 | Return Triage & Quittance | `/loans/[id]/return`, condition checklist, close reasons, destination routing, discharge receipt | M1, M2, M4 | DONE (Gate PASS - TypeScript & Build verified) |
| M6 | Renewal Portal, Radar, WhatsApp & Cron | `/renovar/[magic_token]`, `/overdue`, WhatsApp messages & wa.me, `/api/cron/check-loans`, README.md | M1, M4, M5 | DONE (Gate PASS - TypeScript & Build verified) |
| Final | E2E Testing Pass & Hardening | Pass 100% of E2E Test Suite (Tiers 1-4, 304 tests) & Production Next.js Build | M1-M6, E2E Track | DONE (304/304 PASS, `next build` code 0) |

---

## Interface Contracts

### Data Layer: `src/lib/data-layer/types.ts`
```typescript
export type EquipmentCategory = 'CADEIRA_RODAS' | 'CADEIRA_BANHO' | 'MULETA' | 'ANDADOR' | 'CAMA_HOSPITALAR' | 'OUTROS';
export type EquipmentStatus = 'DISPONIVEL' | 'EMPRESTADO' | 'ATRASADO' | 'HIGIENIZACAO' | 'MANUTENCAO' | 'BAIXADO';
export type EquipmentCondition = 'NOVO' | 'BOM' | 'REGULAR' | 'PRECISA_REPARO' | 'SUCATA';
export type LoanStatus = 'ATIVO' | 'RENOVADO' | 'ATRASADO' | 'DEVOLVIDO' | 'PERDIDO_EXTRAVIADO';
export type CloseReason = 'RECUPERACAO_ALTA' | 'OBITO_PACIENTE' | 'COMPRA_PROPRIA' | 'TROCA_EQUIPAMENTO' | 'OUTROS' | 'DESISTENCIA';

export interface Equipment {
  id: string;
  patrimony_code: string;
  qr_token: string;
  category: EquipmentCategory;
  name: string;
  model_description?: string;
  serial_number?: string;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  replacement_value: number; // In BRL, mandatory for Comodato art. 582 CCB
  created_at: string;
  updated_at: string;
}

export interface Beneficiary {
  id: string;
  full_name: string;
  cpf: string;
  rg?: string;
  phone: string;
  email?: string;
  address_street: string;
  address_number: string;
  address_complement?: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_zipcode: string;
  // Secondary Contact (Mandatory)
  secondary_name: string;
  secondary_relationship: string;
  secondary_phone: string;
  created_at: string;
}

export interface Loan {
  id: string;
  loan_code: string;
  equipment_id: string;
  beneficiary_id: string;
  loan_date: string;
  expected_return_date: string;
  actual_return_date?: string;
  status: LoanStatus;
  renewal_count: number;
  max_renewals: number;
  magic_token: string;
  notes?: string;
  // Comodato legal fields
  replacement_value: number;
  signature_url?: string;
  contract_pdf_url?: string;
  created_at: string;
  updated_at: string;
  // Expanded relations
  equipment?: Equipment;
  beneficiary?: Beneficiary;
}
```

### Mock Store & Repository Interface: `src/lib/data-layer/repository.ts`
```typescript
export interface IDataRepository {
  getEquipments(filters?: { status?: EquipmentStatus; category?: EquipmentCategory; search?: string }): Promise<Equipment[]>;
  getEquipmentById(id: string): Promise<Equipment | null>;
  getEquipmentByQrToken(qr_token: string): Promise<Equipment | null>;
  createEquipment(data: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>): Promise<Equipment>;
  updateEquipment(id: string, data: Partial<Equipment>): Promise<Equipment>;

  getLoans(filters?: { status?: LoanStatus; search?: string }): Promise<Loan[]>;
  getLoanById(id: string): Promise<Loan | null>;
  getLoanByMagicToken(magic_token: string): Promise<Loan | null>;
  createLoan(data: { equipment_id: string; beneficiary: Omit<Beneficiary, 'id' | 'created_at'>; term_days: number; signature_data_url: string; document_urls?: string[] }): Promise<Loan>;
  renewLoan(magic_token: string): Promise<{ success: boolean; loan?: Loan; message?: string }>;
  returnLoan(loan_id: string, triage: { condition: EquipmentCondition; close_reason: CloseReason; destination: EquipmentStatus; notes?: string }): Promise<{ success: boolean; loan: Loan; discharge_receipt_url?: string }>;
}
```

---

## Code Layout
```
rotary-banco-ortopedico/
├── public/
│   ├── manifest.json
│   ├── icons/
│   │   ├── icon-192x192.png
│   │   ├── icon-512x512.png
│   │   └── rotary-emblem.svg
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx (Dashboard / Overdue Radar)
│   │   ├── scan/
│   │   │   └── page.tsx (Mobile QR Scanner)
│   │   ├── item/
│   │   │   └── [qr_token]/
│   │   │       └── page.tsx (Contextual Action Route)
│   │   ├── equipments/
│   │   │   ├── page.tsx (Equipment Catalog)
│   │   │   └── labels/
│   │   │       └── page.tsx (Asset Labels Print)
│   │   ├── loans/
│   │   │   ├── page.tsx (Active & Past Loans)
│   │   │   ├── new/
│   │   │   │   └── page.tsx (Multi-step Wizard)
│   │   │   └── [id]/
│   │   │       └── return/
│   │   │           └── page.tsx (Return Triage)
│   │   ├── renovar/
│   │   │   └── [magic_token]/
│   │   │       └── page.tsx (Public Self-service Renewal)
│   │   ├── overdue/
│   │   │   └── page.tsx (Overdue Radar & WhatsApp Triggers)
│   │   └── api/
│   │       └── cron/
│   │           └── check-loans/
│   │               └── route.ts (Automated loan status transition)
│   ├── components/
│   │   ├── navigation/
│   │   │   ├── bottom-nav.tsx
│   │   │   └── desktop-header.tsx
│   │   ├── ui/ (shadcn components: button, card, dialog, badge, input, etc.)
│   │   ├── equipment/ (cards, filters, label-sheet)
│   │   ├── wizard/ (step indicator, patient-form, signature-pad, pdf-preview)
│   │   ├── triage/ (checklist, return-form, quittance-modal)
│   │   └── qr/ (scanner-view, qr-card)
│   ├── lib/
│   │   ├── data-layer/ (repository, supabase-client, types)
│   │   ├── mock-store/ (in-memory & localstorage seed store)
│   │   ├── pdf/ (comodato-generator, quittance-generator)
│   │   ├── whatsapp/ (message-templates, wa-link-builder)
│   │   ├── image-compression/ (client-side compressor)
│   │   └── utils.ts
│   └── types/
├── tests/
│   ├── e2e/ (Opaque-box E2E test runner and test cases)
│   └── unit/
├── .env.example
├── vercel.json
├── README.md
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```
