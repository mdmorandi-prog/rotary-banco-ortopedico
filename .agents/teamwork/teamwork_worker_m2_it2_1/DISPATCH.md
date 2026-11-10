## 2026-11-10T16:11:36Z

You are the Database Implementation Worker for Milestone 2 Iteration 2 (M2 it2) of the Rotary Banco Ortopédico project.
Working directory: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico
Your state folder: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_worker_m2_it2_1
Parent Orchestrator ID: e6ed8630-0bc4-410c-839f-8a711a549475

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY INPUTS — READ THESE FIRST:
1. C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\ORIGINAL_REQUEST.md
2. C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\PROJECT.md
3. C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\sub_orch_m2\SCOPE.md
4. C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m2_it2_1\handoff.md (Detailed trigger architecture split, function SQL, and deferral specs)
5. C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m2_it2_2\handoff.md (Detailed RLS hardening, anon policy removal, and RPC implementations)
6. C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m2_it2_3\handoff.md (Test harness checks, regex upgrades, and live Postgres verification commands)

YOUR SCOPE OF WRITE OWNERSHIP:
You EXCLUSIVELY own and will modify:
1. `supabase/migrations/001_initial_schema.sql`
2. `scripts/verify-migration.mjs`
Do NOT modify any other files outside your state folder and these two targets.

TASKS TO EXECUTE:
1. Update `supabase/migrations/001_initial_schema.sql`:
   a) In `public.loan_events_log`, update `loan_id` FK definition to:
      `loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,`
   b) Split the trigger on `public.loans` into two clean triggers and functions:
      - `fn_loan_equipment_status_before()` and trigger `trg_loan_equipment_status_before`:
        `BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued, equipment_id ON public.loans`
        * Validates equipment availability with `FOR UPDATE` lock. Raises exception if status is not `DISPONIVEL`.
        * Updates equipment to `EMPRESTADO` on new loan creation.
        * Guards immutability of `equipment_id` and `beneficiary_id` on update (`RAISE EXCEPTION`).
        * On `status = 'DEVOLVIDO'`: sets `actual_return_date = COALESCE(NEW.actual_return_date, now())` and updates equipment to `HIGIENIZACAO`, `MANUTENCAO`, or `DISPONIVEL` based on `post_return_destination`.
        * On `status = 'CANCELADO'`: resets equipment to `DISPONIVEL`.
        * On `status = 'ATRASADO'`: sets equipment to `ATRASADO`.
        * On overdue recovery (`OLD.status = 'ATRASADO' AND NEW.status = 'ATIVO'`): resets equipment to `EMPRESTADO`.
        * Sets defaults for `borrow_date`, `renewal_count`, `quittance_issued`, `magic_token`, and `quittance_issued_at`.
        * Returns `NEW`.
      - `fn_loan_events_log_after()` and trigger `trg_loan_events_log_after`:
        `AFTER INSERT OR UPDATE OF status, renewal_count, quittance_issued ON public.loans`
        * On INSERT: logs `CRIACAO` event in `public.loan_events_log` (safe because loan record is already committed to `public.loans`).
        * On UPDATE: logs `STATUS_CHANGED` (or specific `DEVOLUCAO`/`CANCELAMENTO`/`ATRASO`), `RENOVACAO`, and `QUITACAO` events.
        * Returns `NULL`.
   c) RLS Security Policy Hardening:
      - DROP `loans_anon_select_magic_token` and `loans_anon_update_renewal`.
      - Ensure NO direct `anon` SELECT or UPDATE policies exist on `public.loans` (zero anon policies on `loans`).
      - Maintain `loans_authenticated_all` for `authenticated` role.
      - Ensure public self-service RPCs `get_public_loan_by_magic_token` and `renew_loan_by_magic_token` are `SECURITY DEFINER SET search_path = public`, validate token inputs, lock rows with `FOR UPDATE` on renewal, project only masked public data, and grant execute permissions to `anon, authenticated`.
   d) Verify seed data contains the required 6 equipments, 2 beneficiaries, and 3 loans.

2. Update `scripts/verify-migration.mjs`:
   Replace outdated regex checks with the 4 enhancements formulated in Explorer it2_3 report:
   - Check deferred FK on `loan_events_log.loan_id` (`DEFERRABLE INITIALLY DEFERRED`).
   - Check trigger split: `trg_loan_equipment_status_before` (BEFORE) and `trg_loan_events_log_after` (AFTER).
   - Check `trg_loan_equipment_status_before` monitors `equipment_id`.
   - Check that NO direct `anon` policies exist on `public.loans`, and verify existence of `get_public_loan_by_magic_token` and `renew_loan_by_magic_token` with grants to `anon`.

3. Run Verification:
   - Run `node scripts/verify-migration.mjs` and ensure all checks pass.
   - Run live PostgreSQL validation against the running Docker container (check port 54335 or 54329 as identified by explorers) to verify migration execution, trigger operation on regular loan insert, anon isolation, and RPC execution.
   - Run `npx.cmd tsc --noEmit` and `npm.cmd run build` to verify project builds without errors.

4. Deliverables:
   - Update `progress.md` in your state folder.
   - Write comprehensive `handoff.md` in `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_worker_m2_it2_1\handoff.md`.
   - Send completion message to parent sub-orchestrator (`e6ed8630-0bc4-410c-839f-8a711a549475`).
