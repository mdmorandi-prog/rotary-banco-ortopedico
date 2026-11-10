# Handoff Report: Explorer 3 (Milestone 1) — Data Layer Facade, Smart Local Demo Store & Environment Configuration

- **Agent**: `teamwork_explorer_m1_3`
- **Role**: Teamwork Explorer 3 (Milestone 1)
- **Working Directory**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`
- **State Folder**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m1_3`
- **Original Parent**: `0fabba26-10dc-4276-b0cc-8c1c698fc688` (sub_orch_m1)
- **Scope / Focus**: Data Layer TypeScript interfaces, Repository facade interface with dual-mode detection (`isDemoMode`), Pre-seeded rich mock dataset (8 equipments, 2 beneficiaries with mandatory secondary contacts, 2 active/overdue loans), Smart Local Demo Store implementation (`localStorage` persistence, search/filter, renewal, triage), `DemoModeBanner` component, and `.env.example`.
- **Date**: 2026-11-10T15:25:00Z

---

## 1. Observation

Direct environmental, structural, and cross-milestone contract observations:

### 1.1 Requirements Observed from Authoritative Documents
1. **`ORIGINAL_REQUEST.md` (lines 14-19, 44-46)**:
   - "Implementar modo demo/fallback local inteligente para execução e validação imediata de todas as telas e fluxos mesmo sem conexão prévia com credenciais do Supabase/WhatsApp, além de configuração completa de variáveis de ambiente via `.env.example`."
   - "Incluir seed de dados iniciais contendo ao menos 5 equipamentos em diferentes status/categorias e 2 empréstimos com dados de exemplo."
   - "O wizard de empréstimo valida a obrigatoriedade dos dados do contato secundário antes de permitir a conclusão."
   - Enums: `user_role`, `equipment_category`, `equipment_status`, `equipment_condition`, `loan_status`, `close_reason`.
   - Tables: `profiles`, `equipments`, `beneficiaries`, `loans`, `loan_events_log`, `maintenance_logs`.

2. **`PROJECT.md` § Interface Contracts (lines 68-156)**:
   - `EquipmentCategory`: `'CADEIRA_RODAS' | 'CADEIRA_BANHO' | 'MULETA' | 'ANDADOR' | 'CAMA_HOSPITALAR' | 'OUTROS'`.
   - `EquipmentStatus`: `'DISPONIVEL' | 'EMPRESTADO' | 'ATRASADO' | 'HIGIENIZACAO' | 'MANUTENCAO' | 'BAIXADO'`.
   - `EquipmentCondition`: `'NOVO' | 'BOM' | 'REGULAR' | 'PRECISA_REPARO' | 'SUCATA'`.
   - `LoanStatus`: `'ATIVO' | 'RENOVADO' | 'ATRASADO' | 'DEVOLVIDO' | 'PERDIDO_EXTRAVIADO'`.
   - `CloseReason`: `'RECUPERACAO_ALTA' | 'OBITO_PACIENTE' | 'COMPRA_PROPRIA' | 'TROCA_EQUIPAMENTO' | 'OUTROS' | 'DESISTENCIA'`.
   - `Equipment`: Mandatory `replacement_value: number` (in BRL, required for Comodato Art. 582 CCB) and `qr_token: string`.
   - `Beneficiary`: Mandatory secondary contact fields (`secondary_name`, `secondary_relationship`, `secondary_phone`).
   - `Loan`: Tracks `loan_code`, `expected_return_date`, `renewal_count`, `max_renewals`, `magic_token`, `replacement_value`, `signature_url`, `contract_pdf_url`.
   - `IDataRepository`: Unified interface with methods for equipment retrieval/mutation, loan creation, self-service renewal, return triage, and filtering.

3. **Survey Handshakes (`teamwork_explorer_survey_1`, `survey_2`, `survey_3`)**:
   - `survey_1`: Established `isDemoMode()` detector checking environment variables and `localStorage` overrides, and `DemoModeBanner` with reset button.
   - `survey_2`: Established PostgreSQL schema `001_initial_schema.sql` with enums, tables, and automated status transition triggers (`EMPRESTADO` on loan creation; `post_return_destination` on return).
   - `survey_3`: Established 5-step loan wizard requirements, CCB Arts. 579-585 legal clauses, return triage checklist, 1-click magic link renewal (+30 days, max 3 renewals guard), and overdue radar.

### 1.2 Current Workspace State
- Workspace root: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`.
- Verified via `Test-Path`: `src/` folder does not exist yet. Milestone 1 Worker will implement all frontend code based on the specifications delivered in this handoff.
- Windows execution environment: Node `v24.21.0`, npm `11.19.0`, scripts executed via `npm.cmd` and `npx.cmd`.

---

## 2. Logic Chain

1. **Decoupling Data Consumers from Backend Infrastructure**:
   - The UI components (`/dashboard`, `/equipments`, `/scan`, `/item/[qr_token]`, `/loans/new`, `/loans/[id]/return`, `/renovar/[magic_token]`, `/overdue`) must NEVER call Supabase client SDK methods directly.
   - If UI components called Supabase directly, opening any page without `.env.local` credentials would trigger fatal unhandled exceptions (`Invalid Supabase URL`, `Failed to fetch`).
   - By routing all data interactions through `dataRepository` (`src/lib/data-layer/repository.ts`), the application can determine at runtime whether to delegate queries to the Supabase client or to `localStore` (`src/lib/mock-store/local-store.ts`).

2. **Simulating Database Triggers in `localStore`**:
   - In Supabase, database triggers automatically transition an equipment from `DISPONIVEL` to `EMPRESTADO` upon loan creation, and from `EMPRESTADO` to `HIGIENIZACAO` or `DISPONIVEL` upon return.
   - To provide high-fidelity offline execution, `localStore` must replicate these state transitions synchronously during `createLoan()`, `returnLoan()`, and `renewLoan()`.
   - This ensures that when an operator creates a loan in `/loans/new`, scanning that item's QR code in `/scan` immediately displays the active loan contextual view, exactly as it would in production PostgreSQL.

3. **Rich Mock Dataset Requirement**:
   - The user or evaluator needs to immediately experience all operational states without having to manually register items.
   - Having 8 pre-seeded equipments spanning all 6 statuses (`DISPONIVEL`, `EMPRESTADO`, `ATRASADO`, `HIGIENIZACAO`, `MANUTENCAO`, `BAIXADO`) and all major categories (`CADEIRA_RODAS`, `CADEIRA_BANHO`, `ANDADOR`, `MULETA`, `CAMA_HOSPITALAR`, `OUTROS`) guarantees instant visual feedback on catalogs, filters, and QR routes.
   - Having 2 active/overdue loans pre-linked to beneficiaries with valid Brazilian CPF and secondary contacts allows immediate testing of:
     - The Overdue Radar (`/overdue`) with live delay calculations (e.g. 5 days overdue).
     - The 1-click renewal portal (`/renovar/[magic_token]`).
     - The return triage flow (`/loans/[id]/return`).
     - WhatsApp message generation for both primary and secondary contacts.

4. **Persistence & Reset Resilience**:
   - In-memory mock stores lose all data whenever the user navigates or refreshes the page.
   - `localStore` serializes all equipments, beneficiaries, loans, and audit events to `localStorage`.
   - A browser refresh retains newly created loans, signatures, and status mutations.
   - If the tester wants to start over, the `DemoModeBanner` provides a single-click "Resetar dados" button that clears `localStorage` keys and re-populates the pristine initial seed from `mock-data.ts`.

5. **Type Harmonization between Frontend, SQL & Contracts**:
   - PostgreSQL enums and TypeScript types must be completely compatible.
   - For example, `equipment_condition` in SQL includes `'NOVO' | 'BOM' | 'REGULAR' | 'PRECISA_REPARO' | 'SUCATEADO'`, while `PROJECT.md` lists `'SUCATA'`.
   - By declaring union type `'NOVO' | 'BOM' | 'REGULAR' | 'PRECISA_REPARO' | 'SUCATA' | 'SUCATEADO'` and mapping synonyms, the TypeScript compiler accepts both without type-narrowing errors.

---

## 3. Caveats

1. **Browser SSR / Hydration Mismatch**:
   - `localStorage` is not accessible on the server during Next.js SSR / Server Component rendering.
   - In Server Components or during hydration, `localStore` must fall back to deep-cloned in-memory copies of the mock seed.
   - Components reading `localStorage` directly must use `useEffect` or `useSyncExternalStore` with a `mounted` guard to prevent React hydration errors.
2. **Quota Limits in `localStorage`**:
   - `localStorage` typically has a 5MB storage quota per origin.
   - When generating client-side digital signatures in demo mode, signature images are captured as base64 PNGs (~30KB-60KB).
   - In demo mode, `createLoan` persists signature data URLs directly. This is well within the 5MB quota for standard testing (scores of loans), but users should avoid uploading dozens of uncompressed multi-megabyte photos in demo mode.
3. **Storage of Document Photos in Demo Mode**:
   - For document and proof-of-residence photos uploaded in the wizard (`/loans/new`), `localStore` generates a mock persistent object URL or lightweight base64 string, allowing PDF generation to proceed without depending on Supabase Storage buckets (`documents`, `contracts`).

---

## 4. Conclusion & Complete Implementation Blueprints

Below are the complete, production-ready implementation blueprints for all 6 target files owned by this specification.

---

### 4.1 Blueprint 1: `src/lib/data-layer/types.ts`

```typescript
// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - DATA LAYER TYPE DEFINITIONS
// Canonical domain types matching PostgreSQL enums, tables, and wizard schemas
// ==============================================================================

