# Handoff Report: Milestone 2 Adversarial Verification & Stress Testing

**Agent**: Challenger 2 (`teamwork_challenger_m2_2`)  
**Mission**: Adversarial empirical stress testing of `supabase/migrations/001_initial_schema.sql` (triggers, RLS policies, RPCs, state transitions, LGPD compliance, renewal invariants)  
**Execution Timestamp**: 2026-11-10T15:56:30Z  
**Verdict**: **`DEFECT_DETECTED`**

---

## 1. Observation

Adversarial stress-testing was conducted by executing migration `supabase/migrations/001_initial_schema.sql` in a live, isolated PostgreSQL 16 engine container (`rotary-m2-challenger-pg`). An automated test harness (`run_empirical_tests.mjs`) containing 21 empirical challenge scenarios was executed against the database.

Execution summary: **21 tests executed | 17 PASSED | 4 DEFECTS DETECTED**.

### Observation 1: Critical Bug — Impossible Loan Insertion due to `BEFORE INSERT` Trigger Foreign Key Violation
- **File**: `supabase/migrations/001_initial_schema.sql`
- **Lines**: 373–378, 384–389, 519–523
- **Trigger Definition**:
  ```sql
  DROP TRIGGER IF EXISTS trg_loan_equipment_status_sync ON public.loans;
  CREATE TRIGGER trg_loan_equipment_status_sync
    BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued
    ON public.loans
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_loan_equipment_status();
  ```
- **Trigger Code (Inside `fn_sync_loan_equipment_status`)**:
  ```sql
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'ATIVO' THEN
      ...
      INSERT INTO public.loan_events_log (
        loan_id, event_type, new_status, notes, performed_by, metadata
      ) VALUES (
        NEW.id, 'CREATED', NEW.status, 'Empréstimo iniciado e comodato formalizado.', NEW.created_by,
        jsonb_build_object('equipment_id', NEW.equipment_id, 'expected_return_date', NEW.expected_return_date)
      );
  ```
- **Child Table Constraint**:
  ```sql
  CREATE TABLE IF NOT EXISTS public.loan_events_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  ...
  ```
- **Command & Verbatim Result**:
  ```sql
  INSERT INTO public.loans (
    id, loan_code, equipment_id, beneficiary_id, status,
    loan_date, expected_return_date, magic_token
  ) VALUES (
    'c0000000-0000-0000-0000-000000000010', 'ROT-TEST-T1-1',
    'e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
    'ATIVO', now(), now() + interval '30 days', 'tok-test-t1-1'
  );
  ```
  **Output**:
  ```
  ERROR:  insert or update on table "loan_events_log" violates foreign key constraint "loan_events_log_loan_id_fkey"
  DETAIL:  Key (loan_id)=(c0000000-0000-0000-0000-000000000010) is not present in table "loans".
  CONTEXT:  SQL statement "INSERT INTO public.loan_events_log (
          loan_id, event_type, new_status, notes, performed_by, metadata
        ) VALUES (
          NEW.id, 'CREATED', NEW.status, 'Empréstimo iniciado e comodato formalizado.', NEW.created_by,
          jsonb_build_object('equipment_id', NEW.equipment_id, 'expected_return_date', NEW.expected_return_date)
        )"
  PL/pgSQL function fn_sync_loan_equipment_status() line 34 at SQL statement
  ```
- **Root Cause**: The migration seed only succeeded because line 693 executes `SET session_replication_role = 'replica';`, which disabled triggers during seed execution. Once re-enabled at line 1043 (`SET session_replication_role = 'origin';`), any subsequent call to `INSERT INTO public.loans` fails 100% of the time because `BEFORE INSERT` triggers run before the parent row exists in `public.loans`, immediately violating the non-deferred foreign key constraint on `loan_events_log`.

---

### Observation 2: High Defect — Incomplete Trigger Column List Allows Bypassing Equipment Immutability
- **File**: `supabase/migrations/001_initial_schema.sql`
- **Lines**: 400–402, 519–523
- **Trigger Code (Inside `fn_sync_loan_equipment_status`)**:
  ```sql
  IF TG_OP = 'UPDATE' THEN
    IF OLD.equipment_id != NEW.equipment_id THEN
      RAISE EXCEPTION 'Não é permitido alterar o equipamento de um contrato de comodato existente.';
    END IF;
  ```
- **Trigger Definition**:
  ```sql
  CREATE TRIGGER trg_loan_equipment_status_sync
    BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued
    ON public.loans
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_loan_equipment_status();
  ```
- **Command & Verbatim Result**:
  ```sql
  UPDATE public.loans SET equipment_id = 'e0000000-0000-0000-0000-000000000006' WHERE id = 'c0000000-0000-0000-0000-000000000001';
  ```
  **Output**:
  ```
  UPDATE 1
  ```
- **Root Cause**: `equipment_id` was omitted from the `UPDATE OF ...` column list in `CREATE TRIGGER`. An update that only modifies `equipment_id` never fires `trg_loan_equipment_status_sync`, completely bypassing the immutability guard.

---

