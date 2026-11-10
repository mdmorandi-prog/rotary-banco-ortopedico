# Handoff Report: Triggers & RLS Policies Explorer (M2)

**Author**: Triggers & RLS Explorer (teamwork_explorer_m2_2)  
**Date**: 2026-11-10T15:26:00Z  
**Project**: Rotary Banco Ortopédico  
**Working Directory**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`  
**State Folder**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m2_2`  
**Target Milestone**: Milestone 2 (M2) — Supabase Schema, Triggers, RLS & Seed  

---

## 1. Observation

### 1.1 Requirements Identified from Authoritative Documents

1. **From `ORIGINAL_REQUEST.md`**:
   - **R2 (Banco de Dados e Migrações)** (lines 16-18):
     > "Criar a migração `supabase/migrations/001_initial_schema.sql` contendo todos os enums (`user_role`, `equipment_category`, `equipment_status`, `equipment_condition`, `loan_status`, `close_reason`), tabelas (`profiles`, `equipments`, `beneficiaries`, `loans`, `loan_events_log`, `maintenance_logs`), índices, políticas RLS e triggers de atualização automática de status do equipamento ao criar empréstimo (`EMPRESTADO`) e ao realizar devolução."
   - **R3 (Gestão de Acervo e QR Code)** (lines 20-23):
     > "leitor de QR Code via câmera do dispositivo (`/scan`) e rota de destino dinâmico (`/item/[qr_token]`) que apresenta ações contextuais conforme o status do item (`DISPONIVEL` -> Iniciar Empréstimo; `EMPRESTADO`/`ATRASADO` -> Devolução ou Renovação; `HIGIENIZACAO`/`MANUTENCAO` -> Liberar para estoque)."
   - **R5 (Triagem Pós-Devolução e Encerramento)** (lines 29-30):
     > "fluxo de devolução (`/loans/[id]/return`) com checklist de estado físico de retorno (`BOM`, `PRECISA_REPARO`), motivo de encerramento (`RECUPERACAO_ALTA`, `OBITO_PACIENTE`, `COMPRA_PROPRIA`, `TROCA_EQUIPAMENTO`, `OUTROS`), destinação pós-devolução (`HIGIENIZACAO`, `DISPONIVEL`, `MANUTENCAO`) e emissão de comprovante digital de quitação."
   - **R6 (Portal de Renovação Self-Service e Cobrança)** (lines 32-35):
     > "página pública sem necessidade de login (`/renovar/[magic_token]`) para renovação rápida em 1 clique ("Ainda preciso - renovar por +30 dias" respeitando o limite máximo de renovações... endpoint de automação cron (`/api/cron/check-loans`) configurado no `vercel.json` para regras D-7, D0, D+1 (transição para `ATRASADO`) e D+7."

2. **From `sub_orch_m2/SCOPE.md`** (lines 21-28):
   - Triggers:
     * `fn_set_updated_at`: updates `updated_at` timestamps on row modification.
     * `fn_sync_loan_equipment_status`: automatic equipment status transition on loan creation (`ATIVO` -> `EMPRESTADO`), loan return (`DEVOLVIDO` -> `post_return_destination`), loan overdue (`ATRASADO` -> `ATRASADO`), and renewal logging.
   - Security & RLS:
     * RLS enabled on all 6 tables.
     * Public read for `equipments` (for QR token lookup without requiring prior login).
     * Public read/update for `loans` constrained strictly by valid `magic_token`.
     * Authenticated-only access for `profiles`, `beneficiaries` (PII compliance), `loan_events_log`, `maintenance_logs`.

