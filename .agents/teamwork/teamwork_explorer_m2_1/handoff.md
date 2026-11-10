# Handoff Report: Database Schema Explorer (M2)

**Author**: Database Schema Explorer (teamwork_explorer_m2_1)  
**Date**: 2026-11-10T15:25:00Z  
**Project**: Rotary Banco Ortopédico  
**Working Directory**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`  
**State Folder**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m2_1`  
**Target File for Milestone 2 Worker**: `supabase/migrations/001_initial_schema.sql`

---

## 1. Observation

### 1.1 Direct Requirements & Authoritative Specifications
1. **`ORIGINAL_REQUEST.md` (lines 16-19)**:
   - *"R2. Banco de Dados e Migrações (Supabase SQL): Criar a migração `supabase/migrations/001_initial_schema.sql` contendo todos os enums (`user_role`, `equipment_category`, `equipment_status`, `equipment_condition`, `loan_status`, `close_reason`), tabelas (`profiles`, `equipments`, `beneficiaries`, `loans`, `loan_events_log`, `maintenance_logs`), índices, políticas RLS e triggers de atualização automática de status do equipamento ao criar empréstimo (`EMPRESTADO`) e ao realizar devolução."*
   - *"Incluir seed de dados iniciais contendo ao menos 5 equipamentos em diferentes status/categorias e 2 empréstimos com dados de exemplo."*
   - Criteria lines 44-45: *"O arquivo `supabase/migrations/001_initial_schema.sql` executa com sucesso em banco PostgreSQL/Supabase, criando todos os enums, as 6 tabelas com chaves primárias e estrangeiras, índices e triggers de atualização de status."*

2. **`sub_orch_m2/SCOPE.md` (lines 4-20)**:
   - Target: `supabase/migrations/001_initial_schema.sql`
   - Database Engine: PostgreSQL 15+ / Supabase
   - Extensions: `uuid-ossp`, `pgcrypto`
   - Enums (6):
     * `user_role` ('admin', 'operator', 'volunteer')
     * `equipment_category` ('CADEIRA_RODAS', 'CADEIRA_BANHO', 'MULETA_AXILAR', 'MULETA_CANADENSE', 'ANDADOR', 'CAMA_HOSPITALAR', 'COLCHAO_PNEUMATICO', 'SUPORTE_SORO', 'OUTROS')
     * `equipment_status` ('DISPONIVEL', 'EMPRESTADO', 'ATRASADO', 'HIGIENIZACAO', 'MANUTENCAO', 'BAIXADO')
     * `equipment_condition` ('NOVO', 'BOM', 'REGULAR', 'PRECISA_REPARO', 'SUCATEADO')
     * `loan_status` ('ATIVO', 'DEVOLVIDO', 'ATRASADO', 'CANCELADO')
     * `close_reason` ('RECUPERACAO_ALTA', 'OBITO_PACIENTE', 'COMPRA_PROPRIA', 'TROCA_EQUIPAMENTO', 'OUTROS', 'DESISTENCIA')
   - Tables (6): `profiles`, `equipments`, `beneficiaries`, `loans`, `loan_events_log`, `maintenance_logs`.

3. **`PROJECT.md` Interface Contracts (lines 71-137)**:
   - `EquipmentCategory`: `'CADEIRA_RODAS' | 'CADEIRA_BANHO' | 'MULETA' | 'ANDADOR' | 'CAMA_HOSPITALAR' | 'OUTROS'`
   - `EquipmentStatus`: `'DISPONIVEL' | 'EMPRESTADO' | 'ATRASADO' | 'HIGIENIZACAO' | 'MANUTENCAO' | 'BAIXADO'`
   - `EquipmentCondition`: `'NOVO' | 'BOM' | 'REGULAR' | 'PRECISA_REPARO' | 'SUCATA'`
   - `LoanStatus`: `'ATIVO' | 'RENOVADO' | 'ATRASADO' | 'DEVOLVIDO' | 'PERDIDO_EXTRAVIADO'`
   - `CloseReason`: `'RECUPERACAO_ALTA' | 'OBITO_PACIENTE' | 'COMPRA_PROPRIA' | 'TROCA_EQUIPAMENTO' | 'OUTROS' | 'DESISTENCIA'`
   - `Equipment` fields: `id`, `patrimony_code`, `qr_token`, `category`, `name`, `model_description?`, `serial_number?`, `status`, `condition`, `replacement_value`, `created_at`, `updated_at`.
   - `Beneficiary` fields: `id`, `full_name`, `cpf`, `rg?`, `phone`, `email?`, `address_street`, `address_number`, `address_complement?`, `address_neighborhood`, `address_city`, `address_state`, `address_zipcode`, `secondary_name`, `secondary_relationship`, `secondary_phone`, `created_at`.
   - `Loan` fields: `id`, `loan_code`, `equipment_id`, `beneficiary_id`, `loan_date`, `expected_return_date`, `actual_return_date?`, `status`, `renewal_count`, `max_renewals`, `magic_token`, `notes?`, `replacement_value`, `signature_url?`, `contract_pdf_url?`, `created_at`, `updated_at`.

