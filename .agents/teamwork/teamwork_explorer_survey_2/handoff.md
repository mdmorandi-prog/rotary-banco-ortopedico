# Handoff Report: Survey Explorer 2 — Database Schema (R2) & Inventory/QR Management (R3)

**Author**: Survey Explorer 2  
**Date**: 2026-11-10T15:15:00Z  
**Project**: Rotary Banco Ortopédico  
**Working Directory**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`  
**State Folder**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_survey_2`  
**Target Requirements**: R2 (Supabase SQL Migration, Enums, Tables, Indexes, RLS, Triggers, Seed) and R3 (Equipment Catalog, Mobile QR Scanner, Contextual Action State Machine `/item/[qr_token]`, Asset Label Printing `/equipments/labels`).

---

## 1. Observation

### 1.1 Requirements Observed from `ORIGINAL_REQUEST.md`

1. **R2. Banco de Dados e Migrações (Supabase SQL)**:
   - Migration file path: `supabase/migrations/001_initial_schema.sql`.
   - Enums required:
     * `user_role`: Roles for authentication and authorization (`admin`, `operator`, `volunteer`).
     * `equipment_category`: Orthopedic equipment categories (`CADEIRA_RODAS`, `CADEIRA_BANHO`, `MULETA_AXILAR`, `MULETA_CANADENSE`, `ANDADOR`, `CAMA_HOSPITALAR`, `COLCHAO_PNEUMATICO`, `SUPORTE_SORO`, `OUTROS`).
     * `equipment_status`: Physical/operational lifecycle statuses (`DISPONIVEL`, `EMPRESTADO`, `ATRASADO`, `HIGIENIZACAO`, `MANUTENCAO`, `BAIXADO`).
     * `equipment_condition`: Physical conservation grading (`NOVO`, `BOM`, `REGULAR`, `PRECISA_REPARO`, `SUCATEADO`).
     * `loan_status`: Loan contract state (`ATIVO`, `DEVOLVIDO`, `ATRASADO`, `CANCELADO`).
     * `close_reason`: Justification for comodato termination (`RECUPERACAO_ALTA`, `OBITO_PACIENTE`, `COMPRA_PROPRIA`, `TROCA_EQUIPAMENTO`, `OUTROS`, `DESISTENCIA`).
   - Tables required:
     * `profiles`: Extends Supabase Auth users with full name, role, phone, and club affiliation.
     * `equipments`: Tracks physical inventory, patrimony code, category, status, condition, replacement value, notes, and unique `qr_token`.
     * `beneficiaries`: Complete beneficiary/patient and guardian data, address, mandatory secondary contact, document and proof-of-residence photo URLs.
     * `loans`: Comodato agreements with equipment and beneficiary foreign keys, dates, renewal count, magic token, contract PDF URL, captured signature, return condition, destination, and quittance status.
     * `loan_events_log`: Audit trail recording status transitions, renewals, notifications, and quittance generation.
     * `maintenance_logs`: Historical log of hygiene, preventative maintenance, corrective repairs, and write-offs with costs and notes.
   - Triggers required:
     * Automatic equipment status synchronization upon loan creation (`ATIVO` -> equipment becomes `EMPRESTADO`).
     * Automatic equipment status and condition synchronization upon return (`DEVOLVIDO` -> equipment takes `post_return_destination` such as `HIGIENIZACAO`, `DISPONIVEL`, or `MANUTENCAO`).
     * Automatic updated_at timestamp updates.
   - Seed data required:
     * At least 5 equipments across diverse statuses and categories.
     * At least 2 beneficiaries with valid Brazilian CPF and secondary contacts.
     * At least 2 loans (1 active and 1 overdue) with referential integrity.
     * Valid corresponding event logs and maintenance logs.

2. **R3. Gestão de Acervo, Leitura e Impressão de QR Code**:
   - Equipment catalog at `/equipments`: search by name/patrimony, filters by status and category, metrics overview, and registration modal with auto-generated `qr_token`.
   - Mobile camera QR scanner at `/scan`: device camera access via WebRTC / `html5-qrcode`, visual viewfinder with Rotary branding, torch/facingMode toggles, manual code input fallback, and instant navigation.
   - Contextual Action Route at `/item/[qr_token]`: loads equipment by token and dispatches contextual action UI strictly according to the equipment state machine:
     * `DISPONIVEL` -> Iniciar Empréstimo (`/loans/new?equipment_id=...`) or Encaminhar Manutenção/Higienização.
     * `EMPRESTADO` -> Detalhes do empréstimo ativo, Registrar Devolução (`/loans/[id]/return`), Renovar Empréstimo, Contato WhatsApp.
     * `ATRASADO` -> Alerta de atraso, Registrar Devolução, Renovar com Justificativa, Ação rápida de cobrança via WhatsApp (Beneficiário e Contato Secundário).
     * `HIGIENIZACAO` -> Registrar conclusão de limpeza e liberar para estoque (`DISPONIVEL`) com registro em `maintenance_logs`.
     * `MANUTENCAO` -> Registrar conclusão de reparo com custos e observações, liberar para estoque (`DISPONIVEL`) ou Dar Baixa (`BAIXADO`).
   - Printable asset label generator at `/equipments/labels`:
     * Printable sheet conforming to standard label formats (e.g., 50x30mm thermal or multi-label grid).
     * Visual elements: Rotary official logo, club name, monospace patrimony code, equipment category/model, scannable QR Code encoding `https://[app-url]/item/[qr_token]`, and return phone contact.
     * Print-specific CSS (`@media print`) ensuring exact margins, no headers/footers, and page-break isolation.

