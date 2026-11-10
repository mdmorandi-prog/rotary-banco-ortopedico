# Review & Adversarial Challenge Report: Milestone 2 (Supabase Schema & TypeScript Types)

**Reviewer**: Reviewer 1 (teamwork_reviewer_m2_1)  
**Roles**: Reviewer, Adversarial Critic  
**Date**: 2026-11-10T15:52:00Z  
**Verdict**: **`REQUEST_CHANGES`**  
**Working Directory**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`  
**State Folder**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_reviewer_m2_1`  

---

## Review Summary

**Verdict**: **`REQUEST_CHANGES`**

The schema implementation in `supabase/migrations/001_initial_schema.sql` exhibits high structural quality, extensive domain coverage (6 enums, 6 tables, 21 indexes, RLS, RPCs, rich seed dataset), and passes both `node scripts/verify-migration.mjs` (80/80 checks) and Next.js static build (`tsc --noEmit`).

However, adversarial stress testing against a live, clean PostgreSQL 16 engine container uncovered **one Critical functional blocker** and **two Major security/integrity flaws**:
1. **[Critical] Loan Creation Crashes via Foreign Key Violation**: `trg_loan_equipment_status_sync` runs as a `BEFORE INSERT` trigger on `loans` and immediately inserts into `loan_events_log(loan_id, ...)`. Because the loan row has not been inserted into `public.loans` yet, PostgreSQL raises an immediate foreign key constraint violation (`loan_events_log_loan_id_fkey`). As a result, **no new loan can ever be created** through `INSERT INTO loans`.
2. **[Major] RLS Policy Exposes Entire Loans Table to Public (Data Leakage & Mass Tampering)**: The policy `loans_anon_select_magic_token` uses `TO anon USING (magic_token IS NOT NULL)`. Because `magic_token` is NOT NULL on all rows, unauthenticated users can dump every loan in the database via PostgREST. Furthermore, `loans_anon_update_renewal` allows anonymous users to update all active/overdue loans simultaneously.
3. **[Major] Immutability Invariant for `equipment_id` is Dead Code**: The trigger `trg_loan_equipment_status_sync` is declared `BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued`. It does not listen to `equipment_id`, allowing operators or scripts to alter `equipment_id` without firing the trigger or raising the intended exception.

---

## 1. Observation

### 1.1 Verbatim Commands and Outputs

1. **Dry-Run Validation Script**:
   - Command: `node scripts/verify-migration.mjs`
   - Result:
     ```
     Running Schema & Seed Dry-Run Verification on: ...\001_initial_schema.sql
     === VERIFICATION SUMMARY ===
     Passes: 80
     Warnings: 0
     Issues: 0
     >>> ALL 80 CHECKS PASSED SUCCESSFULLY! <<<
     ```

2. **TypeScript & Build Verification**:
   - Commands:
     ```powershell
     npx.cmd tsc --noEmit
     npm.cmd run build
     ```
   - Result: Both commands exited with code 0 (zero TypeScript errors, Next.js 14 production build succeeded).

3. **Live PostgreSQL 16 Engine Execution** (Docker container `rotary_reviewer_m2_pg` on port 54330):
   - Command: `Get-Content supabase\migrations\001_initial_schema.sql -Raw | docker exec -i rotary_reviewer_m2_pg psql -U postgres -d postgres`
   - Result: All DDL statements, triggers, functions, and seed rows (8 equipments, 2 beneficiaries, 3 loans, 3 maintenance logs, 6 loan events) executed successfully without errors.

4. **Adversarial Test: Loan Creation on Available Equipment (`ROT-AND-003`)**:
   - Command:
     ```sql
     INSERT INTO public.loans (
       loan_code, equipment_id, beneficiary_id, status, expected_return_date, magic_token
     ) VALUES (
       'ROT-EMP-TEST-NEW',
       'e0000000-0000-0000-0000-000000000003',
       'b0000000-0000-0000-0000-000000000001',
       'ATIVO',
       now() + INTERVAL '30 days',
       'magic-tok-test-new-999'
     );
     ```
   - Verbatim Error:
     ```
     ERROR: insert or update on table "loan_events_log" violates foreign key constraint "loan_events_log_loan_id_fkey"
     DETAIL: Key (loan_id)=(f744912d-7af3-4456-9ea5-f130823fde1f) is not present in table "loans".
     CONTEXT: SQL statement "INSERT INTO public.loan_events_log (
             loan_id, event_type, new_status, notes, performed_by, metadata
           ) VALUES (
             NEW.id, 'CREATED', NEW.status, 'Empréstimo iniciado e comodato formalizado.', NEW.created_by,
             jsonb_build_object('equipment_id', NEW.equipment_id, 'expected_return_date', NEW.expected_return_date)
           )"
     PL/pgSQL function fn_sync_loan_equipment_status() line 34 at SQL statement
     ```