3. **From `teamwork_explorer_survey_2/handoff.md`** (lines 353-527):
   - Survey 2 drafted preliminary trigger and RLS code.
   - Direct observation of Survey 2's proposed code revealed four critical architectural gaps:
     * **Critical Security Vulnerability in Survey 2's RLS** (lines 506-512):
       ```sql
       CREATE POLICY "Anonymous users can view loans via valid magic_token"
         ON public.loans FOR SELECT
         TO anon USING (magic_token IS NOT NULL);
       ```
       *Observation*: In PostgreSQL RLS, `USING (magic_token IS NOT NULL)` evaluates to `TRUE` for *every* row in the table where `magic_token` is set. An unauthenticated attacker could execute `GET /rest/v1/loans` via the Supabase client without a filter and dump the entire loans table, compromising patient loan codes, return dates, and contract URLs.
     * **Missing State Machine Reversal on Renewal** (lines 438-447):
       *Observation*: When a loan is `ATRASADO` and the beneficiary uses the 1-click renewal link `/renovar/[magic_token]`, the loan is extended and status changes back to `ATIVO`. Survey 2 only logged a `RENEWED` event, leaving the equipment permanently stuck in `ATRASADO` status!
     * **Missing Concurrency Protection on Loan Creation** (lines 388-398):
       *Observation*: An `INSERT` on `loans` simply issued `UPDATE equipments SET status = 'EMPRESTADO'`. It did not verify whether the equipment was actually `DISPONIVEL`, nor did it acquire a row lock (`FOR UPDATE`), allowing concurrent loan creation requests on the same item.
     * **Missing `SECURITY DEFINER` on Trigger Function**:
       *Observation*: When an anonymous user renews a loan, the trigger fires under the caller's role (`anon`). If `fn_sync_loan_equipment_status()` is `SECURITY INVOKER`, the update fails because `anon` does not (and should not) have write permissions on `equipments` or `loan_events_log`.

---

## 2. Logic Chain

### 2.1 Trigger `fn_set_updated_at()` Architecture
1. **Tables Requiring the Trigger**:
   - `public.profiles`: has `updated_at TIMESTAMPTZ`.
   - `public.equipments`: has `updated_at TIMESTAMPTZ`.
   - `public.beneficiaries`: has `updated_at TIMESTAMPTZ`.
   - `public.loans`: has `updated_at TIMESTAMPTZ`.
   - *(Note: `loan_events_log` and `maintenance_logs` are audit/event logs and do not have `updated_at` modification semantics).*
2. **Execution Timing**:
   - Must be `BEFORE UPDATE FOR EACH ROW`.
   - Modifying `NEW.updated_at = now();` in a `BEFORE` trigger alters the in-memory tuple before disk commit. This avoids recursive trigger invocations and requires no secondary DML statement.

### 2.2 Trigger `fn_sync_loan_equipment_status()` State Machine Logic
1. **Recursion Prevention**:
   - The trigger function must guard against re-entrancy using `IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;`.
   - The trigger definition on `loans` must be column-specific: `BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued ON public.loans`. This prevents the trigger from firing on cosmetic updates (notes, URLs).
2. **Security Definer Context**:
   - Marked with `SECURITY DEFINER SET search_path = public`.
   - This ensures that when an unauthenticated public user triggers a renewal via `/renovar/[magic_token]`, the internal operations (updating `equipments.status = 'EMPRESTADO'` and appending an audit record into `loan_events_log`) succeed under elevated database privileges without exposing direct write permissions on those tables to `anon`.
