# Handoff Report: Milestone 2 Iteration 2 — Trigger Architecture Remediation

**Explorer**: Trigger Architecture Remediation Explorer (`teamwork_explorer_m2_it2_1`)  
**Parent Agent**: Sub-Orchestrator M2 (`e6ed8630-0bc4-410c-839f-8a711a549475`)  
**Date**: 2026-11-10T16:08:00Z  
**Project**: Rotary Banco Ortopédico  
**Working Directory**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`  
**State Folder**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m2_it2_1`  
**Target Migration**: `supabase/migrations/001_initial_schema.sql`  
**Handoff Type**: Hard (Investigation complete, empirically validated on PostgreSQL 16)  

---

## Executive Summary

During Milestone 2 gate review, both Reviewers and Challengers confirmed a **Critical functional blocker** and a **High integrity flaw** in the trigger architecture of `supabase/migrations/001_initial_schema.sql`:
1. **Critical FK Violation on Loan Insertion**: The single unified trigger `trg_loan_equipment_status_sync` runs as `BEFORE INSERT OR UPDATE`. In a `BEFORE INSERT` trigger on `loans`, calling `INSERT INTO public.loan_events_log (loan_id, ...) VALUES (NEW.id, ...)` fails immediately with `ERROR: insert or update on table "loan_events_log" violates foreign key constraint "loan_events_log_loan_id_fkey"` because the parent loan record does not yet exist in `public.loans`. As a consequence, **zero new loans could be created in the system**.
2. **High Integrity Flaw — Dead Code on `equipment_id` Immutability**: The trigger omitted `equipment_id` from its `UPDATE OF ...` column list, allowing direct updates to `equipment_id` to bypass the immutability exception completely.
3. **Equipment State Desync on Overdue Recovery**: The equipment state reset (`ATRASADO -> EMPRESTADO`) was strictly nested under `renewal_count > OLD.renewal_count`, leaving equipment stuck in `ATRASADO` if an operator manually updated a loan back to `ATIVO` without a renewal increment.

This investigation formulates and empirically validates the **Trigger Architecture Remediation**:
- **Clean Trigger Split**:
  1. `trg_loan_equipment_status_before` (`BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued, equipment_id`): Handles equipment row-locking (`FOR UPDATE`), availability verification (`status = 'DISPONIVEL'`), equipment status synchronization (`EMPRESTADO`, `ATRASADO`, `HIGIENIZACAO`, `MANUTENCAO`), equipment immutability enforcement, un-overdue recovery (`ATRASADO -> ATIVO`), and `NEW` row timestamp defaulting (`actual_return_date = now()`, `quittance_issued_at = now()`).
  2. `trg_loan_events_log_after` (`AFTER INSERT OR UPDATE OF status, renewal_count, quittance_issued`): Handles audit logging into `public.loan_events_log`. At `AFTER` execution time, `loans.id` is fully committed and visible within the transaction.
- **Foreign Key Hardening**: Update `loan_events_log.loan_id` to `DEFERRABLE INITIALLY DEFERRED`. This acts as defense-in-depth against complex multi-table transactional workflows while guaranteeing strict referential integrity at commit.

---

## 1. Observation

### 1.1 Direct Baseline Observations in `supabase/migrations/001_initial_schema.sql`

- **Lines 240–249**:
  ```sql
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
  ```
  The foreign key `REFERENCES public.loans(id)` is non-deferrable (immediate check).

- **Lines 353–393 (Case 1: LOAN CREATION)**:
  ```sql
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'ATIVO' THEN
      SELECT status INTO v_equipment_current_status FROM public.equipments WHERE id = NEW.equipment_id FOR UPDATE;
      ...
      UPDATE public.equipments SET status = 'EMPRESTADO', updated_at = now() WHERE id = NEW.equipment_id;

      INSERT INTO public.loan_events_log (
        loan_id, event_type, new_status, notes, performed_by, metadata
      ) VALUES (
        NEW.id, 'CREATED', NEW.status, 'Empréstimo iniciado e comodato formalizado.', NEW.created_by,
        jsonb_build_object('equipment_id', NEW.equipment_id, 'expected_return_date', NEW.expected_return_date)
      );
    ...
  ```
  This child table insertion occurs during the `BEFORE INSERT` trigger lifecycle.