5. **Adversarial Test: Anonymous RLS Table Dumping**:
   - Command:
     ```sql
     SET ROLE anon;
     SELECT loan_code, replacement_value, magic_token FROM public.loans;
     ```
   - Verbatim Output:
     ```
         loan_code     | replacement_value |           magic_token           
     ------------------+-------------------+---------------------------------
      ROT-EMP-2024-001 |            850.00 | magic-tok-active-maria-001
      ROT-EMP-2024-002 |            480.00 | magic-tok-overdue-sebastiao-002
      ROT-EMP-2024-003 |            160.00 | magic-tok-returned-maria-003
     (3 rows)
     ```

6. **Adversarial Test: Equipment Immutability Bypass**:
   - Command:
     ```sql
     UPDATE public.loans 
     SET equipment_id = 'e0000000-0000-0000-0000-000000000003' 
     WHERE id = 'c0000000-0000-0000-0000-000000000001';
     ```
   - Verbatim Output:
     ```
     UPDATE 1
     ```
     (No exception was thrown; the update succeeded, modifying the equipment reference on an existing comodato contract).

---

## 2. Logic Chain

1. **Why the Dry-Run Script and Seed Passed Despite the FK Blocker**:
   - In `001_initial_schema.sql` (line 693), the seed ingestion is surrounded by:
     `SET session_replication_role = 'replica';` ... `SET session_replication_role = 'origin';`
   - In PostgreSQL, setting `session_replication_role = 'replica'` suppresses triggers and foreign key constraint checks. As a consequence, the seed rows bypassed `trg_loan_equipment_status_sync`.
   - `scripts/verify-migration.mjs` performs purely static regex scanning of SQL text and did not execute runtime DML.
   - The worker tested only inserting an active loan for an equipment that was *already* `EMPRESTADO` (`ROT-CB-002`). That check threw an exception on line 366 *before* reaching the `INSERT INTO loan_events_log` on line 373.
   - Therefore, the runtime failure on creating a valid loan went completely undetected until this adversarial review.

2. **Root Cause of the Foreign Key Failure**:
   - `loans` trigger `trg_loan_equipment_status_sync` is defined as `BEFORE INSERT OR UPDATE`.
   - In a `BEFORE INSERT` trigger, the row represented by `NEW` does not exist in `public.loans`.
   - When the trigger function executes `INSERT INTO public.loan_events_log (loan_id, ...) VALUES (NEW.id, ...)`, PostgreSQL evaluates the foreign key `FOREIGN KEY (loan_id) REFERENCES public.loans(id)`. Because the foreign key is `NOT DEFERRABLE INITIALLY IMMEDIATE` by default, PostgreSQL immediately looks up `NEW.id` in `loans`, finds nothing, and aborts the transaction with an FK violation.
   - **Remediation verified**: In `public.loan_events_log`, modifying the constraint to:
     ```sql
     loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
     ```
     defers the referential integrity check to transaction/statement commit, at which point the loan row exists in `loans`. Testing this fix in the PostgreSQL engine confirmed that loan creation succeeds, equipment is set to `EMPRESTADO`, and `CREATED` audit event is logged.

3. **Root Cause of the Anonymous RLS Data Leakage**:
   - `001_initial_schema.sql` lines 584-595:
     ```sql
     CREATE POLICY "loans_anon_select_magic_token"
       ON public.loans FOR SELECT
       TO anon USING (magic_token IS NOT NULL);
     ```
   - In PostgREST, a policy `USING (magic_token IS NOT NULL)` evaluates to `true` for all rows where `magic_token` is present. An unauthenticated attacker requesting `GET /rest/v1/loans` receives the complete list of loans, including tokens, notes, replacement values, and signature URLs.
   - Furthermore, `loans_anon_update_renewal` allows unauthenticated mass updates:
     `USING (magic_token IS NOT NULL AND status IN ('ATIVO', 'ATRASADO')) WITH CHECK (status = 'ATIVO' AND renewal_count <= max_renewals)`
   - **Remediation verified**: The migration already defines two secure `SECURITY DEFINER` RPCs:
     `public.get_public_loan_by_magic_token(p_token text)` and `public.renew_loan_by_magic_token(p_token text)`.
     These functions perform exact-token lookups, mask beneficiary PII, validate renewal limits, and manage state transitions. Direct `anon` access policies on `public.loans` should be removed entirely, eliminating the attack surface while preserving 100% of the public renewal portal functionality.

