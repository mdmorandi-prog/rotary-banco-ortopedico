-- ============================================================================
-- ROTARY BANCO ORTOPÉDICO - MIGRATION 001: INITIAL SCHEMA & SEED
-- ============================================================================
-- Complete schema for physical equipment tracking, digital comodato contracts,
-- automated equipment status synchronization, LGPD-compliant RLS, and seed data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS & COMPATIBILITY STUBS
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure auth schema and auth.users stub exist for standalone dry-runs
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure auth.uid() stub exists for standalone dry-runs outside Supabase
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
  SELECT null::uuid;
$$ LANGUAGE sql STABLE;

-- Ensure anon and authenticated roles exist for standalone dry-runs outside Supabase
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. ENUMS DEFINITIONS (6 DOMAIN ENUMS)
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
-- 2. TABLE DEFINITIONS (6 RELATIONAL TABLES)
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

  -- Address fields
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

  -- Return Triage & Quittance fields (R5)
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

-- 2.5 Loan Events Log (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS public.loan_events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  event_type VARCHAR(50) NOT NULL,
  old_status loan_status,
  new_status loan_status,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.6 Maintenance Logs (Asset Service & Sanitization History)
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
-- 3. INDEXES & PERFORMANCE INVARIANTS
-- ----------------------------------------------------------------------------

-- Foreign keys performance indexes
CREATE INDEX IF NOT EXISTS idx_loans_equipment_id ON public.loans(equipment_id);
CREATE INDEX IF NOT EXISTS idx_loans_beneficiary_id ON public.loans(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_loans_created_by ON public.loans(created_by);
CREATE INDEX IF NOT EXISTS idx_loan_events_loan_id ON public.loan_events_log(loan_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_equipment_id ON public.maintenance_logs(equipment_id);

-- Inventory lookups and catalog filtering
CREATE INDEX IF NOT EXISTS idx_equipments_status ON public.equipments(status);
CREATE INDEX IF NOT EXISTS idx_equipments_category ON public.equipments(category);
CREATE INDEX IF NOT EXISTS idx_equipments_qr_token ON public.equipments(qr_token);
CREATE INDEX IF NOT EXISTS idx_equipments_patrimony_code ON public.equipments(patrimony_code);

-- Beneficiary lookups
CREATE INDEX IF NOT EXISTS idx_beneficiaries_cpf ON public.beneficiaries(cpf);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_full_name ON public.beneficiaries(full_name);

-- Loan monitoring and self-service portal
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_expected_return_date ON public.loans(expected_return_date);
CREATE INDEX IF NOT EXISTS idx_loans_magic_token ON public.loans(magic_token);
CREATE INDEX IF NOT EXISTS idx_loans_loan_code ON public.loans(loan_code);

-- Compound index for daily /api/cron/check-loans scanning
CREATE INDEX IF NOT EXISTS idx_loans_status_expected_date ON public.loans(status, expected_return_date);

-- Event and maintenance audit indexing
CREATE INDEX IF NOT EXISTS idx_loan_events_type ON public.loan_events_log(event_type);
CREATE INDEX IF NOT EXISTS idx_loan_events_created_at ON public.loan_events_log(created_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_type ON public.maintenance_logs(maintenance_type);
CREATE INDEX IF NOT EXISTS idx_maintenance_created_at ON public.maintenance_logs(created_at);

-- Partial Unique Index: Guarantees an equipment cannot have more than one active or overdue loan
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_loan_per_equipment
  ON public.loans (equipment_id)
  WHERE status IN ('ATIVO', 'ATRASADO');

-- ----------------------------------------------------------------------------
-- 4. AUTOMATIC TRIGGERS & STATE MACHINE FUNCTIONS
-- ----------------------------------------------------------------------------

-- 4.1 Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach updated_at triggers to all mutable tables
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

-- Drop legacy trigger and function if present
DROP TRIGGER IF EXISTS trg_loan_equipment_status_sync ON public.loans;
DROP FUNCTION IF EXISTS public.fn_sync_loan_equipment_status();

-- 4.2 BEFORE Trigger Function: Equipment status sync, locking, immutability, and timestamp defaults
CREATE OR REPLACE FUNCTION public.fn_loan_equipment_status_before()
RETURNS TRIGGER AS $$
DECLARE
  v_destination public.equipment_status;
  v_equipment_current_status public.equipment_status;
BEGIN
  -- Prevent infinite trigger recursion
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- --------------------------------------------------------------------------
  -- CASE 1: LOAN CREATION (INSERT)
  -- --------------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    -- Invariant defaults
    IF NEW.loan_date IS NULL THEN
      NEW.loan_date := now();
    END IF;
    IF NEW.renewal_count IS NULL THEN
      NEW.renewal_count := 0;
    END IF;
    IF NEW.quittance_issued IS NULL THEN
      NEW.quittance_issued := false;
    END IF;
    IF NEW.magic_token IS NULL OR trim(NEW.magic_token) = '' THEN
      NEW.magic_token := encode(gen_random_bytes(24), 'hex');
    END IF;
    IF NEW.quittance_issued = true AND NEW.quittance_issued_at IS NULL THEN
      NEW.quittance_issued_at := now();
    END IF;

    IF NEW.status = 'ATIVO' THEN
      -- Check availability and acquire row lock on equipment
      SELECT status INTO v_equipment_current_status
      FROM public.equipments
      WHERE id = NEW.equipment_id
      FOR UPDATE;

      IF v_equipment_current_status IS NULL THEN
        RAISE EXCEPTION 'Equipamento % não encontrado.', NEW.equipment_id;
      END IF;

      IF v_equipment_current_status != 'DISPONIVEL' THEN
        RAISE EXCEPTION 'Equipamento % não está DISPONIVEL (status atual: %).', NEW.equipment_id, v_equipment_current_status;
      END IF;

      UPDATE public.equipments
      SET status = 'EMPRESTADO', updated_at = now()
      WHERE id = NEW.equipment_id;

    ELSIF NEW.status = 'ATRASADO' THEN
      SELECT status INTO v_equipment_current_status
      FROM public.equipments
      WHERE id = NEW.equipment_id
      FOR UPDATE;

      IF v_equipment_current_status IS NULL THEN
        RAISE EXCEPTION 'Equipamento % não encontrado.', NEW.equipment_id;
      END IF;

      UPDATE public.equipments
      SET status = 'ATRASADO', updated_at = now()
      WHERE id = NEW.equipment_id;

    ELSIF NEW.status = 'DEVOLVIDO' THEN
      IF NEW.actual_return_date IS NULL THEN
        NEW.actual_return_date := now();
      END IF;

      v_destination := COALESCE(
        NEW.post_return_destination,
        CASE
          WHEN NEW.return_condition IN ('PRECISA_REPARO', 'SUCATEADO') THEN 'MANUTENCAO'::public.equipment_status
          ELSE 'HIGIENIZACAO'::public.equipment_status
        END
      );

      UPDATE public.equipments
      SET
        status = v_destination,
        condition = COALESCE(NEW.return_condition, condition),
        updated_at = now()
      WHERE id = NEW.equipment_id;
    END IF;

    RETURN NEW;
  END IF;

  -- --------------------------------------------------------------------------
  -- CASE 2: LOAN MODIFICATION (UPDATE)
  -- --------------------------------------------------------------------------
  IF TG_OP = 'UPDATE' THEN
    -- Invariant: Equipment ID and Beneficiary ID cannot be altered on an existing contract
    IF OLD.equipment_id != NEW.equipment_id THEN
      RAISE EXCEPTION 'Não é permitido alterar o equipamento de um contrato de comodato existente.';
    END IF;
    IF OLD.beneficiary_id != NEW.beneficiary_id THEN
      RAISE EXCEPTION 'Não é permitido alterar o beneficiário de um contrato de comodato existente.';
    END IF;

    -- Subcase 2.1: Transition to DEVOLVIDO (Return Triage)
    IF OLD.status != 'DEVOLVIDO' AND NEW.status = 'DEVOLVIDO' THEN
      IF NEW.actual_return_date IS NULL THEN
        NEW.actual_return_date := now();
      END IF;

      -- Determine post-return destination with smart fallback
      v_destination := COALESCE(
        NEW.post_return_destination,
        CASE
          WHEN NEW.return_condition IN ('PRECISA_REPARO', 'SUCATEADO') THEN 'MANUTENCAO'::public.equipment_status
          ELSE 'HIGIENIZACAO'::public.equipment_status
        END
      );

      UPDATE public.equipments
      SET
        status = v_destination,
        condition = COALESCE(NEW.return_condition, condition),
        updated_at = now()
      WHERE id = NEW.equipment_id;

    -- Subcase 2.2: Transition to ATRASADO (Overdue via Cron or Manual)
    ELSIF OLD.status != 'ATRASADO' AND NEW.status = 'ATRASADO' THEN
      UPDATE public.equipments
      SET status = 'ATRASADO', updated_at = now()
      WHERE id = NEW.equipment_id;

    -- Subcase 2.3: Transition from ATRASADO to ATIVO (Renewal or manual un-overdue)
    ELSIF OLD.status = 'ATRASADO' AND NEW.status = 'ATIVO' THEN
      UPDATE public.equipments
      SET status = 'EMPRESTADO', updated_at = now()
      WHERE id = NEW.equipment_id;

    -- Subcase 2.4: Transition to CANCELADO
    ELSIF OLD.status != 'CANCELADO' AND NEW.status = 'CANCELADO' THEN
      UPDATE public.equipments
      SET status = 'DISPONIVEL', updated_at = now()
      WHERE id = NEW.equipment_id;
    END IF;

    -- Subcase 2.5: Renewal threshold validation invariant
    IF NEW.renewal_count > OLD.renewal_count THEN
      IF NEW.renewal_count > NEW.max_renewals THEN
        RAISE EXCEPTION 'Limite máximo de % renovações atingido para este contrato.', NEW.max_renewals;
      END IF;
    END IF;

    -- Subcase 2.6: Quittance issuance timestamp default
    IF NEW.quittance_issued = true AND (OLD.quittance_issued IS NULL OR OLD.quittance_issued = false) THEN
      IF NEW.quittance_issued_at IS NULL THEN
        NEW.quittance_issued_at := now();
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach BEFORE trigger to loans
DROP TRIGGER IF EXISTS trg_loan_equipment_status_before ON public.loans;
CREATE TRIGGER trg_loan_equipment_status_before
  BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued, equipment_id, beneficiary_id
  ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.fn_loan_equipment_status_before();

-- 4.3 AFTER Trigger Function: Immutable audit trail logging
CREATE OR REPLACE FUNCTION public.fn_loan_events_log_after()
RETURNS TRIGGER AS $$
DECLARE
  v_destination public.equipment_status;
BEGIN
  -- Prevent infinite trigger recursion
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- --------------------------------------------------------------------------
  -- CASE 1: LOAN CREATION AUDIT (INSERT)
  -- --------------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'ATIVO' THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by, metadata
      ) VALUES (
        NEW.id, 'CREATED', NULL, NEW.status, 'Empréstimo iniciado e comodato formalizado.', NEW.created_by,
        jsonb_build_object('equipment_id', NEW.equipment_id, 'expected_return_date', NEW.expected_return_date)
      );
    ELSIF NEW.status = 'ATRASADO' THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by, metadata
      ) VALUES (
        NEW.id, 'CREATED', NULL, NEW.status, 'Empréstimo importado/cadastrado com status atrasado.', NEW.created_by,
        jsonb_build_object('equipment_id', NEW.equipment_id, 'expected_return_date', NEW.expected_return_date)
      );
    ELSIF NEW.status = 'DEVOLVIDO' THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by, metadata
      ) VALUES (
        NEW.id, 'RETURNED', NULL, NEW.status, 'Empréstimo importado/cadastrado com status devolvido.', NEW.created_by,
        jsonb_build_object('equipment_id', NEW.equipment_id, 'actual_return_date', NEW.actual_return_date)
      );
    END IF;

    RETURN NEW;
  END IF;

  -- --------------------------------------------------------------------------
  -- CASE 2: LOAN MODIFICATION AUDIT (UPDATE)
  -- --------------------------------------------------------------------------
  IF TG_OP = 'UPDATE' THEN
    -- Subcase 2.1: Transition to DEVOLVIDO (Return Triage)
    IF OLD.status != 'DEVOLVIDO' AND NEW.status = 'DEVOLVIDO' THEN
      v_destination := COALESCE(
        NEW.post_return_destination,
        CASE
          WHEN NEW.return_condition IN ('PRECISA_REPARO', 'SUCATEADO') THEN 'MANUTENCAO'::public.equipment_status
          ELSE 'HIGIENIZACAO'::public.equipment_status
        END
      );

      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by, metadata
      ) VALUES (
        NEW.id, 'RETURNED', OLD.status, NEW.status,
        CONCAT('Devolução registrada. Equipamento direcionado para: ', v_destination::text),
        NEW.created_by,
        jsonb_build_object(
          'close_reason', NEW.close_reason,
          'return_condition', NEW.return_condition,
          'destination', v_destination,
          'actual_return_date', NEW.actual_return_date
        )
      );

    -- Subcase 2.2: Transition to ATRASADO (Overdue)
    ELSIF OLD.status != 'ATRASADO' AND NEW.status = 'ATRASADO' THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by
      ) VALUES (
        NEW.id, 'OVERDUE', OLD.status, NEW.status,
        'Prazo de devolução expirado. Marcado como atrasado.',
        NEW.created_by
      );

    -- Subcase 2.3: Transition to CANCELADO
    ELSIF OLD.status != 'CANCELADO' AND NEW.status = 'CANCELADO' THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by
      ) VALUES (
        NEW.id, 'CANCELLED', OLD.status, NEW.status,
        'Empréstimo cancelado. Equipamento liberado para estoque.',
        NEW.created_by
      );

    -- Subcase 2.4: Transition from ATRASADO to ATIVO (Un-overdue/Recovery)
    ELSIF OLD.status = 'ATRASADO' AND NEW.status = 'ATIVO' AND NEW.renewal_count = OLD.renewal_count THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by
      ) VALUES (
        NEW.id, 'STATUS_CHANGED', OLD.status, NEW.status,
        'Status do empréstimo regularizado para ativo.',
        NEW.created_by
      );
    END IF;

    -- Subcase 2.5: Renewal event
    IF NEW.renewal_count > OLD.renewal_count THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, metadata
      ) VALUES (
        NEW.id, 'RENEWED', OLD.status, NEW.status,
        CONCAT('Empréstimo renovado (', NEW.renewal_count, '/', NEW.max_renewals, '). Novo prazo: ', NEW.expected_return_date::text),
        jsonb_build_object(
          'old_expected_date', OLD.expected_return_date,
          'new_expected_date', NEW.expected_return_date,
          'renewal_count', NEW.renewal_count,
          'max_renewals', NEW.max_renewals
        )
      );
    END IF;

    -- Subcase 2.6: Quittance issuance audit
    IF NEW.quittance_issued = true AND (OLD.quittance_issued IS NULL OR OLD.quittance_issued = false) THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by
      ) VALUES (
        NEW.id, 'QUITTANCE_ISSUED', OLD.status, NEW.status,
        'Termo de Quitação emitido formalmente.',
        NEW.created_by
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach AFTER trigger to loans
DROP TRIGGER IF EXISTS trg_loan_events_log_after ON public.loans;
CREATE TRIGGER trg_loan_events_log_after
  AFTER INSERT OR UPDATE OF status, renewal_count, quittance_issued
  ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.fn_loan_events_log_after();

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES & SECURE RPCS
-- ----------------------------------------------------------------------------

-- 5.1 Enable RLS on all 6 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_events_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

-- 5.2 Profiles Policies & Auth User Sync Trigger
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_authenticated" ON public.profiles;
CREATE POLICY "profiles_insert_authenticated"
  ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin"
  ON public.profiles FOR UPDATE
  TO authenticated USING (
    auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Automatic profile creation when a user is registered or verifies Email OTP/MFA in Supabase Auth
CREATE OR REPLACE FUNCTION public.fn_handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, rotary_club, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'Voluntário'), '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'volunteer'::public.user_role),
    COALESCE(NEW.raw_user_meta_data->>'rotary_club', 'Rotary Club Farroupilha'),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_auth_user();

-- 5.3 Equipments Policies (Public read for QR scan /item/[qr_token])
DROP POLICY IF EXISTS "equipments_select_public" ON public.equipments;
CREATE POLICY "equipments_select_public"
  ON public.equipments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "equipments_insert_authenticated" ON public.equipments;
CREATE POLICY "equipments_insert_authenticated"
  ON public.equipments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "equipments_update_authenticated" ON public.equipments;
CREATE POLICY "equipments_update_authenticated"
  ON public.equipments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "equipments_delete_admin" ON public.equipments;
CREATE POLICY "equipments_delete_admin"
  ON public.equipments FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5.4 Beneficiaries Policies (Strict LGPD Compliance - Zero Anonymous Access)
DROP POLICY IF EXISTS "beneficiaries_authenticated_all" ON public.beneficiaries;
CREATE POLICY "beneficiaries_authenticated_all"
  ON public.beneficiaries FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 5.5 Loans Policies (Authenticated Staff Only - Zero Direct Anonymous Table Access)
DROP POLICY IF EXISTS "loans_authenticated_all" ON public.loans;
CREATE POLICY "loans_authenticated_all"
  ON public.loans FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Ensure direct anonymous table access policies are explicitly dropped
DROP POLICY IF EXISTS "loans_anon_select_magic_token" ON public.loans;
DROP POLICY IF EXISTS "loans_anon_update_renewal" ON public.loans;

-- 5.6 Loan Events Log Policies (Append-only Audit Trail)
DROP POLICY IF EXISTS "loan_events_select_authenticated" ON public.loan_events_log;
CREATE POLICY "loan_events_select_authenticated"
  ON public.loan_events_log FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "loan_events_insert_authenticated" ON public.loan_events_log;
CREATE POLICY "loan_events_insert_authenticated"
  ON public.loan_events_log FOR INSERT
  TO authenticated WITH CHECK (true);

-- 5.7 Maintenance Logs Policies
DROP POLICY IF EXISTS "maintenance_authenticated_all" ON public.maintenance_logs;
CREATE POLICY "maintenance_authenticated_all"
  ON public.maintenance_logs FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 5.8 Secure Public RPCs for Magic Link Self-Service Portal
CREATE OR REPLACE FUNCTION public.get_public_loan_by_magic_token(p_token text)
RETURNS TABLE (
  loan_id uuid,
  loan_code varchar(50),
  equipment_name text,
  equipment_category public.equipment_category,
  equipment_patrimony varchar(50),
  status public.loan_status,
  loan_date timestamptz,
  expected_return_date timestamptz,
  renewal_count integer,
  max_renewals integer,
  beneficiary_first_name text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Input guard: Return empty if token is null or blank
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l.id AS loan_id,
    l.loan_code,
    e.name AS equipment_name,
    e.category AS equipment_category,
    e.patrimony_code AS equipment_patrimony,
    l.status,
    l.loan_date,
    l.expected_return_date,
    l.renewal_count,
    l.max_renewals,
    split_part(b.full_name, ' ', 1) AS beneficiary_first_name
  FROM public.loans l
  JOIN public.equipments e ON e.id = l.equipment_id
  JOIN public.beneficiaries b ON b.id = l.beneficiary_id
  WHERE l.magic_token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_loan_by_magic_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.renew_loan_by_magic_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_loan public.loans%ROWTYPE;
  v_new_date timestamptz;
BEGIN
  -- Input guard: Reject null or empty token
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token de renovação inválido.');
  END IF;

  SELECT * INTO v_loan FROM public.loans WHERE magic_token = p_token FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token de renovação inválido ou expirado.');
  END IF;

  IF v_loan.status NOT IN ('ATIVO', 'ATRASADO') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este contrato não está ativo para renovação.');
  END IF;

  IF v_loan.renewal_count >= v_loan.max_renewals THEN
    RETURN jsonb_build_object('success', false, 'error', 'Limite máximo de renovações atingido. Favor contatar o Rotary.');
  END IF;

  v_new_date := v_loan.expected_return_date + INTERVAL '30 days';

  UPDATE public.loans
  SET
    expected_return_date = v_new_date,
    renewal_count = renewal_count + 1,
    status = 'ATIVO',
    updated_at = now()
  WHERE id = v_loan.id;

  RETURN jsonb_build_object(
    'success', true,
    'new_expected_date', v_new_date,
    'renewal_count', v_loan.renewal_count + 1,
    'max_renewals', v_loan.max_renewals
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.renew_loan_by_magic_token(text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. SEED DATA (ROBUST INITIAL DATASET)
-- ----------------------------------------------------------------------------

-- Temporarily bypass triggers during seed ingestion to preserve historical timestamps
SET session_replication_role = 'replica';

-- 6.1 Seed Equipments (8 diverse items across all operational statuses & categories)
INSERT INTO public.equipments (
  id, patrimony_code, name, category, status, condition, brand_model, serial_number, replacement_value, qr_token, acquisition_date, notes
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
  '2023-03-15',
  'Doada pelo Rotary Club SP Oeste em 2023. Em perfeito estado de conservação.'
),
(
  'e0000000-0000-0000-0000-000000000002',
  'ROT-CB-002',
  'Cadeira de Banho com Rodas e Balde Coletor',
  'CADEIRA_BANHO',
  'ATRASADO',
  'REGULAR',
  'Jaguaribe Max',
  'JG-2022-4412',
  480.00,
  'eq-tok-cb002-rotary-bath',
  '2022-08-20',
  'Acompanha balde higiênico coletor. Rodízios traseiros necessitam de lubrificação no retorno.'
),
(
  'e0000000-0000-0000-0000-000000000003',
  'ROT-AND-003',
  'Andador Articulado Alumínio Dobrável com Rodas',
  'ANDADOR',
  'DISPONIVEL',
  'NOVO',
  'Sequencial D10',
  'SQ-2024-1102',
  320.00,
  'eq-tok-and003-rotary-walker',
  '2024-01-10',
  'Equipamento novo recebido na campanha de arrecadação Distrital 2024.'
),
(
  'e0000000-0000-0000-0000-000000000004',
  'ROT-MUL-004',
  'Par de Muletas Canadenses Reguláveis em Alumínio',
  'MULETA_CANADENSE',
  'HIGIENIZACAO',
  'BOM',
  'Indaiá Comfort',
  'ID-2023-7721',
  160.00,
  'eq-tok-mul004-rotary-crutch',
  '2023-05-12',
  'Devolvido recentemente após alta médica. Aguarda processo de desinfecção e troca de ponteiras.'
),
(
  'e0000000-0000-0000-0000-000000000005',
  'ROT-CAM-005',
  'Cama Hospitalar Manual 2 Manivelas com Grades Laterais',
  'CAMA_HOSPITALAR',
  'MANUTENCAO',
  'PRECISA_REPARO',
  'Pilati Premium',
  'PL-2021-0089',
  2400.00,
  'eq-tok-cam005-rotary-bed',
  '2021-11-05',
  'Desgaste na engrenagem da manivela de elevação de tronco. Encaminhada para tornearia mecânica parceira.'
),
(
  'e0000000-0000-0000-0000-000000000006',
  'ROT-COL-006',
  'Colchão Pneumático de Alívio de Pressão com Compressor 110V',
  'COLCHAO_PNEUMATICO',
  'DISPONIVEL',
  'BOM',
  'AirPlus Dellamed',
  'DL-2023-5590',
  390.00,
  'eq-tok-col006-rotary-air',
  '2023-09-18',
  'Motor compressor testado e operando com ciclo alternado silencioso. Ideal para pacientes acamados.'
),
(
  'e0000000-0000-0000-0000-000000000007',
  'ROT-MUL-007',
  'Par de Muletas Axilares Adulto Reguláveis',
  'MULETA_AXILAR',
  'DISPONIVEL',
  'BOM',
  'Dilepé Pop',
  'DP-2023-3312',
  140.00,
  'eq-tok-mul007-rotary-axil',
  '2023-07-22',
  'Apoios axilares em borracha macia e ponteiras antiderrapantes em excelente estado.'
),
(
  'e0000000-0000-0000-0000-000000000008',
  'ROT-SUP-008',
  'Suporte de Soro Cromado com 4 Ganchos e Rodízios',
  'SUPORTE_SORO',
  'DISPONIVEL',
  'BOM',
  'Carci Standard',
  'CR-2022-7711',
  150.00,
  'eq-tok-sup008-rotary-pole',
  '2022-10-15',
  'Haste telescópica cromada e base pesada em ferro fundido com 5 rodízios giratórios.'
)
ON CONFLICT (id) DO NOTHING;

-- 6.2 Seed Beneficiaries (Complete Brazilian PII & Mandatory Secondary Contacts)
INSERT INTO public.beneficiaries (
  id, full_name, cpf, rg, phone, email, birth_date,
  address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_cep,
  is_patient_same_as_responsible, patient_name, patient_cpf, patient_rg, patient_relationship, patient_condition_notes,
  secondary_contact_name, secondary_contact_relationship, secondary_contact_phone,
  document_photo_url, proof_of_residence_url, notes
) VALUES
(
  'b0000000-0000-0000-0000-000000000001',
  'Maria Aparecida da Silva',
  '123.456.789-09',
  '28.987.654-3',
  '(11) 98765-4321',
  'maria.silva@rotarybanco.org.br',
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
  'Pós-operatório de osteossíntese de fêmur decorrente de queda domiciliar. Necessita de locomoção assistida por 60 dias.',
  'Carlos Eduardo da Silva',
  'Filho',
  '(11) 97654-3210',
  '/uploads/docs/doc-maria-silva-rg.jpg',
  '/uploads/docs/comp-res-maria-silva.jpg',
  'Família assistida e cadastrada pelo Rotary Club SP Oeste.'
),
(
  'b0000000-0000-0000-0000-000000000002',
  'Sebastião Ferreira Santos',
  '987.654.321-00',
  '15.432.109-8',
  '(11) 99123-4567',
  'sebastiao.santos@rotarybanco.org.br',
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
  '321.654.987-91',
  '09.876.543-2',
  'Mãe',
  'Idosa de 84 anos acamada, sequela motora de AVC, necessitando de cadeira de banho para cuidados de higiene diária.',
  'Luciana Ferreira Santos',
  'Irmã',
  '(11) 99876-5432',
  '/uploads/docs/doc-sebastiao-santos.jpg',
  '/uploads/docs/comp-res-sebastiao.jpg',
  'Responsável trabalha durante o dia; contato secundário disponível no período da tarde.'
)
ON CONFLICT (id) DO NOTHING;

-- 6.3 Seed Loans (Active, Overdue by 15 days, and Historical Returned)
INSERT INTO public.loans (
  id, loan_code, equipment_id, beneficiary_id, status,
  loan_date, expected_return_date, actual_return_date,
  renewal_count, max_renewals, magic_token, replacement_value,
  contract_pdf_url, signature_image_url, witness_name, witness_document,
  return_condition, close_reason, post_return_destination, return_notes,
  quittance_issued, quittance_issued_at, notes
) VALUES
(
  'c0000000-0000-0000-0000-000000000001',
  'ROT-EMP-2024-001',
  'e0000000-0000-0000-0000-000000000001', -- ROT-CR-001 (Cadeira de Rodas)
  'b0000000-0000-0000-0000-000000000001', -- Maria Aparecida da Silva
  'ATIVO',
  now() - INTERVAL '15 days',
  now() + INTERVAL '15 days',
  NULL,
  0,
  3,
  'magic-tok-active-maria-001',
  850.00,
  '/contracts/contrato-ROT-EMP-2024-001-maria.pdf',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><path d="M10 40 Q 60 10, 110 40 T 190 20" stroke="%2317458f" stroke-width="2" fill="none"/></svg>',
  'Alberto Gentili (Rotariano)',
  'RG 12.345.678-SP',
  NULL, NULL, NULL, NULL,
  false, NULL,
  'Contrato de comodato assinado digitalmente na sede do Rotary. Prazo inicial de 30 dias.'
),
(
  'c0000000-0000-0000-0000-000000000002',
  'ROT-EMP-2024-002',
  'e0000000-0000-0000-0000-000000000002', -- ROT-CB-002 (Cadeira de Banho)
  'b0000000-0000-0000-0000-000000000002', -- Sebastião Ferreira Santos
  'ATRASADO',
  now() - INTERVAL '45 days',
  now() - INTERVAL '15 days', -- 15 days overdue (>10 days requirement)
  NULL,
  1,
  3,
  'magic-tok-overdue-sebastiao-002',
  480.00,
  '/contracts/contrato-ROT-EMP-2024-002-sebastiao.pdf',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><path d="M15 35 Q 70 5, 120 45 T 180 30" stroke="%2317458f" stroke-width="2" fill="none"/></svg>',
  'Marcos Valério (Secretário Rotary)',
  'RG 18.765.432-SP',
  NULL, NULL, NULL, NULL,
  false, NULL,
  'Empréstimo renovado 1 vez pelo portal. Prazo expirado há 15 dias; cobrança disparada via WhatsApp.'
),
(
  'c0000000-0000-0000-0000-000000000003',
  'ROT-EMP-2024-003',
  'e0000000-0000-0000-0000-000000000004', -- ROT-MUL-004 (Muletas Canadenses)
  'b0000000-0000-0000-0000-000000000001', -- Maria Aparecida da Silva
  'DEVOLVIDO',
  now() - INTERVAL '35 days',
  now() - INTERVAL '5 days',
  now() - INTERVAL '3 days',
  0,
  3,
  'magic-tok-returned-maria-003',
  160.00,
  '/contracts/contrato-ROT-EMP-2024-003-maria.pdf',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><path d="M10 40 Q 60 10, 110 40 T 190 20" stroke="%2317458f" stroke-width="2" fill="none"/></svg>',
  'Alberto Gentili (Rotariano)',
  'RG 12.345.678-SP',
  'BOM',
  'RECUPERACAO_ALTA',
  'HIGIENIZACAO',
  'Paciente recuperou locomoção plena. Item íntegro devolvido e encaminhado para assepsia.',
  true,
  now() - INTERVAL '3 days',
  'Devolução registrada com emissão digital do Termo de Quitação.'
)
ON CONFLICT (id) DO NOTHING;

-- 6.4 Seed Maintenance Logs (Asset Service & Sanitization History)
INSERT INTO public.maintenance_logs (
  equipment_id, maintenance_type, description, cost, technician_name, completed_at
) VALUES
(
  'e0000000-0000-0000-0000-000000000004', -- ROT-MUL-004
  'HIGIENIZACAO',
  'Higienização pós-devolução com quaternário de amônio e substituição preventiva das ponteiras de borracha.',
  25.00,
  'Voluntário Paulo',
  NULL
),
(
  'e0000000-0000-0000-0000-000000000005', -- ROT-CAM-005
  'MANUTENCAO_CORRETIVA',
  'Substituição do conjunto de manivela dentada e lubrificação das articulações da cabeceira da cama hospitalar.',
  180.00,
  'Oficina Mecânica São José',
  NULL
),
(
  'e0000000-0000-0000-0000-000000000001', -- ROT-CR-001
  'MANUTENCAO_PREVENTIVA',
  'Revisão preventiva semestral: aperto e alinhamento de raios, alinhamento de garfos e lubrificação de rolamentos blindados.',
  45.00,
  'Oficina do Rotary',
  now() - INTERVAL '60 days'
);

-- 6.5 Seed Loan Events Log (Audit Trail)
INSERT INTO public.loan_events_log (
  loan_id, event_type, old_status, new_status, notes, metadata, created_at
) VALUES
(
  'c0000000-0000-0000-0000-000000000001',
  'CREATED',
  NULL,
  'ATIVO',
  'Empréstimo formalizado presencialmente na sede do Rotary.',
  '{"channel": "presential", "term_days": 30}'::jsonb,
  now() - INTERVAL '15 days'
),
(
  'c0000000-0000-0000-0000-000000000002',
  'CREATED',
  NULL,
  'ATIVO',
  'Empréstimo formalizado para atendimento de paciente idosa.',
  '{"channel": "presential", "term_days": 30}'::jsonb,
  now() - INTERVAL '45 days'
),
(
  'c0000000-0000-0000-0000-000000000002',
  'RENEWED',
  'ATIVO',
  'ATIVO',
  'Empréstimo renovado pelo portal self-service (+30 dias).',
  '{"renewal_count": 1, "extension_days": 30}'::jsonb,
  now() - INTERVAL '20 days'
),
(
  'c0000000-0000-0000-0000-000000000002',
  'OVERDUE',
  'ATIVO',
  'ATRASADO',
  'Prazo de devolução expirado (D+1). Transicionado para atrasado pela automação cron.',
  '{"days_overdue": 1, "automated": true}'::jsonb,
  now() - INTERVAL '14 days'
),
(
  'c0000000-0000-0000-0000-000000000002',
  'OVERDUE_NOTIFICATION',
  'ATRASADO',
  'ATRASADO',
  'Notificação de cobrança WhatsApp (Estágio D+7) gerada para contato principal e contato secundário.',
  '{"stage": "D+7", "targets": ["primary", "secondary"]}'::jsonb,
  now() - INTERVAL '8 days'
),
(
  'c0000000-0000-0000-0000-000000000003',
  'RETURNED',
  'ATIVO',
  'DEVOLVIDO',
  'Devolução registrada com emissão do Termo de Quitação. Item encaminhado para higienização.',
  '{"quittance_issued": true, "condition": "BOM", "destination": "HIGIENIZACAO"}'::jsonb,
  now() - INTERVAL '3 days'
);

-- Re-enable triggers
SET session_replication_role = 'origin';