- **Lines 400–402 & Line 520 (Equipment Immutability Guard vs Trigger Event List)**:
  ```sql
  -- Lines 400-402:
  IF OLD.equipment_id != NEW.equipment_id THEN
    RAISE EXCEPTION 'Não é permitido alterar o equipamento de um contrato de comodato existente.';
  END IF;

  -- Line 520:
  CREATE TRIGGER trg_loan_equipment_status_sync
    BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued
    ON public.loans
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_loan_equipment_status();
  ```
  `equipment_id` is absent from `BEFORE INSERT OR UPDATE OF ...`.

- **Lines 455–466 (Overdue State Reversal Nested Under Renewal)**:
  ```sql
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
  ```
  If an operator manually transitions a loan from `ATRASADO` to `ATIVO` without incrementing `renewal_count`, lines 461–465 are unreachable.

### 1.2 Verbatim Reproduction on Live PostgreSQL 16 Engine

Using container `rotary_test_db` running PostgreSQL 16.15:

1. **Attempting Standard Loan Creation**:
   ```sql
   INSERT INTO public.loans (loan_code, equipment_id, beneficiary_id, status, expected_return_date, magic_token)
   VALUES ('TEST-LOAN-001', 'e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'ATIVO', now() + INTERVAL '30 days', 'tok-test-001');
   ```
   **Verbatim Error**:
   ```
   ERROR: insert or update on table "loan_events_log" violates foreign key constraint "loan_events_log_loan_id_fkey"
   DETAIL: Key (loan_id)=(2faf9f32-189e-4d6a-b26d-90cced6a1722) is not present in table "loans".
   CONTEXT: SQL statement "INSERT INTO public.loan_events_log (
           loan_id, event_type, new_status, notes, performed_by, metadata
         ) VALUES (
           NEW.id, 'CREATED', NEW.status, 'Empréstimo iniciado e comodato formalizado.', NEW.created_by,
           jsonb_build_object('equipment_id', NEW.equipment_id, 'expected_return_date', NEW.expected_return_date)
         )"
   PL/pgSQL function fn_sync_loan_equipment_status() line 34 at SQL statement
   ```

2. **Attempting Equipment Reassignment on Active Loan**:
   ```sql
   UPDATE public.loans 
   SET equipment_id = 'e0000000-0000-0000-0000-000000000006' 
   WHERE id = 'c0000000-0000-0000-0000-000000000001';
   ```
   **Verbatim Output**:
   ```
   UPDATE 1
   ```
   The contract equipment was modified without triggering the immutability check.

3. **Manual Overdue Resolution without Renewal Increment**:
   ```sql
   UPDATE public.loans SET status = 'ATIVO' WHERE id = 'c0000000-0000-0000-0000-000000000002';
   SELECT status FROM public.equipments WHERE id = 'e0000000-0000-0000-0000-000000000002';
   ```
   **Verbatim Output**:
   ```
   status: ATRASADO
   ```
   The loan is `ATIVO`, but the physical equipment remained flagged as `ATRASADO`.

### 1.3 Empirical Validation of the Proposed Remediation

Applying the formulated split triggers and deferred FK:
- **Test 1 (Active Loan Creation on `ROT-AND-003`)**:
  - `INSERT INTO loans` executed with code 0 (`INSERT 0 1`).
  - `equipments.status` updated from `DISPONIVEL` to `EMPRESTADO`.
  - `loan_events_log` recorded event `CREATED` with `new_status = 'ATIVO'`.
- **Test 2 (Equipment Reassignment Attempt)**:
  - `UPDATE public.loans SET equipment_id = ...` threw:
    `ERROR: Não é permitido alterar o equipamento de um contrato de comodato existente.`
- **Test 3 (Manual Overdue Transition `ATRASADO -> ATIVO`)**:
  - `UPDATE public.loans SET status = 'ATIVO'` executed with code 0.
  - `equipments.status` correctly reset from `ATRASADO` to `EMPRESTADO`.