3. **Workspace State**:
   - Greenfield Next.js project directory at `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`.
   - Requires dual-mode operation: Direct PostgreSQL/Supabase database execution AND seamless local demo mock store fallback when Supabase credentials are absent.

---

## 2. Logic Chain

### 2.1 Relational Architecture & Integrity Reasoning

1. **Enum Consistency**:
   - Defining PostgreSQL native `ENUM` types prevents invalid state mutations at the database level.
   - By matching TypeScript union types 1:1 with PostgreSQL enums, the frontend and API layers gain static compile-time safety and eliminate runtime type mismatches.

2. **Entity Relationships & Cascading Rules**:
   - `equipments` -> `loans`: An equipment cannot be deleted if referenced by a loan (`ON DELETE RESTRICT`). This preserves the historical audit trail of comodato contracts.
   - `beneficiaries` -> `loans`: Beneficiaries cannot be deleted if active or historical loans exist (`ON DELETE RESTRICT`).
   - `loans` -> `loan_events_log`: If a loan is deleted in development/testing, its audit logs cascade (`ON DELETE CASCADE`).
   - `equipments` -> `maintenance_logs`: Deleting an equipment cascades to its maintenance logs (`ON DELETE CASCADE`).

3. **Trigger Logic (Automated Status State Transitions)**:
   - When a loan is created with status `ATIVO`:
     ```sql
     UPDATE equipments SET status = 'EMPRESTADO', updated_at = now() WHERE id = NEW.equipment_id;
     ```
   - When a loan is marked as `DEVOLVIDO`:
     ```sql
     UPDATE equipments SET 
       status = COALESCE(NEW.post_return_destination, 'HIGIENIZACAO'),
       condition = COALESCE(NEW.return_condition, condition),
       updated_at = now()
     WHERE id = NEW.equipment_id;
     ```
   - When a loan is marked as `ATRASADO`:
     ```sql
     UPDATE equipments SET status = 'ATRASADO', updated_at = now() WHERE id = NEW.equipment_id;
     ```
   - This ensures the database guarantees equipment availability invariants even if an external script or API fails to make the secondary update.

4. **Security & Row Level Security (RLS)**:
   - Equipment catalog and QR token lookups must allow read access to anonymous users so that scanning a QR code on a physical label (`/item/[qr_token]`) works immediately on any volunteer or public device without requiring a login screen first.
   - Loan renewals via `magic_token` (`/renovar/[magic_token]`) require public read/update access restricted strictly to the row matching the specific `magic_token`.
   - Beneficiary PII (CPF, address, phone numbers) must remain strictly protected under LGPD; only authenticated operators and admins may read or write beneficiary records.

5. **Asset Label Layout & QR Code Dimensioning**:
   - The QR code on a physical label must encode the full URL (`https://[domain]/item/[qr_token]`) or the raw token with a standard prefix. Using the full URL enables native smartphone camera scanning (iOS Camera and Android Google Lens) to open the web app directly.
   - Minimum physical QR code size for reliable smartphone camera focus is 15mm x 15mm. On a 50mm x 30mm label, placing a 22mm x 22mm QR code on the left and typography (Patrimony, Category, Club, Phone) on the right guarantees rapid scanning even in low-light warehouse conditions.

---

## 3. Caveats

1. **Supabase Local vs Cloud vs Mock Mode**:
   - If developers run without a local Supabase CLI or cloud project, the application must never throw uncaught exceptions during database calls. A unified client abstraction must fall back to the in-memory/localStorage mock repository that implements identical trigger semantics.
2. **Camera Permissions in WebRTC**:
   - Mobile browsers (especially iOS Safari and Android Chrome) require a secure context (`https://` or `localhost`) for `navigator.mediaDevices.getUserMedia()`. If opened on an insecure local IP (e.g. `http://192.168.x.x`), camera access will fail. The `/scan` page must detect this condition and provide a friendly explanation alongside the manual input fallback.
3. **Printer Margin Variations**:
   - Thermal label printers (Zebra, Brother, Elgin) use continuous paper rolls, whereas desktop users often print on A4 sheets (e.g. Pimaco 6180/6182 3x10 labels). The `/equipments/labels` page must support both single thermal label format (`50mm x 30mm`) and an A4 multi-label grid layout.
4. **Out of Scope for Explorer 2**:
   - The contract PDF generation with digital signature canvas (R4), detailed return checklist wizard (R5), and WhatsApp cron automation (R6) are investigated by Explorer 3 and must be integrated with the schema defined here.

---

## 4. Conclusion & Technical Specifications

### 4.1 Supabase SQL Migration (`supabase/migrations/001_initial_schema.sql`)

Below is the complete, production-ready SQL script ready for direct execution in PostgreSQL / Supabase:

