# RLS & Security Remediation Investigation Report: Milestone 2 Iteration 2

**Agent**: RLS & Security Remediation Explorer (`teamwork_explorer_m2_it2_2`)  
**Mission**: Formulate the precise RLS security policy and RPC remediation for Milestone 2 (M2) Iteration 2 of Rotary Banco Ortopédico.  
**Working Directory**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`  
**State Folder**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m2_it2_2`  
**Date**: 2026-11-10T16:05:00Z  

---

## 1. Observation

### 1.1 Direct Inspection of `supabase/migrations/001_initial_schema.sql`

1. **Column Definition for `magic_token` in `public.loans`** (Line 215):
   ```sql
   magic_token VARCHAR(64) NOT NULL UNIQUE,
   ```
   The column is declared with a strict `NOT NULL` constraint on all rows.

2. **Current Anonymous RLS Policies on `public.loans`** (Lines 584–595):
   ```sql
   DROP POLICY IF EXISTS "loans_anon_select_magic_token" ON public.loans;
   CREATE POLICY "loans_anon_select_magic_token"
     ON public.loans FOR SELECT
     TO anon USING (magic_token IS NOT NULL);

   DROP POLICY IF EXISTS "loans_anon_update_renewal" ON public.loans;
   CREATE POLICY "loans_anon_update_renewal"
     ON public.loans FOR UPDATE
     TO anon
     USING (magic_token IS NOT NULL AND status IN ('ATIVO', 'ATRASADO'))
     WITH CHECK (status = 'ATIVO' AND renewal_count <= max_renewals);
   ```

3. **Current Public Self-Service RPCs** (Lines 614–686):
   - `public.get_public_loan_by_magic_token(p_token text)`:
     Defined with `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`.
     Selects from `loans`, `equipments`, and `beneficiaries` with `WHERE l.magic_token = p_token`, projecting only `split_part(b.full_name, ' ', 1) AS beneficiary_first_name`, equipment details, and status.
   - `public.renew_loan_by_magic_token(p_token text)`:
     Defined with `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`.
     Acquires `SELECT * INTO v_loan FROM public.loans WHERE magic_token = p_token FOR UPDATE;`, checks `status IN ('ATIVO', 'ATRASADO')`, checks `renewal_count < max_renewals`, extends `expected_return_date` by +30 days, increments `renewal_count`, sets `status = 'ATIVO'`, and returns JSON.

4. **Flawed Static Check in `scripts/verify-migration.mjs`** (Line 126):
   ```javascript
   check('Public magic token policy on loans', /CREATE\s+POLICY\s+["'].*["']\s+ON\s+(?:public\.)?loans\s+FOR\s+SELECT\s+TO\s+anon.*magic_token/i.test(sqlContent), 'Public read policy on loans via magic_token missing');
   ```
   This regex check directly forced the Iteration 1 implementer to create `loans_anon_select_magic_token` with `TO anon ... magic_token`, unintentionally introducing the vulnerability.

### 1.2 Verbatim Adversarial Penetration Test Results

1. **Unauthenticated Table Dump under `role anon`** (Challenger 2 Test `T5.6` & Reviewer 1 Observation 1.1):
   - SQL Executed:
     ```sql
     SET ROLE anon;
     SELECT loan_code, replacement_value, magic_token, signature_image_url, contract_pdf_url FROM public.loans;
     ```
   - Verbatim Output:
     ```
         loan_code     | replacement_value |           magic_token           | signature_image_url         | contract_pdf_url
     ------------------+-------------------+---------------------------------+-----------------------------+--------------------------------------------------
      ROT-EMP-2024-001 |            850.00 | magic-tok-active-maria-001      | data:image/svg+xml;utf8,... | /contracts/contrato-ROT-EMP-2024-001-maria.pdf
      ROT-EMP-2024-002 |            480.00 | magic-tok-overdue-sebastiao-002 | data:image/svg+xml;utf8,... | /contracts/contrato-ROT-EMP-2024-002-sebastiao.pdf
      ROT-EMP-2024-003 |            160.00 | magic-tok-returned-maria-003    | data:image/svg+xml;utf8,... | /contracts/contrato-ROT-EMP-2024-003-maria.pdf
     (3 rows)
     ```
   - Impact: 100% of loans, patient contracts, digital signatures, and secret renewal magic tokens are leaked to unauthenticated attackers.

