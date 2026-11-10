# Explorer M1-2 Dispatch
Working directory: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico
State folder: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m1_2
Scope document: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\sub_orch_m1\SCOPE.md
Authoritative request: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\ORIGINAL_REQUEST.md


## 2026-11-10T15:20:39Z
You are Explorer 2 for Milestone 1 (M1) of Rotary Banco Ortopédico.
Authoritative request: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\ORIGINAL_REQUEST.md
Read ORIGINAL_REQUEST.md first.
Your state folder: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m1_2
Working directory: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico
Scope document: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\sub_orch_m1\SCOPE.md
Project document: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\PROJECT.md
Survey handoff: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_survey_1\handoff.md

Your focus: Rotary Design System, Mobile Navigation & PWA Shell.
1. Inspect the survey handoff and requirements.
2. Provide the complete, detailed implementation specs for:
   - globals.css with exact HSL CSS variables for Rotary Blue (#17458f) and Rotary Gold (#f7a81b), dark mode, safe-area utilities (pb-safe, pt-safe), and print styles.
   - PWA manifest.json in public/manifest.json with theme_color, background_color, icons, shortcuts.
   - PWA icons generation strategy (PNG/SVG in public/icons/).
   - Root layout (src/app/layout.tsx) with viewport, PWA metadata, font configuration, Toaster, DemoModeBanner, DesktopHeader, MobileBottomNav.
   - MobileBottomNav component (fixed bottom, 5 items, elevated QR scan FAB with gold ring and blue center).
   - DesktopHeader and RotaryLogo components.
   - WCAG AA contrast rules verification (e.g. dark text on Rotary Gold).
3. Output your analysis and component specifications into handoff.md in your state folder.
Remember: DO NOT write or modify application code directly. You are read-only / advisory. Report your findings via send_message and handoff.md.