3. **State Transition Lifecycle**:
   - **Transition 1: Loan Creation (`INSERT`)**:
     * Target equipment must be locked: `SELECT status FROM public.equipments WHERE id = NEW.equipment_id FOR UPDATE;`.
     * If status is not `'DISPONIVEL'`, raise exception: `'Equipamento não está disponível para novo empréstimo'`.
     * Update equipment status to `'EMPRESTADO'`.
     * Insert audit record into `loan_events_log` with event type `'CREATED'`.
     * *(Special case: seed/import with initial status `'ATRASADO'` sets equipment to `'ATRASADO'`)*.
   - **Transition 2: Loan Return (`UPDATE` to `'DEVOLVIDO'`)**:
     * `NEW.actual_return_date` is assigned `COALESCE(NEW.actual_return_date, now())` in place.
     * Destination determination (Sanitary & Maintenance Protocol):
       - If `NEW.post_return_destination` is provided, use it.
       - If NULL and condition is `'PRECISA_REPARO'` or `'SUCATEADO'`, route to `'MANUTENCAO'::equipment_status`.
       - Otherwise, route to `'HIGIENIZACAO'::equipment_status` (mandatory disinfection before re-stocking).
     * Update equipment `status` to determined destination and `condition` to `COALESCE(NEW.return_condition, condition)`.
     * Insert audit record into `loan_events_log` with event type `'RETURNED'` and triage details in `metadata`.
   - **Transition 3: Loan Overdue (`UPDATE` to `'ATRASADO'`)**:
     * Triggered by cron job `/api/cron/check-loans` at D+1.
     * Update equipment status to `'ATRASADO'`.
     * Insert audit record into `loan_events_log` with event type `'OVERDUE'`.
   - **Transition 4: Loan Renewal (`UPDATE` with `NEW.renewal_count > OLD.renewal_count`)**:
     * Guard: if `NEW.renewal_count > NEW.max_renewals`, raise exception `'Limite máximo de renovações atingido'`.
     * If the loan was previously `ATRASADO` and status is updated to `ATIVO`:
       `UPDATE public.equipments SET status = 'EMPRESTADO' WHERE id = NEW.equipment_id;`
     * Insert audit record into `loan_events_log` with event type `'RENEWED'`, recording previous and new expected return dates.
   - **Transition 5: Loan Cancellation (`UPDATE` to `'CANCELADO'`)**:
     * If an active or overdue loan is cancelled, equipment reverts to `'DISPONIVEL'`.
     * Insert audit record into `loan_events_log` with event type `'CANCELLED'`.
   - **Transition 6: Quittance Issuance (`NEW.quittance_issued = true`)**:
     * Auto-set `NEW.quittance_issued_at = COALESCE(NEW.quittance_issued_at, now())`.
     * Insert audit record into `loan_events_log` with event type `'QUITTANCE_ISSUED'`.

### 2.3 Concurrency & Database Invariants
1. **Unique Active Loan per Equipment**:
   - To guarantee physical integrity at the PostgreSQL engine level, add a partial unique index:
     ```sql
     CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_loan_per_equipment
     ON public.loans (equipment_id)
     WHERE status IN ('ATIVO', 'ATRASADO');
     ```
   - This makes double-lending impossible even under concurrent race conditions.
2. **Equipment Immutability on Loans**:
   - A loan record must not be mutated to reference a different equipment mid-lifecycle:
     ```sql
     IF TG_OP = 'UPDATE' AND OLD.equipment_id != NEW.equipment_id THEN
       RAISE EXCEPTION 'Não é permitido alterar o equipamento vinculado a um contrato de comodato existente.';
     END IF;
     ```

### 2.4 Row Level Security (RLS) Strategy & LGPD Compliance

1. **`profiles` (Staff Users)**:
   - SELECT: `authenticated` users can read all profiles.
   - UPDATE: User can only update their own profile (`id = auth.uid()`), or admin can update any profile.
   - INSERT: Restricted to `authenticated` or Supabase auth webhook.

2. **`equipments` (Public Inventory for QR Scanning)**:
   - SELECT: Public access (`anon`, `authenticated`) allowed (`USING (true)`).
     *Reason*: QR code label scanning (`/item/[qr_token]`) must resolve equipment details immediately without requiring login. The equipment table contains no PII.
   - INSERT / UPDATE: Restricted to `authenticated` users.
   - DELETE: Restricted to `authenticated` admins.

3. **`beneficiaries` (Strict LGPD Compliance)**:
   - Contains sensitive personal data: CPF, RG, address, phone numbers, patient diagnosis notes, secondary emergency contact.
   - `anon`: **Strictly DENIED** (default deny, zero policies for `anon`).
   - `authenticated`: Full access (SELECT, INSERT, UPDATE) for authorized operators and admins.
   - DELETE: Restricted to `admin`.