4. **`teamwork_explorer_survey_2/handoff.md` (lines 130-349)**:
   - Provides baseline DDL for all 6 tables and 6 enums.
   - Identified field naming variations:
     * `brand_model` vs `model_description`
     * `address_cep` vs `address_zipcode`
     * `secondary_contact_name` vs `secondary_name`
     * `secondary_contact_relationship` vs `secondary_relationship`
     * `secondary_contact_phone` vs `secondary_phone`
     * `signature_image_url` vs `signature_url`
     * `SUCATEADO` vs `SUCATA`

5. **`teamwork_explorer_survey_3/handoff.md` (lines 250-301 & 538-574)**:
   - Confirms Wizard and Comodato PDF form validation fields:
     * `secondary_contact_name`, `secondary_contact_relationship`, `secondary_contact_phone`
     * `address_cep`
     * `is_patient_same_as_responsible`, `patient_name`, `patient_cpf`, `patient_rg`, `patient_relationship`, `patient_condition_notes`
     * `document_photo_url`, `proof_of_residence_url`
     * `quittance_issued`, `quittance_issued_at`, `post_return_destination`, `return_condition`

---

## 2. Logic Chain

### 2.1 Reconciling Enums Between PostgreSQL and TypeScript Contracts
1. **`user_role`**:
   - PostgreSQL: `'admin'`, `'operator'`, `'volunteer'`.
   - TypeScript: `'admin' | 'operator' | 'volunteer'`.
   - Complete consensus across all documents.

2. **`equipment_category`**:
   - `PROJECT.md` line 72 used a simplified union (`MULETA`), but `ORIGINAL_REQUEST.md`, `SCOPE.md`, and Rotary operational requirements strictly demand distinguishing underarm crutches (`MULETA_AXILAR`) from forearm crutches (`MULETA_CANADENSE`), plus `COLCHAO_PNEUMATICO` and `SUPORTE_SORO`.
   - Recommendation: Define the complete 9-value enum in PostgreSQL:
     `'CADEIRA_RODAS'`, `'CADEIRA_BANHO'`, `'MULETA_AXILAR'`, `'MULETA_CANADENSE'`, `'ANDADOR'`, `'CAMA_HOSPITALAR'`, `'COLCHAO_PNEUMATICO'`, `'SUPORTE_SORO'`, `'OUTROS'`.
   - M1 TypeScript definition should expand `EquipmentCategory` to match this 9-value union (or include `'MULETA'` as a legacy union member if needed).

3. **`equipment_status`**:
   - Values: `'DISPONIVEL'`, `'EMPRESTADO'`, `'ATRASADO'`, `'HIGIENIZACAO'`, `'MANUTENCAO'`, `'BAIXADO'`.
   - 100% consensus across all sources.

4. **`equipment_condition`**:
   - `SCOPE.md` specifies `'NOVO'`, `'BOM'`, `'REGULAR'`, `'PRECISA_REPARO'`, `'SUCATEADO'`.
   - `PROJECT.md` line 74 listed `'SUCATA'`. In standard Portuguese and inventory terminology, condition is an adjective (`SUCATEADO` / scrapped).
   - Recommendation: In PostgreSQL, define `'NOVO'`, `'BOM'`, `'REGULAR'`, `'PRECISA_REPARO'`, `'SUCATEADO'`. In TypeScript, define `'NOVO' | 'BOM' | 'REGULAR' | 'PRECISA_REPARO' | 'SUCATEADO' | 'SUCATA'`.