### Observation 3: Critical Defect — Policy `loans_anon_select_magic_token` Exposes All Loans, Digital Signatures, and Magic Tokens to Anonymous Users
- **File**: `supabase/migrations/001_initial_schema.sql`
- **Lines**: 584–588
- **Policy Definition**:
  ```sql
  DROP POLICY IF EXISTS "loans_anon_select_magic_token" ON public.loans;
  CREATE POLICY "loans_anon_select_magic_token"
    ON public.loans FOR SELECT
    TO anon USING (magic_token IS NOT NULL);
  ```
- **Command & Verbatim Result**:
  ```sql
  SET ROLE anon;
  SELECT loan_code, magic_token, signature_image_url, contract_pdf_url FROM public.loans;
  ```
  **Output**:
  ```
  ROT-EMP-2024-001 | magic-tok-active-maria-001      | data:image/svg+xml;utf8,... | /contracts/contrato-ROT-EMP-2024-001-maria.pdf
  ROT-EMP-2024-002 | magic-tok-overdue-sebastiao-002 | data:image/svg+xml;utf8,... | /contracts/contrato-ROT-EMP-2024-002-sebastiao.pdf
  ROT-EMP-2024-003 | magic-tok-returned-maria-003    | data:image/svg+xml;utf8,... | /contracts/contrato-ROT-EMP-2024-003-maria.pdf
  ```
- **Root Cause**: `magic_token` is declared `VARCHAR(64) NOT NULL UNIQUE`. Consequently, `USING (magic_token IS NOT NULL)` evaluates to `true` for 100% of rows. Any unauthenticated caller using the public Supabase anon key can harvest all magic tokens, digital signatures, witness data, and contract links across all beneficiaries.

---

### Observation 4: Critical Defect — Policy `loans_anon_update_renewal` Allows Unauthenticated Mass Tampering of Active Loans
- **File**: `supabase/migrations/001_initial_schema.sql`
- **Lines**: 589–595
- **Policy Definition**:
  ```sql
  DROP POLICY IF EXISTS "loans_anon_update_renewal" ON public.loans;
  CREATE POLICY "loans_anon_update_renewal"
    ON public.loans FOR UPDATE
    TO anon
    USING (magic_token IS NOT NULL AND status IN ('ATIVO', 'ATRASADO'))
    WITH CHECK (status = 'ATIVO' AND renewal_count <= max_renewals);
  ```
- **Command & Verbatim Result**:
  ```sql
  SET ROLE anon;
  UPDATE public.loans SET notes = 'TAMPERED_BY_ANON' WHERE status = 'ATIVO';
  SELECT count(*) FROM public.loans WHERE notes = 'TAMPERED_BY_ANON';
  ```
  **Output**:
  ```
  UPDATE 1
  count: 1
  ```
- **Root Cause**: The policy `USING` clause does not validate that the anonymous client knows or supplied the specific loan's `magic_token`. Any anonymous actor can alter `notes`, `expected_return_date`, `replacement_value`, `contract_pdf_url`, or `signature_image_url` on any active loan without token validation. Direct table UPDATE is completely redundant and dangerous because the application already has a secure `SECURITY DEFINER` RPC `renew_loan_by_magic_token(p_token text)`.

---

### Observation 5: Validated Passing Invariants (17/21 Passed)
- **T1.2**: Loan creation on already `EMPRESTADO` equipment is correctly rejected by trigger (`"não está DISPONIVEL"`).
- **T1.4**: Loan return (`DEVOLVIDO`) with `post_return_destination = 'HIGIENIZACAO'` updates equipment status to `HIGIENIZACAO` and records `RETURNED` audit event.
- **T1.5**: Loan return fallback (`post_return_destination = NULL`, `return_condition = 'PRECISA_REPARO'`) correctly routes equipment to `MANUTENCAO`.
- **T1.6**: Loan overdue transition (`ATIVO -> ATRASADO`) updates equipment to `ATRASADO` and records `OVERDUE` audit event.
- **T2.1**: Overdue loan renewal state reversal (`status = 'ATIVO'` with `renewal_count++`) successfully reverts equipment status from `ATRASADO` to `EMPRESTADO` and logs `RENEWED` event.
- **T3.1**: Trigger correctly raises exception (`Limite máximo de 3 renovações atingido`) when `renewal_count > max_renewals`.
- **T3.2**: RPC `renew_loan_by_magic_token` correctly returns `{ "success": false, "error": "Limite máximo de renovações atingido..." }` when `renewal_count >= max_renewals`.
- **T3.3**: RPC `renew_loan_by_magic_token` successfully extends return date by +30 days and increments count on eligible loans.
- **T3.4 & T3.5**: RPC `renew_loan_by_magic_token` safely rejects non-existent tokens and returned (`DEVOLVIDO`) contracts.
- **T4.1 & T4.2**: RPC `get_public_loan_by_magic_token` correctly masks beneficiary full name, returning only the first name (`split_part(b.full_name, ' ', 1)`), and returns 0 rows for non-existent tokens.
- **T5.1 & T5.2**: Strict LGPD enforced on `beneficiaries`: unauthenticated users cannot read (0 rows returned) and cannot insert (violates RLS policy).
- **T5.3 & T5.4**: `equipments` table permits public QR scan read while blocking anonymous INSERT/UPDATE (`UPDATE 0`).
- **T5.5**: `profiles`, `loan_events_log`, and `maintenance_logs` are completely invisible to anonymous users (0 rows returned).