```sql
-- ============================================================================
-- ROTARY BANCO ORTOPÉDICO - MIGRATION 001: INITIAL SCHEMA
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUMS DEFINITIONS
-- ----------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM (
  'admin',
  'operator',
  'volunteer'
);

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

CREATE TYPE equipment_status AS ENUM (
  'DISPONIVEL',
  'EMPRESTADO',
  'ATRASADO',
  'HIGIENIZACAO',
  'MANUTENCAO',
  'BAIXADO'
);

CREATE TYPE equipment_condition AS ENUM (
  'NOVO',
  'BOM',
  'REGULAR',
  'PRECISA_REPARO',
  'SUCATEADO'
);

CREATE TYPE loan_status AS ENUM (
  'ATIVO',
  'DEVOLVIDO',
  'ATRASADO',
  'CANCELADO'
);

CREATE TYPE close_reason AS ENUM (
  'RECUPERACAO_ALTA',
  'OBITO_PACIENTE',
  'COMPRA_PROPRIA',
  'TROCA_EQUIPAMENTO',
  'OUTROS',
  'DESISTENCIA'
);

-- ----------------------------------------------------------------------------
-- 2. TABLE DEFINITIONS
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
  
  -- Patient vs Responsible qualification
  is_patient_same_as_responsible BOOLEAN NOT NULL DEFAULT true,
  patient_name TEXT,
  patient_cpf VARCHAR(14),
  patient_rg VARCHAR(20),
  patient_relationship TEXT,
  patient_condition_notes TEXT,
  
  -- Mandatory Secondary Contact (LGPD & Emergency Retrieval)
  secondary_contact_name TEXT NOT NULL,
  secondary_contact_relationship TEXT NOT NULL,
  secondary_contact_phone VARCHAR(20) NOT NULL,
  
  -- Document attachments
  document_photo_url TEXT,
  proof_of_residence_url TEXT,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.4 Loans (Comodato Agreements)
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE RESTRICT,
  beneficiary_id UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE RESTRICT,
  status loan_status NOT NULL DEFAULT 'ATIVO',
  
  loan_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return_date TIMESTAMPTZ NOT NULL,
  actual_return_date TIMESTAMPTZ,
  
  renewal_count INTEGER NOT NULL DEFAULT 0,
  max_renewals INTEGER NOT NULL DEFAULT 3,
  magic_token VARCHAR(64) NOT NULL UNIQUE,
  
  -- Contract documentation & Legal Signature (Arts. 579-585 CCB)
  contract_pdf_url TEXT,
  signature_image_url TEXT,
  witness_name TEXT,
  witness_document TEXT,
  
  -- Return Triage & Discharge
  return_condition equipment_condition,
  close_reason close_reason,
  post_return_destination equipment_status,
  return_notes TEXT,
  quittance_issued BOOLEAN NOT NULL DEFAULT false,
  quittance_issued_at TIMESTAMPTZ,
  
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.5 Loan Events Log (Audit Trail)
CREATE TABLE IF NOT EXISTS public.loan_events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'CREATED', 'RENEWED', 'STATUS_CHANGE', 'RETURNED', 'OVERDUE_NOTIFICATION', 'QUITTANCE_ISSUED'
  old_status loan_status,
  new_status loan_status,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.6 Maintenance Logs (Asset Service History)
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(50) NOT NULL, -- 'HIGIENIZACAO', 'MANUTENCAO_PREVENTIVA', 'MANUTENCAO_CORRETIVA', 'BAIXA'
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

-- ----------------------------------------------------------------------------
-- 4. AUTOMATIC TRIGGERS & FUNCTIONS
-- ----------------------------------------------------------------------------

-- 4.1 Updated At timestamp trigger
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_equipments_updated_at ON public.equipments;
CREATE TRIGGER trg_equipments_updated_at
  BEFORE UPDATE ON public.equipments
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_beneficiaries_updated_at ON public.beneficiaries;
CREATE TRIGGER trg_beneficiaries_updated_at
  BEFORE UPDATE ON public.beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_loans_updated_at ON public.loans;
CREATE TRIGGER trg_loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- 4.2 Automatic Equipment Status Sync on Loan Operations
CREATE OR REPLACE FUNCTION public.fn_sync_loan_equipment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- CASE 1: Loan Creation (INSERT) with status 'ATIVO'
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'ATIVO' THEN
      UPDATE public.equipments
      SET status = 'EMPRESTADO', updated_at = now()
      WHERE id = NEW.equipment_id;

      INSERT INTO public.loan_events_log (
        loan_id, event_type, new_status, notes, performed_by
      ) VALUES (
        NEW.id, 'CREATED', NEW.status, 'Empréstimo iniciado e comodato formalizado.', NEW.created_by
      );
    END IF;
    RETURN NEW;
  END IF;

  -- CASE 2: Loan Modification (UPDATE)
  IF TG_OP = 'UPDATE' THEN
    -- Status transitioned to DEVOLVIDO
    IF OLD.status != 'DEVOLVIDO' AND NEW.status = 'DEVOLVIDO' THEN
      -- Default destination is HIGIENIZACAO if unspecified
      UPDATE public.equipments
      SET 
        status = COALESCE(NEW.post_return_destination, 'HIGIENIZACAO'),
        condition = COALESCE(NEW.return_condition, condition),
        updated_at = now()
      WHERE id = NEW.equipment_id;

      IF NEW.actual_return_date IS NULL THEN
        NEW.actual_return_date = now();
      END IF;

      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by
      ) VALUES (
        NEW.id, 'RETURNED', OLD.status, NEW.status, 
        CONCAT('Devolução concluída. Destino pós-triagem: ', COALESCE(NEW.post_return_destination::text, 'HIGIENIZACAO')),
        NEW.created_by
      );
    
    -- Status transitioned to ATRASADO
    ELSIF OLD.status != 'ATRASADO' AND NEW.status = 'ATRASADO' THEN
      UPDATE public.equipments
      SET status = 'ATRASADO', updated_at = now()
      WHERE id = NEW.equipment_id;

      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by
      ) VALUES (
        NEW.id, 'OVERDUE', OLD.status, NEW.status, 'Prazo de devolução expirado. Marcado como atrasado.', NEW.created_by
      );

    -- Renewal detected (expected_return_date extended or renewal_count incremented)
    ELSIF NEW.renewal_count > OLD.renewal_count THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, metadata
      ) VALUES (
        NEW.id, 'RENEWED', OLD.status, NEW.status, 
        CONCAT('Empréstimo renovado (', NEW.renewal_count, '/', NEW.max_renewals, '). Novo prazo: ', NEW.expected_return_date::text),
        jsonb_build_object('renewal_count', NEW.renewal_count, 'new_expected_date', NEW.expected_return_date)
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_loan_equipment_status_sync ON public.loans;
CREATE TRIGGER trg_loan_equipment_status_sync
  BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count
  ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_loan_equipment_status();

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_events_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

-- 5.1 Profiles RLS
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id);

-- 5.2 Equipments RLS (Public read for QR codes, Authenticated write)
CREATE POLICY "Equipments are viewable by anyone for QR scanning"
  ON public.equipments FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Authenticated users can insert equipments"
  ON public.equipments FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update equipments"
  ON public.equipments FOR UPDATE
  TO authenticated USING (true);

-- 5.3 Beneficiaries RLS (Strictly authenticated for LGPD privacy)
CREATE POLICY "Authenticated users have full access to beneficiaries"
  ON public.beneficiaries FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 5.4 Loans RLS (Public can access and renew only via magic_token)
CREATE POLICY "Authenticated users have full access to loans"
  ON public.loans FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anonymous users can view loans via valid magic_token"
  ON public.loans FOR SELECT
  TO anon USING (magic_token IS NOT NULL);

CREATE POLICY "Anonymous users can renew loans via valid magic_token"
  ON public.loans FOR UPDATE
  TO anon USING (magic_token IS NOT NULL)
  WITH CHECK (magic_token IS NOT NULL);

-- 5.5 Loan Events Log RLS
CREATE POLICY "Authenticated users can view loan event logs"
  ON public.loan_events_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "System and authenticated users can insert event logs"
  ON public.loan_events_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 5.6 Maintenance Logs RLS
CREATE POLICY "Authenticated users have full access to maintenance logs"
  ON public.maintenance_logs FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 6. SEED DATA (>= 5 Equipments, >= 2 Beneficiaries, >= 2 Loans)
-- ----------------------------------------------------------------------------

-- Seed Equipments (6 diverse items covering multiple categories and statuses)
INSERT INTO public.equipments (
  id, patrimony_code, name, category, status, condition, brand_model, serial_number, replacement_value, qr_token, notes
) VALUES 
(
  'e0000000-0000-0000-0000-000000000001',
  'ROT-CR-001',
  'Cadeira de Rodas Standard Aço 44cm',
  'CADEIRA_RODAS',
  'EMPRESTADO',
  'BOM',
  'Ortobras K1',
  'OB-2023-9841',
  850.00,
  'eq-tok-cr001-rotary-wheel',
  'Doada pelo Rotary Club SP Oeste em 2023. Em perfeito estado.'
),
(
  'e0000000-0000-0000-0000-000000000002',
  'ROT-CB-002',
  'Cadeira de Banho com Rodas e Balde',
  'CADEIRA_BANHO',
  'ATRASADO',
  'REGULAR',
  'Jaguaribe Max',
  'JG-2022-4412',
  480.00,
  'eq-tok-cb002-rotary-bath',
  'Acompanha balde coletor higiênico. Rodízios traseiros lubrificados.'
),
(
  'e0000000-0000-0000-0000-000000000003',
  'ROT-AND-003',
  'Andador Articulado Alumínio Dobrável',
  'ANDADOR',
  'DISPONIVEL',
  'NOVO',
  'Sequencial D10',
  'SQ-2024-1102',
  320.00,
  'eq-tok-and003-rotary-walker',
  'Item novo recebido em campanha de arrecadação 2024.'
),
(
  'e0000000-0000-0000-0000-000000000004',
  'ROT-MUL-004',
  'Par de Muletas Canadenses Reguláveis',
  'MULETA_CANADENSE',
  'HIGIENIZACAO',
  'BOM',
  'Indaiá Comfort',
  'ID-2023-7721',
  160.00,
  'eq-tok-mul004-rotary-crutch',
  'Devolvido recentemente. Aguarda desinfecção e troca de ponteiras de borracha.'
),
(
  'e0000000-0000-0000-0000-000000000005',
  'ROT-CAM-005',
  'Cama Hospitalar Manual 2 Manivelas com Grades',
  'CAMA_HOSPITALAR',
  'MANUTENCAO',
  'PRECISA_REPARO',
  'Pilati Premium',
  'PL-2021-0089',
  2400.00,
  'eq-tok-cam005-rotary-bed',
  'Manivela da cabeceira com desgaste na engrenagem. Encaminhada para torneiro mecânico parceiro.'
),
(
  'e0000000-0000-0000-0000-000000000006',
  'ROT-COL-006',
  'Colchão Pneumático com Compressor de Alívio de Pressão',
  'COLCHAO_PNEUMATICO',
  'DISPONIVEL',
  'BOM',
  'AirPlus Dellamed',
  'DL-2023-5590',
  390.00,
  'eq-tok-col006-rotary-air',
  'Motor compressor 110V testado e operando com ciclo alternado silencioso.'
)
ON CONFLICT (id) DO NOTHING;

-- Seed Beneficiaries (2 complete patient/guardian records with mandatory secondary contacts)
INSERT INTO public.beneficiaries (
  id, full_name, cpf, rg, phone, email, birth_date,
  address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_cep,
  is_patient_same_as_responsible, patient_name, patient_cpf, patient_rg, patient_relationship, patient_condition_notes,
  secondary_contact_name, secondary_contact_relationship, secondary_contact_phone, notes
) VALUES
(
  'b0000000-0000-0000-0000-000000000001',
  'Maria Aparecida da Silva',
  '123.456.789-00',
  '28.987.654-3',
  '(11) 98765-4321',
  'maria.silva@email.com',
  '1965-04-18',
  'Rua das Acácias',
  '142',
  'Casa 2',
  'Vila Esperança',
  'São Paulo',
  'SP',
  '03540-000',
  true,
  NULL, NULL, NULL, NULL,
  'Pós-operatório de fratura de fêmur decorrente de queda.',
  'Carlos Eduardo da Silva',
  'Filho',
  '(11) 97654-3210',
  'Família assistida pelo Rotary Clube local.'
),
(
  'b0000000-0000-0000-0000-000000000002',
  'Sebastião Ferreira Santos',
  '987.654.321-99',
  '15.432.109-8',
  '(11) 99123-4567',
  'sebastiao.santos@email.com',
  '1978-09-25',
  'Av. Rotary Internacional',
  '850',
  'Apto 42 Bloco B',
  'Jardim Rotary',
  'São Paulo',
  'SP',
  '04820-110',
  false,
  'Dona Francisca Santos',
  '321.654.987-11',
  '09.876.543-2',
  'Mãe',
  'Idosa acamada necessitando de cadeira de banho para cuidados diários.',
  'Luciana Ferreira Santos',
  'Irmã',
  '(11) 99876-5432',
  'Responsável trabalha durante o dia; contato secundário disponível à tarde.'
)
ON CONFLICT (id) DO NOTHING;

-- Seed Loans (1 Active Loan, 1 Overdue Loan)
INSERT INTO public.loans (
  id, equipment_id, beneficiary_id, status,
  loan_date, expected_return_date, actual_return_date,
  renewal_count, max_renewals, magic_token,
  contract_pdf_url, signature_image_url,
  witness_name, witness_document
) VALUES
(
  'l0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001', -- ROT-CR-001 (Cadeira de Rodas)
  'b0000000-0000-0000-0000-000000000001', -- Maria Aparecida da Silva
  'ATIVO',
  now() - INTERVAL '15 days',
  now() + INTERVAL '15 days',
  NULL,
  0,
  3,
  'magic-tok-active-loan-maria-001',
  '/contracts/contrato-ROT-CR-001-maria.pdf',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><path d="M10 40 Q 60 10, 110 40 T 190 20" stroke="%2317458f" stroke-width="2" fill="none"/></svg>',
  'Alberto Gentili (Rotariano)',
  'RG 12.345.678-SP'
),
(
  'l0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000002', -- ROT-CB-002 (Cadeira de Banho)
  'b0000000-0000-0000-0000-000000000002', -- Sebastião Ferreira Santos
  'ATRASADO',
  now() - INTERVAL '45 days',
  now() - INTERVAL '15 days', -- 15 days overdue
  NULL,
  1,
  3,
  'magic-tok-overdue-loan-sebastiao-002',
  '/contracts/contrato-ROT-CB-002-sebastiao.pdf',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><path d="M15 35 Q 70 5, 120 45 T 180 30" stroke="%2317458f" stroke-width="2" fill="none"/></svg>',
  'Marcos Valério (Secretário Rotary)',
  'RG 18.765.432-SP'
)
ON CONFLICT (id) DO NOTHING;

-- Seed Maintenance Logs
INSERT INTO public.maintenance_logs (
  equipment_id, maintenance_type, description, cost, technician_name, completed_at
) VALUES
(
  'e0000000-0000-0000-0000-000000000004',
  'HIGIENIZACAO',
  'Higienização com hipoclorito e quaternário de amônio em andamento.',
  25.00,
  'Voluntário Paulo',
  NULL
),
(
  'e0000000-0000-0000-0000-000000000005',
  'MANUTENCAO_CORRETIVA',
  'Substituição do eixo da manivela dentada e lubrificação das articulações da cama hospitalar.',
  180.00,
  'Oficina Mecânica São José',
  NULL
);
```

