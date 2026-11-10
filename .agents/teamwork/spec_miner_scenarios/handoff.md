# Handoff Report: Scenario Spec Miner — Tier 3 Cross-Feature Interactions & Tier 4 Real-World Rotary Scenarios

**Author**: Scenario Spec Miner  
**Date**: 2026-11-10T15:25:00Z  
**Project**: Rotary Banco Ortopédico  
**Working Directory**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`  
**State Folder**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\spec_miner_scenarios`  
**Target Specifications**: Tier 3 (Cross-Feature Pairwise Interactions) and Tier 4 (Real-World Rotary Banco Ortopédico Operational Scenarios).  
**Authoritative Sources**: `ORIGINAL_REQUEST.md`, `PROJECT.md`, `SCOPE.md`, `supabase/migrations/001_initial_schema.sql`, Brazilian Civil Code (Lei Federal nº 10.406/2002, Arts. 579-585, Art. 320), Brazilian LGPD (Lei nº 13.709/2018), and ANVISA Technical Notes on Medical Equipment Sanitization.

---

## 1. Observation

### 1.1 Direct Observations from Authoritative Sources

1. **`ORIGINAL_REQUEST.md` Core Requirements**:
   - **R2 (Supabase SQL & Enums)**: Defines enums `equipment_category`, `equipment_status` (`DISPONIVEL`, `EMPRESTADO`, `ATRASADO`, `HIGIENIZACAO`, `MANUTENCAO`, `BAIXADO`), `equipment_condition` (`NOVO`, `BOM`, `REGULAR`, `PRECISA_REPARO`, `SUCATEADO`), `loan_status` (`ATIVO`, `DEVOLVIDO`, `ATRASADO`, `CANCELADO`), and `close_reason` (`RECUPERACAO_ALTA`, `OBITO_PACIENTE`, `COMPRA_PROPRIA`, `TROCA_EQUIPAMENTO`, `OUTROS`, `DESISTENCIA`). Triggers must automate equipment status synchronization upon loan creation (`EMPRESTADO`) and return (`post_return_destination`).
   - **R3 (Equipment Catalog, QR Scanning & Labels)**: Dynamic routing at `/item/[qr_token]` drives contextual actions (`DISPONIVEL` -> Iniciar Empréstimo; `EMPRESTADO`/`ATRASADO` -> Devolução / Renovação; `HIGIENIZACAO`/`MANUTENCAO` -> Concluir / Liberar para estoque). Thermal label layout at `/equipments/labels` prints Rotary emblem, patrimony code, 22x22mm QR code, and return contact.
   - **R4 (Wizard, Secondary Contact, Comodato PDF)**: 5-step wizard at `/loans/new` enforces mandatory secondary contact (name >= 2 words, valid phone, relationship, non-collision check), client-side photo compression (< 800KB), canvas signature capture, and generated Comodato PDF grounded in CCB Arts. 579-585 with declared replacement value.
   - **R5 (Return Triage & Quittance Receipt)**: `/loans/[id]/return` executes physical checklist (`BOM`, `PRECISA_REPARO`), termination reasons, destination routing (`HIGIENIZACAO`, `DISPONIVEL`, `MANUTENCAO`), and generates digital quittance receipt under CCB Art. 320.
   - **R6 (Renewal Portal, Radar, WhatsApp & Cron)**: Public zero-login renewal portal `/renovar/[magic_token]` provides 1-click renewal (+30 days, capped at `max_renewals`) or return pickup assistance. Overdue radar at `/overdue` tracks D-7, D0, D+1, D+7 stages. Modular WhatsApp generator provides `wa.me` fallback links for primary and secondary contacts. Automated cron `/api/cron/check-loans` transitions expired loans to `ATRASADO` at D+1.

2. **`PROJECT.md` & `SCOPE.md` Constraints**:
   - Dual-mode data architecture: Seamless execution via `src/lib/data-layer/repository.ts` falling back to `src/lib/mock-store/local-store.ts` when unconfigured.
   - Opaque-box E2E test architecture: Node.js runner executing in `tests/e2e/runner.js` supporting `--tier=3` and `--tier=4`.
   - Tier 3 requires pairwise combination test cases exercising multi-feature state transitions.
   - Tier 4 requires comprehensive multi-step user journeys representing realistic Rotary club operations.

---

## 2. Logic Chain

### 2.1 Relational State Invariants & Transitions

1. **State Transition Coherence**:
   - An orthopedic equipment cannot be concurrently loaned to two beneficiaries. When `createLoan` executes, database triggers or repository logic must synchronously mutate `equipment.status` from `DISPONIVEL` to `EMPRESTADO`.
   - When a loan reaches D+1 overdue (`expected_return_date < CURRENT_DATE`), cron execution must transition both `loan.status` and `equipment.status` to `ATRASADO`.
   - When an overdue or active loan is returned, `loan.status` becomes `DEVOLVIDO`, `loan.actual_return_date` is stamped, and `equipment.status` transitions to the designated post-return destination (`HIGIENIZACAO` by default, or `MANUTENCAO` if damaged).
   - Items in `HIGIENIZACAO` or `MANUTENCAO` cannot be loaned until explicitly cleared through the contextual action route `/item/[qr_token]`, returning to `DISPONIVEL`.

2. **Legal and Moral Safeguards (CCB Arts. 579-585 & Art. 320)**:
   - Under CCB Art. 582, the borrower is in default (*mora*) immediately upon expiration of the term. The automated transition to `ATRASADO` provides statutory notice.
   - Under CCB Art. 585, multiple comodatários or designated guarantors are jointly and severally liable (*solidariamente responsáveis*). The mandatory secondary contact is not merely an emergency phone number; they hold co-responsibility, legally justifying WhatsApp escalation at D+7.
   - Under CCB Art. 320, a formal written discharge (*quitação*) extinguishes the comodato obligation and relieves the family of liability. In multi-item loans, returning one item requires a partial quittance (*quitação parcial*), leaving remaining items active.