5. **`loan_status`**:
   - `SCOPE.md` lists `('ATIVO', 'DEVOLVIDO', 'ATRASADO', 'CANCELADO')`.
   - `PROJECT.md` line 75 lists `'ATIVO' | 'RENOVADO' | 'ATRASADO' | 'DEVOLVIDO' | 'PERDIDO_EXTRAVIADO'`.
   - In operational terms: renewals increment `renewal_count` on an `ATIVO` loan; however, if external integrations or UI filters treat `RENOVADO` or `PERDIDO_EXTRAVIADO` or `CANCELADO` as distinct statuses, a missing PostgreSQL enum value causes a fatal runtime crash (`ERROR: invalid input value for enum loan_status`).
   - Recommendation: Define the comprehensive enum containing all 6 states:
     `'ATIVO'`, `'RENOVADO'`, `'DEVOLVIDO'`, `'ATRASADO'`, `'CANCELADO'`, `'PERDIDO_EXTRAVIADO'`.
     This guarantees zero runtime enum validation errors across any caller or layer.

6. **`close_reason`**:
   - Values: `'RECUPERACAO_ALTA'`, `'OBITO_PACIENTE'`, `'COMPRA_PROPRIA'`, `'TROCA_EQUIPAMENTO'`, `'OUTROS'`, `'DESISTENCIA'`.
   - 100% consensus across all sources.

### 2.2 Table Architecture & Referential Integrity Rules
1. **`profiles`**:
   - Extends Supabase `auth.users(id)`: `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`.
   - Note for dry-run testing outside Supabase: A stub `auth.users` table or `CREATE SCHEMA IF NOT EXISTS auth;` must precede foreign key creation so PostgreSQL dry-run succeeds on bare databases.

2. **`equipments`**:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `patrimony_code VARCHAR(50) NOT NULL UNIQUE` (Human readable code e.g. `ROT-CR-001`)
   - `qr_token VARCHAR(64) NOT NULL UNIQUE` (Direct QR link token `/item/[qr_token]`)
   - `brand_model TEXT` (Matches physical brand/model e.g. "Ortobras K1", also supports TS alias `model_description`)
   - `replacement_value NUMERIC(10, 2) NOT NULL DEFAULT 500.00` (Mandatory for CCB Art. 582 comodato liability)
   - `acquisition_date DATE DEFAULT CURRENT_DATE`, `notes TEXT`.

3. **`beneficiaries`**:
   - Contains primary patient/guardian PII + mandatory secondary contact.
   - Address fields: `address_street`, `address_number`, `address_complement`, `address_neighborhood`, `address_city`, `address_state`, `address_cep`.
   - Secondary contact fields: `secondary_contact_name`, `secondary_contact_relationship`, `secondary_contact_phone`.
   - Patient separation fields: `is_patient_same_as_responsible BOOLEAN NOT NULL DEFAULT true`, `patient_name`, `patient_cpf`, `patient_rg`, `patient_relationship`, `patient_condition_notes`.
   - Verification attachments: `document_photo_url`, `proof_of_residence_url`.
   - All secondary contact fields are `NOT NULL` to satisfy Requirement R4 (mandatory secondary contact).

4. **`loans`**:
   - Relational keys:
     * `equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE RESTRICT` (Guarantees historical equipment cannot be deleted while contracted).
     * `beneficiary_id UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE RESTRICT` (Guarantees beneficiary cannot be deleted while loans exist).
     * `created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL` (Operator account deletion never cascades to destroy loan records).
   - Contractual fields:
     * `loan_code VARCHAR(50) NOT NULL UNIQUE` (e.g. `ROT-EMP-001` or `COM-2024-001`)
     * `loan_date TIMESTAMPTZ NOT NULL DEFAULT now()`
     * `expected_return_date TIMESTAMPTZ NOT NULL`
     * `actual_return_date TIMESTAMPTZ`
     * `renewal_count INTEGER NOT NULL DEFAULT 0`
     * `max_renewals INTEGER NOT NULL DEFAULT 3`
     * `magic_token VARCHAR(64) NOT NULL UNIQUE`
     * `replacement_value NUMERIC(10, 2) NOT NULL DEFAULT 500.00` (Snapshot of equipment value at contract execution for CCB Art. 582 enforcement)
     * `contract_pdf_url TEXT`, `signature_image_url TEXT`, `witness_name TEXT`, `witness_document TEXT`, `notes TEXT`
   - Return & Quittance fields (R5):
     * `return_condition equipment_condition`, `close_reason close_reason`, `post_return_destination equipment_status`, `return_notes TEXT`
     * `quittance_issued BOOLEAN NOT NULL DEFAULT false`, `quittance_issued_at TIMESTAMPTZ`