2. **Unauthenticated Mass Modification under `role anon`** (Challenger 2 Test `T5.7`):
   - SQL Executed:
     ```sql
     SET ROLE anon;
     UPDATE public.loans SET notes = 'TAMPERED_BY_ANON' WHERE status = 'ATIVO';
     SELECT count(*) FROM public.loans WHERE notes = 'TAMPERED_BY_ANON';
     ```
   - Verbatim Output:
     ```
     UPDATE 1
     count: 1
     ```
   - Impact: An anonymous user without any valid `magic_token` can alter active loans at will.

3. **LGPD Compliance on `beneficiaries`** (Challenger 2 Tests `T5.1` & `T5.2`):
   - `SET ROLE anon; SELECT count(*) FROM public.beneficiaries;` returned `0` [PASS].
   - `SET ROLE anon; INSERT INTO public.beneficiaries ...` rejected with RLS error `violates row-level security policy for table "beneficiaries"` [PASS].

4. **Public Read on `equipments` for QR Scanner** (Challenger 2 Tests `T5.3` & `T5.4`):
   - `SET ROLE anon; SELECT name, status FROM public.equipments WHERE qr_token = 'eq-tok-cr001-rotary-wheel';` returned `Cadeira de Rodas Standard | EMPRESTADO` [PASS].
   - `SET ROLE anon; UPDATE public.equipments SET name = 'Defaced';` returned `UPDATE 0` (denied) [PASS].

---

## 2. Logic Chain

1. **Why Direct `anon` Table Policies on `loans` are Fundamentally Flawed**:
   - In PostgreSQL RLS, `CREATE POLICY ... FOR SELECT USING (condition)` filters which existing rows in the table are visible to the querying role.
   - Because `magic_token` is declared `NOT NULL` on `public.loans`, the condition `magic_token IS NOT NULL` evaluates to `TRUE` for every single row in the table.
   - When an unauthenticated caller queries `GET /rest/v1/loans` or `SELECT * FROM public.loans`, PostgreSQL applies `USING (true)` and returns all rows.
   - Similarly, in `CREATE POLICY ... FOR UPDATE USING (magic_token IS NOT NULL AND status IN ('ATIVO', 'ATRASADO'))`, PostgreSQL allows `UPDATE` on every active loan because `USING` tests existing row state, not caller identity or request payload token match.
   - In PostgREST / Supabase REST architecture, a client cannot securely supply a secret token to a generic table `SELECT` policy without exposing a query filter that an attacker can simply omit to dump the entire table.

2. **Why `SECURITY DEFINER` RPCs are the Canonical & Secure Architecture**:
   - `get_public_loan_by_magic_token(p_token text)` and `renew_loan_by_magic_token(p_token text)` execute with the privileges of their definer (`postgres`), allowing them to read and update `public.loans` even when role `anon` has **zero** table permissions on `public.loans`.
   - The token parameter `p_token` is explicitly checked via `WHERE l.magic_token = p_token`. If the caller does not provide an exact, valid token, the query returns 0 rows.
   - `get_public_loan_by_magic_token` explicitly projects only non-PII attributes and masks the beneficiary full name to first name only via `split_part(b.full_name, ' ', 1)`. All sensitive data (CPF, address, phone, signature base64, PDF URL, internal notes) are excluded from the projection.
   - `renew_loan_by_magic_token` acquires a row lock (`FOR UPDATE`), verifies loan eligibility, enforces the `max_renewals` ceiling, calculates the new date (+30 days), increments `renewal_count`, and triggers the audit log within a single atomic transaction.

3. **Status of Other Tables**:
   - `beneficiaries`: Contains exclusively authenticated policy `beneficiaries_authenticated_all`. Role `anon` has no policy, resulting in default `DENY ALL` (100% LGPD compliant).
   - `equipments`: Policy `equipments_select_public` grants SELECT to `anon, authenticated`, supporting mobile camera QR lookup (`/item/[qr_token]`), while all mutating operations (INSERT, UPDATE, DELETE) are strictly locked to `authenticated` (and DELETE to `admin`).
   - `profiles`, `loan_events_log`, `maintenance_logs`: All operations restricted to `authenticated`. Zero anonymous access.