3. **Humanitarian & Infection Control Protocols**:
   - In cases of patient demise (`OBITO_PACIENTE`), standard collection channels are inappropriate. The public renewal portal must provide a gentle "Solicitar auxílio para recolhimento" option, routing the request to a high-priority logistics queue with bereavement tagging.
   - Sanitary return requires that all equipment used by medical patients undergo mandatory disinfection (`HIGIENIZACAO`) before entering active stock, mitigating nosocomial pathogen transmission.

---

## 3. Caveats

1. **Simulated Time & Clock Mocking in Tests**:
   - Tests exercising D-7, D0, D+1, and D+7 cron transitions must avoid wall-clock sleeps. Test fixtures must support deterministic date manipulation (e.g., passing explicit `currentDate` overrides or backdating `expected_return_date` in the database / mock store).
2. **Deterministic Magic Tokens and QR Tokens**:
   - In E2E tests, generated `magic_token` values are cryptographically secure 32-character hexadecimal strings. Test assertions must validate token length, uniqueness, and lookup functionality rather than hardcoded string equality.
3. **Dual Execution Environment**:
   - Test suites must pass identically against both the Supabase PostgreSQL database schema (with SQL triggers) and the local mock store (`localStorage` repository).

---

## 4. Conclusion & Technical Specifications

### 4.1 Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Pairwise Transition | Loan Creation to Equipment State Machine (`T3-INT-01`) | Synchronizes loan creation with equipment status transition to `EMPRESTADO` | Equipment ID (`DISPONIVEL`), Beneficiary data, Secondary contact, Term (30/60/90d), Signature | Active Loan (`ATIVO`), Equipment status `EMPRESTADO`, `loan_events_log` record | Rejects with 409 if equipment status is not `DISPONIVEL` | ORIGINAL_REQUEST.md R2, R4; PROJECT.md F8, F15 |
| 2 | Pairwise Transition | 1-Click Magic Token Renewal (`T3-INT-02`) | Extends active loan by +30 days and increments `renewal_count` without authentication | `magic_token` (32-char hex) via `/renovar/[magic_token]` | `expected_return_date += 30 days`, `renewal_count += 1`, status remains `ATIVO` | Rejects with 400 if `renewal_count >= max_renewals` or token invalid | ORIGINAL_REQUEST.md R6; PROJECT.md F23 |
| 3 | Pairwise Transition | Automated Cron D+1 Overdue Transition (`T3-INT-03`) | Cron detects overdue active loans, sets `ATRASADO` on loan and equipment, and triggers WhatsApp alerts | `GET /api/cron/check-loans` with `Authorization: Bearer <secret>` | `loan.status = ATRASADO`, `equipment.status = ATRASADO`, primary WhatsApp alert generated | Ignores already returned/cancelled loans; idempotent on repeat runs | ORIGINAL_REQUEST.md R6; PROJECT.md F8, F25, F26 |
| 4 | Pairwise Transition | Return Triage with Destination Routing (`T3-INT-04`) | Evaluates condition checklist, maps destination, issues digital quittance, and sets `DEVOLVIDO` | `loan_id`, physical condition (`BOM`/`PRECISA_REPARO`), `close_reason`, destination | `loan.status = DEVOLVIDO`, `actual_return_date`, `equipment.status = destination`, Termo de Quitação PDF | Blocks return if physical condition is `PRECISA_REPARO` and destination is `DISPONIVEL` | ORIGINAL_REQUEST.md R5; PROJECT.md F20, F21, F22 |
| 5 | Pairwise Transition | Max Renewal Cap & Secondary Escalation (`T3-INT-05`) | Blocks 1-click renewal at cap and generates WhatsApp escalation to secondary guarantor at D+7 | `magic_token` where `renewal_count >= max_renewals`, cron D+7 trigger | Renewal UI blocked, Secondary contact WhatsApp escalation generated, audit log | Throws validation error if secondary contact phone is missing or malformed | ORIGINAL_REQUEST.md R4, R6; PROJECT.md F16, F23, F25 |
| 6 | Pairwise Transition | Maintenance Refurbishment Release (`T3-INT-06`) | Logs repair costs, updates condition to `BOM`, and restores equipment to `DISPONIVEL` | Equipment ID (`MANUTENCAO`), repair notes, cost, new condition (`BOM`) | Equipment status `DISPONIVEL`, `maintenance_logs` closed entry | Rejects if required notes or condition are omitted | ORIGINAL_REQUEST.md R3; PROJECT.md F7, F13 |
| 7 | Pairwise Transition | Sanitary Hygiene Clearance Gate (`T3-INT-07`) | Releases sanitized item from `HIGIENIZACAO` back to `DISPONIVEL` stock via QR action route | Equipment ID (`HIGIENIZACAO`), volunteer confirmation | Equipment status `DISPONIVEL`, `maintenance_logs` hygiene record | Blocks loan creation attempts while item is in `HIGIENIZACAO` | ORIGINAL_REQUEST.md R3, R5; PROJECT.md F8, F13 |
| 8 | Pairwise Transition | Public Collection Assistance Request (`T3-INT-08`) | Allows home-bound/bereaved families to request equipment pickup from public portal | `magic_token`, pickup notes, address confirmation, phone | Loan flagged with `pickup_requested = true`, queued in `/overdue` radar | Rejects if pickup contact phone is blank | ORIGINAL_REQUEST.md R6; PROJECT.md F23, F24 |
| 9 | Operational Scenario | Post-Surgical Wheelchair Journey (`T4-SCN-01`) | Full lifecycle: scan, wizard, comodato PDF, WhatsApp D-7 reminder, 1-click renewal, sanitary return | Wheelchair `CR-042`, femur fracture patient, 60d term, +30d renewal, hygiene return | Signed Comodato PDF, renewal audit, sanitary quittance receipt, stock release | Detects missing secondary contact during wizard step 3 | ORIGINAL_REQUEST.md R3, R4, R5, R6; PROJECT.md M1-M6 |
| 10 | Operational Scenario | Palliative Care Demise Journey (`T4-SCN-02`) | Palliative bed loan, death notification (`OBITO_PACIENTE`), pickup logistics, deep decontamination | Hospital Bed `CH-015`, terminal patient, pickup assistance, close reason `OBITO_PACIENTE` | High-priority overdue collection queue, compassionate quittance, hygiene audit | Flagged if volunteer tries to mark item `DISPONIVEL` without sanitization | ORIGINAL_REQUEST.md R4, R5, R6; PROJECT.md M4, M5, M6 |
| 11 | Operational Scenario | Serial Renewal Overdue & Escalation (`T4-SCN-03`) | Serial renewals (3x), overdue transition at D+1, hard cap block, D+7 secondary guarantor escalation | Crutches `MC-108`, 30d term, 3 serial renewals, D+1 overdue, D+7 escalation | 3 renewal events, overdue state, blocked renewal UI, secondary WhatsApp link | Rejects 4th renewal attempt via magic link | ORIGINAL_REQUEST.md R4, R6; PROJECT.md M4, M6 |
| 12 | Operational Scenario | Maintenance Refurbishment & Reallocation (`T4-SCN-04`) | Repair workshop completion, asset label thermal printing, mobile QR scan, and express loan | Bath Chair `CB-019` (damaged casters), parts cost R$45, printable label, express loan | Maintenance log, 50x30mm thermal label, `/item/[qr_token]` dispatch, new loan | Prevents loan creation while condition is `PRECISA_REPARO` | ORIGINAL_REQUEST.md R3, R4; PROJECT.md M2, M3, M4 |
| 13 | Operational Scenario | Multi-Equipment Family Comodato (`T4-SCN-05`) | Polytrauma patient assigned 2 equipments with differentiated terms, partial return & segregated quittance | Patient Geraldo Peixoto, Wheelchair `CR-088` (90d), Crutches `MC-044` (120d) | 2 distinct loan records, partial quittance for `CR-088`, active tracking of `MC-044` | Enforces that returning item A does NOT discharge or terminate item B | ORIGINAL_REQUEST.md R4, R5; PROJECT.md M4, M5 |