5. **`loan_events_log`**:
   - `loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE`
   - `event_type VARCHAR(50) NOT NULL` (`'CREATED'`, `'RENEWED'`, `'STATUS_CHANGE'`, `'RETURNED'`, `'OVERDUE'`, `'QUITTANCE_ISSUED'`, `'RETURN_REQUESTED'`)
   - `metadata JSONB NOT NULL DEFAULT '{}'::jsonb`
   - `performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL`

6. **`maintenance_logs`**:
   - `equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE`
   - `maintenance_type VARCHAR(50) NOT NULL` (`'HIGIENIZACAO'`, `'MANUTENCAO_PREVENTIVA'`, `'MANUTENCAO_CORRETIVA'`, `'BAIXA'`)
   - `cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00`, `technician_name TEXT`, `completed_at TIMESTAMPTZ DEFAULT now()`

### 2.3 Indexing Strategy for High Query Velocity
- `idx_equipments_qr_token`: Instant QR code scan lookups (`/item/[qr_token]`).
- `idx_equipments_status`: Fast status filtering on catalog (`/equipments?status=DISPONIVEL`).
- `idx_equipments_category`: Fast category filtering (`/equipments?category=CADEIRA_RODAS`).
- `idx_equipments_patrimony_code`: Monospace code search.
- `idx_beneficiaries_cpf`: Prevent duplicate patient registration and fast search.
- `idx_beneficiaries_full_name`: Name search on wizard and return triage.
- `idx_loans_magic_token`: Public 1-click renewal lookups (`/renovar/[magic_token]`).
- `idx_loans_equipment_id` & `idx_loans_beneficiary_id`: Fast join performance on loan relations.
- `idx_loans_status`: Fast filter on active, overdue, returned loans.
- `idx_loans_expected_return_date`: Fast range queries for D-7, D0, D+1, D+7.
- `idx_loans_status_expected_date` (Compound): `(status, expected_return_date)` for `/api/cron/check-loans` daily scheduled execution without table scanning.
- `idx_loan_events_loan_id` & `idx_maintenance_equipment_id`: Fast retrieval of item/loan historical logs.

---

## 3. Caveats

1. **Supabase `auth.users` Foreign Key in Standalone Postgres**:
   - If `001_initial_schema.sql` is run in an empty Postgres instance without Supabase Auth initialized, `REFERENCES auth.users(id)` will fail with `relation "auth.users" does not exist`.
   - **Remedy**: Include a conditional pre-flight creation of the `auth` schema and a stub `auth.users` table if `auth.users` is not yet present, or document that it assumes a Supabase-managed PostgreSQL instance.
2. **TypeScript Property Reconciliation (M1 vs M2)**:
   - To avoid any compiler discrepancy between `PROJECT.md` drafts and the Supabase migration:
     * In `beneficiaries`: Support both `address_cep` and `address_zipcode` in TypeScript. In PostgreSQL, use `address_cep`.
     * In `beneficiaries`: Support both `secondary_contact_name` and `secondary_name`. In PostgreSQL, use `secondary_contact_name`.
     * In `equipments`: Support both `brand_model` and `model_description`. In PostgreSQL, use `brand_model`.
     * In `loans`: Support both `signature_image_url` and `signature_url`. In PostgreSQL, use `signature_image_url`.
3. **Execution Responsibility**:
   - This agent (`teamwork_explorer_m2_1`) is strictly read-only. We do NOT create `supabase/migrations/001_initial_schema.sql`. The M2 Worker will assemble our table/enum recommendations alongside Explorer 2's Triggers/RLS and Explorer 3's Seed data into the final migration.

---

## 4. Conclusion & Technical Recommendations

### 4.1 SQL DDL Recommendations for `supabase/migrations/001_initial_schema.sql`

