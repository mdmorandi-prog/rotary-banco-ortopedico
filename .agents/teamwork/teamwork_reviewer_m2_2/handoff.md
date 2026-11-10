# Adversarial Review & Quality Audit Report: Milestone 2

**Reviewer**: Reviewer 2 / Adversarial Critic (`teamwork_reviewer_m2_2`)  
**Parent Agent**: `e6ed8630-0bc4-410c-839f-8a711a549475`  
**Date**: 2026-11-10T15:48:30Z  
**Project**: Rotary Banco Ortopédico  
**Working Directory**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`  
**State Folder**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_reviewer_m2_2`  
**Target Reviewed**: Milestone 2 - Supabase Schema, Migrations, Triggers, RLS, and Seed Data  

---

## Executive Summary & Verdict

**Verdict**: **REQUEST_CHANGES**

Milestone 2 provides a comprehensive PostgreSQL schema with excellent domain modeling, valid Brazilian seed CPFs, and complete Next.js/TypeScript build parity. However, rigorous adversarial stress-testing against an isolated live PostgreSQL 16 engine uncovered **two Critical defects** that compromise runtime functionality and data security:

1. **[CRITICAL FUNCTIONAL DEFECT] Total Inability to Insert New Loans**:
   Trigger `trg_loan_equipment_status_sync` is attached as `BEFORE INSERT OR UPDATE` on `public.loans`. Inside the function, it attempts `INSERT INTO public.loan_events_log (loan_id, ...) VALUES (NEW.id, ...)`. Because the trigger fires *before* the loan row is inserted into `public.loans`, the immediate foreign key constraint on `loan_events_log.loan_id REFERENCES public.loans(id)` is violated, causing **any attempt to create a new loan in the database to fail catastrophically**.
2. **[CRITICAL SECURITY VULNERABILITY] Public Anonymous Leak of All Loans**:
   RLS policy `"loans_anon_select_magic_token"` is defined as `TO anon USING (magic_token IS NOT NULL)`. Because `magic_token` is a mandatory `NOT NULL` column on all loans, this policy evaluates to `TRUE` for every record, **exposing 100% of loans, contract PDF URLs, digital signatures, witness data, and beneficiary foreign keys to unauthenticated public REST queries**.

---

## Findings

### Finding 1 [Critical] — Broken Loan Creation Trigger (`BEFORE INSERT` FK Violation)

- **What**: Every `INSERT INTO public.loans` with status `'ATIVO'` or `'ATRASADO'` fails with a foreign key constraint violation.
- **Where**: `supabase/migrations/001_initial_schema.sql`, lines 353–378 & line 520:
  ```sql
  CREATE TRIGGER trg_loan_equipment_status_sync
    BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued
    ON public.loans
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_loan_equipment_status();
  ```
- **Why this is a problem**:
  When a new loan is inserted, the trigger executes line 373:
  ```sql
  INSERT INTO public.loan_events_log (
    loan_id, event_type, new_status, notes, performed_by, metadata
  ) VALUES (
    NEW.id, 'CREATED', NEW.status, 'Empréstimo iniciado e comodato formalizado.', NEW.created_by,
    jsonb_build_object('equipment_id', NEW.equipment_id, 'expected_return_date', NEW.expected_return_date)
  );
  ```
  `public.loan_events_log` enforces:
  `loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE`.
  Because the trigger is `BEFORE INSERT`, the row with `id = NEW.id` does NOT exist in table `public.loans` yet. PostgreSQL halts execution immediately with:
  ```
  ERROR: insert or update on table "loan_events_log" violates foreign key constraint "loan_events_log_loan_id_fkey"
  DETAIL: Key (loan_id)=(...) is not present in table "loans".
  ```
  Consequently, **no comodato loan can ever be created in the system**.
- **Root Cause of Testing Blindspot**:
  1. The seed script wraps data in `SET session_replication_role = 'replica';`, bypassing triggers during migration.
  2. `scripts/verify-migration.mjs` only performs static string regex checks without running real DML transactions.
  3. The worker only tested an *invalid* duplicate insert on an already-loaned item (`ROT-CB-002`), which failed at the status check (`não está DISPONIVEL`) before reaching line 373. A valid loan insertion was never executed.
- **Suggested Fix**:
  Split the trigger logic into two triggers:
  1. `trg_loan_equipment_status_before`: A `BEFORE INSERT OR UPDATE` trigger on `public.loans` that handles availability checks, row locking (`FOR UPDATE`), equipment status updates (`EMPRESTADO`, `HIGIENIZACAO`, etc.), and timestamp defaults (`NEW.actual_return_date = now()`, `NEW.quittance_issued_at = now()`).
  2. `trg_loan_audit_log_after`: An `AFTER INSERT OR UPDATE` trigger on `public.loans` that inserts audit records into `public.loan_events_log`. At `AFTER` execution time, `NEW.id` is fully committed in `public.loans`, satisfying the foreign key constraint.

---

### Finding 2 [Critical] — Anonymous Public Read Policy Leaks All Loans Table Data