4. **Root Cause of Iteration 1 Policy Generation**:
   - In `scripts/verify-migration.mjs` line 126, a static regex check explicitly required:
     `CREATE POLICY ... ON loans FOR SELECT TO anon.*magic_token`
   - To achieve an 80/80 pass score, the author added the flawed policy.
   - Any remediation must simultaneously fix `scripts/verify-migration.mjs` to validate that `loans` has zero direct `anon` table policies and instead requires `SECURITY DEFINER` RPCs.

---

## 3. Caveats

1. **PostgreSQL Compatibility Stubs for Standalone Engines**:
   - When testing in a standalone Docker PostgreSQL engine (outside managed Supabase), PostgreSQL defaults require explicit grants for roles `anon` and `authenticated`:
     ```sql
     GRANT USAGE ON SCHEMA public TO anon, authenticated;
     GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
     GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
     GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
     ```
   - In managed Supabase, these grants are standard platform defaults. Adding explicit grants or compatibility statements ensures test harnesses run seamlessly in both environments without weakening RLS (because RLS is explicitly enabled on all tables).

2. **Frontend Interplay for Milestone 6 (`/renovar/[magic_token]`)**:
   - When implementing Feature 23 (Public Self-Service Renewal), the client code must call:
     - `supabase.rpc('get_public_loan_by_magic_token', { p_token })` for fetching renewal details.
     - `supabase.rpc('renew_loan_by_magic_token', { p_token })` for executing the 1-click renewal.
   - The mock layer (`src/lib/mock-store/local-store.ts`) already implements `getLoanByMagicToken` and `renewLoan`. Dual-mode repository integration in M6 will map directly to these two RPCs.