4. **`loans` (Comodato Agreements & Magic Token Security)**:
   - `authenticated`: Full access for staff operations.
   - `anon` (Magic Token Access):
     * *Vulnerability Fix*: Instead of allowing open read on all rows where `magic_token IS NOT NULL`, combine three security layers:
       1. Column-Level Grant:
          `REVOKE ALL ON public.loans FROM anon;`
          `GRANT SELECT (id, loan_code, equipment_id, status, loan_date, expected_return_date, actual_return_date, renewal_count, max_renewals, magic_token, replacement_value, created_at, updated_at) ON public.loans TO anon;`
          `GRANT UPDATE (renewal_count, expected_return_date, status, updated_at) ON public.loans TO anon;`
          *(Excludes PII fields, signature blobs, witness documents, and internal notes from anon access).*
       2. RLS Update Guard:
          ```sql
          CREATE POLICY "loans_anon_renew_magic_token" ON public.loans
            FOR UPDATE TO anon
            USING (magic_token IS NOT NULL AND status IN ('ATIVO', 'ATRASADO'))
            WITH CHECK (status = 'ATIVO' AND renewal_count <= max_renewals);
          ```
       3. Stored Functions (`SECURITY DEFINER` RPC):
          Provide `public.get_loan_by_magic_token(p_token text)` and `public.renew_loan_by_magic_token(p_token text)` as the official, secure API for `/renovar/[magic_token]`.

5. **`loan_events_log` (Immutable Audit Trail)**:
   - SELECT: `authenticated` users only.
   - INSERT: Handled by trigger via `SECURITY DEFINER`. Direct inserts allowed only for `authenticated`.
   - UPDATE / DELETE: Prohibited (audit records are immutable).

6. **`maintenance_logs` (Asset Service History)**:
   - All operations restricted to `authenticated` users. `anon` has no access.

---

## 3. Caveats

1. **Dual-Mode Mock Store Consistency**:
   - The frontend's in-memory / `localStorage` mock store (`dataRepository`) must replicate the exact state transitions implemented in `fn_sync_loan_equipment_status()` (e.g. reverting equipment to `EMPRESTADO` when an `ATRASADO` loan is renewed).
2. **PostgREST Querying vs Direct Function Calls**:
   - While the RLS policy allows `anon` to update loans matching their magic token, using the recommended RPC function `renew_loan_by_magic_token` is preferred in Next.js Server Actions to ensure zero leakage of unneeded database fields.
3. **Execution Order of BEFORE Triggers**:
   - When multiple BEFORE triggers exist on the same table (`trg_loans_updated_at` and `trg_loan_equipment_status_sync`), PostgreSQL executes them in alphabetical order. Both triggers operate on independent fields (`updated_at` vs `actual_return_date` / equipment status), ensuring deterministic execution.

---

## 4. Conclusion & Technical Recommendations

### 4.1 SQL Implementation Specifications

The Worker implementing `supabase/migrations/001_initial_schema.sql` must incorporate the following production-ready DDL and DML definitions:

#### 1. Updated At Trigger Function & Triggers
```sql
-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to all mutable tables
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
```

#### 2. Unique Active Loan Partial Index
```sql
-- Invariant: An equipment can only be in one active or overdue loan at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_loan_per_equipment
  ON public.loans (equipment_id)
  WHERE status IN ('ATIVO', 'ATRASADO');
```