- **What**: RLS policy `"loans_anon_select_magic_token"` grants unauthenticated anonymous users global SELECT permission across all rows in `public.loans`.
- **Where**: `supabase/migrations/001_initial_schema.sql`, lines 584–587:
  ```sql
  DROP POLICY IF EXISTS "loans_anon_select_magic_token" ON public.loans;
  CREATE POLICY "loans_anon_select_magic_token"
    ON public.loans FOR SELECT
    TO anon USING (magic_token IS NOT NULL);
  ```
- **Why this is a problem**:
  `magic_token` is a `NOT NULL` column on `public.loans`. Therefore, `USING (magic_token IS NOT NULL)` is unconditionally true for every single row.
  When an anonymous user or web scraper queries Supabase/PostgREST (`GET /rest/v1/loans`), the database returns all loans, exposing:
  - `beneficiary_id`
  - `contract_pdf_url` (containing patient names, CPFs, medical notes, home addresses)
  - `signature_image_url` (digital signatures)
  - `witness_name` and `witness_document`
  - `replacement_value` and internal notes
  - `magic_token` values (which attackers can use to tamper with loan renewals)
  Furthermore, `001_initial_schema.sql` already provides the dedicated RPC function:
  `public.get_public_loan_by_magic_token(p_token text)`
  defined with `SECURITY DEFINER SET search_path = public`, which safely returns only sanitized, non-PII fields (`beneficiary_first_name`, `equipment_name`, `status`, `expected_return_date`) when supplied with a valid token.
  Likewise, policy `"loans_anon_update_renewal"` allows `anon` direct UPDATE on loans where `magic_token IS NOT NULL`, which is redundant and dangerous given the existence of `public.renew_loan_by_magic_token(p_token)`.
- **Suggested Fix**:
  Drop both direct `anon` table policies on `public.loans`:
  ```sql
  DROP POLICY IF EXISTS "loans_anon_select_magic_token" ON public.loans;
  DROP POLICY IF EXISTS "loans_anon_update_renewal" ON public.loans;
  ```
  Ensure all anonymous self-service operations exclusively utilize the `SECURITY DEFINER` RPC endpoints:
  - `public.get_public_loan_by_magic_token(p_token)`
  - `public.renew_loan_by_magic_token(p_token)`

---

### Finding 3 [Major] — Test Harness Lacks Runtime DML Invariant Execution

- **What**: `scripts/verify-migration.mjs` executes 80 static regular-expression pattern checks against the SQL file content, but executes zero SQL statements against a real or in-memory PostgreSQL engine.
- **Where**: `scripts/verify-migration.mjs`.
- **Why this is a problem**:
  Because `verify-migration.mjs` only verified regex matches (e.g. `check('Trigger trg_loan_equipment_status_sync bound to loans', /CREATE\s+TRIGGER.../)`), it reported 80/80 passed with 0 warnings, giving false confidence while the trigger was completely broken for all loan insertions.
- **Suggested Fix**:
  Incorporate a functional dry-run execution step (e.g., using `pg-mem` or an ephemeral container script) into the verification pipeline to execute:
  1. `INSERT INTO public.loans` on a available equipment (verifying success and equipment status transition).
  2. Direct `SELECT * FROM public.loans` under role `anon` (verifying zero records leaked).
  3. `public.renew_loan_by_magic_token` execution.

---

### Finding 4 [Minor] — Manual Transition from ATRASADO to ATIVO without Renewal Count Increment

- **What**: If an operator manually transitions an overdue loan from `ATRASADO` back to `ATIVO` without incrementing `renewal_count`, the equipment status is not updated back to `EMPRESTADO`.
- **Where**: `supabase/migrations/001_initial_schema.sql`, lines 455–466:
  The equipment status reset `UPDATE public.equipments SET status = 'EMPRESTADO'` is strictly nested under `ELSIF NEW.renewal_count > OLD.renewal_count THEN ... IF OLD.status = 'ATRASADO' AND NEW.status = 'ATIVO'`.
- **Suggested Fix**:
  Add a dedicated branch for status change from `ATRASADO` to `ATIVO`:
  ```sql
  ELSIF OLD.status = 'ATRASADO' AND NEW.status = 'ATIVO' THEN
    UPDATE public.equipments
    SET status = 'EMPRESTADO', updated_at = now()
    WHERE id = NEW.equipment_id;
  ```

---

## 1. Observation

1. **Automated Verification Suite Execution**:
   - Command: `Set-Location 'C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico'; node scripts/verify-migration.mjs`
   - Result: 80 passed, 0 warnings, 0 issues.
2. **TypeScript & Build Verification**:
   - `npx.cmd tsc --noEmit` exited with code 0 (zero errors).
   - `npm.cmd run build` exited with code 0 (Next.js production build succeeded).