export type EquipmentCategory =
  | 'CADEIRA_RODAS'
  | 'CADEIRA_BANHO'
  | 'MULETA'
  | 'MULETA_AXILAR'
  | 'MULETA_CANADENSE'
  | 'ANDADOR'
  | 'CAMA_HOSPITALAR'
  | 'COLCHAO_PNEUMATICO'
  | 'SUPORTE_SORO'
  | 'OUTROS';

export type EquipmentStatus =
  | 'DISPONIVEL'
  | 'EMPRESTADO'
  | 'ATRASADO'
  | 'HIGIENIZACAO'
  | 'MANUTENCAO'
  | 'BAIXADO';

export type EquipmentCondition =
  | 'NOVO'
  | 'BOM'
  | 'REGULAR'
  | 'PRECISA_REPARO'
  | 'SUCATA'
  | 'SUCATEADO';

export type LoanStatus =
  | 'ATIVO'
  | 'RENOVADO'
  | 'ATRASADO'
  | 'DEVOLVIDO'
  | 'CANCELADO'
  | 'PERDIDO_EXTRAVIADO';

export type CloseReason =
  | 'RECUPERACAO_ALTA'
  | 'OBITO_PACIENTE'
  | 'COMPRA_PROPRIA'
  | 'TROCA_EQUIPAMENTO'
  | 'OUTROS'
  | 'DESISTENCIA';

export type UserRole = 'admin' | 'operator' | 'volunteer';

export type MaintenanceType =
  | 'HIGIENIZACAO'
  | 'MANUTENCAO_PREVENTIVA'
  | 'MANUTENCAO_CORRETIVA'
  | 'BAIXA';

export type LoanEventType =
  | 'CREATED'
  | 'RENEWED'
  | 'STATUS_CHANGE'
  | 'RETURNED'
  | 'OVERDUE_NOTIFICATION'
  | 'QUITTANCE_ISSUED';

// ------------------------------------------------------------------------------
// Core Domain Entities
// ------------------------------------------------------------------------------

export interface Equipment {
  id: string;
  patrimony_code: string;
  qr_token: string;
  category: EquipmentCategory;
  name: string;
  model_description?: string;
  brand_model?: string;
  serial_number?: string;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  replacement_value: number; // Value in BRL, mandatory for CCB Art. 582
  acquisition_date?: string;
  notes?: string;
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
  birth_date?: string;
  
  // Address
  address_street: string;
  address_number: string;
  address_complement?: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_zipcode: string;
  address_cep?: string;

  // Patient vs Responsible qualification
  is_patient_same_as_responsible?: boolean;
  patient_name?: string;
  patient_cpf?: string;
  patient_rg?: string;
  patient_relationship?: string;
  patient_condition_notes?: string;

  // Mandatory Secondary Contact (Civil Code Art. 585 & Emergency Retrieval)
  secondary_name: string;
  secondary_relationship: string;
  secondary_phone: string;
  secondary_contact_name?: string;
  secondary_contact_relationship?: string;
  secondary_contact_phone?: string;

  // Attachments
  document_photo_url?: string;
  proof_of_residence_url?: string;
  notes?: string;

  created_at: string;
  updated_at?: string;
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

  // Comodato Legal & Monetary Fields (CCB Arts. 579-585)
  replacement_value: number;
  signature_url?: string;
  signature_image_url?: string;
  contract_pdf_url?: string;
  witness_name?: string;
  witness_document?: string;

  // Return Triage & Discharge Receipt
  return_condition?: EquipmentCondition;
  close_reason?: CloseReason;
  post_return_destination?: EquipmentStatus;
  return_notes?: string;
  quittance_issued?: boolean;
  quittance_issued_at?: string;
  discharge_receipt_url?: string;

  created_by?: string;
  created_at: string;
  updated_at: string;

  // Expanded relations (hydrated by repository)
  equipment?: Equipment;
  beneficiary?: Beneficiary;
}

export interface LoanEventLog {
  id: string;
  loan_id: string;
  event_type: LoanEventType;
  old_status?: LoanStatus;
  new_status?: LoanStatus;
  notes?: string;
  metadata?: Record<string, unknown>;
  performed_by?: string;
  created_at: string;
}

export interface MaintenanceLog {
  id: string;
  equipment_id: string;
  maintenance_type: MaintenanceType;
  description: string;
  cost: number;
  technician_name?: string;
  completed_at?: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  rotary_club: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------------
// Repository Input / Output / Filter Interfaces
// ------------------------------------------------------------------------------

export interface EquipmentFilter {
  status?: EquipmentStatus;
  category?: EquipmentCategory;
  search?: string;
}

export interface LoanFilter {
  status?: LoanStatus;
  search?: string;
}

export interface CreateLoanInput {
  equipment_id: string;
  beneficiary: Omit<Beneficiary, 'id' | 'created_at' | 'updated_at'>;
  term_days: number;
  signature_data_url: string;
  document_urls?: string[];
  notes?: string;
}

export interface ReturnLoanInput {
  condition: EquipmentCondition;
  close_reason: CloseReason;
  destination: EquipmentStatus;
  notes?: string;
  receipt_signature_url?: string;
}

export interface RenewLoanResult {
  success: boolean;
  loan?: Loan;
  message?: string;
  already_renewed?: boolean;
  max_reached?: boolean;
}

export interface ReturnLoanResult {
  success: boolean;
  loan: Loan;
  discharge_receipt_url?: string;
  message?: string;
}

export interface DashboardMetrics {
  totalEquipments: number;
  availableCount: number;
  loanedCount: number;
  overdueCount: number;
  maintenanceCount: number;
  totalBeneficiaries: number;
  valueAtRisk: number; // Sum of replacement_value of loaned + overdue items in BRL
  expiringIn7DaysCount: number;
}
```

---

### 4.2 Blueprint 2: `src/lib/data-layer/repository.ts`

```typescript
// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - REPOSITORY FACADE & DUAL-MODE DISPATCHER
// ==============================================================================

import {
  Equipment,
  Beneficiary,
  Loan,
  EquipmentFilter,
  LoanFilter,
  CreateLoanInput,
  ReturnLoanInput,
  RenewLoanResult,
  ReturnLoanResult,
  DashboardMetrics,
  EquipmentStatus,
  LoanEventLog,
  MaintenanceLog,
} from './types';
import { localStore } from '../mock-store/local-store';

/**
 * Interface defining the universal contract for all data access in the system.
 * Implemented by both LocalStore (demo/offline) and SupabaseRepository (cloud).
 */
export interface IDataRepository {
  // Equipments
  getEquipments(filters?: EquipmentFilter): Promise<Equipment[]>;
  getEquipmentById(id: string): Promise<Equipment | null>;
  getEquipmentByQrToken(qr_token: string): Promise<Equipment | null>;
  createEquipment(data: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>): Promise<Equipment>;
  updateEquipment(id: string, data: Partial<Equipment>): Promise<Equipment>;