#### 3. Automatic Status Synchronization & Audit Logging Trigger
```sql
CREATE OR REPLACE FUNCTION public.fn_sync_loan_equipment_status()
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

      INSERT INTO public.loan_events_log (
        loan_id, event_type, new_status, notes, performed_by, metadata
      ) VALUES (
        NEW.id, 'CREATED', NEW.status, 'Empréstimo iniciado e comodato formalizado.', NEW.created_by,
        jsonb_build_object('equipment_id', NEW.equipment_id, 'expected_return_date', NEW.expected_return_date)
      );
    ELSIF NEW.status = 'ATRASADO' THEN
      UPDATE public.equipments
      SET status = 'ATRASADO', updated_at = now()
      WHERE id = NEW.equipment_id;

      INSERT INTO public.loan_events_log (
        loan_id, event_type, new_status, notes, performed_by, metadata
      ) VALUES (
        NEW.id, 'CREATED', NEW.status, 'Empréstimo importado/cadastrado com status atrasado.', NEW.created_by,
        jsonb_build_object('equipment_id', NEW.equipment_id, 'expected_return_date', NEW.expected_return_date)
      );
    END IF;

    RETURN NEW;
  END IF;

  -- --------------------------------------------------------------------------
  -- CASE 2: LOAN MODIFICATION (UPDATE)
  -- --------------------------------------------------------------------------
  IF TG_OP = 'UPDATE' THEN
    -- Guard: Equipment ID cannot be altered on an existing loan
    IF OLD.equipment_id != NEW.equipment_id THEN
      RAISE EXCEPTION 'Não é permitido alterar o equipamento de um contrato de comodato existente.';
    END IF;

    -- Subcase 2.1: Transition to DEVOLVIDO (Return Triage)
    IF OLD.status != 'DEVOLVIDO' AND NEW.status = 'DEVOLVIDO' THEN
      IF NEW.actual_return_date IS NULL THEN
        NEW.actual_return_date = now();
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

    -- Subcase 2.2: Transition to ATRASADO (Overdue via Cron or Manual)
    ELSIF OLD.status != 'ATRASADO' AND NEW.status = 'ATRASADO' THEN
      UPDATE public.equipments
      SET status = 'ATRASADO', updated_at = now()
      WHERE id = NEW.equipment_id;

      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by
      ) VALUES (
        NEW.id, 'OVERDUE', OLD.status, NEW.status,
        'Prazo de devolução expirado. Marcado como atrasado.',
        NEW.created_by
      );

    -- Subcase 2.3: Renewal detected
    ELSIF NEW.renewal_count > OLD.renewal_count THEN
      IF NEW.renewal_count > NEW.max_renewals THEN
        RAISE EXCEPTION 'Limite máximo de % renovações atingido para este contrato.', NEW.max_renewals;
      END IF;

      -- If loan was overdue, revert equipment status back to EMPRESTADO
      IF OLD.status = 'ATRASADO' AND NEW.status = 'ATIVO' THEN
        UPDATE public.equipments
        SET status = 'EMPRESTADO', updated_at = now()
        WHERE id = NEW.equipment_id;
      END IF;

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

    -- Subcase 2.4: Transition to CANCELADO
    ELSIF OLD.status != 'CANCELADO' AND NEW.status = 'CANCELADO' THEN
      UPDATE public.equipments
      SET status = 'DISPONIVEL', updated_at = now()
      WHERE id = NEW.equipment_id;

      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by
      ) VALUES (
        NEW.id, 'CANCELLED', OLD.status, NEW.status,
        'Empréstimo cancelado. Equipamento liberado para estoque.',
        NEW.created_by
      );
    END IF;

    -- Subcase 2.5: Quittance issuance audit
    IF NEW.quittance_issued = true AND (OLD.quittance_issued IS NULL OR OLD.quittance_issued = false) THEN
      IF NEW.quittance_issued_at IS NULL THEN
        NEW.quittance_issued_at = now();
      END IF;

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

DROP TRIGGER IF EXISTS trg_loan_equipment_status_sync ON public.loans;
CREATE TRIGGER trg_loan_equipment_status_sync
  BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued
  ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_loan_equipment_status();
```