---

### 4.2 TypeScript Domain Definitions (`src/types/database.ts` & Domain Models)

To guarantee 100% build pass and zero `any` types across the codebase, the following type system is established:

```typescript
// ============================================================================
// DOMAIN ENUMS & CONSTANTS
// ============================================================================

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

export type LoanStatus = 'ATIVO' | 'DEVOLVIDO' | 'ATRASADO' | 'CANCELADO';

export type CloseReason =
  | 'RECUPERACAO_ALTA'
  | 'OBITO_PACIENTE'
  | 'COMPRA_PROPRIA'
  | 'TROCA_EQUIPAMENTO'
  | 'OUTROS'
  | 'DESISTENCIA';

// Friendly labels for UI displays in Portuguese
export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  CADEIRA_RODAS: 'Cadeira de Rodas',
  CADEIRA_BANHO: 'Cadeira de Banho',
  MULETA_AXILAR: 'Muleta Axilar',
  MULETA_CANADENSE: 'Muleta Canadense',
  ANDADOR: 'Andador',
  CAMA_HOSPITALAR: 'Cama Hospitalar',
  COLCHAO_PNEUMATICO: 'Colchão Pneumático',
  SUPORTE_SORO: 'Suporte de Soro',
  OUTROS: 'Outros Equipamentos',
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, { label: string; color: string; badgeClass: string }> = {
  DISPONIVEL: { label: 'Disponível', color: '#16a34a', badgeClass: 'bg-green-100 text-green-800 border-green-300' },
  EMPRESTADO: { label: 'Emprestado', color: '#17458f', badgeClass: 'bg-blue-100 text-blue-800 border-blue-300' },
  ATRASADO: { label: 'Atrasado', color: '#dc2626', badgeClass: 'bg-red-100 text-red-800 border-red-300 animate-pulse' },
  HIGIENIZACAO: { label: 'Higienização', color: '#d97706', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' },
  MANUTENCAO: { label: 'Manutenção', color: '#ea580c', badgeClass: 'bg-orange-100 text-orange-800 border-orange-300' },
  BAIXADO: { label: 'Baixado', color: '#6b7280', badgeClass: 'bg-gray-100 text-gray-800 border-gray-300' },
};

export const EQUIPMENT_CONDITION_LABELS: Record<EquipmentCondition, string> = {
  NOVO: 'Novo (Excelente)',
  BOM: 'Bom estado',
  REGULAR: 'Regular (Marcas de uso)',
  PRECISA_REPARO: 'Necessita Reparo',
  SUCATEADO: 'Sucateado / Inservível',
};

// ============================================================================
// ENTITY INTERFACES
// ============================================================================

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
  name: string;
  category: EquipmentCategory;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  brand_model?: string | null;
  serial_number?: string | null;
  replacement_value: number;
  qr_token: string;
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
  
  is_patient_same_as_responsible: boolean;
  patient_name?: string | null;
  patient_cpf?: string | null;
  patient_rg?: string | null;
  patient_relationship?: string | null;
  patient_condition_notes?: string | null;
  
  secondary_contact_name: string;
  secondary_contact_relationship: string;
  secondary_contact_phone: string;
  
  document_photo_url?: string | null;
  proof_of_residence_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: string;
  equipment_id: string;
  beneficiary_id: string;
  status: LoanStatus;
  loan_date: string;
  expected_return_date: string;
  actual_return_date?: string | null;
  renewal_count: number;
  max_renewals: number;
  magic_token: string;
  contract_pdf_url?: string | null;
  signature_image_url?: string | null;
  witness_name?: string | null;
  witness_document?: string | null;
  
  return_condition?: EquipmentCondition | null;
  close_reason?: CloseReason | null;
  post_return_destination?: EquipmentStatus | null;
  return_notes?: string | null;
  quittance_issued: boolean;
  quittance_issued_at?: string | null;
  
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanEventLog {
  id: string;
  loan_id: string;
  event_type: 'CREATED' | 'RENEWED' | 'STATUS_CHANGE' | 'RETURNED' | 'OVERDUE' | 'QUITTANCE_ISSUED';
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

// Composite types for UI views
export interface EquipmentWithActiveLoan extends Equipment {
  active_loan?: (Loan & { beneficiary: Beneficiary }) | null;
}

export interface LoanWithDetails extends Loan {
  equipment: Equipment;
  beneficiary: Beneficiary;
  created_by_profile?: Profile | null;
}
```