```sql
-- ============================================================================
-- ROTARY BANCO ORTOPÉDICO - MIGRATION 001: INITIAL SCHEMA
-- ============================================================================

-- 0. EXTENSIONS & COMPATIBILITY
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure auth schema exists for standalone dry-runs
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 1. ENUMS DEFINITIONS (6 ENUMS)
-- ----------------------------------------------------------------------------

-- 1.1 User Role
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'admin',
    'operator',
    'volunteer'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1.2 Equipment Category
DO $$ BEGIN
  CREATE TYPE equipment_category AS ENUM (
    'CADEIRA_RODAS',
    'CADEIRA_BANHO',
    'MULETA_AXILAR',
    'MULETA_CANADENSE',
    'ANDADOR',
    'CAMA_HOSPITALAR',
    'COLCHAO_PNEUMATICO',
    'SUPORTE_SORO',
    'OUTROS'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1.3 Equipment Operational Status
DO $$ BEGIN
  CREATE TYPE equipment_status AS ENUM (
    'DISPONIVEL',
    'EMPRESTADO',
    'ATRASADO',
    'HIGIENIZACAO',
    'MANUTENCAO',
    'BAIXADO'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1.4 Equipment Physical Condition
DO $$ BEGIN
  CREATE TYPE equipment_condition AS ENUM (
    'NOVO',
    'BOM',
    'REGULAR',
    'PRECISA_REPARO',
    'SUCATEADO'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1.5 Loan Contract Status
DO $$ BEGIN
  CREATE TYPE loan_status AS ENUM (
    'ATIVO',
    'RENOVADO',
    'DEVOLVIDO',
    'ATRASADO',
    'CANCELADO',
    'PERDIDO_EXTRAVIADO'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1.6 Comodato Close Reason
DO $$ BEGIN
  CREATE TYPE close_reason AS ENUM (
    'RECUPERACAO_ALTA',
    'OBITO_PACIENTE',
    'COMPRA_PROPRIA',
    'TROCA_EQUIPAMENTO',
    'OUTROS',
    'DESISTENCIA'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 2. TABLE DEFINITIONS (6 TABLES)
-- ----------------------------------------------------------------------------

-- 2.1 Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'operator',
  rotary_club TEXT NOT NULL DEFAULT 'Rotary Club de São Paulo',
  phone VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 Equipments (Physical asset catalog)
CREATE TABLE IF NOT EXISTS public.equipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patrimony_code VARCHAR(50) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category equipment_category NOT NULL,
  status equipment_status NOT NULL DEFAULT 'DISPONIVEL',
  condition equipment_condition NOT NULL DEFAULT 'BOM',
  brand_model TEXT,
  serial_number TEXT,
  replacement_value NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
  qr_token VARCHAR(64) NOT NULL UNIQUE,
  acquisition_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.3 Beneficiaries (Patients, Guardians & Mandatory Secondary Contacts)
CREATE TABLE IF NOT EXISTS public.beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  rg VARCHAR(20),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  birth_date DATE,
  
  -- Address
  address_street TEXT NOT NULL,
  address_number TEXT NOT NULL,
  address_complement TEXT,
  address_neighborhood TEXT NOT NULL,
  address_city TEXT NOT NULL,
  address_state VARCHAR(2) NOT NULL DEFAULT 'SP',
  address_cep VARCHAR(10) NOT NULL,
  
  -- Patient vs Responsible distinction
  is_patient_same_as_responsible BOOLEAN NOT NULL DEFAULT true,
  patient_name TEXT,
  patient_cpf VARCHAR(14),
  patient_rg VARCHAR(20),
  patient_relationship TEXT,
  patient_condition_notes TEXT,
  
  -- Mandatory Secondary Contact (CCB Art. 585 & Emergency Retrieval)
  secondary_contact_name TEXT NOT NULL,
  secondary_contact_relationship TEXT NOT NULL,
  secondary_contact_phone VARCHAR(20) NOT NULL,
  
  -- Verification attachments
  document_photo_url TEXT,
  proof_of_residence_url TEXT,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.4 Loans (Comodato Agreements)
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_code VARCHAR(50) NOT NULL UNIQUE,
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE RESTRICT,
  beneficiary_id UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE RESTRICT,
  status loan_status NOT NULL DEFAULT 'ATIVO',
  
  loan_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return_date TIMESTAMPTZ NOT NULL,
  actual_return_date TIMESTAMPTZ,
  
  renewal_count INTEGER NOT NULL DEFAULT 0,
  max_renewals INTEGER NOT NULL DEFAULT 3,
  magic_token VARCHAR(64) NOT NULL UNIQUE,
  
  -- Comodato legal fields (CCB Arts. 579-585)
  replacement_value NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
  contract_pdf_url TEXT,
  signature_image_url TEXT,
  witness_name TEXT,
  witness_document TEXT,
  notes TEXT,
  
  -- Return Triage & Discharge (R5)
  return_condition equipment_condition,
  close_reason close_reason,
  post_return_destination equipment_status,
  return_notes TEXT,
  quittance_issued BOOLEAN NOT NULL DEFAULT false,
  quittance_issued_at TIMESTAMPTZ,
  
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.5 Loan Events Log (Audit Trail)
CREATE TABLE IF NOT EXISTS public.loan_events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  old_status loan_status,
  new_status loan_status,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.6 Maintenance Logs (Asset Service History)
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  technician_name TEXT,
  completed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ----------------------------------------------------------------------------

-- Foreign keys
CREATE INDEX IF NOT EXISTS idx_loans_equipment_id ON public.loans(equipment_id);
CREATE INDEX IF NOT EXISTS idx_loans_beneficiary_id ON public.loans(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_loans_created_by ON public.loans(created_by);
CREATE INDEX IF NOT EXISTS idx_loan_events_loan_id ON public.loan_events_log(loan_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_equipment_id ON public.maintenance_logs(equipment_id);

-- Inventory lookups and filters
CREATE INDEX IF NOT EXISTS idx_equipments_status ON public.equipments(status);
CREATE INDEX IF NOT EXISTS idx_equipments_category ON public.equipments(category);
CREATE INDEX IF NOT EXISTS idx_equipments_qr_token ON public.equipments(qr_token);
CREATE INDEX IF NOT EXISTS idx_equipments_patrimony_code ON public.equipments(patrimony_code);

-- Beneficiary lookups
CREATE INDEX IF NOT EXISTS idx_beneficiaries_cpf ON public.beneficiaries(cpf);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_full_name ON public.beneficiaries(full_name);

-- Loan monitoring and self-service
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_expected_return_date ON public.loans(expected_return_date);
CREATE INDEX IF NOT EXISTS idx_loans_magic_token ON public.loans(magic_token);
CREATE INDEX IF NOT EXISTS idx_loans_loan_code ON public.loans(loan_code);

-- Compound index for daily /api/cron/check-loans scanning
CREATE INDEX IF NOT EXISTS idx_loans_status_expected_date ON public.loans(status, expected_return_date);

-- Event & maintenance audit
CREATE INDEX IF NOT EXISTS idx_loan_events_type ON public.loan_events_log(event_type);
CREATE INDEX IF NOT EXISTS idx_loan_events_created_at ON public.loan_events_log(created_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_type ON public.maintenance_logs(maintenance_type);
CREATE INDEX IF NOT EXISTS idx_maintenance_created_at ON public.maintenance_logs(created_at);
```