---

## 2. Logic Chain

1. **Premise**: In PostgreSQL, `BEFORE INSERT` triggers execute prior to writing the row to disk and before foreign key constraints on referencing tables can resolve the newly generated primary key `NEW.id`.
2. **Step 1**: Migration `001_initial_schema.sql` binds `trg_loan_equipment_status_sync` as `BEFORE INSERT OR UPDATE` on `public.loans` (line 520).
3. **Step 2**: Inside `fn_sync_loan_equipment_status()`, lines 373-378 attempt `INSERT INTO public.loan_events_log (loan_id, ...) VALUES (NEW.id, ...)`.
4. **Step 3**: Table `loan_events_log` specifies `loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE`.
5. **Step 4**: When an insertion occurs in real usage (outside `session_replication_role = 'replica'`), PostgreSQL enforces foreign key referential integrity immediately.
6. **Step 5**: Because `NEW.id` is not yet present in `public.loans`, PostgreSQL aborts with `loan_events_log_loan_id_fkey` constraint violation.
7. **Inference 1**: No loan can ever be created through standard SQL/ORM operations. This blocks Feature 15 (`/loans/new` wizard) completely.
8. **Step 6**: The trigger definition binds only `OF status, post_return_destination, return_condition, renewal_count, quittance_issued` (line 520).
9. **Inference 2**: Updates altering `equipment_id` do not trigger `trg_loan_equipment_status_sync`, allowing contractual asset reassignment in violation of the immutability rule at lines 400-402.
10. **Step 7**: Anonymous RLS policies on `loans` (`loans_anon_select_magic_token` and `loans_anon_update_renewal`) use `USING (magic_token IS NOT NULL)`.
11. **Step 8**: `magic_token` is declared `NOT NULL` on every loan.
12. **Inference 3**: Every loan is readable and modifiable by any anonymous entity on the internet possessing the Supabase anon key, exposing all magic tokens, beneficiary IDs, and digital signatures.
13. **Step 9**: The database already implements secure `SECURITY DEFINER` RPCs (`get_public_loan_by_magic_token` and `renew_loan_by_magic_token`) which authenticate by token parameter.
14. **Inference 4**: Direct anonymous table privileges on `public.loans` are unnecessary, dangerous, and violate the security scope defined in `SCOPE.md`.

---

## 3. Caveats

- **No Caveats**: All tests were executed directly against an active PostgreSQL 16 engine container running the verbatim migration script. All errors were reproduced and captured via standard command output.

---

## 4. Conclusion

**Verdict: `DEFECT_DETECTED`**

Migration `supabase/migrations/001_initial_schema.sql` possesses solid data modeling (correct enums, Brazilian CPF/CEP fields, partial unique index, and robust RPC logic), but suffers from **3 CRITICAL defects and 1 HIGH defect** that must be resolved before Milestone 2 can be approved:

1. **[CRITICAL] Broken Loan Insertion Trigger**: `BEFORE INSERT` trigger cannot insert into child table `loan_events_log` due to foreign key violation.
   - **Remediation**: Split `trg_loan_equipment_status_sync` into two triggers, or move the audit log insertion into an `AFTER INSERT OR UPDATE` trigger:
     - `BEFORE INSERT OR UPDATE`: Status validation and equipment status sync.
     - `AFTER INSERT OR UPDATE`: Audit event logging in `loan_events_log`.
2. **[HIGH] Trigger Column List Omission**: `equipment_id` must be added to the trigger column list:
   - **Remediation**: `BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued, equipment_id ON public.loans`.
3. **[CRITICAL] Anonymous Data Leakage on `loans`**:
   - **Remediation**: Drop policy `loans_anon_select_magic_token`. Direct table read must be restricted to `authenticated`. The public renewal portal must exclusively use `get_public_loan_by_magic_token(p_token text)`.
4. **[CRITICAL] Anonymous Mass Modification on `loans`**:
   - **Remediation**: Drop policy `loans_anon_update_renewal`. Direct table update must be restricted to `authenticated`. The public renewal portal must exclusively use `renew_loan_by_magic_token(p_token text)`.

---

## 5. Verification Method

To independently verify these findings:

1. Launch a PostgreSQL 16 instance and apply `supabase/migrations/001_initial_schema.sql`.
2. Ensure standard Supabase role privileges exist:
   ```sql
   GRANT USAGE ON SCHEMA public TO anon, authenticated;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
   ```
3. Run the automated empirical test harness provided in this state folder:
   ```powershell
   node .agents/teamwork/teamwork_challenger_m2_2/run_empirical_tests.mjs
   ```
4. Observe the test outputs and reproduction logs saved in:
   `.agents/teamwork/teamwork_challenger_m2_2/empirical_test_output.txt`