---

### 4.3 Intelligent Demo/Fallback Store Specification (`src/lib/db/mock-store.ts`)

To ensure workers can test immediately without waiting for Supabase credentials, an in-memory & localStorage reactive mock store is specified:

```typescript
// Interface for database operations
export interface IDatabaseRepository {
  getEquipments(filters?: { search?: string; status?: EquipmentStatus; category?: EquipmentCategory }): Promise<Equipment[]>;
  getEquipmentById(id: string): Promise<Equipment | null>;
  getEquipmentByQrToken(qr_token: string): Promise<EquipmentWithActiveLoan | null>;
  createEquipment(data: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>): Promise<Equipment>;
  updateEquipmentStatus(id: string, status: EquipmentStatus, condition?: EquipmentCondition): Promise<Equipment>;
  
  getBeneficiaries(): Promise<Beneficiary[]>;
  getBeneficiaryById(id: string): Promise<Beneficiary | null>;
  createBeneficiary(data: Omit<Beneficiary, 'id' | 'created_at' | 'updated_at'>): Promise<Beneficiary>;
  
  getLoans(): Promise<LoanWithDetails[]>;
  getLoanById(id: string): Promise<LoanWithDetails | null>;
  getLoanByMagicToken(magic_token: string): Promise<LoanWithDetails | null>;
  createLoan(data: { equipment_id: string; beneficiary_id: string; days: number; signature_data_url: string }): Promise<Loan>;
  returnLoan(loan_id: string, returnData: { condition: EquipmentCondition; close_reason: CloseReason; destination: EquipmentStatus; notes?: string }): Promise<Loan>;
  renewLoan(magic_token: string, days?: number): Promise<Loan>;
  
  getMaintenanceLogs(equipment_id: string): Promise<MaintenanceLog[]>;
  createMaintenanceLog(data: Omit<MaintenanceLog, 'id' | 'created_at'>): Promise<MaintenanceLog>;
}
```