---

### 4.2 Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Loan Creation (`T3-INT-01`) | Attempt to create loan on equipment with status `EMPRESTADO` | Operation rejected with error "Equipamento já se encontra emprestado"; equipment status unchanged. |
| 2 | Loan Creation (`T3-INT-01`) | Secondary contact phone identical to primary beneficiary phone | Form validation fails at Step 3 with error "Telefone do contato secundário não pode ser idêntico ao do contato principal". |
| 3 | Magic Renewal (`T3-INT-02`) | Malformed or non-existent `magic_token` (e.g. `'invalid-token-123'`) | Portal displays 404 / Error card "Link de renovação inválido ou expirado"; zero database mutations. |
| 4 | Magic Renewal (`T3-INT-02`) | Attempt 1-click renewal on loan already marked `DEVOLVIDO` | System displays "Este empréstimo já foi encerrado e devolvido"; renewal action disabled. |
| 5 | Magic Renewal (`T3-INT-02`) | Renewal attempt when `renewal_count == max_renewals` (3 of 3) | 1-click button disabled; shows banner "Limite máximo de renovações atingido" with collection request option. |
| 6 | Cron Check (`T3-INT-03`) | Active loan with `expected_return_date == CURRENT_DATE` (D0) | Status remains `ATIVO`; generates D0 friendly reminder WhatsApp message; does NOT set `ATRASADO`. |
| 7 | Cron Check (`T3-INT-03`) | Active loan with `expected_return_date == CURRENT_DATE - 1` (D+1) | Status mutates to `ATRASADO` for both loan and equipment; generates D+1 overdue alert. |
| 8 | Cron Check (`T3-INT-03`) | Cron executed twice in immediate succession (idempotency check) | Second run processes zero status transitions; sends zero duplicate WhatsApp messages for same date. |
| 9 | Cron Check (`T3-INT-05`) | Overdue loan reaching `diff_days == 7` (D+7) | Generates escalation WhatsApp link addressed to `secondary_name` citing CCB Art. 585 joint liability. |
| 10 | Return Triage (`T3-INT-04`) | Checklist indicates broken part (`PRECISA_REPARO`), user selects `DISPONIVEL` | Form validation rejects submission: "Equipamentos que precisam de reparo devem ser encaminhados para MANUTENCAO". |
| 11 | Return Triage (`T3-INT-04`) | Termination reason `OBITO_PACIENTE` selected | Quittance receipt generates respectful bereavement preamble; sets destination to `HIGIENIZACAO`. |
| 12 | Contextual Route (`T3-INT-07`) | User attempts to loan item currently in `HIGIENIZACAO` | UI displays "Equipamento em Higienização"; "Iniciar Empréstimo" is hidden; only "Liberar para Estoque" shown. |
| 13 | Multi-Item Loan (`T4-SCN-05`) | Returning 1 of 2 family equipments (`CR-088` returned, `MC-044` kept) | Loan A becomes `DEVOLVIDO` with partial quittance; Loan B remains `ATIVO`; equipment A enters `HIGIENIZACAO`, B remains `EMPRESTADO`. |
| 14 | Thermal Labels (`T4-SCN-04`) | QR code scanned on physical label | Camera extracts URL `https://.../item/[qr_token]` and redirects directly to contextual state machine. |
| 15 | Image Compression (`T4-SCN-01`) | Operator uploads 14MB high-res smartphone photo of RG document | Client-side compression downsizes photo to < 600KB, max dimension 1600px, JPEG quality 0.8 before upload. |

---

### 4.3 Detailed Test Specifications: Tier 3 Cross-Feature Interactions