- **Test 4 (Return Triage & Quittance)**:
  - `UPDATE public.loans SET status = 'DEVOLVIDO', return_condition = 'BOM', post_return_destination = 'HIGIENIZACAO', quittance_issued = true` executed with code 0.
  - `actual_return_date` defaulted to `now()`.
  - `quittance_issued_at` defaulted to `now()`.
  - `equipments.status` updated to `HIGIENIZACAO`.
  - `loan_events_log` recorded both `RETURNED` and `QUITTANCE_ISSUED`.
- **Test 5 (`SET CONSTRAINTS ALL IMMEDIATE;`)**:
  - Executing under `SET CONSTRAINTS ALL IMMEDIATE;` succeeded with code 0 because the parent loan row is committed prior to the `AFTER` trigger execution.

---

## 2. Logic Chain

1. **Premise 1 (Trigger Execution Lifecycle in PostgreSQL)**:
   - A `BEFORE INSERT` trigger fires *before* the new row is written to the underlying heap or index.
   - Any SQL statement executed inside the trigger that references `NEW.id` via a foreign key evaluates against the current database state.
   - If that foreign key is immediate (`NOT DEFERRABLE` or `DEFERRED` check not active), PostgreSQL inspects the parent table (`public.loans`), finds no record with primary key `NEW.id`, and aborts the transaction.

2. **Premise 2 (Role Separation Between BEFORE and AFTER Triggers)**:
   - **`BEFORE` triggers** have write-access to the `NEW` tuple. They are the only mechanism in PostgreSQL able to set default timestamps on the record being inserted/updated (`NEW.actual_return_date = now()`, `NEW.quittance_issued_at = now()`) and validate preconditions before disk writes.
   - `BEFORE` triggers are also optimal for acquiring pessimistic locks (`SELECT ... FOR UPDATE`) on referenced assets (`equipments`) to prevent double-booking race conditions.
   - **`AFTER` triggers** execute *after* the tuple has been written to the table. In an `AFTER INSERT OR UPDATE` trigger, the parent record is fully present in the transaction's visibility snapshot.
   - Inserting audit records into child tables (`public.loan_events_log`) during an `AFTER` trigger guarantees that immediate foreign key constraints on `loan_id` are unconditionally satisfied.

3. **Premise 3 (Event Filtering via `UPDATE OF ...`)**:
   - In PostgreSQL, specifying `UPDATE OF col1, col2, ...` restricts trigger firing strictly to statements modifying at least one of those columns.
   - Because `equipment_id` was omitted from line 520, PostgreSQL deliberately skipped firing `trg_loan_equipment_status_sync` on equipment changes.
   - Appending `equipment_id` to the `UPDATE OF` list ensures the immutability validation on lines 400–402 is always executed.

4. **Premise 4 (State Transition Decoupling)**:
   - Transitioning an overdue loan back to active (`OLD.status = 'ATRASADO' AND NEW.status = 'ATIVO'`) can occur either via automated/portal renewal (+30 days) OR via administrative adjustment by an operator.
   - In both cases, the physical equipment must return to `EMPRESTADO`.
   - Decoupling `OLD.status = 'ATRASADO' AND NEW.status = 'ATIVO'` from the renewal count check ensures that equipment status is always synchronized.

5. **Premise 5 (Evaluation of `DEFERRABLE INITIALLY DEFERRED`)**:
   - While the `AFTER` trigger makes child inserts succeed even with an immediate foreign key, configuring `FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED` provides significant architectural advantages:
     a) It permits transactional out-of-order inserts (e.g. migration tools, data repair scripts, or batch audit log imports where logs may be staged in the same transaction block).
     b) It eliminates all possible timing anomalies if complex ORM frameworks or batch loaders operate within multi-statement transactions.
     c) Referential integrity is mathematically guaranteed: if an invalid `loan_id` is inserted, PostgreSQL halts and rolls back the transaction at `COMMIT;`.
   - Therefore, the combination of **split BEFORE/AFTER triggers** AND **deferred foreign key** provides optimal structural correctness and defense-in-depth.

---

## 3. Caveats

1. **RLS Policy Adjustments**:
   - Direct anonymous table queries on `public.loans` (`loans_anon_select_magic_token` and `loans_anon_update_renewal`) represent security vulnerabilities as identified by Reviewers and Challengers. This trigger architecture operates cleanly under authenticated staff access and via the existing `SECURITY DEFINER` RPCs (`get_public_loan_by_magic_token` and `renew_loan_by_magic_token`). Direct anonymous table policies on `loans` should be dropped as part of Explorer 2's remediation.