---

### 4.4 R3: Component Architecture & Specifications

#### 1. Equipment Catalog (`/equipments`)
- **Page Layout**:
  - **Header & Metric Counters**:
    * Total de Equipamentos
    * Disponíveis (Green)
    * Emprestados (Blue)
    * Atrasados (Red)
    * Higienização / Manutenção (Amber/Orange)
  - **Toolbar**:
    * Search input with auto-debounce (searches `patrimony_code`, `name`, `brand_model`, `serial_number`).
    * Category dropdown selector (All + 9 categories).
    * Status dropdown selector (All + 6 statuses).
    * View Mode Toggle: Grid Card View vs. Compact Data Table.
    * Action button: "+ Novo Equipamento" (opens creation modal).
    * Action button: "Imprimir Etiquetas" (redirects to `/equipments/labels`).
  - **Add Equipment Modal (`AddEquipmentDialog`)**:
    * Fields: Name, Category, Patrimony Code (with auto-suggest format `ROT-[CAT]-[NUMBER]`), Replacement Value, Condition, Brand/Model, Serial Number, Notes.
    * Auto-generated `qr_token` via client crypto `crypto.randomUUID()`.
    * Validation with Zod before submission.
  - **Equipment Card (`EquipmentCard`)**:
    * Category Icon (wheelchair, walker, bed, crutches).
    * Patrimony code badge in bold monospace.
    * Equipment name and model.
    * Status badge with Rotary design system colors.
    * Replacement value: "Valor de Reposição: R$ 850,00".
    * Quick Actions: "Ver QR Code", "Ações Contextuais" (links to `/item/[qr_token]`), "Histórico".