```
================================================================================
TEST SPECIFICATION: T3-INT-01 — Loan Creation to Equipment State Synchronization
================================================================================
Features Exercised: F4 (Data Repository), F8 (Triggers & State), F11 (Catalog), 
                    F12 (QR Scanner), F13 (Contextual Route), F15 (Wizard), 
                    F16 (Secondary Contact), F17 (Compression), F18 (Signature), 
                    F19 (Comodato PDF).
Operational Context: Volunteer allocates an available wheelchair to a patient in need.

Preconditions:
  - Equipment exists: `id: 'eq-wheelchair-01'`, `patrimony_code: 'CR-042'`, `status: 'DISPONIVEL'`, `condition: 'BOM'`, `replacement_value: 850.00`.
  - Beneficiary data: Maria Silva, CPF 123.456.789-00, Phone (11) 98888-1111, Address complete.
  - Secondary contact: Carlos Silva (Filho), Phone (11) 99999-2222 (distinct from primary).

Execution Steps:
  1. Navigate to `/item/${equipment.qr_token}` -> Verify status is 'DISPONIVEL' and 'Iniciar Empréstimo' CTA is visible.
  2. Click 'Iniciar Empréstimo' -> Lands on `/loans/new?equipment_id=eq-wheelchair-01`.
  3. Step 1 (Equipamento): Verify equipment details (CR-042, Cadeira de Rodas, Valor Reposição: R$ 850,00).
  4. Step 2 (Beneficiário): Input full name, CPF, RG, phone, and complete address.
  5. Step 3 (Contato Secundário): Input secondary name, relationship, and phone. Assert validation blocks if phone matches primary or name < 2 words.
  6. Step 4 (Documentos): Attach document photos. Assert client compression downsizes payload to < 800KB.
  7. Step 5 (Contrato & Assinatura): Select term = 60 days. Capture canvas signature data URL. Generate Comodato PDF.
  8. Submit Loan Creation -> Calls `dataRepository.createLoan(...)`.

Assertions & Invariants:
  - Loan returned has `status === 'ATIVO'`, `renewal_count === 0`, `max_renewals === 3`.
  - `loan.expected_return_date === currentDate + 60 days`.
  - `loan.magic_token` is a valid 32-character hex string.
  - Equipment status in database is now `EMPRESTADO`.
  - Calling `getEquipmentById('eq-wheelchair-01')` returns `status === 'EMPRESTADO'`.
  - Attempting to call `createLoan` with same `equipment_id` immediately throws 409 / Conflict.
  - Audit log `loan_events_log` contains an entry with `event_type === 'LOAN_CREATED'`.
  - Visiting `/item/${equipment.qr_token}` now displays 'EMPRESTADO' and options 'Registrar Devolução' and 'Renovar'.
```

```
================================================================================
TEST SPECIFICATION: T3-INT-02 — 1-Click Magic Token Self-Service Renewal
================================================================================
Features Exercised: F4 (Data Repository), F8 (Triggers & State), F13 (Contextual Route), 
                    F23 (Public Renewal Portal), F25 (WhatsApp Generator).
Operational Context: Patient recovers at home, needs 30 more days, clicks WhatsApp magic link.

Preconditions:
  - Active loan exists: `loan_id: 'loan-001'`, `equipment_id: 'eq-wheelchair-01'`, `status: 'ATIVO'`, `renewal_count: 0`, `max_renewals: 3`.
  - `expected_return_date: '2026-12-01'`, `magic_token: 'a1b2c3d4e5f60718293a4b5c6d7e8f90'`.
  - Associated equipment status is `EMPRESTADO`.

Execution Steps:
  1. Borrower accesses public URL `/renovar/a1b2c3d4e5f60718293a4b5c6d7e8f90`.
  2. Page verifies token without login. Displays: Beneficiary name, Equipment 'CR-042', Current Due Date '01/12/2026', Renewals remaining: '3 de 3'.
  3. Borrower clicks button "Ainda preciso - renovar por +30 dias".
  4. Client invokes `dataRepository.renewLoan('a1b2c3d4e5f60718293a4b5c6d7e8f90')`.

Assertions & Invariants:
  - Method returns `{ success: true, loan }`.
  - `loan.renewal_count === 1`.
  - `loan.expected_return_date === '2026-12-31'` (strictly previous date + 30 days).
  - `loan.status` remains `ATIVO` (or `RENOVADO`).
  - Equipment status remains `EMPRESTADO`.
  - `loan_events_log` records `event_type === 'LOAN_RENEWED'`, metadata `{ old_date: '2026-12-01', new_date: '2026-12-31', count: 1 }`.
  - Portal UI updates immediately showing success message and new return date '31/12/2026'.
  - Renewals remaining displays '2 de 3'.
```