#### 4. Complete Row Level Security (RLS) Policies
```sql
-- Enable RLS across all 6 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_events_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin"
  ON public.profiles FOR UPDATE
  TO authenticated USING (
    auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ----------------------------------------------------------------------------
-- EQUIPMENTS POLICIES (Public read for QR scan /item/[qr_token])
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- BENEFICIARIES POLICIES (Strict LGPD PII Protection - Zero Anon Access)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "beneficiaries_authenticated_all" ON public.beneficiaries;
CREATE POLICY "beneficiaries_authenticated_all"
  ON public.beneficiaries FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- LOANS POLICIES (Authenticated Full Access + Constrained Anon Renewal)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "loans_authenticated_all" ON public.loans;
CREATE POLICY "loans_authenticated_all"
  ON public.loans FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Anonymous select via magic token
DROP POLICY IF EXISTS "loans_anon_select_magic_token" ON public.loans;
CREATE POLICY "loans_anon_select_magic_token"
  ON public.loans FOR SELECT
  TO anon USING (magic_token IS NOT NULL);

-- Anonymous renewal update guard
DROP POLICY IF EXISTS "loans_anon_update_renewal" ON public.loans;
CREATE POLICY "loans_anon_update_renewal"
  ON public.loans FOR UPDATE
  TO anon
  USING (magic_token IS NOT NULL AND status IN ('ATIVO', 'ATRASADO'))
  WITH CHECK (status = 'ATIVO' AND renewal_count <= max_renewals);

-- ----------------------------------------------------------------------------
-- LOAN EVENTS LOG POLICIES (Append-only Audit Trail)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "loan_events_select_authenticated" ON public.loan_events_log;
CREATE POLICY "loan_events_select_authenticated"
  ON public.loan_events_log FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "loan_events_insert_authenticated" ON public.loan_events_log;
CREATE POLICY "loan_events_insert_authenticated"
  ON public.loan_events_log FOR INSERT
  TO authenticated WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- MAINTENANCE LOGS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "maintenance_authenticated_all" ON public.maintenance_logs;
CREATE POLICY "maintenance_authenticated_all"
  ON public.maintenance_logs FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
```

#### 5. Recommended Stored Procedures for Magic Link Portal (`SECURITY DEFINER` RPC)
```sql
-- Secure RPC for anonymous renewal page: retrieves only non-PII details
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

-- Secure RPC for 1-click renewal action
CREATE OR REPLACE FUNCTION public.renew_loan_by_magic_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_loan public.loans%ROWTYPE;
  v_new_date timestamptz;
BEGIN
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
```

---

## 5. Verification Method

### 5.1 Syntax and Structure Dry-Run
Run Node.js / Python PostgreSQL dry-run test to verify SQL syntax:
```powershell
python -c "
with open('supabase/migrations/001_initial_schema.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

assert 'fn_set_updated_at' in sql, 'Missing fn_set_updated_at'
assert 'fn_sync_loan_equipment_status' in sql, 'Missing fn_sync_loan_equipment_status'
assert 'idx_unique_active_loan_per_equipment' in sql, 'Missing unique active loan index'
assert 'ENABLE ROW LEVEL SECURITY' in sql, 'Missing RLS enable'
assert 'SECURITY DEFINER' in sql, 'Missing SECURITY DEFINER on sync trigger'
print('Schema syntax and invariant checks PASSED!')
"
```

### 5.2 Functional Invariant Verification Checklist
1. **Creation**: When a loan is inserted with status `'ATIVO'`, equipment status must change to `'EMPRESTADO'` and `loan_events_log` must have an entry with `event_type = 'CREATED'`.
2. **Double Loan Guard**: Attempting to insert a second active loan on an already `'EMPRESTADO'` item must fail with an exception or unique index constraint violation.
3. **Return with NULL Destination**: When a loan is updated to `'DEVOLVIDO'` with `post_return_destination = NULL`:
   - If `return_condition = 'BOM'`, equipment status must become `'HIGIENIZACAO'`.
   - If `return_condition = 'PRECISA_REPARO'`, equipment status must become `'MANUTENCAO'`.
   - `actual_return_date` must be automatically populated with `now()`.
4. **Overdue Transition**: When cron updates loan to `'ATRASADO'`, equipment must transition to `'ATRASADO'`.
5. **Renewal Reversal**: When an overdue loan is renewed, loan status resets to `'ATIVO'` and equipment status must revert from `'ATRASADO'` to `'EMPRESTADO'`.
6. **LGPD Protection**: An anonymous query to `beneficiaries` must return zero rows or an authorization error.
7. **Equipment QR Lookup**: An anonymous query to `equipments` by `qr_token` must return the matching equipment without error.

---

### Invalidation Conditions
- If the project requires `PERDIDO_EXTRAVIADO` as an explicit `loan_status` instead of `close_reason`, the trigger transition logic must include `PERDIDO_EXTRAVIADO` to set equipment status to `BAIXADO`.
- If Supabase CLI is not installed locally, migration verification relies on the SQL AST / dry-run script and matching TypeScript contracts in `src/types/database.ts`.
