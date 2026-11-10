# Task Assignment: Survey Explorer 3

- Role: Explorer 3 (Survey: Loan Wizard, Comodato PDF, Return Triage, Renewal Portal, Radar & Automations)
- Working directory: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico
- State folder: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_survey_3
- Authoritative request: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\ORIGINAL_REQUEST.md

## 2026-11-10T15:08:26Z
You are Survey Explorer 3 for the Rotary Banco Ortopédico project.
Working directory: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico
Your state folder: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_survey_3
Authoritative request: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\ORIGINAL_REQUEST.md

Your mission:
Survey and specify in complete technical detail Requirements R4, R5, and R6:
- R4: Multi-step Loan Wizard (/loans/new) confirming equipment, patient & guardian info, mandatory secondary contact validation (name, relationship, phone), client-side photo/document compression (browser-image-compression or canvas), digital signature canvas (react-signature-canvas), automatic legal Comodato contract PDF generator based on Código Civil Brasileiro arts. 579 to 585 with replacement valuation, conservation & return clauses, captured signature, and contract QR token/verification id.
- R5: Return triage workflow (/loans/[id]/return), physical condition checklist (BOM, PRECISA_REPARO), closure reasons (RECUPERACAO_ALTA, OBITO_PACIENTE, COMPRA_PROPRIA, TROCA_EQUIPAMENTO, OUTROS), destination routing (HIGIENIZACAO, DISPONIVEL, MANUTENCAO), and digital discharge receipt generation.
- R6: Public 1-click self-service renewal portal (/renovar/[magic_token]) without login, handling max renewal rules and return requests; /overdue & /dashboard radar with asset KPIs, overdue items, customized WhatsApp message generator for primary & secondary contacts with direct wa.me fallback links; automated cron endpoint (/api/cron/check-loans) with vercel.json config for D-7, D0, D+1 (auto-transition to ATRASADO), and D+7 schedules, with modular src/lib/whatsapp.ts.

Document all workflows, legal requirements, validation rules, math/date logic, component architecture, and edge cases.
Write your complete handoff report to:
C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_survey_3\handoff.md

When complete, send a message to orchestrator with your findings summary.

## 2026-11-10T15:16:18Z
**Context**: Survey Phase - Requirements R4, R5, R6
**Content**: Checking in on your survey report progress. Explorers 1 and 2 have delivered their handoffs. Please finalize and write your `handoff.md` and send the completion message when ready.
**Action**: Write handoff.md and report completion.