```
================================================================================
TEST SPECIFICATION: T3-INT-03 — Cron Automation D+1 Overdue Transition & Dual WhatsApp Alerts
================================================================================
Features Exercised: F4 (Data Repository), F8 (Triggers & State), F24 (Overdue Radar), 
                    F25 (WhatsApp Generator), F26 (Cron Automation).
Operational Context: Daily scheduled cron processes expired loans and dispatches alerts.

Preconditions:
  - Loan `loan-002` exists: `status: 'ATIVO'`, `expected_return_date: '2026-11-09'`.
  - Current simulated system date is `'2026-11-10'` (1 day past expected return date, D+1).
  - Associated equipment `eq-crutch-02` status is `EMPRESTADO`.
  - Primary contact: Lucas Mendes, Phone (11) 97777-3333. Secondary: Roberto Mendes, Phone (11) 98888-4444.

Execution Steps:
  1. Trigger automated cron endpoint: `POST /api/cron/check-loans` with header `Authorization: Bearer CRON_SECRET_TEST`.
  2. Cron queries active loans where `expected_return_date < '2026-11-10'` and `status == 'ATIVO'`.
  3. For `loan-002` (diff_days == 1):
     a. Transition `loan.status` to `ATRASADO`.
     b. Transition `equipment.status` to `ATRASADO`.
     c. Record event in `loan_events_log` (`event_type: 'STATUS_CHANGED_TO_OVERDUE'`).
     d. Build D+1 WhatsApp notification for primary contact.
     e. Check secondary escalation rule (diff_days < 7 -> secondary not messaged yet).

Assertions & Invariants:
  - Cron response status is 200 with `{ processed: >= 1, transitioned_to_overdue: >= 1 }`.
  - Database verification: `getLoanById('loan-002').status === 'ATRASADO'`.
  - Equipment verification: `getEquipmentById('eq-crutch-02').status === 'ATRASADO'`.
  - Generated WhatsApp message contains:
    * Primary contact phone: `'5511977773333'`.
    * Text references patient name, equipment description, days overdue (1 dia).
    * Includes renewal link: `https://[app-url]/renovar/${loan.magic_token}`.
  - Overdue Radar (`/overdue`) now lists `loan-002` with badge 'ATRASADO' and Overdue KPI incremented.
  - Running the cron endpoint a second time on the same date produces `{ transitioned_to_overdue: 0 }` (idempotency).
```

```
================================================================================
TEST SPECIFICATION: T3-INT-04 — Overdue Loan Return Triage, Routing & Quittance Receipt
================================================================================
Features Exercised: F4 (Data Repository), F7 (Maintenance Logs), F8 (Triggers & State), 
                    F20 (Return Triage), F21 (Return Reasons & Routing), 
                    F22 (Discharge Receipt CCB 320), F24 (Overdue Radar).
Operational Context: Family returns overdue wheelchair at warehouse; volunteer conducts physical triage.

Preconditions:
  - Overdue loan `loan-003`: `status: 'ATRASADO'`, `equipment_id: 'eq-wheelchair-03'`.
  - Equipment `eq-wheelchair-03`: `status: 'ATRASADO'`, `replacement_value: 850.00`.

Execution Steps:
  1. Access `/loans/loan-003/return` (or scan QR code at `/scan` -> click "Registrar Devolução").
  2. Fill Physical Condition Checklist:
     - Structure/Chassis: Intact.
     - Wheels & Tires: Normal wear.
     - Brakes: Fully functional.
     - Upholstery: Clean, no tears.
     - Condition result: `BOM`.
  3. Select Reason for Termination: `RECUPERACAO_ALTA`.
  4. Select Post-Return Destination: `HIGIENIZACAO` (standard healthcare sanitary protocol).
  5. Submit Triage -> Invokes `dataRepository.returnLoan('loan-003', triageData)`.

Assertions & Invariants:
  - `loan.status === 'DEVOLVIDO'`.
  - `loan.actual_return_date` is not null (stamped with current timestamp).
  - `loan.close_reason === 'RECUPERACAO_ALTA'`.
  - `loan.return_condition === 'BOM'`.
  - `equipment.status === 'HIGIENIZACAO'`.
  - `maintenance_logs` contains a new open entry: `equipment_id: 'eq-wheelchair-03'`, `maintenance_type: 'HIGIENIZACAO'`, `status: 'ABERTA'`.
  - Digital discharge receipt ("Termo de Quitação de Comodato") is generated:
    * References Brazilian Civil Code Article 320.
    * Explicitly names beneficiary and secondary guarantor as fully discharged of liability.
    * Displays patrimony code, serial, and return timestamp.
  - Loan `loan-003` is automatically removed from active overdue radar at `/overdue`.
  - Sub-test branch 4B (Damaged item): If condition is `PRECISA_REPARO` and destination is `MANUTENCAO`:
    * `equipment.status === 'MANUTENCAO'`.
    * `maintenance_logs` entry created with `maintenance_type: 'CORRETIVA'`.
```

```
================================================================================
TEST SPECIFICATION: T3-INT-05 — Overdue Loan Renewal Cap Block & Secondary Escalation
================================================================================
Features Exercised: F16 (Secondary Contact), F19 (Comodato joint liability), 
                    F23 (Renewal Portal), F24 (Overdue Radar), F25 (WhatsApp Generator), 
                    F26 (Cron Automation).
Operational Context: Chronic delinquency with exhausted renewals triggers legal escalation to guarantor.

Preconditions:
  - Loan `loan-004` exists: `status: 'ATRASADO'`, `renewal_count: 3`, `max_renewals: 3`.
  - `expected_return_date: '2026-11-03'`, current simulated date is `'2026-11-10'` (D+7 overdue).
  - Primary contact: Lucas Mendes (unresponsive). Secondary contact: Roberto Mendes (Pai), Phone (11) 98888-4444.

Execution Steps:
  1. Borrower attempts to renew via `/renovar/${loan.magic_token}`.
     - Assert: 1-click renewal button is disabled. UI warns "Limite de renovações atingido (3 de 3)".
     - Assert: Portal offers alternative CTA: "Solicitar Recolhimento" or "Falar com Atendimento".
  2. Scheduled cron executes at D+7 (diff_days >= 7):
     - Cron identifies loan as critical overdue with primary unresponsiveness.
     - Generates escalation alert targeting `secondary_phone`.

Assertions & Invariants:
  - Attempting to invoke `dataRepository.renewLoan(loan.magic_token)` returns `{ success: false, message: 'Limite de renovações atingido' }`.
  - WhatsApp escalation message generated for secondary contact contains:
    * Target Phone: `'5511988884444'`.
    * Greets secondary contact by name: `'Sr(a). Roberto Mendes'`.
    * Cites Brazilian Civil Code Article 585 (*responsabilidade solidária*).
    * References borrower name, equipment, and 7-day delinquency.
    * Provides Rotary Club warehouse address and phone for return coordination.
  - Overdue radar flags loan as "ATRASO CRÍTICO - NOTIFICAR RESPONSÁVEL SOLIDÁRIO".