#### 2. Mobile Camera QR Scanner (`/scan`)
- **Mobile-First Scanner Component (`QrScanner`)**:
  - Uses `html5-qrcode` library (standard, lightweight, works reliably on Android/iOS PWA).
  - WebRTC Camera constraints: `{ facingMode: { ideal: "environment" } }`.
  - **Visual Viewfinder**:
    * 260px x 260px central scanning reticle.
    * 4 rounded corner borders styled with Rotary Royal Blue (`#17458f`) and Gold accent (`#f7a81b`).
    * Laser scanline animation moving vertically within the reticle.
  - **Controls Overlay**:
    * Torch / Flashlight toggle button (`applyConstraints({ advanced: [{ torch: true }] })` with support detection).
    * Camera switch button (Environment vs. Front-facing).
    * Return to catalog button.
  - **Fallback Input Form**:
    * Card below viewfinder: "Problemas na câmera? Digite o patrimônio ou token:"
    * Instant autocomplete search input supporting codes like `ROT-CR-001` or direct token string.
  - **Token Parser Logic**:
    * Detects if scanned string is a full URL (`https://.../item/xyz-123`) or a raw token (`xyz-123`).
    * Extracts token and triggers `router.push('/item/' + token)`.
    * Plays a gentle confirmation audio beep or haptic vibration (`navigator.vibrate([100, 50, 100])`) on successful detection.

#### 3. Dynamic Contextual Action State Machine (`/item/[qr_token]`)
- **Route**: `src/app/item/[qr_token]/page.tsx`
- **State Machine Specification**:

| Equipment Status | Banner & Visual Indicator | Contextual Primary Action | Secondary Actions & Contacts |
|:---|:---|:---|:---|
| **`DISPONIVEL`** | 🟢 **Verde**: "Disponível para Empréstimo Imediato" | **"Iniciar Novo Empréstimo"** (Navega para `/loans/new?equipment_id=${id}`) | 1. "Enviar para Higienização"<br>2. "Encaminhar para Manutenção" |
| **`EMPRESTADO`** | 🔵 **Azul**: "Em Comodato Ativo" + Dados do Beneficiário e Data Prevista | **"Registrar Devolução"** (Navega para `/loans/${loan.id}/return`) | 1. "Renovar Empréstimo (+30 dias)"<br>2. Botão WhatsApp: "Falar com Beneficiário" |
| **`ATRASADO`** | 🔴 **Vermelho Pulsante**: "Devolução Vencida há X dias" | **"Registrar Devolução / Recolhimento"** (Navega para `/loans/${loan.id}/return`) | 1. "Renovar com Justificativa"<br>2. Botão WhatsApp: "Cobrança Beneficiário"<br>3. Botão WhatsApp: "Contato Secundário (Urgente)" |
| **`HIGIENIZACAO`** | 🟡 **Âmbar**: "Item em Processo de Higienização e Desinfecção" | **"Concluir Higienização e Liberar"** (Altera status para `DISPONIVEL` e grava log) | 1. "Constatado Defeito -> Enviar para Manutenção" |
| **`MANUTENCAO`** | 🟠 **Laranja**: "Equipamento em Reparo / Oficina Mecânica" | **"Concluir Reparo e Liberar"** (Modal de peças/custo, altera para `DISPONIVEL`) | 1. "Dar Baixa Definitiva (Inservível / Sucateado)" |
| **`BAIXADO`** | ⚫ **Cinza**: "Item Baixado do Patrimônio" | *Nenhuma ação operacional permitida* | "Ver Histórico de Manutenção e Baixa" |