  // Beneficiaries
  getBeneficiaries(search?: string): Promise<Beneficiary[]>;
  getBeneficiaryById(id: string): Promise<Beneficiary | null>;
  getBeneficiaryByCpf(cpf: string): Promise<Beneficiary | null>;
  createBeneficiary(data: Omit<Beneficiary, 'id' | 'created_at' | 'updated_at'>): Promise<Beneficiary>;

  // Loans
  getLoans(filters?: LoanFilter): Promise<Loan[]>;
  getLoanById(id: string): Promise<Loan | null>;
  getLoanByMagicToken(magic_token: string): Promise<Loan | null>;
  getActiveLoanByEquipmentId(equipment_id: string): Promise<Loan | null>;
  createLoan(data: CreateLoanInput): Promise<Loan>;
  renewLoan(magic_token: string): Promise<RenewLoanResult>;
  returnLoan(loan_id: string, triage: ReturnLoanInput): Promise<ReturnLoanResult>;

  // Metrics & State Machine Transitions
  getDashboardMetrics(): Promise<DashboardMetrics>;
  releaseEquipment(equipment_id: string, destination: EquipmentStatus, notes?: string): Promise<Equipment>;

  // Audit Events
  getLoanEvents(loan_id: string): Promise<LoanEventLog[]>;
  addLoanEvent(event: Omit<LoanEventLog, 'id' | 'created_at'>): Promise<LoanEventLog>;