```

---

### 4.4 Detailed Test Specifications: Tier 4 Real-World Rotary Scenarios

```
================================================================================
TEST SCENARIO: T4-SCN-01 — Post-Surgical Wheelchair with Emergency Extension & Sanitary Return
================================================================================
Persona & Clinical Context:
  - Patient: Dona Maria Silva, 67 anos. Suffered right femoral neck fracture after domestic fall. 
    Underwent surgical osteosynthesis. Non-weight-bearing ordered for 60 days.
  - Primary Responsible: Carlos Silva (son, 41 anos, lives with patient).
  - Mandatory Secondary Contact: Ana Silva (daughter, 38 anos, lives nearby).
  - Equipment: Standard Wheelchair `CR-042`, replacement value R$ 850,00.

Lifecycle Execution Sequence:
  Step 1: Intake & Availability Check
    - Volunteer opens `/scan`, scans barcode/QR on wheelchair `CR-042`.
    - Contextual route `/item/cr042-token` confirms status `DISPONIVEL` and condition `BOM`.
    - Volunteer clicks "Iniciar Empréstimo".
  Step 2: 5-Step Loan Wizard Completion
    - Route: `/loans/new?equipment_id=eq-cr-042`.
    - Step 1 (Equipamento): Validates equipment model, serial, and replacement value (R$ 850,00).
    - Step 2 (Paciente/Responsável): Inputs Dona Maria (paciente) and Carlos (responsável).
    - Step 3 (Contato Secundário Obrigatório): Inputs Ana Silva, parentesco "Filha", telefone (11) 98888-2222.
      * Validation verifies: phone != primary phone, CPF != primary CPF, name >= 2 words.
    - Step 4 (Documentos): Uploads hospital discharge summary and proof of address.
      * Client-side compressor downsizes 4.2MB camera photos to 380KB.
    - Step 5 (Contrato & Assinatura): Selects initial term of 60 days. Carlos signs digital canvas.
  Step 3: Contract Generation & Dispatch
    - System invokes `createLoan`.
    - Comodato PDF generated with:
      * Arts. 579-585 CCB cited.
      * Replacement value R$ 850,00 prominently stated.
      * Joint liability clause for Carlos and Ana.
      * Embedded canvas signature and verification QR code.
    - Equipment status transitions to `EMPRESTADO`. Magic token generated.
    - WhatsApp dispatch confirmation with PDF link and magic token link sent to Carlos.
  Step 4: Clinical Complication & Self-Service Extension (Day 55)
    - At day 55 (D-5), surgeon observes delayed bone callus; orders +30 days non-weight-bearing.
    - Carlos receives automated D-7 WhatsApp reminder with 1-click renewal link.
    - Carlos opens `/renovar/[magic_token]`, clicks "Ainda preciso - renovar por +30 dias".
    - System extends `expected_return_date` to Day 90, increments `renewal_count` to 1.
    - Status remains `ATIVO`. Event logged in `loan_events_log`.
  Step 5: Physical Return & Sanitary Triage (Day 88)
    - Dona Maria recovers full mobility. Carlos brings wheelchair to Rotary warehouse.
    - Volunteer scans QR code on `CR-042`, opens `/loans/[id]/return`.
    - Completes physical inspection checklist (frame sound, bearings smooth, brakes functional -> `BOM`).
    - Termination reason: `RECUPERACAO_ALTA`.
    - Destination: `HIGIENIZACAO` (mandatory sanitization protocol).
    - System marks loan as `DEVOLVIDO`, stamps `actual_return_date`.
    - Issues "Termo de Quitação de Comodato" (CCB Art. 320) fully releasing Carlos and Ana.
  Step 6: Hygiene Completion & Stock Release
    - Wheelchair is placed in sanitization bay (`status: 'HIGIENIZACAO'`).
    - Volunteer disinfects item with hospital-grade quaternary ammonium compound.
    - Volunteer opens `/item/cr042-token`, clicks "Liberar da Higienização para Estoque".
    - Equipment status returns to `DISPONIVEL`, ready for the next patient.

Verification Invariants:
  - Status progression: DISPONIVEL -> EMPRESTADO -> EMPRESTADO (renewed) -> HIGIENIZACAO -> DISPONIVEL.
  - `renewal_count` incremented from 0 to 1.
  - Loan status: ATIVO -> DEVOLVIDO.
  - Complete legal document chain: Comodato PDF -> Renewal Audit -> Quittance Receipt.
```

```
================================================================================
TEST SCENARIO: T4-SCN-02 — Palliative Care Bed Loan with Patient Demise & Collection Assistance
================================================================================
Persona & Clinical Context:
  - Patient: Seu Antônio Souza, 78 anos. End-stage oncology, home palliative hospice care.
  - Primary Responsible: Beatriz Souza (daughter, primary caregiver).
  - Secondary Contact: Eduardo Souza (son, secondary guarantor).
  - Equipment: Semi-fowler Hospital Bed `CH-015` (value R$ 3.200,00) + Pneumatic anti-bedsore mattress.

