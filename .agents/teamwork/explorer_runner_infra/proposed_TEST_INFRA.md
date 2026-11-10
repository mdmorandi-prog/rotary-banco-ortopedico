# E2E Testing Infrastructure Specification — Rotary Banco Ortopédico

## 1. Overview & Testing Philosophy

This document defines the architecture, directory structure, assertion engine, and execution standards for the opaque-box end-to-end (E2E) testing track of **Rotary Banco Ortopédico**.

### Core Philosophy
1. **Opaque-Box & Requirement-Driven**:
   - Tests validate behavior strictly against the authoritative functional specifications (`ORIGINAL_REQUEST.md` and `PROJECT.md`).
   - Tests do not bind to internal component state or private implementation trivia. They verify interface contracts, data schemas, API routes, state transitions, legal clauses, and complete user journeys.
2. **Zero-Dependency Native Execution**:
   - The test runner (`tests/e2e/runner.js`) is implemented in pure Node.js using standard library modules (`node:fs`, `node:path`, `node:perf_hooks`, `node:assert`, `node:url`).
   - No heavy third-party test runners (e.g. Jest, Vitest, Cypress, Playwright) are required for core test execution. This avoids dependency installation conflicts, headless browser crashes, and Windows PowerShell script execution policy locks (`PSSecurityException`).
   - The entire suite executes in less than 5 seconds.
3. **Domain & Legal Compliance First**:
   - Testing verifies Brazilian Civil Code requirements for Comodato Contracts (CCB Arts. 579 to 585: gratuitous nature, replacement value, custody/conservation duties, default/mora, joint liability).
   - Validates quittance receipts under CCB Art. 320.
   - Validates LGPD data integrity and mandatory secondary contact anti-fraud rules.
   - Validates WCAG 2.1 AA/AAA contrast ratios for the Rotary brand palette (`#17458f` and `#f7a81b`).

---

## 2. Directory Structure

```
tests/
└── e2e/
    ├── runner.js                      # Pure Node.js central CLI test runner
    ├── test-harness.js                # Assertion helpers, contract verifiers, mock fixtures, in-memory repository
    ├── tier1-features/                # Tier 1: Core Feature Coverage (>= 5 tests per feature F1–F27)
    │   ├── f01_app_setup.test.js
    │   ├── f02_rotary_brand.test.js
    │   ├── f03_pwa_shell.test.js
    │   ├── f04_demo_store.test.js
    │   ├── f05_env_config.test.js
    │   ├── f06_supabase_schema.test.js
    │   ├── f07_database_tables.test.js
    │   ├── f08_triggers_state.test.js
    │   ├── f09_rls_security.test.js
    │   ├── f10_seed_dataset.test.js
    │   ├── f11_equipment_catalog.test.js
    │   ├── f12_qr_scanner.test.js
    │   ├── f13_contextual_item_route.test.js
    │   ├── f14_asset_labels_print.test.js
    │   ├── f15_loan_wizard.test.js
    │   ├── f16_secondary_contact.test.js
    │   ├── f17_image_compression.test.js
    │   ├── f18_digital_signature.test.js
    │   ├── f19_comodato_pdf.test.js
    │   ├── f20_return_triage.test.js
    │   ├── f21_return_routing.test.js
    │   ├── f22_discharge_receipt.test.js
    │   ├── f23_renewal_portal.test.js
    │   ├── f24_overdue_radar.test.js
    │   ├── f25_whatsapp_generator.test.js
    │   ├── f26_cron_automation.test.js
    │   └── f27_project_docs.test.js
    ├── tier2-boundaries/              # Tier 2: Boundary & Corner Cases (>= 5 tests per feature F1–F27)
    │   ├── f01_bnd_app_setup.test.js
    │   ├── f02_bnd_rotary_brand.test.js
    │   ├── ...
    │   └── f27_bnd_project_docs.test.js
    ├── tier3-interactions/            # Tier 3: Cross-Feature Pairwise Interactions
    │   ├── flow_loan_creation_to_overdue.test.js
    │   ├── flow_renewal_magic_token.test.js
    │   ├── flow_return_to_triage_destination.test.js
    │   ├── flow_qr_scan_to_contextual_action.test.js
    │   └── flow_cron_status_escalation.test.js
    └── tier4-scenarios/               # Tier 4: Real-World Rotary Operational Scenarios
        ├── scenario_wheelchair_lifecycle.test.js
        ├── scenario_overdue_secondary_contact_recovery.test.js
        ├── scenario_post_return_maintenance_and_scrap.test.js
        ├── scenario_offline_demo_center_workflow.test.js
        └── scenario_high_demand_campaign_batch.test.js
```

