# DISPATCH: Challenger 2 (Adversarial Mutation Challenger)

Task: Adversarially challenge test detection fidelity: inject simulated bugs or mutations into mock data/assertions (e.g. invalid CPF, missing CCB 579 citation, omitted secondary contact, skipped hygiene transition) and prove that the test suite catches them and fails with exit code 1.
Working directory: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico
State folder: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\challenger_test_mutation
Authoritative request: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\ORIGINAL_REQUEST.md
Project plan: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\PROJECT.md
Scope document: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\e2e_testing_orchestrator\SCOPE.md
Test Readiness: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\TEST_READY.md


## 2026-11-10T16:06:27Z
You are the Adversarial Mutation Challenger for the Rotary Banco Ortopédico project.
Working directory: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico
Your state folder: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\challenger_test_mutation
Authoritative request: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\ORIGINAL_REQUEST.md
Scope document: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\PROJECT.md
Test Readiness: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\TEST_READY.md

MANDATORY: Read ORIGINAL_REQUEST.md and PROJECT.md first.
Your mission:
Adversarially challenge the test detection capability (fault injection / mutation testing):
1. In a temporary isolated test or script, verify that the assertions in `tests/e2e/test-harness.js` actually catch faults and fail as expected:
   - What happens if a Comodato contract omits CCB Article 579 or replacement value? Does `assertLegalComodatoClauses` throw?
   - What happens if a Quittance receipt omits CCB Article 320 or debt discharge? Does `assertQuittanceReceipt` throw?
   - What happens if a secondary contact has the same phone as the primary contact? Does `assertSecondaryContactValidation` throw?
   - What happens if an invalid CPF (e.g. `111.111.111-11`) is provided? Does `assertBrazilianCPF` throw?
   - What happens if an illegal state transition is attempted (e.g. EMPRESTADO -> EMPRESTADO)? Does `assertEquipmentStateTransition` throw?
2. Confirm that when any test fails, `tests/e2e/runner.js` exits with exit code 1.
3. Clean up any temporary mutation test files.
4. Provide a clear verdict in your handoff report: APPROVE or REJECT.
Write your report to:
C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\challenger_test_mutation\handoff.md
Send a completion message back with your verdict and report path.