Lifecycle Execution Sequence:
  Step 1: Heavy Equipment Allocation & Comodato
    - Bed `CH-015` allocated to Seu Antônio for 90-day term.
    - High declared replacement value (R$ 3.200,00) documented in Comodato PDF.
    - Status transitions to `EMPRESTADO`.
  Step 2: Patient Demise & Family Notification (Day 42)
    - At day 42, Seu Antônio passes away peacefully at home.
    - Family is in mourning and lacks physical means to transport an 80kg steel bed in a car.
  Step 3: Public Portal Collection Request
    - Beatriz accesses WhatsApp renewal link `/renovar/[magic_token]`.
    - Selects "Solicitar devolução / auxílio para recolhimento".
    - Enters notes: "Paciente faleceu. Necessita 2 pessoas e carreto para retirada. Endereço: Rua das Flores, 123. Contato: Eduardo (irmão)".
    - System updates loan record with `pickup_requested = true`, `pickup_notes`, and `pickup_contact`.
  Step 4: Overdue Radar Logistics Dispatch
    - In `/overdue`, bed appears under tab "COLETAS SOLICITADAS" with tag `LUTO / OBITO_PACIENTE` and priority `ALTA`.
    - Rotary logistics volunteer views request, phones Eduardo, schedules Saturday morning pickup.
  Step 5: Warehouse Ingestion & Decontamination Triage
    - Volunteer team transports bed to Rotary warehouse.
    - Operator opens return triage `/loans/[id]/return`.
    - Selects Reason: `OBITO_PACIENTE`.
    - Evaluates condition: Mechanics and frame functional -> condition `BOM`.
    - Destination: `HIGIENIZACAO` (mandatory deep decontamination under ANVISA biological safety guidelines).
    - System generates "Termo de Quitação" with respectful condolence preamble, extinguishing comodato liabilities for Beatriz and Eduardo under CCB Art. 320.
  Step 6: Maintenance & Disinfection Logging
    - Maintenance log created with `maintenance_type: 'HIGIENIZACAO'`, status `ABERTA`.
    - After terminal disinfection, item is cleared back to `DISPONIVEL`.

Verification Invariants:
  - Zero friction collection request from public portal without requiring login.
  - `OBITO_PACIENTE` reason correctly documented without delinquent status penalties.
  - Compassionate quittance document generated extinguishing joint civil liabilities.
  - Sanitization gate enforced before equipment can be reallocated.
```

```
================================================================================
TEST SCENARIO: T4-SCN-03 — Serial Renewals Reaching Maximum Cap & Secondary Contact Escalation
================================================================================
Persona & Clinical Context:
  - Patient & Primary: Lucas Mendes, 22 anos, university student. Ankle ligament injury.
  - Mandatory Secondary: Roberto Mendes (father, 52 anos).
  - Equipment: Canadian Crutches `MC-108`, replacement value R$ 120,00.

Lifecycle Execution Sequence:
  Step 1: Initial Comodato Setup
    - Loan created with initial term of 30 days. `max_renewals` set to 3.
    - Status: `ATIVO`, `renewal_count = 0`, expected return Day 30.
  Step 2: Serial Self-Service Renewals
    - Day 28: Lucas receives D-2 reminder, clicks magic link, renews (+30 days). 
      * `renewal_count = 1`, expected return Day 60.
    - Day 58: Lucas renews second time (+30 days).
      * `renewal_count = 2`, expected return Day 90.
    - Day 88: Lucas renews third time (+30 days).
      * `renewal_count = 3` (reaches `max_renewals`). Expected return Day 120.
      * Portal UI displays banner: "Esta é a sua última renovação online permitida. A devolução deverá ocorrer até [Data]".
  Step 3: Expiration & Overdue Transition (Day 121 / D+1)
    - Day 120 passes without return.
    - On Day 121, cron `/api/cron/check-loans` runs:
      * Identifies loan as expired (`diff_days == 1`).
      * Transitions loan and equipment to `ATRASADO`.
      * Generates D+1 overdue notification to Lucas.
  Step 4: Blocked Self-Service Renewal Attempt (Day 122)
    - Lucas opens `/renovar/[magic_token]`.
    - System detects `renewal_count (3) >= max_renewals (3)`.
    - Renewal button is disabled. Banner states: "Limite máximo de renovações atingido. Por favor, realize a devolução no Rotary Club ou entre em contato para agendar recolhimento."
  Step 5: Delinquency Escalation to Secondary Guarantor (Day 127 / D+7)
    - Lucas ignores notices for 7 days.
    - On Day 127, cron runs at D+7 overdue (`diff_days == 7`):
      * Identifies loan at critical overdue stage.
      * Generates WhatsApp Escalation Message to Father Roberto Mendes (Secondary Contact).
      * Message cites CCB Art. 585 (*solidariedade passiva*):
        "Prezado Sr. Roberto Mendes, entramos em contato referente ao comodato das Muletas Canadenses (Patrimônio MC-108) retiradas por Lucas Mendes, no qual o senhor consta como contato responsável e solidário (Art. 585 do Código Civil)..."
  Step 6: Resolution & Final Return
    - Roberto receives escalation, accompanies Lucas to Rotary warehouse next day.
    - Triage completed, condition `BOM`, close reason `RECUPERACAO_ALTA`, destination `HIGIENIZACAO`.
    - Quittance issued discharging both Lucas and Roberto.

Verification Invariants:
  - Exact cap enforcement: 3 successful renewals, 4th strictly blocked.
  - Automated progression to `ATRASADO` on Day 121.
  - Escalation specifically targets secondary contact phone with CCB 585 statutory wording.
  - Successful quittance extinguishes joint liability.
```

```
================================================================================
TEST SCENARIO: T4-SCN-04 — Bath Chair Workshop Refurbishment, Label Printing & QR Reallocation
================================================================================
Persona & Clinical Context:
  - Equipment: Bath Chair `CB-019`, currently in `MANUTENCAO` due to broken caster wheel.
  - Beneficiary: Dona Josefa, 82 anos, severe mobility impairment, urgently awaiting bath chair.
  - Primary Contact: Lúcia (daughter).

