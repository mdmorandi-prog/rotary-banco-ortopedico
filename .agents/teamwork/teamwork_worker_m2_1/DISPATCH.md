## 2026-11-10T15:31:01Z
You are the Implementation Worker for Milestone 2 (M2) of Rotary Banco Ortopédico.

Working directory: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico
Your state folder: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_worker_m2_1

MANDATORY FIRST STEP: Read the authoritative request at:
C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\ORIGINAL_REQUEST.md

Also read:
- C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\sub_orch_m2\SCOPE.md
- C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\PROJECT.md
- Explorer 1 Report: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m2_1\handoff.md
- Explorer 2 Report: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m2_2\handoff.md
- Explorer 3 Report: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m2_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You have exclusive write ownership of:
- `supabase/migrations/001_initial_schema.sql`
- `scripts/verify-migration.mjs`
- Your state folder

Your Objectives:
1. Synthesize and write `supabase/migrations/001_initial_schema.sql` incorporating:
   - Section 0: PostgreSQL extensions (`uuid-ossp`, `pgcrypto`) and `auth.users` stub for standalone dry-runs.
   - Section 1: All 6 PostgreSQL enums (`user_role`, `equipment_category`, `equipment_status`, `equipment_condition`, `loan_status`, `close_reason`).
   - Section 2: All 6 tables (`profiles`, `equipments`, `beneficiaries`, `loans`, `loan_events_log`, `maintenance_logs`) with full types, constraints, default values, and foreign keys (`ON DELETE RESTRICT` on loans).
   - Section 3: Performance indexes and the partial unique index `idx_unique_active_loan_per_equipment` on `loans(equipment_id) WHERE status IN ('ATIVO', 'ATRASADO')`.
   - Section 4: Automatic triggers: `fn_set_updated_at` (for all mutable tables) and `fn_sync_loan_equipment_status` (`SECURITY DEFINER SET search_path = public`) implementing full state-machine synchronization and audit logging.
   - Section 5: Row Level Security (RLS) policies for all 6 tables and public RPCs (`get_public_loan_by_magic_token`, `renew_loan_by_magic_token`).
   - Section 6: Comprehensive seed dataset (8 equipments, 2 beneficiaries with valid Brazilian CPFs and mandatory secondary contacts, 3 loans, maintenance logs, loan event logs) wrapped in `SET session_replication_role = 'replica';` / `'origin'`.
2. Implement `scripts/verify-migration.mjs` (using Explorer 3's prototype in `.agents/teamwork/teamwork_explorer_m2_3/verify_schema_dryrun.mjs` as reference).
3. Run the verification script: `node scripts/verify-migration.mjs` and ensure all 80 checks pass. If Docker is available, you may also run the dry-run container on port `54329`. Note that on Windows powershell, use `npm.cmd` / `npx.cmd`.
4. Write your completion report `handoff.md` in your state folder following the 5-component format (Observation, Logic Chain, Caveats, Conclusion, Verification Method) with all verification output.
5. Notify the orchestrator with send_message when complete.