3. **Trigger Dependency**:
   - Calling `renew_loan_by_magic_token` updates `public.loans`, which in turn fires `trg_loan_equipment_status_sync`.
   - The trigger bug remediation (Explorer 1's fix: making `loan_events_log.loan_id` foreign key `DEFERRABLE INITIALLY DEFERRED` or splitting to `AFTER INSERT OR UPDATE`) ensures that the renewal RPC completes successfully and logs the `RENEWED` event.

---

## 4. Conclusion & Required Changes

The RLS policy architecture on `public.loans` must be completely cleansed of direct `anon` table access, relying exclusively on the two hardened `SECURITY DEFINER` RPCs.

### Actionable Remediation Specification:

#### 1. Update `supabase/migrations/001_initial_schema.sql` (Section 5.5 - Lines 578–595)

**Replace Lines 578–595 with**:
```sql
-- 5.5 Loans Policies (Authenticated Staff Only - Zero Direct Anonymous Table Access)
DROP POLICY IF EXISTS "loans_authenticated_all" ON public.loans;
CREATE POLICY "loans_authenticated_all"
  ON public.loans FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Ensure direct anonymous table access policies are explicitly dropped
DROP POLICY IF EXISTS "loans_anon_select_magic_token" ON public.loans;
DROP POLICY IF EXISTS "loans_anon_update_renewal" ON public.loans;
```

#### 2. Harden Public RPCs in `supabase/migrations/001_initial_schema.sql` (Section 5.8 - Lines 614–686)

**Harden `get_public_loan_by_magic_token`**:
Add input guard against empty/null tokens and add explicit grant:
```sql
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
```

**Harden `renew_loan_by_magic_token`**:
Add input guard and explicit grant:
```sql
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
```

#### 3. Update Verification Suite in `scripts/verify-migration.mjs`

**Replace Line 126 in `scripts/verify-migration.mjs`**:
```javascript
  // 7. Critical Policies & Secure RPCs
  check('Public QR scan policy on equipments', /CREATE\s+POLICY\s+["'].*["']\s+ON\s+(?:public\.)?equipments\s+FOR\s+SELECT\s+TO\s+(?:anon,\s*authenticated|anon)/i.test(sqlContent), 'Public read policy on equipments for QR scanning missing');
  check('Loans table restricted to authenticated', /CREATE\s+POLICY\s+["']loans_authenticated_all["']\s+ON\s+(?:public\.)?loans\s+FOR\s+ALL\s+TO\s+authenticated/i.test(sqlContent), 'Missing loans_authenticated_all policy');
  check('Zero direct anon table policies on loans (anti-data leakage)', !/CREATE\s+POLICY\s+["'].*["']\s+ON\s+(?:public\.)?loans\s+FOR\s+(?:SELECT|UPDATE|INSERT|ALL)\s+TO\s+(?:anon|PUBLIC)/i.test(sqlContent), 'Direct anon table policy found on loans (violates security)');
  check('RPC get_public_loan_by_magic_token defined with SECURITY DEFINER', /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?get_public_loan_by_magic_token[\s\S]*?SECURITY\s+DEFINER/i.test(sqlContent), 'Missing SECURITY DEFINER on get_public_loan_by_magic_token');
  check('RPC renew_loan_by_magic_token defined with SECURITY DEFINER', /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?renew_loan_by_magic_token[\s\S]*?SECURITY\s+DEFINER/i.test(sqlContent), 'Missing SECURITY DEFINER on renew_loan_by_magic_token');
```

---

## 5. Verification Method

### 5.1 Verification Checklist & Commands

1. **Verify Static Schema Checks**:
   ```powershell
   Set-Location "C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico"
   node scripts/verify-migration.mjs
   ```
   *Expected Result*: All checks report `[OK]` with zero failures.

2. **Empirical Penetration Testing on Isolated PostgreSQL 16 Container**:
   ```powershell
   # 1. Start clean container
   docker run --rm --name rotary_rls_verify -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres -p 54332:5432 -d postgres:16-alpine
   Start-Sleep -Seconds 3

   # 2. Apply migration
   Get-Content supabase\migrations\001_initial_schema.sql -Raw | docker exec -i rotary_rls_verify psql -U postgres -d postgres

   # 3. Apply standard role grants for standalone test
   docker exec -i rotary_rls_verify psql -U postgres -d postgres -c "
     GRANT USAGE ON SCHEMA public TO anon, authenticated;
     GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
     GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
     GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
   "

   # 4. Penetration Test A: Anonymous direct SELECT on loans (Must return 0 rows)
   docker exec -i rotary_rls_verify psql -U postgres -d postgres -c "
     SET ROLE anon;
     SELECT count(*) FROM public.loans;
   "
   # Expected output: 0

   # 5. Penetration Test B: Anonymous direct UPDATE on loans (Must update 0 rows)
   docker exec -i rotary_rls_verify psql -U postgres -d postgres -c "
     SET ROLE anon;
     UPDATE public.loans SET notes = 'HACKED' WHERE status = 'ATIVO';
   "
   # Expected output: UPDATE 0

   # 6. Penetration Test C: Anonymous read on beneficiaries (Must return 0 rows)
   docker exec -i rotary_rls_verify psql -U postgres -d postgres -c "
     SET ROLE anon;
     SELECT count(*) FROM public.beneficiaries;
   "
   # Expected output: 0

   # 7. Functionality Test D: Public QR scan read on equipments (Must return item details)
   docker exec -i rotary_rls_verify psql -U postgres -d postgres -c "
     SET ROLE anon;
     SELECT patrimony_code, name, status FROM public.equipments WHERE qr_token = 'eq-tok-cr001-rotary-wheel';
   "
   # Expected output: ROT-CR-001 | Cadeira de Rodas Standard | EMPRESTADO

   # 8. Functionality Test E: Public renewal data lookup via RPC (Must return masked name Maria)
   docker exec -i rotary_rls_verify psql -U postgres -d postgres -c "
     SET ROLE anon;
     SELECT loan_code, equipment_name, status, beneficiary_first_name FROM public.get_public_loan_by_magic_token('magic-tok-active-maria-001');
   "
   # Expected output: ROT-EMP-2024-001 | Cadeira de Rodas Standard | ATIVO | Maria

   # 9. Functionality Test F: Public renewal execution via RPC (Must succeed and advance 30 days)
   docker exec -i rotary_rls_verify psql -U postgres -d postgres -c "
     SET ROLE anon;
     SELECT public.renew_loan_by_magic_token('magic-tok-active-maria-001');
   "
   # Expected output: {"success": true, "renewal_count": 1, ...}

   # 10. Clean up container
   docker stop rotary_rls_verify
   ```

### 5.2 Invalidation Conditions
This remediation plan is invalidated if:
- Any direct table operation on `public.loans` is granted to `anon`.
- `get_public_loan_by_magic_token` projects patient CPF, full name, phone number, address, or signature URL.
- `renew_loan_by_magic_token` allows renewal without validating token existence and state eligibility.