---

## 3. CLI Command Reference & NPM Integration

### Package.json Configuration
In `package.json`, add the canonical test scripts:
```json
{
  "scripts": {
    "test": "node tests/e2e/runner.js --tier=all",
    "test:tier1": "node tests/e2e/runner.js --tier=1",
    "test:tier2": "node tests/e2e/runner.js --tier=2",
    "test:tier3": "node tests/e2e/runner.js --tier=3",
    "test:tier4": "node tests/e2e/runner.js --tier=4",
    "test:verbose": "node tests/e2e/runner.js --tier=all --verbose",
    "test:filter": "node tests/e2e/runner.js --filter"
  }
}
```

### CLI Command Options
| Option | Description | Example |
|---|---|---|
| `--tier=1` | Runs only Tier 1: Core Feature Coverage | `node tests/e2e/runner.js --tier=1` |
| `--tier=2` | Runs only Tier 2: Boundary & Corner Cases | `node tests/e2e/runner.js --tier=2` |
| `--tier=3` | Runs only Tier 3: Cross-Feature Interactions | `node tests/e2e/runner.js --tier=3` |
| `--tier=4` | Runs only Tier 4: Real-World Scenarios | `node tests/e2e/runner.js --tier=4` |
| `--tier=all` | Runs all tiers sequentially in order (Default) | `npm.cmd test` |
| `--filter=<regex>` | Filters tests matching pattern in suite or title | `node tests/e2e/runner.js --filter="Comodato"` |
| `--verbose` | Emits individual passing test titles and timing in ms | `node tests/e2e/runner.js --verbose` |
| `--bail` | Halts execution immediately upon first failure | `node tests/e2e/runner.js --bail` |
| `--help` | Displays usage guide | `node tests/e2e/runner.js --help` |

### Windows Compatibility
On Windows PowerShell, due to script execution policies:
- Run with `npm.cmd test` or `node tests/e2e/runner.js`.
- Exit codes: Returns `0` on 100% pass, and `1` on any failure.

---

## 4. Test Harness & Utility Engine (`tests/e2e/test-harness.js`)

The test harness provides five essential categories of utilities:

### 4.1 Custom Domain Assertions
- `assert.assertLegalComodatoClauses(textOrPdfContent)`:
  Validates that contract text explicitly contains:
  - Designation as "Comodato" and citation of "Código Civil" (Lei 10.406/2002).
  - Explicit citations of Articles 579 to 585.
  - Gratuitous loan declaration (*comodato a título gratuito* - Art. 579).
  - Obligation of custody and conservation (*guardar e conservar* - Art. 582).
  - Default/mora liability and rental penalties for delayed return (Art. 582).
  - Joint and several liability (*solidariedade passiva* - Art. 585).
  - Declared replacement value (*valor de reposição* > 0).
- `assert.assertQuittanceReceipt(textOrPdfContent)`:
  Validates that the return receipt satisfies CCB Art. 320:
  - Express quittance statement (*dá plena, rasa e geral quitação*).
  - Identifies equipment and physical return condition (`BOM`, `PRECISA_REPARO`).
  - Extinguishes borrower and guarantor liabilities.
- `assert.assertEquipmentStateTransition(currentStatus, action, expectedStatus)`:
  Enforces equipment lifecycle state transitions:
  - `DISPONIVEL` -> `EMPRESTADO` (on loan creation)
  - `EMPRESTADO` -> `HIGIENIZACAO` | `DISPONIVEL` | `MANUTENCAO` (on return triage)
  - `EMPRESTADO` -> `ATRASADO` (on cron D+1 overdue transition)
  - `ATRASADO` -> `EMPRESTADO` (on renewal +30 days)
  - `HIGIENIZACAO` -> `DISPONIVEL` (on cleaning completion)
  - `MANUTENCAO` -> `DISPONIVEL` | `BAIXADO` (on repair or scrapping)
  - Forbids invalid state leaps (e.g. `EMPRESTADO` cannot be re-loaned directly; `BAIXADO` cannot be un-scrapped).
