# Scope: Milestone 2 - Supabase Schema & Seed

## Architecture
- **Target File**: `supabase/migrations/001_initial_schema.sql`
- **Database Engine**: PostgreSQL 15+ / Supabase
- **Extensions**: `uuid-ossp`, `pgcrypto`
- **Enums (6)**:
  - `user_role` ('admin', 'operator', 'volunteer')
  - `equipment_category` ('CADEIRA_RODAS', 'CADEIRA_BANHO', 'MULETA_AXILAR', 'MULETA_CANADENSE', 'ANDADOR', 'CAMA_HOSPITALAR', 'COLCHAO_PNEUMATICO', 'SUPORTE_SORO', 'OUTROS')
  - `equipment_status` ('DISPONIVEL', 'EMPRESTADO', 'ATRASADO', 'HIGIENIZACAO', 'MANUTENCAO', 'BAIXADO')
  - `equipment_condition` ('NOVO', 'BOM', 'REGULAR', 'PRECISA_REPARO', 'SUCATEADO')
  - `loan_status` ('ATIVO', 'DEVOLVIDO', 'ATRASADO', 'CANCELADO')
  - `close_reason` ('RECUPERACAO_ALTA', 'OBITO_PACIENTE', 'COMPRA_PROPRIA', 'TROCA_EQUIPAMENTO', 'OUTROS', 'DESISTENCIA')
- **Tables (6)**:
  - `profiles`
  - `equipments`
  - `beneficiaries`
  - `loans`
  - `loan_events_log`
  - `maintenance_logs`
- **Triggers**:
  - `fn_set_updated_at`: updates `updated_at` timestamps on row modification.
  - `fn_sync_loan_equipment_status`: automatic equipment status transition on loan creation (`ATIVO` -> `EMPRESTADO`), loan return (`DEVOLVIDO` -> `post_return_destination`), loan overdue (`ATRASADO` -> `ATRASADO`), and renewal logging.
- **Security & RLS**:
  - RLS enabled on all 6 tables.
  - Public read for `equipments` (for QR token lookup without requiring prior login).
  - Public read/update for `loans` constrained strictly by valid `magic_token`.
  - Authenticated-only access for `profiles`, `beneficiaries` (PII compliance), `loan_events_log`, `maintenance_logs`.
- **Seed Data**:
  - >= 6 equipments covering diverse categories and statuses (`DISPONIVEL`, `EMPRESTADO`, `ATRASADO`, `HIGIENIZACAO`, `MANUTENCAO`).
  - >= 2 beneficiaries with valid CPF, address, and mandatory secondary contacts.
  - >= 2 loans (at least 1 active, 1 overdue) with referential integrity.
  - Seed maintenance logs.
- **Verification Strategy**:
  - SQL syntax and schema dry-run verification (parser/linter or dry-run validation script).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 6 | Supabase Schema & Enums | 6 enums: user_role, equipment_category, equipment_status, equipment_condition, loan_status, close_reason | M2 | Survey 2 |
| 7 | Core Database Tables | 6 tables: profiles, equipments, beneficiaries, loans, loan_events_log, maintenance_logs | M2 | Survey 2 |
| 8 | Automated Triggers & State | Triggers for loan creation (EMPRESTADO) and return (destination status), audit logging | M2 | Survey 2 |
| 9 | Row Level Security (RLS) | Security policies for authenticated staff, public QR lookup, and public magic token access | M2 | Survey 2 |
| 10 | Initial Seed Dataset | >= 6 equipments across categories/statuses, >= 2 loans (active, overdue), beneficiaries | M2 | Survey 2 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M2 | Supabase Schema & Seed | `001_initial_schema.sql`, 6 enums, 6 tables, triggers, RLS, seed data (6+ items, 2+ loans) | none | IN_PROGRESS |