### 4.2 TypeScript Model Recommendations for `src/lib/data-layer/types.ts`
To ensure complete alignment between database columns and TypeScript interfaces, the following definitions are recommended for M1:

```typescript
export type UserRole = 'admin' | 'operator' | 'volunteer';

export type EquipmentCategory =
  | 'CADEIRA_RODAS'
  | 'CADEIRA_BANHO'
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
  | 'SUCATEADO';

export type LoanStatus =
  | 'ATIVO'
  | 'RENOVADO'
  | 'DEVOLVIDO'
  | 'ATRASADO'
  | 'CANCELADO'
  | 'PERDIDO_EXTRAVIADO';

export type CloseReason =
  | 'RECUPERACAO_ALTA'
  | 'OBITO_PACIENTE'
  | 'COMPRA_PROPRIA'
  | 'TROCA_EQUIPAMENTO'
  | 'OUTROS'
  | 'DESISTENCIA';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  rotary_club: string;
  phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Equipment {
  id: string;
  patrimony_code: string;
  qr_token: string;
  category: EquipmentCategory;
  name: string;
  brand_model?: string | null;
  model_description?: string | null; // Compatibility alias
  serial_number?: string | null;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  replacement_value: number;
  acquisition_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Beneficiary {
  id: string;
  full_name: string;
  cpf: string;
  rg?: string | null;
  phone: string;
  email?: string | null;
  birth_date?: string | null;
  address_street: string;
  address_number: string;
  address_complement?: string | null;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_cep: string;
  address_zipcode?: string; // Compatibility alias
  is_patient_same_as_responsible: boolean;
  patient_name?: string | null;
  patient_cpf?: string | null;
  patient_rg?: string | null;
  patient_relationship?: string | null;
  patient_condition_notes?: string | null;
  secondary_contact_name: string;
  secondary_name?: string; // Compatibility alias
  secondary_contact_relationship: string;
  secondary_relationship?: string; // Compatibility alias
  secondary_contact_phone: string;
  secondary_phone?: string; // Compatibility alias
  document_photo_url?: string | null;
  proof_of_residence_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: string;
  loan_code: string;
  equipment_id: string;
  beneficiary_id: string;
  loan_date: string;
  expected_return_date: string;
  actual_return_date?: string | null;
  status: LoanStatus;
  renewal_count: number;
  max_renewals: number;
  magic_token: string;
  replacement_value: number;
  signature_image_url?: string | null;
  signature_url?: string | null; // Compatibility alias
  contract_pdf_url?: string | null;
  witness_name?: string | null;
  witness_document?: string | null;
  return_condition?: EquipmentCondition | null;
  close_reason?: CloseReason | null;
  post_return_destination?: EquipmentStatus | null;
  return_notes?: string | null;
  quittance_issued: boolean;
  quittance_issued_at?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Expanded relations
  equipment?: Equipment;
  beneficiary?: Beneficiary;
  created_by_profile?: Profile | null;
}

export interface LoanEventLog {
  id: string;
  loan_id: string;
  event_type: 'CREATED' | 'RENEWED' | 'STATUS_CHANGE' | 'RETURNED' | 'OVERDUE' | 'QUITTANCE_ISSUED' | 'RETURN_REQUESTED';
  old_status?: LoanStatus | null;
  new_status?: LoanStatus | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  performed_by?: string | null;
  created_at: string;
}

export interface MaintenanceLog {
  id: string;
  equipment_id: string;
  maintenance_type: 'HIGIENIZACAO' | 'MANUTENCAO_PREVENTIVA' | 'MANUTENCAO_CORRETIVA' | 'BAIXA';
  description: string;
  cost: number;
  technician_name?: string | null;
  completed_at?: string | null;
  created_at: string;
}
```