2. **Static Regex Verifiers**:
   - `scripts/verify-migration.mjs` contains a regex check for the old trigger name `trg_loan_equipment_status_sync`. When applying this remediation to `001_initial_schema.sql`, the verification script must be updated to check for `trg_loan_equipment_status_before` and `trg_loan_events_log_after`.

---

## 4. Conclusion & Precise Concrete DDL

The author of the migration should replace the existing trigger and function in `supabase/migrations/001_initial_schema.sql` (lines 338–523) and update the table definition of `public.loan_events_log` (line 241).

### 4.1 Update Table Definition for `public.loan_events_log` (Line 241)

Replace:
```sql
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
```
With:
```sql
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
```

### 4.2 Drop Legacy Trigger & Function (Lines 517–523)

```sql
DROP TRIGGER IF EXISTS trg_loan_equipment_status_sync ON public.loans;
DROP FUNCTION IF EXISTS public.fn_sync_loan_equipment_status();
```

### 4.3 Implement `public.fn_loan_equipment_status_before()` & `trg_loan_equipment_status_before`

```sql
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
    END IF;

    RETURN NEW;
  END IF;

  -- --------------------------------------------------------------------------
  -- CASE 2: LOAN MODIFICATION (UPDATE)
  -- --------------------------------------------------------------------------
  IF TG_OP = 'UPDATE' THEN
    -- Invariant: Equipment ID cannot be altered on an existing contract
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
        NEW.quittance_issued_at = now();
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
  BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued, equipment_id
  ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.fn_loan_equipment_status_before();
```

### 4.4 Implement `public.fn_loan_events_log_after()` & `trg_loan_events_log_after`

```sql
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
    END IF;

    -- Subcase 2.4: Renewal event
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

    -- Subcase 2.5: Quittance issuance audit
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
```

---

## 5. Verification Method

To independently verify the trigger architecture remediation:

1. **Apply Migration to a Clean PostgreSQL Container**:
   ```powershell
   Get-Content supabase\migrations\001_initial_schema.sql -Raw | docker exec -i rotary_test_db psql -U postgres -d rotary_db
   ```

2. **Verify Active Loan Insertion**:
   ```sql
   INSERT INTO public.loans (loan_code, equipment_id, beneficiary_id, status, expected_return_date, magic_token)
   VALUES ('VERIFY-LOAN-001', 'e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'ATIVO', now() + INTERVAL '30 days', 'tok-verify-001');

   -- Must return EMPRESTADO
   SELECT status FROM public.equipments WHERE id = 'e0000000-0000-0000-0000-000000000003';

   -- Must return CREATED event
   SELECT event_type FROM public.loan_events_log WHERE loan_id = (SELECT id FROM public.loans WHERE loan_code = 'VERIFY-LOAN-001');
   ```

3. **Verify Equipment Immutability Guard**:
   ```sql
   -- Must throw exception 'Não é permitido alterar o equipamento de um contrato de comodato existente.'
   UPDATE public.loans 
   SET equipment_id = 'e0000000-0000-0000-0000-000000000007' 
   WHERE loan_code = 'VERIFY-LOAN-001';
   ```

4. **Verify Overdue State Reversal**:
   ```sql
   UPDATE public.loans SET status = 'ATRASADO' WHERE loan_code = 'VERIFY-LOAN-001';
   -- Equipment is ATRASADO
   SELECT status FROM public.equipments WHERE id = 'e0000000-0000-0000-0000-000000000003';

   -- Reset to ATIVO without renewal
   UPDATE public.loans SET status = 'ATIVO' WHERE loan_code = 'VERIFY-LOAN-001';
   -- Must return EMPRESTADO
   SELECT status FROM public.equipments WHERE id = 'e0000000-0000-0000-0000-000000000003';
   ```

5. **Execute Automated Adversarial Suites**:
   ```powershell
   node .agents/teamwork/teamwork_challenger_m2_1/stress-harness.mjs
   ```
   Both T6.2 (loan insertion) and T6.3 (equipment immutability check) must now report `[PASS]`.