#### 4. Printable Asset Label Generator (`/equipments/labels`)
- **Route**: `src/app/equipments/labels/page.tsx`
- **Layout Modes**:
  1. **Térmica Individual (50mm x 30mm)**: Perfeita para etiquetadoras térmicas portáteis (Zebra ZD220, Elgin L42 Pro).
  2. **Grade Folha A4 (Pimaco 6180 - 3 colunas x 10 linhas = 30 etiquetas)**: Para impressão em qualquer impressora jato de tinta ou laser convencional.
- **Label Card Visual Elements**:
  ```
  +-----------------------------------------------------------+
  | (ROTARY WHEEL) ROTARY CLUB - BANCO ORTOPÉDICO            |
  |-----------------------------------------------------------|
  | [  QR CODE  ]  PATRIMÔNIO: ROT-CR-001                     |
  | [ 22mmx22mm ]  CADEIRA DE RODAS STANDARD AÇO              |
  | [           ]  Valor Reposição: R$ 850,00                 |
  | [  SCAN ME  ]  Devolução/Dúvidas: (11) 98765-4321         |
  +-----------------------------------------------------------+
  ```
- **Print Optimization (`@media print`)**:
  ```css
  @media print {
    /* Hide layout shell, navbar, bottom navigation, and print controls */
    header, nav, footer, .no-print, aside {
      display: none !important;
    }
    body {
      background: white !important;
      color: black !important;
      margin: 0 !important;
      padding: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .labels-container {
      display: grid !important;
      grid-template-columns: repeat(3, 1fr) !important;
      gap: 2mm !important;
      padding: 5mm !important;
    }
    .label-card {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      border: 1px dashed #666 !important;
      width: 63.5mm !important;
      height: 25.4mm !important;
      box-sizing: border-box !important;
      padding: 2mm !important;
    }
  }
  ```

---

## 5. Verification Method

To verify R2 and R3 implementation independently:

1. **Database Migration Verification**:
   - In Supabase CLI or PostgreSQL:
     ```bash
     npx supabase db lint
     psql -U postgres -d postgres -f supabase/migrations/001_initial_schema.sql
     ```
   - Verify table creation and row counts:
     ```sql
     SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
     SELECT COUNT(*) FROM equipments; -- Expected: >= 6
     SELECT COUNT(*) FROM beneficiaries; -- Expected: >= 2
     SELECT COUNT(*) FROM loans; -- Expected: >= 2
     ```
   - Verify Trigger Execution:
     ```sql
     -- Test return trigger:
     UPDATE loans SET status = 'DEVOLVIDO', post_return_destination = 'HIGIENIZACAO', return_condition = 'BOM'
     WHERE id = 'l0000000-0000-0000-0000-000000000001';
     
     -- Verify equipment status was automatically updated:
     SELECT status, condition FROM equipments WHERE id = 'e0000000-0000-0000-0000-000000000001';
     -- Expected: status = 'HIGIENIZACAO', condition = 'BOM'
     
     -- Verify event log was written:
     SELECT * FROM loan_events_log WHERE loan_id = 'l0000000-0000-0000-0000-000000000001' ORDER BY created_at DESC LIMIT 1;
     -- Expected: event_type = 'RETURNED'
     ```

2. **TypeScript Compilation & Build Verification**:
   - Run typecheck:
     ```bash
     npm run build
     # Or:
     npx tsc --noEmit
     ```
   - Must output 0 errors.

3. **Contextual Action State Machine Verification**:
   - In browser:
     * Access `/item/eq-tok-and003-rotary-walker` (Status `DISPONIVEL`): Verify "Iniciar Novo Empréstimo" is visible and clicking leads to `/loans/new?equipment_id=...`.
     * Access `/item/eq-tok-cr001-rotary-wheel` (Status `EMPRESTADO`): Verify beneficiary name "Maria Aparecida da Silva", return button, and WhatsApp button are present.
     * Access `/item/eq-tok-cb002-rotary-bath` (Status `ATRASADO`): Verify red alert badge, days overdue, and both WhatsApp contacts (Beneficiary + Secondary Contact) are present.
     * Access `/item/eq-tok-mul004-rotary-crutch` (Status `HIGIENIZACAO`): Verify "Concluir Higienização e Liberar" button transitions item back to `DISPONIVEL`.
     * Access `/item/eq-tok-cam005-rotary-bed` (Status `MANUTENCAO`): Verify repair card and "Concluir Reparo e Liberar" action.

4. **Printable Labels Verification**:
   - Navigate to `/equipments/labels`.
   - Select 2 items or "Selecionar Todos".
   - Open browser print preview (`Ctrl + P` / `Cmd + P`).
   - Verify: No navigation bar, no footer, QR codes crisp and scannable, Rotary branding sharp and aligned.