Lifecycle Execution Sequence:
  Step 1: Maintenance State Verification
    - Bath chair `CB-019` has status `MANUTENCAO` and condition `PRECISA_REPARO`.
    - Attempting to loan `CB-019` via `/loans/new?equipment_id=eq-cb-019` is blocked by validation.
  Step 2: Workshop Refurbishment Completion
    - Technician replaces 4 stainless casters and repaints frame.
    - Technician opens `/item/[qr_token]`, selects "Concluir Manutenção".
    - Inputs: Service description "Substituição completa de 4 rodízios inox e pintura", Parts cost R$ 45,00, Condition `BOM`, Destination `DISPONIVEL`.
    - System closes maintenance log, updates equipment status to `DISPONIVEL` and condition to `BOM`.
  Step 3: Asset Label Printing
    - Old physical label damaged during solvent cleaning.
    - Operator navigates to `/equipments/labels?id=eq-cb-019`.
    - Formats 50x30mm thermal label containing:
      * Official Rotary Wheel emblem and club title.
      * Monospace patrimony code `CB-019`.
      * Category "CADEIRA DE BANHO" and replacement value R$ 450,00.
      * Contact telephone for return assistance.
      * High-contrast 22x22mm QR code encoding `https://[app-url]/item/[qr_token]`.
    - Prints label and fixes to tubular aluminum frame.
  Step 4: Camera Scan & Immediate Reallocation
    - Lúcia arrives at Rotary warehouse with medical prescription.
    - Volunteer opens mobile camera scanner `/scan`, scans newly printed QR label on `CB-019`.
    - Mobile browser redirects to `/item/[qr_token]`.
    - Page displays green "DISPONIVEL" badge and prominent "Iniciar Empréstimo" button.
    - Volunteer completes 5-step wizard, collects signature, generates Comodato PDF.
    - Equipment status transitions to `EMPRESTADO` within 4 minutes.

Verification Invariants:
  - Equipment successfully unblocked from `MANUTENCAO` to `DISPONIVEL`.
  - Maintenance cost and parts logged in `maintenance_logs`.
  - Printable label verified for dimensions (50x30mm), elements, and QR URL.
  - End-to-end QR scan seamlessly drives express loan wizard.
```

```
================================================================================
TEST SCENARIO: T4-SCN-05 — Multi-Equipment Family Loan with Independent Lifecycles & Partial Quittances
================================================================================
Persona & Clinical Context:
  - Patient: Sr. Geraldo Peixoto, 58 anos. Polytrauma from motorcycle accident.
    Requires Wheelchair `CR-088` (immediate mobility) and Canadian Crutches `MC-044` (for subsequent physical therapy).
  - Primary Contact: Sueli Peixoto (wife). Secondary Contact: Fabio Peixoto (son).

Lifecycle Execution Sequence:
  Step 1: Dual Comodato Agreement
    - Operator allocates both items to beneficiary Geraldo Peixoto:
      * Loan A: Wheelchair `CR-088`, replacement value R$ 850,00, initial term 90 days.
      * Loan B: Crutches `MC-044`, replacement value R$ 120,00, initial term 120 days.
    - Sueli signs Comodato contracts with Fabio as joint secondary contact.
    - Both items transition to `EMPRESTADO`.
    - Each loan receives a unique `loan_code` and separate `magic_token`.
  Step 2: Differentiated Recovery & Partial Return (Day 65)
    - At Day 65, therapist advances Geraldo to crutch-walking. Wheelchair is no longer needed.
    - Sueli brings Wheelchair `CR-088` back to Rotary. Crutches `MC-044` remain in active home use.
  Step 3: Partial Triage & Segregated Quittance
    - Operator opens return triage for Loan A (`/loans/loan-A/return`).
    - Physical condition: `BOM`, close reason `RECUPERACAO_ALTA`, destination `HIGIENIZACAO`.
    - System executes `returnLoan`:
      * Loan A status becomes `DEVOLVIDO`.
      * Equipment `CR-088` status becomes `HIGIENIZACAO`.
      * Generates **Termo de Quitação Parcial** explicitly declaring:
        "Dá-se quitação plena, rasa e geral exclusivamente quanto à devolução da Cadeira de Rodas CR-088 (Contrato EMP-A), permanecendo plenamente vigentes e ativas todas as obrigações relativas às Muletas Canadenses MC-044 (Contrato EMP-B)..."
  Step 4: Active Monitoring & Renewal of Remaining Item (Day 115)
    - Loan B (`MC-044`) remains active in the system (`status: 'ATIVO'`).
    - At Day 115, Sueli receives automated D-7 WhatsApp reminder specifically for Loan B.
    - Sueli clicks 1-click renewal on Loan B's magic link (+30 days).
    - Loan B extended to Day 150 (`renewal_count = 1`).
  Step 5: Final Rehabilitation & Total Quittance (Day 145)
    - Geraldo completes rehabilitation. Sueli returns crutches `MC-044`.
    - Operator conducts triage, verifies condition `BOM`, selects destination `HIGIENIZACAO`.
    - Loan B status becomes `DEVOLVIDO`.
    - System issues final Termo de Quitação extinguishing all remaining comodato obligations for the Peixoto family.

Verification Invariants:
  - Independence of loans: Returning Loan A has zero unintended side effects on Loan B.
  - Partial quittance legal wording protects borrower for returned item while maintaining enforceable custody on unreturned item.
  - Distinct magic tokens prevent cross-contract renewal collisions.
  - Final quittance closes the family account completely.
```

---

## 5. Verification Method

To verify these specifications independently:

1. **Schema & Trigger Verification**:
   - Inspect `supabase/migrations/001_initial_schema.sql` to verify triggers `on_loan_created_update_equipment` and `on_loan_returned_update_equipment` match the exact enum values (`EMPRESTADO`, `HIGIENIZACAO`, `MANUTENCAO`, `DISPONIVEL`).
2. **Repository Contract Verification**:
   - Inspect `src/lib/data-layer/repository.ts` and `src/lib/mock-store/local-store.ts` to confirm `createLoan`, `renewLoan`, and `returnLoan` implement the specified state mutations and return types.
3. **Automated Test Runner Verification**:
   - Once implemented by the test track, execute:
     ```powershell
     node tests/e2e/runner.js --tier=3
     node tests/e2e/runner.js --tier=4
     ```
   - Assert all 5 Tier 3 cross-feature interaction tests and 5 Tier 4 real-world operational scenarios pass with exit code 0.