- `assert.assertSecondaryContactValidation(beneficiary)`:
  Enforces mandatory secondary contact anti-fraud rules:
  - Secondary contact name contains >= 2 words.
  - Secondary relationship is non-empty.
  - Secondary phone is a valid Brazilian phone and **does not collide** with the primary beneficiary phone.
  - Secondary contact is not identical to the primary beneficiary.
- `assert.assertBrazilianCPF(cpf)`:
  Validates standard 11-digit CPF formatting and calculates modulo 11 checksum verification digits.
- `assert.assertBrazilianPhone(phone)`:
  Validates 10-11 digit Brazilian telephone format with valid DDD.
- `assert.assertWCAGContrast(hexFg, hexBg, minRatio = 4.5)`:
  Calculates WCAG 2.1 relative luminance and contrast ratio. Verifies Rotary Royal Blue `#17458f` against white (`7.4:1`, passes AAA) and Rotary Gold `#f7a81b` with dark text (`6.8:1`, passes AA).

### 4.2 Contract Verification Utilities
- `contracts.verifyDatabaseMigrationContract(sqlPath)`:
  Parses `supabase/migrations/001_initial_schema.sql` to verify:
  - All 6 Enums: `user_role`, `equipment_category`, `equipment_status`, `equipment_condition`, `loan_status`, `close_reason`.
  - All 6 Tables: `profiles`, `equipments`, `beneficiaries`, `loans`, `loan_events_log`, `maintenance_logs`.
  - Primary keys, foreign keys (`REFERENCES`), `ON DELETE RESTRICT` constraints.
  - Database triggers for automatic equipment status transitions.
  - RLS enablement (`ENABLE ROW LEVEL SECURITY`) and policies.
  - Seed dataset containing >= 5 equipments and >= 2 loans.
- `contracts.verifyMockStoreContract(repository)`:
  Verifies that the mock store implements all 11 methods of `IDataRepository`:
  - `getEquipments`, `getEquipmentById`, `getEquipmentByQrToken`, `createEquipment`, `updateEquipment`.
  - `getLoans`, `getLoanById`, `getLoanByMagicToken`, `createLoan`, `renewLoan`, `returnLoan`.
- `contracts.verifyPWAContract(publicDir)`:
  Verifies `public/manifest.json` fields, display mode `standalone`, and icon sizes (192x192, 512x512).
- `contracts.verifyEnvironmentContract(envExamplePath)`:
  Verifies that all required environment keys are present in `.env.example`.

### 4.3 Mock Data Generators & Fixtures
- `fixtures.createMockEquipment(status, overrides)`: Generates typed equipment entities across all 6 statuses.
- `fixtures.createMockBeneficiary(overrides)`: Generates valid beneficiaries with compliant secondary contacts and valid CPFs.
- `fixtures.createInvalidBeneficiary(failureType)`: Generates test cases for missing secondary contact, colliding phones, invalid CPFs, etc.
- `fixtures.createMockLoan(overrides)`: Generates active, overdue, renewed, or returned loan records with magic tokens.
- `fixtures.generateMockQrToken(patrimony)`: Generates unique QR tokens.
- `fixtures.generateMockMagicToken(loanCode)`: Generates 1-click renewal magic tokens.
- `fixtures.generateValidCPF()`: Generates random mathematically valid CPFs for test generation.

### 4.4 In-Memory Isolated Data Repository
- `createInMemoryRepository(initialData)`:
  Reference implementation of `IDataRepository` operating purely in memory. Supports rapid execution of multi-step loan workflows, renewals, returns, and state machine transitions in zero-latency sandbox mode.

---

## 5. Coverage Thresholds & Quality Gates

| Tier | Category | Minimum Target | Pass Threshold |
|---|---|---|---|
| **Tier 1** | Core Feature Coverage (F1 to F27) | >= 5 tests per feature (>= 135 tests) | **100% Pass** |
| **Tier 2** | Boundary & Corner Cases (F1 to F27) | >= 5 boundary tests per feature (>= 135 tests) | **100% Pass** |
| **Tier 3** | Cross-Feature Interactions | >= 15 integration tests | **100% Pass** |
| **Tier 4** | Real-World Operational Scenarios | >= 10 end-to-end scenarios | **100% Pass** |
| **Total** | Full E2E Test Suite | **>= 295 test cases** | **100% Pass (0 failures)** |

### Quality Gate Exit Criteria:
1. `npm.cmd test` exits with code `0`.
2. Total test failures = `0`.
3. Unhandled exceptions or promise rejections = `0`.
4. Total execution duration < `5.00s`.