4. **Root Cause of the Dead Invariant Check on `equipment_id`**:
   - Line 520 of `001_initial_schema.sql`:
     ```sql
     CREATE TRIGGER trg_loan_equipment_status_sync
       BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued
       ON public.loans
     ```
   - Because `equipment_id` is omitted from the `UPDATE OF ...` column list, PostgreSQL does not fire the trigger when `UPDATE loans SET equipment_id = ...` is executed.
   - As a result, lines 400-402 (`IF OLD.equipment_id != NEW.equipment_id THEN RAISE EXCEPTION ...`) are never reached during single-column updates.
   - **Remediation verified**: Append `equipment_id` to the trigger column list:
     ```sql
     BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued, equipment_id
     ```

---

## 3. Caveats

1. **Standalone PostgreSQL vs Managed Supabase**:
   - The compatibility stubs in Section 0 (`auth` schema, `auth.users`, `auth.uid()`, roles `anon`/`authenticated`) are completely harmless in Supabase (using `IF NOT EXISTS` / `CREATE OR REPLACE`) and enable standalone containerized testing.
2. **TypeScript Alignment**:
   - `src/lib/data-layer/types.ts` is fully compatible with both the database schema and `PROJECT.md` contracts, implementing aliasing (`secondary_name` / `secondary_contact_name`, `address_zipcode` / `address_cep`, `SUCATA` / `SUCATEADO`). No TypeScript issues were found.

---

## 4. Conclusion & Required Changes

The schema and seed dataset cannot be approved in their current state because **creating a new loan in the system fails unconditionally with a PostgreSQL foreign key error**, and **anonymous users can enumerate the entire loans table**.

### Required Changes for Implementation Worker:

1. **Fix Loan Events Foreign Key Deferral** (`supabase/migrations/001_initial_schema.sql`, line 241):
   Change:
   ```sql
   loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
   ```
   To:
   ```sql
   loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
   ```

2. **Secure Anonymous RLS on Loans** (`supabase/migrations/001_initial_schema.sql`, lines 584-595):
   Remove or replace direct `anon` SELECT/UPDATE policies on `public.loans`. Direct anonymous queries must not be allowed to enumerate the table. Unauthenticated clients must access loans exclusively via `get_public_loan_by_magic_token(p_token)` and `renew_loan_by_magic_token(p_token)`.

3. **Add `equipment_id` to Trigger Definition** (`supabase/migrations/001_initial_schema.sql`, line 520):
   Change:
   ```sql
   BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued
   ```
   To:
   ```sql
   BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued, equipment_id
   ```

4. **Enhance Verification Script** (`scripts/verify-migration.mjs`):
   Update regex check for the foreign key to expect `DEFERRABLE INITIALLY DEFERRED`.

---

## 5. Verification Method

To independently verify the fixes:

1. **Verify Dry-Run Validation**:
   ```powershell
   Set-Location 'C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico'
   node scripts/verify-migration.mjs
   ```

2. **Verify Real Engine DML & Trigger Execution**:
   ```powershell
   docker run --rm --name rotary_test_m2_fix -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres -p 54331:5432 -d postgres:16-alpine
   Start-Sleep -Seconds 3
   Get-Content supabase\migrations\001_initial_schema.sql -Raw | docker exec -i rotary_test_m2_fix psql -U postgres -d postgres

   # Test 1: Insert new active loan on available equipment (Must SUCCEED and set equipment to EMPRESTADO)
   docker exec -i rotary_test_m2_fix psql -U postgres -d postgres -c "
   INSERT INTO public.loans (loan_code, equipment_id, beneficiary_id, status, expected_return_date, magic_token)
   VALUES ('TEST-VERIFY', 'e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'ATIVO', now() + INTERVAL '30 days', 'test-tok-verify');
   SELECT status FROM public.equipments WHERE id = 'e0000000-0000-0000-0000-000000000003';
   SELECT event_type FROM public.loan_events_log WHERE loan_id = (SELECT id FROM public.loans WHERE loan_code = 'TEST-VERIFY');
   "

   # Test 2: Attempt to alter equipment_id on existing loan (Must THROW EXCEPTION)
   docker exec -i rotary_test_m2_fix psql -U postgres -d postgres -c "
   UPDATE public.loans SET equipment_id = 'e0000000-0000-0000-0000-000000000007' WHERE loan_code = 'TEST-VERIFY';
   "

   # Test 3: Anonymous select on loans (Must DENY or return 0 rows)
   docker exec -i rotary_test_m2_fix psql -U postgres -d postgres -c "
   SET ROLE anon;
   SELECT count(*) FROM public.loans;
   "

   docker stop rotary_test_m2_fix
   ```

3. **Verify Build and Types**:
   ```powershell
   npx.cmd tsc --noEmit
   npm.cmd run build
   ```