3. **PostgreSQL 16 Live Engine Execution (`rotary_m2_rev2_pg` on port 54329)**:
   - Initial DDL execution: All 6 enums, 6 tables, 21 indexes, triggers, and RLS policies applied cleanly.
   - Seed Row Counts:
     * `equipments`: 8
     * `beneficiaries`: 2
     * `loans`: 3
     * `maintenance_logs`: 3
     * `loan_events_log`: 6
   - Beneficiaries CPF Checksum Validation:
     * Maria Aparecida da Silva: `123.456.789-09` -> Valid Modulo 11 check digits.
     * Sebastião Ferreira Santos: `987.654.321-00` -> Valid Modulo 11 check digits.
     * Patient Dona Francisca Santos: `321.654.987-91` -> Valid Modulo 11 check digits.
   - Partial Unique Index Concurrency Test:
     * Bypassing triggers with `session_replication_role = 'replica'` and attempting to insert a second active loan on `ROT-CR-001`:
     * Result: Threw `ERROR: duplicate key value violates unique constraint "idx_unique_active_loan_per_equipment"`.
   - Adversarial Loan Creation Test (`INSERT INTO loans` with `status = 'ATIVO'` on available item `ROT-AND-003`):
     * Result: Threw `ERROR: insert or update on table "loan_events_log" violates foreign key constraint "loan_events_log_loan_id_fkey"`.
   - Adversarial Anonymous Access Test (`SET ROLE anon; SELECT * FROM public.loans;`):
     * Result: Returned all 3 loans with full metadata and `magic_token`s.
   - RPC `public.get_public_loan_by_magic_token`:
     * Result: Successfully returned sanitized non-PII fields (`Sebastião`, `ROT-CB-002`, `ATIVO`).
   - RPC `public.renew_loan_by_magic_token`:
     * Result: Successfully incremented renewal count, updated return date, and enforced `max_renewals = 3` limit.

---

## 2. Logic Chain

1. **Trigger Architecture Defect**:
   - Line 520 defines `trg_loan_equipment_status_sync` as `BEFORE INSERT OR UPDATE`.
   - Line 373 executes `INSERT INTO public.loan_events_log (loan_id, ...) VALUES (NEW.id, ...)`.
   - Table `loan_events_log` has `loan_id REFERENCES public.loans(id)`.
   - In a `BEFORE INSERT` trigger, the row `NEW.id` is not present in `public.loans`.
   - The immediate FK constraint check fails and aborts the statement.
   - Therefore, no active loan can ever be created using standard SQL or the Supabase client.
2. **RLS Data Leakage**:
   - Line 586 sets `TO anon USING (magic_token IS NOT NULL)`.
   - In PostgreSQL RLS, `USING` determines which rows are returned by `SELECT`.
   - Since `magic_token` is NOT NULL on all rows, the expression evaluates to true for all rows.
   - An anonymous user querying the API receives every loan record in the database.
   - This violates LGPD and exposes sensitive legal contracts and signatures.

---

## 3. Caveats

- The local mock data layer (`src/lib/mock-store/`) operates independently of PostgreSQL and is unaffected by the SQL trigger bug during client-side demo mode.
- The PostgreSQL RPC endpoints (`get_public_loan_by_magic_token` and `renew_loan_by_magic_token`) are properly configured with `SECURITY DEFINER SET search_path = public` and operate safely once direct table RLS is tightened.

---

## 4. Conclusion

The schema foundation, data types, indexing, and seed data are high quality, but the migration cannot be approved in its current state due to the runtime trigger blocker on loan creation and the RLS anonymous read exposure.

Milestone 2 requires targeted remediation before advancing:
1. Split `trg_loan_equipment_status_sync` into a `BEFORE` trigger (status sync) and an `AFTER` trigger (audit logging).
2. Remove direct `anon` table policies on `public.loans` and rely exclusively on the secure RPCs.

---

## 5. Verification Method

To independently verify the defects and their fixes:

1. **Reproduce Loan Insertion Failure on PostgreSQL**:
   ```powershell
   docker run --rm --name rotary_m2_verify -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres -p 54329:5432 -d postgres:16-alpine
   Start-Sleep -Seconds 3
   Get-Content supabase\migrations\001_initial_schema.sql -Raw | docker exec -i rotary_m2_verify psql -U postgres -d postgres
   
   # Attempt to insert an active loan for available equipment ROT-AND-003:
   docker exec -i rotary_m2_verify psql -U postgres -d postgres -c "INSERT INTO public.loans (loan_code, equipment_id, beneficiary_id, status, expected_return_date, magic_token) VALUES ('TEST-001', 'e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'ATIVO', now() + INTERVAL '30 days', 'test-tok-001');"
   ```
   *Observed Failure*: `ERROR: insert or update on table "loan_events_log" violates foreign key constraint "loan_events_log_loan_id_fkey"`.

2. **Reproduce Anonymous RLS Data Leakage**:
   ```powershell
   docker exec -i rotary_m2_verify psql -U postgres -d postgres -c "GRANT SELECT ON public.loans TO anon; SET ROLE anon; SELECT id, loan_code, magic_token, contract_pdf_url FROM public.loans;"
   ```
   *Observed Failure*: All seed loans are returned to role `anon`.

3. **Cleanup**:
   ```powershell
   docker stop rotary_m2_verify
   ```