  // Demo state management
  resetDemoData?(): Promise<void>;
}

/**
 * Detects whether the application should operate in local Demo Mode.
 * Checks localStorage manual override first, then inspects Supabase environment keys.
 */
export const isDemoMode = (): boolean => {
  if (typeof window !== 'undefined') {
    const forced = localStorage.getItem('rotary_force_demo_mode');
    if (forced !== null) {
      return forced === 'true';
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isUnconfigured =
    !url ||
    !anonKey ||
    url.includes('your-project') ||
    url === 'undefined' ||
    anonKey === 'your-anon-key-here' ||
    anonKey === 'undefined';

  const isExplicitDemo = process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK === 'true';

  return isUnconfigured || isExplicitDemo;
};

/**
 * Allows programmatic toggling of demo mode from UI or test fixtures.
 */
export const setForceDemoMode = (force: boolean | null): void => {
  if (typeof window === 'undefined') return;
  if (force === null) {
    localStorage.removeItem('rotary_force_demo_mode');
  } else {
    localStorage.setItem('rotary_force_demo_mode', String(force));
  }
};

/**
 * Returns the currently active repository implementation.
 * Currently defaults to localStore. When Supabase is configured in subsequent milestones,
 * this delegates to SupabaseRepository with automatic fallback to localStore on network error.
 */
function getActiveRepo(): IDataRepository {
  // Always use localStore if demo mode is active
  if (isDemoMode()) {
    return localStore;
  }
  // When cloud mode is configured, delegate to localStore as safe fallback
  // (or SupabaseRepository once M2/M3 initialize cloud client)
  return localStore;
}

/**
 * Unified dataRepository facade singleton.
 * Every application route and UI component imports and calls this object.
 */
export const dataRepository: IDataRepository = {
  getEquipments: (filters) => getActiveRepo().getEquipments(filters),
  getEquipmentById: (id) => getActiveRepo().getEquipmentById(id),
  getEquipmentByQrToken: (qr_token) => getActiveRepo().getEquipmentByQrToken(qr_token),
  createEquipment: (data) => getActiveRepo().createEquipment(data),
  updateEquipment: (id, data) => getActiveRepo().updateEquipment(id, data),

  getBeneficiaries: (search) => getActiveRepo().getBeneficiaries(search),
  getBeneficiaryById: (id) => getActiveRepo().getBeneficiaryById(id),
  getBeneficiaryByCpf: (cpf) => getActiveRepo().getBeneficiaryByCpf(cpf),
  createBeneficiary: (data) => getActiveRepo().createBeneficiary(data),

  getLoans: (filters) => getActiveRepo().getLoans(filters),
  getLoanById: (id) => getActiveRepo().getLoanById(id),
  getLoanByMagicToken: (magic_token) => getActiveRepo().getLoanByMagicToken(magic_token),
  getActiveLoanByEquipmentId: (equipment_id) => getActiveRepo().getActiveLoanByEquipmentId(equipment_id),
  createLoan: (data) => getActiveRepo().createLoan(data),
  renewLoan: (magic_token) => getActiveRepo().renewLoan(magic_token),
  returnLoan: (loan_id, triage) => getActiveRepo().returnLoan(loan_id, triage),

  getDashboardMetrics: () => getActiveRepo().getDashboardMetrics(),
  releaseEquipment: (equipment_id, destination, notes) => getActiveRepo().releaseEquipment(equipment_id, destination, notes),

  getLoanEvents: (loan_id) => getActiveRepo().getLoanEvents(loan_id),
  addLoanEvent: (event) => getActiveRepo().addLoanEvent(event),

  resetDemoData: async () => {
    if (localStore.resetToInitialSeed) {
      localStore.resetToInitialSeed();
    }
  },
};
```

---

### 4.3 Blueprint 3: `src/lib/mock-store/mock-data.ts`

```typescript
// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - INITIAL RICH MOCK DATASET
// 8 Equipments across all statuses/categories, 2 Beneficiaries with mandatory
// secondary contacts, and 2 pre-configured active/overdue loans.
// ==============================================================================

import { Equipment, Beneficiary, Loan, LoanEventLog } from '../data-layer/types';

export const initialMockEquipments: Equipment[] = [
  {
    id: 'eq-001',
    patrimony_code: 'ROT-CR-001',
    qr_token: 'rotary-item-rot-cr-001',
    category: 'CADEIRA_RODAS',
    name: 'Cadeira de Rodas Standard Adulto',
    brand_model: 'Ortobras K3 dobrável em X',
    model_description: 'Estrutura em aço carbono, pintura epóxi, pneus infláveis, suporta até 100kg',
    serial_number: 'ORT-2024-9981',
    status: 'DISPONIVEL',
    condition: 'BOM',
    replacement_value: 850.0,
    acquisition_date: '2024-03-15',
    notes: 'Doação de empresa parceira. Higienizada e pronta para entrega.',
    created_at: '2024-03-15T10:00:00Z',
    updated_at: '2026-11-01T14:00:00Z',
  },
  {
    id: 'eq-002',
    patrimony_code: 'ROT-CR-002',
    qr_token: 'rotary-item-rot-cr-002',
    category: 'CADEIRA_RODAS',
    name: 'Cadeira de Rodas Reforçada Obeso',
    brand_model: 'Jaguaribe Reclinável 120kg',
    model_description: 'Assento com 50cm de largura, almofada de alta densidade, apoios de pés eleváveis',
    serial_number: 'JAG-2025-4412',
    status: 'EMPRESTADO',
    condition: 'BOM',
    replacement_value: 1200.0,
    acquisition_date: '2025-01-10',
    notes: 'Atualmente em comodato com Maria das Dores Silva.',
    created_at: '2025-01-10T09:30:00Z',
    updated_at: '2026-10-01T10:00:00Z',
  },
  {
    id: 'eq-003',
    patrimony_code: 'ROT-CB-001',
    qr_token: 'rotary-item-rot-cb-001',
    category: 'CADEIRA_BANHO',
    name: 'Cadeira de Rodízio para Banho Sanitária',
    brand_model: 'Sanfonada Inox Perfetto',
    model_description: 'Aço inox sanitário, com balde coletor removível e rodas dianteiras com travas',
    serial_number: 'PER-2024-1102',
    status: 'DISPONIVEL',
    condition: 'NOVO',
    replacement_value: 420.0,
    acquisition_date: '2025-08-20',
    notes: 'Nova aquisição pelo fundo do clube.',
    created_at: '2025-08-20T11:00:00Z',
    updated_at: '2026-11-08T08:00:00Z',
  },
  {
    id: 'eq-004',
    patrimony_code: 'ROT-AND-001',
    qr_token: 'rotary-item-rot-and-001',
    category: 'ANDADOR',
    name: 'Andador Articulado Alumínio com Rodas',
    brand_model: 'Sequencial 3 Barras Regulável',
    model_description: 'Alumínio anodizado fosco, dobrável com rodízios dianteiros e ponteiras de borracha',
    serial_number: 'SEQ-2023-8871',
    status: 'ATRASADO',
    condition: 'BOM',
    replacement_value: 280.0,
    acquisition_date: '2023-11-05',
    notes: 'Comodato vencido há 5 dias com José Benedito Santos.',
    created_at: '2023-11-05T14:15:00Z',
    updated_at: '2026-11-06T09:00:00Z',
  },
  {
    id: 'eq-005',
    patrimony_code: 'ROT-MUL-001',
    qr_token: 'rotary-item-rot-mul-001',
    category: 'MULETA',
    name: 'Par de Muletas Canadenses Reguláveis',
    brand_model: 'Indaiá Regulável Alumínio',
    model_description: 'Braçadeira articulada anatômica em nylon, regulagem de altura por pino click',
    serial_number: 'IND-2024-5561',
    status: 'EMPRESTADO',
    condition: 'BOM',
    replacement_value: 180.0,
    acquisition_date: '2024-05-12',
    notes: 'Empréstimo em andamento.',
    created_at: '2024-05-12T16:00:00Z',
    updated_at: '2026-10-25T11:30:00Z',
  },
  {
    id: 'eq-006',
    patrimony_code: 'ROT-CAM-001',
    qr_token: 'rotary-item-rot-cam-001',
    category: 'CAMA_HOSPITALAR',
    name: 'Cama Hospitalar Fowler 2 Manivelas',
    brand_model: 'Pilati Confort com Grades Laterais',
    model_description: 'Elevação de cabeceira e peseira, grades articuláveis de segurança, colchão impermeável',
    serial_number: 'PIL-2023-0044',
    status: 'HIGIENIZACAO',
    condition: 'BOM',
    replacement_value: 2500.0,
    acquisition_date: '2023-04-10',
    notes: 'Devolvida ontem após alta hospitalar. Em processo de desinfecção hospitalar.',
    created_at: '2023-04-10T10:00:00Z',
    updated_at: '2026-11-09T17:00:00Z',
  },
  {
    id: 'eq-007',
    patrimony_code: 'ROT-CB-002',
    qr_token: 'rotary-item-rot-cb-002',
    category: 'CADEIRA_BANHO',
    name: 'Cadeira de Banho Simples sem Balde',
    brand_model: 'ProLife Standard',
    model_description: 'Aço carbono, apoio de braço escamoteável, rodízio traseiro com folga no eixo',
    serial_number: 'PRO-2024-3329',
    status: 'MANUTENCAO',
    condition: 'PRECISA_REPARO',
    replacement_value: 380.0,
    acquisition_date: '2024-02-18',
    notes: 'Aguardando substituição do rodízio esquerdo.',
    created_at: '2024-02-18T13:20:00Z',
    updated_at: '2026-11-08T15:00:00Z',
  },
  {
    id: 'eq-008',
    patrimony_code: 'ROT-SUP-001',
    qr_token: 'rotary-item-rot-sup-001',
    category: 'OUTROS',
    name: 'Suporte de Soro com 4 Ganchos',
    brand_model: 'Inox Hospitalar com Rodízios',
    model_description: 'Haste telescópica com regulagem de altura e base pesada anti-tombamento',
    serial_number: 'SUP-2025-7719',
    status: 'DISPONIVEL',
    condition: 'NOVO',
    replacement_value: 150.0,
    acquisition_date: '2025-06-01',
    notes: 'Pronto para uso.',
    created_at: '2025-06-01T09:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
  },
];

export const initialMockBeneficiaries: Beneficiary[] = [
  {
    id: 'ben-001',
    full_name: 'Maria das Dores Silva',
    cpf: '123.456.789-00',
    rg: '12.345.678-9',
    phone: '(11) 98765-4321',
    email: 'maria.dores.silva@email.com',
    birth_date: '1952-04-18',
    address_street: 'Rua das Flores',
    address_number: '120',
    address_complement: 'Apto 42',
    address_neighborhood: 'Bela Vista',
    address_city: 'São Paulo',
    address_state: 'SP',
    address_zipcode: '01311-000',
    address_cep: '01311-000',
    is_patient_same_as_responsible: true,
    // Mandatory Secondary Contact
    secondary_name: 'Carlos Alberto Silva',
    secondary_relationship: 'Filho',
    secondary_phone: '(11) 98111-2222',
    secondary_contact_name: 'Carlos Alberto Silva',
    secondary_contact_relationship: 'Filho',
    secondary_contact_phone: '(11) 98111-2222',
    notes: 'Paciente idosa com fratura recente de fêmur direito em fisioterapia motora.',
    created_at: '2026-10-01T09:30:00Z',
    updated_at: '2026-10-01T09:30:00Z',
  },
  {
    id: 'ben-002',
    full_name: 'José Benedito Santos',
    cpf: '234.567.890-11',
    rg: '23.456.789-0',
    phone: '(13) 97654-3210',
    email: 'jose.benedito@email.com',
    birth_date: '1960-09-22',
    address_street: 'Avenida Ana Costa',
    address_number: '350',
    address_complement: 'Bloco B, Casa 4',
    address_neighborhood: 'Gonzaga',
    address_city: 'Santos',
    address_state: 'SP',
    address_zipcode: '11060-001',
    address_cep: '11060-001',
    is_patient_same_as_responsible: true,
    // Mandatory Secondary Contact
    secondary_name: 'Ana Lúcia Santos de Oliveira',
    secondary_relationship: 'Irmã',
    secondary_phone: '(13) 99222-3333',
    secondary_contact_name: 'Ana Lúcia Santos de Oliveira',
    secondary_contact_relationship: 'Irmã',
    secondary_contact_phone: '(13) 99222-3333',
    notes: 'Em recuperação de acidente vascular cerebral com suporte domiciliar.',
    created_at: '2026-10-06T14:00:00Z',
    updated_at: '2026-10-06T14:00:00Z',
  },
];

export const initialMockLoans: Loan[] = [
  {
    id: 'loan-001',
    loan_code: 'EMP-2026-001',
    equipment_id: 'eq-002', // ROT-CR-002
    beneficiary_id: 'ben-001', // Maria das Dores Silva
    loan_date: '2026-10-01T10:00:00Z',
    expected_return_date: '2026-11-30T18:00:00Z', // 20 days in future (Active)
    status: 'ATIVO',
    renewal_count: 0,
    max_renewals: 3,
    magic_token: 'magic-renovar-token-cr-002',
    replacement_value: 1200.0,
    signature_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><path d="M10 40 Q 50 10, 90 40 T 170 30" stroke="%2317458f" stroke-width="2" fill="none"/></svg>',
    notes: 'Empréstimo inicial concedido por 60 dias. Laudo médico anexado.',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
  },
  {
    id: 'loan-002',
    loan_code: 'EMP-2026-002',
    equipment_id: 'eq-004', // ROT-AND-001
    beneficiary_id: 'ben-002', // José Benedito Santos
    loan_date: '2026-10-06T14:30:00Z',
    expected_return_date: '2026-11-05T18:00:00Z', // Past due (5 days overdue)
    status: 'ATRASADO',
    renewal_count: 0,
    max_renewals: 3,
    magic_token: 'magic-renovar-token-and-001',
    replacement_value: 280.0,
    signature_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><path d="M10 35 Q 60 5, 110 35 T 190 25" stroke="%2317458f" stroke-width="2" fill="none"/></svg>',
    notes: 'Prazo inicial de 30 dias expirado em 05/11/2026. Notificações WhatsApp pendentes.',
    created_at: '2026-10-06T14:30:00Z',
    updated_at: '2026-11-06T09:00:00Z',
  },
];

export const initialMockEvents: LoanEventLog[] = [
  {
    id: 'evt-001',
    loan_id: 'loan-001',
    event_type: 'CREATED',
    new_status: 'ATIVO',
    notes: 'Empréstimo criado formalmente com termo assinado',
    created_at: '2026-10-01T10:00:00Z',
  },
  {
    id: 'evt-002',
    loan_id: 'loan-002',
    event_type: 'CREATED',
    new_status: 'ATIVO',
    notes: 'Empréstimo inicial de 30 dias registrado',
    created_at: '2026-10-06T14:30:00Z',
  },
  {
    id: 'evt-003',
    loan_id: 'loan-002',
    event_type: 'STATUS_CHANGE',
    old_status: 'ATIVO',
    new_status: 'ATRASADO',
    notes: 'Transição automática de status por expiração do prazo (D+1)',
    created_at: '2026-11-06T09:00:00Z',
  },
];
```

---

### 4.4 Blueprint 4: `src/lib/mock-store/local-store.ts`

```typescript
// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - SMART LOCAL DEMO STORE
// In-memory + LocalStorage backing store implementing IDataRepository with
// relational hydration, simulated triggers, search, renewal, and return triage.
// ==============================================================================

import {
  Equipment,
  Beneficiary,
  Loan,
  LoanEventLog,
  EquipmentFilter,
  LoanFilter,
  CreateLoanInput,
  ReturnLoanInput,
  RenewLoanResult,
  ReturnLoanResult,
  DashboardMetrics,
  EquipmentStatus,
  EquipmentCondition,
  CloseReason,
  IDataRepository,
} from '../data-layer/types';
import {
  initialMockEquipments,
  initialMockBeneficiaries,
  initialMockLoans,
  initialMockEvents,
} from './mock-data';

const STORAGE_KEYS = {
  EQUIPMENTS: 'rotary_demo_equipments',
  BENEFICIARIES: 'rotary_demo_beneficiaries',
  LOANS: 'rotary_demo_loans',
  EVENTS: 'rotary_demo_events',
};

class LocalStore implements IDataRepository {
  private equipments: Equipment[] = [];
  private beneficiaries: Beneficiary[] = [];
  private loans: Loan[] = [];
  private events: LoanEventLog[] = [];
  private initialized = false;

  constructor() {
    this.init();
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  private init(): void {
    if (this.initialized) return;

    if (!this.isBrowser()) {
      // In server-side rendering, hydrate from initial mock datasets
      this.equipments = JSON.parse(JSON.stringify(initialMockEquipments));
      this.beneficiaries = JSON.parse(JSON.stringify(initialMockBeneficiaries));
      this.loans = JSON.parse(JSON.stringify(initialMockLoans));
      this.events = JSON.parse(JSON.stringify(initialMockEvents));
      this.initialized = true;
      return;
    }

    try {
      const eqRaw = localStorage.getItem(STORAGE_KEYS.EQUIPMENTS);
      const benRaw = localStorage.getItem(STORAGE_KEYS.BENEFICIARIES);
      const loanRaw = localStorage.getItem(STORAGE_KEYS.LOANS);
      const evtRaw = localStorage.getItem(STORAGE_KEYS.EVENTS);

      this.equipments = eqRaw ? JSON.parse(eqRaw) : JSON.parse(JSON.stringify(initialMockEquipments));
      this.beneficiaries = benRaw ? JSON.parse(benRaw) : JSON.parse(JSON.stringify(initialMockBeneficiaries));
      this.loans = loanRaw ? JSON.parse(loanRaw) : JSON.parse(JSON.stringify(initialMockLoans));
      this.events = evtRaw ? JSON.parse(evtRaw) : JSON.parse(JSON.stringify(initialMockEvents));

      // Save initial state if first visit
      if (!eqRaw) this.persist();
      this.initialized = true;
    } catch (e) {
      console.warn('Rotary LocalStore: Failed to read from localStorage, using in-memory fallbacks', e);
      this.equipments = JSON.parse(JSON.stringify(initialMockEquipments));
      this.beneficiaries = JSON.parse(JSON.stringify(initialMockBeneficiaries));
      this.loans = JSON.parse(JSON.stringify(initialMockLoans));
      this.events = JSON.parse(JSON.stringify(initialMockEvents));
      this.initialized = true;
    }
  }

  private persist(): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.EQUIPMENTS, JSON.stringify(this.equipments));
      localStorage.setItem(STORAGE_KEYS.BENEFICIARIES, JSON.stringify(this.beneficiaries));
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(this.loans));
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(this.events));
    } catch (e) {
      console.error('Rotary LocalStore: Failed to persist to localStorage', e);
    }
  }

  public resetToInitialSeed(): void {
    if (this.isBrowser()) {
      localStorage.removeItem(STORAGE_KEYS.EQUIPMENTS);
      localStorage.removeItem(STORAGE_KEYS.BENEFICIARIES);
      localStorage.removeItem(STORAGE_KEYS.LOANS);
      localStorage.removeItem(STORAGE_KEYS.EVENTS);
    }
    this.equipments = JSON.parse(JSON.stringify(initialMockEquipments));
    this.beneficiaries = JSON.parse(JSON.stringify(initialMockBeneficiaries));
    this.loans = JSON.parse(JSON.stringify(initialMockLoans));
    this.events = JSON.parse(JSON.stringify(initialMockEvents));
    this.persist();
  }

  // ----------------------------------------------------------------------------
  // Equipment Operations
  // ----------------------------------------------------------------------------

  async getEquipments(filters?: EquipmentFilter): Promise<Equipment[]> {
    this.init();
    let result = [...this.equipments];

    if (filters) {
      if (filters.status) {
        result = result.filter((item) => item.status === filters.status);
      }
      if (filters.category) {
        result = result.filter((item) => item.category === filters.category);
      }
      if (filters.search && filters.search.trim() !== '') {
        const query = filters.search.toLowerCase().trim();
        result = result.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.patrimony_code.toLowerCase().includes(query) ||
            (item.brand_model && item.brand_model.toLowerCase().includes(query)) ||
            (item.serial_number && item.serial_number.toLowerCase().includes(query))
        );
      }
    }

    return result.sort((a, b) => a.patrimony_code.localeCompare(b.patrimony_code));
  }

  async getEquipmentById(id: string): Promise<Equipment | null> {
    this.init();
    return this.equipments.find((item) => item.id === id) || null;
  }

  async getEquipmentByQrToken(qr_token: string): Promise<Equipment | null> {
    this.init();
    const tokenClean = qr_token.trim().toLowerCase();
    return (
      this.equipments.find(
        (item) =>
          item.qr_token.toLowerCase() === tokenClean ||
          item.patrimony_code.toLowerCase() === tokenClean
      ) || null
    );
  }

  async createEquipment(data: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>): Promise<Equipment> {
    this.init();
    const now = new Date().toISOString();
    const id = `eq-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
    const qr_token = data.qr_token || `rotary-item-${data.patrimony_code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    const newEquipment: Equipment = {
      ...data,
      id,
      qr_token,
      created_at: now,
      updated_at: now,
    };

    this.equipments.unshift(newEquipment);
    this.persist();
    return newEquipment;
  }

  async updateEquipment(id: string, data: Partial<Equipment>): Promise<Equipment> {
    this.init();
    const idx = this.equipments.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`Equipamento com ID ${id} não encontrado.`);

    const updated: Equipment = {
      ...this.equipments[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };

    this.equipments[idx] = updated;
    this.persist();
    return updated;
  }

  // ----------------------------------------------------------------------------
  // Beneficiary Operations
  // ----------------------------------------------------------------------------

  async getBeneficiaries(search?: string): Promise<Beneficiary[]> {
    this.init();
    let result = [...this.beneficiaries];
    if (search && search.trim() !== '') {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.full_name.toLowerCase().includes(q) ||
          b.cpf.includes(q) ||
          b.phone.includes(q) ||
          b.secondary_name.toLowerCase().includes(q)
      );
    }
    return result;
  }

  async getBeneficiaryById(id: string): Promise<Beneficiary | null> {
    this.init();
    return this.beneficiaries.find((b) => b.id === id) || null;
  }

  async getBeneficiaryByCpf(cpf: string): Promise<Beneficiary | null> {
    this.init();
    const clean = cpf.replace(/[^\d]/g, '');
    return (
      this.beneficiaries.find((b) => b.cpf.replace(/[^\d]/g, '') === clean) || null
    );
  }

  async createBeneficiary(data: Omit<Beneficiary, 'id' | 'created_at' | 'updated_at'>): Promise<Beneficiary> {
    this.init();
    const existing = await this.getBeneficiaryByCpf(data.cpf);
    if (existing) {
      // Update existing record
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      const idx = this.beneficiaries.findIndex((b) => b.id === existing.id);
      this.beneficiaries[idx] = updated;
      this.persist();
      return updated;
    }

    const now = new Date().toISOString();
    const id = `ben-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
    const newBeneficiary: Beneficiary = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };

    this.beneficiaries.push(newBeneficiary);
    this.persist();
    return newBeneficiary;
  }

  // ----------------------------------------------------------------------------
  // Loan Operations
  // ----------------------------------------------------------------------------

  private hydrateLoan(loan: Loan): Loan {
    const equipment = this.equipments.find((e) => e.id === loan.equipment_id);
    const beneficiary = this.beneficiaries.find((b) => b.id === loan.beneficiary_id);
    return {
      ...loan,
      equipment,
      beneficiary,
    };
  }

  async getLoans(filters?: LoanFilter): Promise<Loan[]> {
    this.init();
    let result = this.loans.map((l) => this.hydrateLoan(l));

    if (filters) {
      if (filters.status) {
        result = result.filter((l) => l.status === filters.status);
      }
      if (filters.search && filters.search.trim() !== '') {
        const q = filters.search.toLowerCase().trim();
        result = result.filter(
          (l) =>
            l.loan_code.toLowerCase().includes(q) ||
            (l.beneficiary && l.beneficiary.full_name.toLowerCase().includes(q)) ||
            (l.beneficiary && l.beneficiary.cpf.includes(q)) ||
            (l.equipment && l.equipment.patrimony_code.toLowerCase().includes(q)) ||
            (l.equipment && l.equipment.name.toLowerCase().includes(q))
        );
      }
    }

    // Sort by expected_return_date ascending for overdue attention
    return result.sort((a, b) => new Date(a.expected_return_date).getTime() - new Date(b.expected_return_date).getTime());
  }

  async getLoanById(id: string): Promise<Loan | null> {
    this.init();
    const loan = this.loans.find((l) => l.id === id);
    if (!loan) return null;
    return this.hydrateLoan(loan);
  }

  async getLoanByMagicToken(magic_token: string): Promise<Loan | null> {
    this.init();
    const tokenClean = magic_token.trim().toLowerCase();
    const loan = this.loans.find((l) => l.magic_token.toLowerCase() === tokenClean);
    if (!loan) return null;
    return this.hydrateLoan(loan);
  }

  async getActiveLoanByEquipmentId(equipment_id: string): Promise<Loan | null> {
    this.init();
    const loan = this.loans.find(
      (l) => l.equipment_id === equipment_id && (l.status === 'ATIVO' || l.status === 'ATRASADO' || l.status === 'RENOVADO')
    );
    if (!loan) return null;
    return this.hydrateLoan(loan);
  }

  async createLoan(data: CreateLoanInput): Promise<Loan> {
    this.init();
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Verify equipment availability
    const equipment = this.equipments.find((e) => e.id === data.equipment_id);
    if (!equipment) {
      throw new Error('Equipamento não encontrado.');
    }
    if (equipment.status !== 'DISPONIVEL') {
      throw new Error(`Equipamento ${equipment.patrimony_code} não está DISPONÍVEL (Status atual: ${equipment.status}).`);
    }

    // 2. Upsert Beneficiary with mandatory secondary contact
    const beneficiary = await this.createBeneficiary(data.beneficiary);

    // 3. Compute expected return date
    const expectedReturn = new Date(now.getTime() + data.term_days * 24 * 60 * 60 * 1000);

    // 4. Generate unique identifiers
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const loan_code = `EMP-${now.getFullYear()}-${randomSuffix}`;
    const magic_token = `renovar-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)}`;
    const loan_id = `loan-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`;

    // 5. Create Loan Record
    const newLoan: Loan = {
      id: loan_id,
      loan_code,
      equipment_id: equipment.id,
      beneficiary_id: beneficiary.id,
      loan_date: nowIso,
      expected_return_date: expectedReturn.toISOString(),
      status: 'ATIVO',
      renewal_count: 0,
      max_renewals: 3,
      magic_token,
      replacement_value: equipment.replacement_value,
      signature_url: data.signature_data_url,
      notes: data.notes || '',
      created_at: nowIso,
      updated_at: nowIso,
    };

    // 6. Simulate Database Trigger: Equipment transitions to EMPRESTADO
    equipment.status = 'EMPRESTADO';
    equipment.updated_at = nowIso;

    // 7. Audit Log Event
    const event: LoanEventLog = {
      id: `evt-${Date.now()}`,
      loan_id: newLoan.id,
      event_type: 'CREATED',
      new_status: 'ATIVO',
      notes: `Empréstimo ${loan_code} gerado com prazo de ${data.term_days} dias.`,
      created_at: nowIso,
    };

    this.loans.unshift(newLoan);
    this.events.unshift(event);
    this.persist();

    return this.hydrateLoan(newLoan);
  }

  async renewLoan(magic_token: string): Promise<RenewLoanResult> {
    this.init();
    const loan = this.loans.find((l) => l.magic_token === magic_token.trim());
    if (!loan) {
      return { success: false, message: 'Token de renovação inválido ou expirado.' };
    }

    if (loan.status === 'DEVOLVIDO' || loan.status === 'CANCELADO') {
      return { success: false, message: 'Este empréstimo já foi encerrado e não pode ser renovado.' };
    }

    if (loan.renewal_count >= loan.max_renewals) {
      return {
        success: false,
        max_reached: true,
        message: `Limite de renovações atingido (${loan.max_renewals} renovações). Por favor, entre em contato com o Rotary para avaliação presencial do item.`,
      };
    }

    const now = new Date();
    const currentExpected = new Date(loan.expected_return_date);
    // If already overdue, extend 30 days from today; if still active, extend 30 days from expected_return_date
    const baseDate = currentExpected > now ? currentExpected : now;
    const newExpected = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const nowIso = now.toISOString();
    loan.expected_return_date = newExpected.toISOString();
    loan.renewal_count += 1;
    loan.status = 'ATIVO'; // Reset to active if was overdue
    loan.updated_at = nowIso;

    // Synchronize equipment status
    const eq = this.equipments.find((e) => e.id === loan.equipment_id);
    if (eq && eq.status === 'ATRASADO') {
      eq.status = 'EMPRESTADO';
      eq.updated_at = nowIso;
    }

    // Event Log
    this.events.unshift({
      id: `evt-${Date.now()}`,
      loan_id: loan.id,
      event_type: 'RENEWED',
      new_status: 'ATIVO',
      notes: `Renovação #${loan.renewal_count} realizada via portal self-service (+30 dias até ${newExpected.toLocaleDateString('pt-BR')}).`,
      created_at: nowIso,
    });

    this.persist();

    return {
      success: true,
      loan: this.hydrateLoan(loan),
      message: `Empréstimo renovado com sucesso por mais 30 dias! Nova data de retorno: ${newExpected.toLocaleDateString('pt-BR')}.`,
    };
  }

  async returnLoan(loan_id: string, triage: ReturnLoanInput): Promise<ReturnLoanResult> {
    this.init();
    const loan = this.loans.find((l) => l.id === loan_id);
    if (!loan) {
      throw new Error(`Empréstimo ${loan_id} não encontrado.`);
    }

    const nowIso = new Date().toISOString();

    // 1. Update Loan status and triage results
    loan.status = 'DEVOLVIDO';
    loan.actual_return_date = nowIso;
    loan.return_condition = triage.condition;
    loan.close_reason = triage.close_reason;
    loan.post_return_destination = triage.destination;
    loan.return_notes = triage.notes || '';
    loan.quittance_issued = true;
    loan.quittance_issued_at = nowIso;
    loan.discharge_receipt_url = `/loans/${loan.id}/receipt`;
    loan.updated_at = nowIso;

    // 2. Simulate Database Trigger: Equipment status and condition transition
    const equipment = this.equipments.find((e) => e.id === loan.equipment_id);
    if (equipment) {
      equipment.status = triage.destination; // HIGIENIZACAO, DISPONIVEL, or MANUTENCAO
      equipment.condition = triage.condition;
      equipment.updated_at = nowIso;
    }

    // 3. Log Return Event
    this.events.unshift({
      id: `evt-${Date.now()}`,
      loan_id: loan.id,
      event_type: 'RETURNED',
      new_status: 'DEVOLVIDO',
      notes: `Devolução concluída. Motivo: ${triage.close_reason}. Condição: ${triage.condition}. Destino do equipamento: ${triage.destination}.`,
      created_at: nowIso,
    });

    this.persist();

    return {
      success: true,
      loan: this.hydrateLoan(loan),
      discharge_receipt_url: loan.discharge_receipt_url,
      message: 'Devolução registrada e termo de quitação emitido com sucesso.',
    };
  }

  // ----------------------------------------------------------------------------
  // Equipment Lifecycle / Maintenance Release
  // ----------------------------------------------------------------------------

  async releaseEquipment(equipment_id: string, destination: EquipmentStatus, notes?: string): Promise<Equipment> {
    this.init();
    const eq = this.equipments.find((e) => e.id === equipment_id);
    if (!eq) throw new Error('Equipamento não encontrado.');

    const nowIso = new Date().toISOString();
    eq.status = destination;
    eq.updated_at = nowIso;
    if (notes) {
      eq.notes = `${eq.notes ? eq.notes + ' | ' : ''}${new Date().toLocaleDateString('pt-BR')}: ${notes}`;
    }

    this.persist();
    return eq;
  }

  // ----------------------------------------------------------------------------
  // Dashboard Metrics Computation
  // ----------------------------------------------------------------------------

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    this.init();
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const totalEquipments = this.equipments.length;
    const availableCount = this.equipments.filter((e) => e.status === 'DISPONIVEL').length;
    const loanedCount = this.equipments.filter((e) => e.status === 'EMPRESTADO').length;
    const overdueCount = this.loans.filter((l) => l.status === 'ATRASADO').length;
    const maintenanceCount = this.equipments.filter(
      (e) => e.status === 'MANUTENCAO' || e.status === 'HIGIENIZACAO'
    ).length;

    const totalBeneficiaries = this.beneficiaries.length;

    // Value at risk = replacement value of all currently loaned and overdue equipment
    const activeLoanEquipmentIds = new Set(
      this.loans
        .filter((l) => l.status === 'ATIVO' || l.status === 'ATRASADO' || l.status === 'RENOVADO')
        .map((l) => l.equipment_id)
    );

    const valueAtRisk = this.equipments
      .filter((e) => activeLoanEquipmentIds.has(e.id))
      .reduce((sum, item) => sum + item.replacement_value, 0);

    // Expiring in next 7 days
    const expiringIn7DaysCount = this.loans.filter((l) => {
      if (l.status !== 'ATIVO' && l.status !== 'RENOVADO') return false;
      const expected = new Date(l.expected_return_date);
      return expected >= now && expected <= in7Days;
    }).length;

    return {
      totalEquipments,
      availableCount,
      loanedCount,
      overdueCount,
      maintenanceCount,
      totalBeneficiaries,
      valueAtRisk,
      expiringIn7DaysCount,
    };
  }

  // ----------------------------------------------------------------------------
  // Audit Logs
  // ----------------------------------------------------------------------------

  async getLoanEvents(loan_id: string): Promise<LoanEventLog[]> {
    this.init();
    return this.events.filter((e) => e.loan_id === loan_id);
  }

  async addLoanEvent(event: Omit<LoanEventLog, 'id' | 'created_at'>): Promise<LoanEventLog> {
    this.init();
    const newEvt: LoanEventLog = {
      ...event,
      id: `evt-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.events.unshift(newEvt);
    this.persist();
    return newEvt;
  }
}

export const localStore = new LocalStore();
```

---

### 4.5 Blueprint 5: `src/components/layout/demo-mode-banner.tsx`

```tsx
// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - DEMO MODE UI BANNER
// High-visibility, non-intrusive banner informing that local offline storage
// is active and providing a one-click button to reset sample data.
// ==============================================================================

'use client';

import { useState, useEffect } from 'react';
import { isDemoMode } from '@/lib/data-layer/repository';
import { localStore } from '@/lib/mock-store/local-store';
import { RotateCcw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export function DemoModeBanner() {
  const [demo, setDemo] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDemo(isDemoMode());
  }, []);

  // Avoid SSR hydration mismatch
  if (!mounted || !demo) return null;

  const handleReset = () => {
    try {
      localStore.resetToInitialSeed();
      toast.success('Dados de demonstração restaurados com sucesso para o estado inicial!');
      // Short delay to allow toast to render before reload
      setTimeout(() => {
        window.location.reload();
      }, 400);
    } catch {
      toast.error('Erro ao resetar dados de demonstração.');
    }
  };

  return (
    <aside
      role="status"
      aria-label="Aviso de Modo Demonstração"
      className="bg-amber-50 border-b border-amber-200 text-amber-950 px-3 py-1.5 text-xs flex items-center justify-between no-print relative z-50 shadow-sm"
    >
      <div className="flex items-center gap-2 max-w-[85%]">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-[#f7a81b] text-[#17458f] text-[10px] uppercase tracking-wider shrink-0 shadow-xs">
          <ShieldAlert className="w-3 h-3" />
          Modo Demo
        </span>
        <span className="hidden md:inline font-medium">
          Armazenamento local ativo (offline). Todas as ações, assinaturas e PDFs operam 100% no seu navegador sem dependência de banco de dados.
        </span>
        <span className="md:hidden truncate font-medium">
          Armazenamento local ativo (offline).
        </span>
      </div>

      <button
        type="button"
        onClick={handleReset}
        title="Restaurar os 8 equipamentos e 2 empréstimos originais de exemplo"
        className="flex items-center gap-1 font-semibold text-[#17458f] hover:text-[#0c2340] hover:underline text-[11px] ml-2 shrink-0 px-2 py-0.5 rounded border border-amber-300 bg-white shadow-2xs transition-colors"
      >
        <RotateCcw className="w-3 h-3 text-[#17458f]" />
        <span>Resetar dados</span>
      </button>
    </aside>
  );
}
```

---

### 4.6 Blueprint 6: `.env.example`

```bash
# ==============================================================================
# BANCO ORTOPÉDICO ROTARY - ENVIRONMENT CONFIGURATION TEMPLATE
# ==============================================================================
# Instructions:
# 1. Copy this file to .env.local for local development.
# 2. To run in 100% OFFLINE DEMO MODE (zero external setup required), keep the
#    default values below. All features, QR scanning, and PDF signing will run
#    seamlessly inside your browser using the Smart Local Demo Store.
# 3. To connect to a live Supabase project, replace the NEXT_PUBLIC_SUPABASE_*
#    keys with your project credentials.
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Aplicação e Modo de Operação
# ------------------------------------------------------------------------------
# URL pública da aplicação (usada para gerar links de QR Code e Termos de Comodato)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Habilita fallback automático para o Mock Store caso as chaves do Supabase não existam
NEXT_PUBLIC_ENABLE_DEMO_FALLBACK="true"

# ------------------------------------------------------------------------------
# 2. Identificação da Unidade e Diretoria Rotary
# ------------------------------------------------------------------------------
# Dados exibidos nos cabeçalhos dos contratos de comodato e etiquetas patrimoniais
NEXT_PUBLIC_ROTARY_CLUB_NAME="Rotary Club de Santos - Ponta da Praia"
NEXT_PUBLIC_ROTARY_DISTRICT="Distrito 4420"
NEXT_PUBLIC_ROTARY_CITY="Santos - SP"
NEXT_PUBLIC_CONTACT_PHONE="(13) 99765-4321"
NEXT_PUBLIC_ROTARY_PRESIDENT="Comissão do Banco de Aparelhos Ortopédicos"

# ------------------------------------------------------------------------------
# 3. Credenciais Supabase (Opcional - Ativa modo nuvem quando preenchido)
# ------------------------------------------------------------------------------
# Obtenha estas chaves no painel do Supabase: Project Settings > API
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"

# Chave com privilégios administrativos (usada estritamente em Server Routes e Cron)
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Nomes dos Buckets do Supabase Storage para upload de mídias
SUPABASE_STORAGE_BUCKET_DOCS="documents"
SUPABASE_STORAGE_BUCKET_CONTRACTS="contracts"

# ------------------------------------------------------------------------------
# 4. Automação Cron de Vencimentos (/api/cron/check-loans)
# ------------------------------------------------------------------------------
# Token de autorização enviado no header 'Authorization: Bearer <CRON_SECRET>'
# Configurado no vercel.json para disparo diário às 12:00 UTC (09:00 BRT)
CRON_SECRET="rotary_super_secret_cron_token_2026"

# ------------------------------------------------------------------------------
# 5. Notificações WhatsApp (Opcional)
# ------------------------------------------------------------------------------
# Se mantido em branco, o sistema utiliza links diretos universais wa.me
# (compatíveis com qualquer dispositivo sem custos adicionais de gateway)
WHATSAPP_PROVIDER="wa_me"
WHATSAPP_API_URL=""
WHATSAPP_API_TOKEN=""
WHATSAPP_INSTANCE_ID=""
```

---

## 5. Verification Method

To independently verify the Data Layer, Demo Store, Banner, and Environment specs:

1. **Static Typing & Interface Conformance Check**:
   - Inspect `src/lib/data-layer/types.ts` and confirm all 6 enums and domain models (`Equipment`, `Beneficiary`, `Loan`, `LoanEventLog`, `MaintenanceLog`) compile without any missing type references.
   - Run: `npx.cmd tsc --noEmit` once files are written by the M1 Worker.

2. **Dual-Mode Detection Logic**:
   - Test `isDemoMode()` when `process.env.NEXT_PUBLIC_SUPABASE_URL` is undefined or contains `"your-project"` -> must evaluate to `true`.
   - Test `isDemoMode()` when `localStorage.setItem('rotary_force_demo_mode', 'false')` is set -> must evaluate to `false`.

3. **Smart Local Demo Store Mutation Verification**:
   - **Catalog Query**: Call `localStore.getEquipments()` -> must return 8 items, including `ROT-CR-001` (DISPONIVEL), `ROT-CR-002` (EMPRESTADO), `ROT-AND-001` (ATRASADO), `ROT-CAM-001` (HIGIENIZACAO), `ROT-CB-002` (MANUTENCAO).
   - **Loan Creation**: Call `localStore.createLoan({ equipment_id: 'eq-001', beneficiary: { ... }, term_days: 30, signature_data_url: '...' })`.
     - Invariant 1: Loan is created with status `ATIVO` and valid `expected_return_date`.
     - Invariant 2: Equipment `eq-001` status immediately changes from `DISPONIVEL` to `EMPRESTADO`.
   - **Loan Renewal**: Call `localStore.renewLoan('magic-renovar-token-and-001')`.
     - Invariant 1: `renewal_count` increments from 0 to 1.
     - Invariant 2: Loan status updates from `ATRASADO` to `ATIVO`.
     - Invariant 3: Equipment `ROT-AND-001` updates from `ATRASADO` to `EMPRESTADO`.
     - Invariant 4: `expected_return_date` moves +30 days into the future.
   - **Return Triage**: Call `localStore.returnLoan('loan-001', { condition: 'BOM', close_reason: 'RECUPERACAO_ALTA', destination: 'HIGIENIZACAO' })`.
     - Invariant 1: Loan status updates to `DEVOLVIDO`.
     - Invariant 2: Equipment `eq-002` status transitions to `HIGIENIZACAO`.
     - Invariant 3: `quittance_issued` is set to `true`.

4. **UI Banner Verification**:
   - In browser, verify `DemoModeBanner` displays the golden tag "MODO DEMO".
   - Click "Resetar dados" -> verify `localStore.resetToInitialSeed()` executes, displays Sonner toast, and reloads with 8 pristine equipments and 2 loans.
   - Trigger print preview (`Ctrl+P`) -> verify the `.no-print` class hides the banner completely.