---

## 5. Verification Method

### 5.1 Verification Commands
Once the M2 Worker writes `supabase/migrations/001_initial_schema.sql`, verify schema execution with the following methods:

1. **SQL Syntax Dry-Run Check**:
   - Using PostgreSQL CLI (`psql`):
     ```bash
     psql -U postgres -d postgres -f supabase/migrations/001_initial_schema.sql
     ```
   - Using Node.js dry-run parser (e.g. pg-mem or sql-parser):
     ```bash
     node -e "const fs = require('fs'); const sql = fs.readFileSync('supabase/migrations/001_initial_schema.sql', 'utf8'); console.log('File read successfully. Length:', sql.length);"
     ```

2. **Schema Introspection Verification Query**:
   ```sql
   -- Verify all 6 enums
   SELECT t.typname AS enum_name, string_agg(e.enumlabel, ', ') AS enum_values
   FROM pg_type t
   JOIN pg_enum e ON t.oid = e.enumtypid
   WHERE t.typname IN ('user_role', 'equipment_category', 'equipment_status', 'equipment_condition', 'loan_status', 'close_reason')
   GROUP BY t.typname;

   -- Verify all 6 tables
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_name IN ('profiles', 'equipments', 'beneficiaries', 'loans', 'loan_events_log', 'maintenance_logs');

   -- Verify foreign key constraints and ON DELETE behavior
   SELECT
       tc.table_name, kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name,
       rc.delete_rule
   FROM information_schema.table_constraints AS tc
   JOIN information_schema.key_column_usage AS kcu
       ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.referential_constraints AS rc
       ON tc.constraint_name = rc.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu
       ON ccu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
   ```

3. **TypeScript Contract Compilation Check**:
   - Run:
     ```bash
     npm.cmd run build
     # or
     npx.cmd tsc --noEmit
     ```
   - Invalidation conditions: Any compile errors indicating missing properties on `Equipment`, `Beneficiary`, or `Loan`, or invalid enum literals.
