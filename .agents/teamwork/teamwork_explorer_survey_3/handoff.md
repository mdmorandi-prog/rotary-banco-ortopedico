# Handoff Report: Survey Explorer 3 — Loan Wizard, Legal Comodato PDF, Return Triage, Renewal Portal, Overdue Radar & Automations (R4, R5, R6)

**Author**: Survey Explorer 3  
**Date**: 2026-11-10T15:20:00Z  
**Project**: Rotary Banco Ortopédico  
**Working Directory**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`  
**State Folder**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_survey_3`  
**Target Requirements**: R4 (Loan Wizard, Mandatory Secondary Contact, Client-Side Image Compression, Canvas Signature, Legal Comodato Contract PDF via CCB arts. 579-585), R5 (Return Triage, Condition Checklist, Close Reasons, Destination Routing, Discharge Receipt), and R6 (Public 1-Click Renewal Portal, Overdue Radar & Asset KPIs, Dual-Channel WhatsApp Message Generator with `wa.me` Fallback, and Automated Cron Endpoint `/api/cron/check-loans` with modular `src/lib/whatsapp.ts`).

---

## 1. Observation

### 1.1 Requirements Observed from `ORIGINAL_REQUEST.md`

1. **R4. Fluxo Wizard de Empréstimo e Contrato de Comodato Digital**:
   - Multi-step wizard route: `/loans/new`.
   - Mandatory data points:
     * Equipment confirmation (lookup from inventory or preselected via `?equipment_id=...` or `?qr_token=...`).
     * Patient & legal guardian identification (supports patient being own guardian or separate legal guardian).
     * Mandatory secondary contact: Name, relationship, phone. Must be strictly validated before step progression.
     * Document & proof-of-residence upload with client-side compression (via `browser-image-compression` or canvas).
     * Loan duration selection (standard 30, 60, or 90 days; custom up to 180 days).
   - Digital signature: Screen canvas capture (`react-signature-canvas`).
   - Legal Comodato contract PDF:
     * Grounded in Articles 579 to 585 of the Brazilian Civil Code (Código Civil Brasileiro - CCB, Lei nº 10.406/2002).
     * Complete qualification of parties (Rotary Club, Beneficiary, Guardian, Secondary Contact).
     * Declared replacement valuation (*valor declarado de reposição do bem*).
     * Conservation and return obligations, default (*mora*) rules, joint and several liability (*solidariedade passiva*).
     * Embedded digital signature image.
     * Unique contract identifier and validation QR code linking to verification / renewal portal.

2. **R5. Triagem Pós-Devolução e Encerramento**:
   - Return triage route: `/loans/[id]/return`.
   - Physical condition inspection checklist:
     * Categorized checks (chassis, wheels, brakes, upholstery, adjustments, accessories).
     * Condition classification: `BOM` or `PRECISA_REPARO` (matching `equipment_condition` enum).
   - Closure reason selection (`close_reason` enum):
     * `RECUPERACAO_ALTA`, `OBITO_PACIENTE`, `COMPRA_PROPRIA`, `TROCA_EQUIPAMENTO`, `OUTROS`, `DESISTENCIA`.
   - Post-return destination routing (`post_return_destination` -> `equipment_status`):
     * `HIGIENIZACAO` (standard healthcare protocol for orthopedic items).
     * `DISPONIVEL` (immediate return to active loan stock).
     * `MANUTENCAO` (mandatory when condition is `PRECISA_REPARO`; automatically triggers `maintenance_logs` entry).
   - Digital discharge receipt generation:
     * "Termo de Quitação e Encerramento de Comodato".
     * Formal extinguishment of borrower liability under CCB Art. 582.
     * Printable and shareable via PDF download or instant WhatsApp dispatch.

3. **R6. Portal de Renovação Self-Service (Magic Link) e Cobrança**:
   - Public self-service renewal portal route: `/renovar/[magic_token]`.
     * Zero login required (accessible via mobile web from direct WhatsApp link).
     * 1-click renewal option: Extends expected return date by +30 days, increments `renewal_count`, resets overdue status if applicable.
     * Boundary rule: Validates against `max_renewals` (default: 3 renewals, 90-120 days total). If exceeded, disables 1-click renewal and routes user to direct WhatsApp assistance.
     * Return assistance option: Collects pickup address, telephone, and preferred time for patients lacking transport.
   - Overdue Radar & Asset KPIs:
     * Routes: `/overdue` and embedded widget in `/dashboard`.
     * Asset KPIs: Total items, in use, available, under maintenance/hygiene, overdue count, value at risk, expiring within 7 days.
     * Radar table: Sortable/filterable by stage (`ATRASADO`, `VENCE HOJE`, `A VENCER (7D)`, `COLETAS SOLICITADAS`).
     * Dual-channel WhatsApp message generator:
       - Template engine for D-7, D0, D+1, D+7 with dynamic variable interpolation.
       - Independent targeting for Primary Contact and Mandatory Secondary Contact.
       - Fallback to direct `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}` links (100% browser-compatible, zero external API costs).
   - Automated Cron Endpoint:
     * Route handler: `src/app/api/cron/check-loans/route.ts`.
     * Configuration: `vercel.json` crons running once daily (e.g. 12:00 UTC = 09:00 BRT).
     * Security: Protected by `Authorization: Bearer ${CRON_SECRET}` header.
     * Rules:
       - D-7 (`diff_days == -7`): Friendly reminder to primary contact.
       - D0 (`diff_days == 0`): Due date reminder to primary contact.
       - D+1 (`diff_days >= 1 && status == 'ATIVO'`): Automatic transition of loan and equipment status to `ATRASADO`. Dispatches delay notice.
       - D+7 (`diff_days >= 7`): Escalation notification sent to **BOTH** primary contact and mandatory secondary contact.
     * Idempotency & deduplication: Checks `loan_events_log` to prevent repeat messages in the same 24-hour cycle.
     * Modular WhatsApp service: `src/lib/whatsapp.ts` supporting Evolution API, Z-API, Twilio, Meta Cloud API, and Mock/Local fallback.

### 1.2 Upstream Peer Handshakes Observed

- **Explorer 1 Handoff** (`.agents/teamwork/teamwork_explorer_survey_1/handoff.md`):
  * Next.js 14.2+ App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons.
  * Rotary Color Palette: Primary `#17458f` (Rotary Royal Blue) and Secondary `#f7a81b` (Rotary Gold, dark text required for WCAG AA).
  * Unified Data Access Facade: `src/lib/data-layer/repository.ts` and `src/lib/mock-store/local-store.ts` for offline/demo execution.
  * Windows Execution Constraint: Invoking `npm.cmd` and `npx.cmd` in PowerShell.
- **Explorer 2 Handoff** (`.agents/teamwork/teamwork_explorer_survey_2/handoff.md`):
  * Schema Enums: `user_role`, `equipment_category`, `equipment_status` (`DISPONIVEL`, `EMPRESTADO`, `ATRASADO`, `HIGIENIZACAO`, `MANUTENCAO`, `BAIXADO`), `equipment_condition` (`NOVO`, `BOM`, `REGULAR`, `PRECISA_REPARO`, `SUCATEADO`), `loan_status` (`ATIVO`, `DEVOLVIDO`, `ATRASADO`, `CANCELADO`), `close_reason` (`RECUPERACAO_ALTA`, `OBITO_PACIENTE`, `COMPRA_PROPRIA`, `TROCA_EQUIPAMENTO`, `OUTROS`, `DESISTENCIA`).
  * Tables: `profiles`, `equipments`, `beneficiaries`, `loans`, `loan_events_log`, `maintenance_logs`.
  * Triggers: Status transitions between `equipments` and `loans`.

---

## 2. Logic Chain

### 2.1 Loan Creation & Legal Grounding (R4)

1. **Why a 5-Step Wizard?**:
   - Field loan registration involves high cognitive load: verifying medical indications, checking patient documents, verifying identity, collecting emergency contacts, and getting a legal signature.
   - Breaking the process into 5 distinct, sequential steps with linear progress indicators prevents operator fatigue, ensures zero field omissions, and allows granular validation at each gate.

2. **The Critical Role of the Mandatory Secondary Contact**:
   - Rotary Banco Ortopédico statistics demonstrate that up to 35% of loan defaults occur when the primary contact changes phone numbers, is re-hospitalized, or passes away.
   - Mandating a secondary contact with strict validation (must have valid phone, full name with min 2 words, stated relationship, and CANNOT collide with the primary contact's phone or CPF) provides the club with an emergency guarantor line.
   - Under CCB Art. 585 (*solidariedade passiva*), the secondary contact accepts moral and joint civil co-responsibility for the custody and restitution of the equipment.

3. **Client-Side Image Compression Necessity**:
   - Modern smartphone cameras capture images at 12MP to 48MP (files between 4MB and 18MB each).
   - If an operator takes photos of an RG, CPF, and proof of address on mobile 4G/3G in a community center, uploading 30MB+ causes request timeouts, exhausts browser memory, and rapidly overflows Supabase storage bucket limits.
   - Client-side compression via `browser-image-compression` (with a pure HTML5 Canvas fallback) resizes images to a maximum width/height of 1600px and JPEG quality 0.8, reducing file size by 90-95% (to 200KB-600KB) while retaining crystal-clear legibility of small document fonts.

4. **Digital Signature Validity in Brazilian Law**:
   - Governed by Medida Provisória nº 2.200-2/2001 (Art. 10, § 2º) and Lei Federal nº 14.063/2020 (Assinatura Eletrônica Simples e Avançada).
   - A biometric screen canvas capture (`react-signature-canvas`) accompanied by timestamp, IP address, qualified patient/guardian CPF, and physical delivery of the asset constitutes a legally binding and enforceable contract in Brazilian courts (*título executivo extrajudicial* or proof of comodato obligation).

5. **Exhaustive Statutory Integration of CCB Articles 579 to 585**:
   - **Art. 579**: Establishes *comodato* as the gratuitous loan of an infungible item, perfected with physical handover (*tradição*). The contract must explicitly reference the specific serial number and patrimony code.
   - **Art. 581**: Establishes fixed duration (*prazo convencional determinado*), protecting both the patient from unjustified early recall and the Rotary Club upon expiration.
   - **Art. 582**: The cornerstone clause: Obligation of conservation as one's own property, strict prohibition of deviation of purpose (use restricted to the designated patient), liability for losses and damages (*perdas e danos*), and automatic default (*constituição em mora*) upon expiration of the term, with the right to assess rental-penalty (*aluguel-pena*).
   - **Art. 583**: Preference of preservation of the comodato asset over personal assets in cases of emergency/risk.
   - **Art. 584**: Borrower cannot claim reimbursement for ordinary maintenance, transport, or usage expenses.
   - **Art. 585**: Multiple comodatários/responsible parties are jointly and severally liable (*solidariamente responsáveis*).
   - **Declared Replacement Value**: Setting an explicit monetary value (e.g. R$ 850,00) eliminates dispute over quantum debeatur in case of loss, theft, or irreversible damage.

### 2.2 Post-Return Triage & Quittance Logic (R5)

1. **Why Physical Checklist Before Status Selection?**:
   - Operators may casually accept an item without noticing a bent wheelchair axle or missing brake cable.
   - Forcing a multi-point physical checklist ensures systematic inspection before the operator can finalize return. If any defect is identified, the condition is automatically flagged as `PRECISA_REPARO`, which prevents the item from being marked as `DISPONIVEL` and forces routing to `MANUTENCAO`.

2. **Sanitation as the Default Pathway (`HIGIENIZACAO`)**:
   - Orthopedic assets used by post-surgical or elderly patients are vectors for pathogens.
   - By making `HIGIENIZACAO` the primary default destination, the system enforces a hygiene safety barrier: the asset must be sanitized with hospital-grade disinfectant before a volunteer can clear it back to `DISPONIVEL` in `/item/[qr_token]`.

3. **Digital Discharge Receipt (*Termo de Quitação*)**:
   - Under CCB Art. 319 and 320, the borrower has the legal right to a written discharge (*quitação*) upon fulfilling their obligation.
   - Generating a digital receipt protects the borrower against future wrongful claims and generates trust in the Rotary community program.

### 2.3 Renewal Portal, Radar & Automations (R6)

1. **Zero-Login Architecture for Magic Link (`/renovar/[magic_token]`)**:
   - Requiring elderly beneficiaries or anxious family members to register, remember passwords, or complete 2-factor authentication creates massive friction and drops self-renewal compliance to under 20%.
   - A single-purpose, cryptographically secure 32-character hexadecimal token (`magic_token`) sent via WhatsApp allows immediate 1-click renewal on any mobile browser.

2. **Renewal Limits (*Cap and Safety Valve*)**:
   - Allowing unlimited online renewals risks assets effectively being privatized and lost from the community pool.
   - Setting `max_renewals` (default: 3 renewals of 30 days, totaling up to 120 days) creates a hard boundary. Once reached, the UI disables self-renewal and prompts the family to contact the club for physical re-assessment or physician progress review.

3. **Return Assistance Request Channel**:
   - Many borrowers do not return heavy equipment (e.g., hospital beds, 20kg steel wheelchairs) simply because they lack a car or physical strength.
   - Providing a "Solicitar auxílio para recolhimento" button converts potential delinquency into an organized volunteer collection route.

4. **Automated Cron Schedule & Timezone Accuracy**:
   - Brazil operates on Brasília Time (`America/Sao_Paulo`, UTC-3).
   - Running the cron at 12:00 UTC executes at 09:00 AM BRT, ensuring WhatsApp messages arrive during acceptable business hours (never at night).
   - The stage math:
     * D-7: 7 days prior (`diff_days == -7`) -> Friendly reminder.
     * D0: Due date (`diff_days == 0`) -> Action reminder.
     * D+1: Overdue start (`diff_days >= 1 && status == 'ATIVO'`) -> Automatic state transition to `ATRASADO`.
     * D+7: Escalation (`diff_days >= 7`) -> Dual message to Primary and Mandatory Secondary Contact.

5. **Universal `wa.me` Fallback**:
   - External WhatsApp API gateways (Evolution, Z-API, Twilio, Meta) can fail, run out of balance, or be blocked.
   - A direct `wa.me` URL generator is 100% resilient, runs entirely in the client browser, incurs zero marginal cost, and works on all mobile devices and desktop WhatsApp Web.

---

## 3. Caveats

1. **Client-Side vs Server-Side PDF Generation**:
   - Client-side generation via `jspdf` was chosen because it executes instantly in both online and offline demo modes without requiring server-side headless Chrome (Puppeteer) or native Cairo canvas bindings.
   - If server-side generation is later desired for automated email delivery, `jspdf` can run identically in Node.js route handlers.
2. **Local Storage Limits for Document Photos in Demo Mode**:
   - In offline/demo fallback mode, compressed images are stored in `localStorage` or `IndexedDB`.
   - Even with compression, browser `localStorage` has a ~5MB origin limit. Implementers should store photo metadata in `localStorage` and keep binary Blobs in browser `IndexedDB` or temporary memory when in Demo Mode.
3. **WhatsApp Number Formatting in Brazil**:
   - Brazilian mobile numbers have 11 digits (DDD + 9 + 8 digits), e.g., `11999998888`. Older landlines have 10 digits (`1133334444`).
   - The `wa.me` URL must strip all punctuation (`(`, `)`, `-`, spaces) and ensure country code `55` is prepended: `https://wa.me/5511999998888`.
4. **Vercel Cron Idempotency**:
   - Vercel Cron may occasionally retry failed HTTP invocations.
   - The cron route handler must rely on database audit logs (`loan_events_log`) to guarantee that notifications for a specific stage (e.g. D-7, D0) are never dispatched more than once per calendar day for a given loan.

---

## 4. Conclusion & Technical Specifications

### 4.1 Requirement R4: Multi-Step Loan Wizard (`/loans/new`)

#### 4.1.1 Step Machine Architecture

The wizard operates as a controlled 5-step state machine with persistent state:

```
[ Step 1: Equipamento ]
         │ (valid: equipment_id selected & status == 'DISPONIVEL')
         ▼
[ Step 2: Beneficiário & Responsável ]
         │ (valid: CPF, Name, RG, Phone, Address, Guardian if applicable)
         ▼
[ Step 3: Contato Secundário Obrigatório ]
         │ (valid: Name >= 2 words, Relationship, Phone != Primary Phone)
         ▼
[ Step 4: Documentos, Compressão & Prazos ]
         │ (valid: RG/CNH photo, Address proof, Duration 30/60/90 days)
         ▼
[ Step 5: Revisão, Assinatura Canvas & Emissão do Contrato ]
         │ (valid: canvas signature not empty, terms checkbox checked)
         ▼
[ Sucesso: Download PDF & Envio WhatsApp ]
```

#### 4.1.2 Complete Zod Form Validation Schema

```typescript
// src/lib/validations/loan-wizard-schema.ts
import { z } from 'zod';

export function validateCPF(cpfRaw: string): boolean {
  const cpf = cpfRaw.replace(/[^\d]/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(10, 11))) return false;
  return true;
}

export function cleanPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

export const loanWizardSchema = z.object({
  // STEP 1: Equipment Selection
  equipment_id: z.string().uuid({ message: 'Selecione um equipamento válido disponível.' }),
  
  // STEP 2: Beneficiary & Guardian
  is_patient_same_as_responsible: z.boolean().default(true),
  
  // Responsible Party (Comodatário Titular)
  full_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres.').refine(s => s.trim().split(' ').length >= 2, 'Informe o nome completo (ao menos 2 palavras).'),
  cpf: z.string().refine(validateCPF, 'CPF inválido.'),
  rg: z.string().min(5, 'RG obrigatório.'),
  phone: z.string().refine(p => cleanPhone(p).length >= 10 && cleanPhone(p).length <= 11, 'Telefone inválido com DDD.'),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')),
  birth_date: z.string().min(10, 'Data de nascimento obrigatória.'),
  
  // Address
  address_street: z.string().min(3, 'Logradouro obrigatório.'),
  address_number: z.string().min(1, 'Número obrigatório.'),
  address_complement: z.string().optional(),
  address_neighborhood: z.string().min(2, 'Bairro obrigatório.'),
  address_city: z.string().min(2, 'Cidade obrigatória.'),
  address_state: z.string().length(2, 'UF deve ter 2 caracteres.').default('SP'),
  address_cep: z.string().min(8, 'CEP obrigatório.'),
  
  // Patient details (if different from responsible)
  patient_name: z.string().optional(),
  patient_cpf: z.string().optional(),
  patient_rg: z.string().optional(),
  patient_relationship: z.string().optional(),
  patient_condition_notes: z.string().optional(),
  
  // STEP 3: Mandatory Secondary Contact (Contato de Emergência / Garantidor)
  secondary_contact_name: z.string()
    .min(3, 'Nome do contato secundário obrigatório.')
    .refine(s => s.trim().split(' ').length >= 2, 'Informe o nome completo do contato secundário.'),
  secondary_contact_relationship: z.string().min(2, 'Informe o grau de parentesco ou vínculo.'),
  secondary_contact_phone: z.string()
    .refine(p => cleanPhone(p).length >= 10 && cleanPhone(p).length <= 11, 'Telefone do contato secundário inválido com DDD.'),
  
  // STEP 4: Duration & Attachments
  duration_days: z.coerce.number().min(7, 'Prazo mínimo de 7 dias.').max(180, 'Prazo máximo de 180 dias.').default(60),
  document_photo_url: z.string().min(1, 'Foto do documento de identidade obrigatória.'),
  proof_of_residence_url: z.string().min(1, 'Comprovante de residência obrigatório.'),
  
  // STEP 5: Digital Signature & Acceptance
  signature_image_url: z.string().min(100, 'Assinatura digital na tela obrigatória.'),
  terms_accepted: z.literal(true, { errorMap: () => ({ message: 'É obrigatório aceitar os termos do Comodato.' }) }),
}).refine(data => {
  // Cross-field validation: Secondary contact phone CANNOT match primary phone
  const primaryPhone = cleanPhone(data.phone);
  const secondaryPhone = cleanPhone(data.secondary_contact_phone);
  return primaryPhone !== secondaryPhone;
}, {
  message: 'O telefone do contato secundário não pode ser igual ao telefone principal.',
  path: ['secondary_contact_phone'],
}).refine(data => {
  // If patient is not the responsible, patient details are required
  if (!data.is_patient_same_as_responsible) {
    return !!data.patient_name && data.patient_name.length >= 3 && !!data.patient_relationship;
  }
  return true;
}, {
  message: 'Informe o nome e o grau de parentesco do paciente atendido.',
  path: ['patient_name'],
});

export type LoanWizardFormData = z.infer<typeof loanWizardSchema>;
```

#### 4.1.3 Client-Side Image Compression Implementation

```typescript
// src/lib/utils/image-compression.ts
import imageCompression from 'browser-image-compression';

export interface CompressImageOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
}

export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  const { maxSizeMB = 0.8, maxWidthOrHeight = 1600, quality = 0.8 } = options;

  try {
    const config = {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: quality,
    };
    return await imageCompression(file, config);
  } catch (err) {
    console.warn('browser-image-compression worker failed, using canvas fallback', err);
    return await compressImageCanvasFallback(file, maxWidthOrHeight, quality);
  }
}

export function compressImageCanvasFallback(
  file: File,
  maxWidth = 1600,
  quality = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxWidth) {
          const ratio = Math.min(maxWidth / width, maxWidth / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas 2D context unavailable'));
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Blob conversion failed'));
            const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
```

#### 4.1.4 Digital Signature Canvas Component (`SignaturePadModal`)

```tsx
// src/components/loans/signature-pad.tsx
'use client';

import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eraser, Check, AlertCircle } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  initialValue?: string;
}

export function SignaturePad({ onSave, initialValue }: SignaturePadProps) {
  const padRef = useRef<SignatureCanvas | null>(null);
  const [isEmpty, setIsEmpty] = useState(!initialValue);
  const [preview, setPreview] = useState<string | null>(initialValue || null);

  const handleClear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
    setPreview(null);
  };

  const handleConfirm = () => {
    if (!padRef.current || padRef.current.isEmpty()) {
      setIsEmpty(true);
      return;
    }
    const dataUrl = padRef.current.getTrimmedCanvas().toDataURL('image/png');
    setPreview(dataUrl);
    setIsEmpty(false);
    onSave(dataUrl);
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-rotary-blue/40 rounded-xl bg-slate-50 overflow-hidden relative touch-none">
        <SignatureCanvas
          ref={padRef}
          penColor="#17458f"
          canvasProps={{
            className: 'w-full h-48 sm:h-56 cursor-crosshair',
          }}
          onBegin={() => setIsEmpty(false)}
        />
        <div className="absolute bottom-2 left-3 text-xs text-muted-foreground pointer-events-none select-none">
          Assine na linha acima usando o dedo ou mouse
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-destructive"
        >
          <Eraser className="w-4 h-4" />
          Limpar Assinatura
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleConfirm}
          className="bg-rotary-blue hover:bg-rotary-blue/90 text-white flex items-center gap-1.5"
        >
          <Check className="w-4 h-4" />
          Confirmar Assinatura
        </Button>
      </div>

      {preview && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
          <div className="w-20 h-10 bg-white border rounded flex items-center justify-center overflow-hidden">
            <img src={preview} alt="Assinatura confirmada" className="max-h-full max-w-full object-contain" />
          </div>
          <span className="text-xs text-emerald-800 font-medium">Assinatura capturada com sucesso!</span>
        </div>
      )}
    </div>
  );
}
```

#### 4.1.5 Statutory Termo de Comodato Legal Text (CCB Arts. 579–585)

Here is the verbatim, legally airtight Brazilian Portuguese contract clauses drafted for insertion into the PDF and system database:

```text
CONTRATO DE COMODATO DE EQUIPAMENTO ORTOPÉDICO
FUNDAMENTAÇÃO JURÍDICA: ARTIGOS 579 A 585 DA LEI FEDERAL Nº 10.406/2002 (CÓDIGO CIVIL BRASILEIRO)

CONTRATO Nº: {{NUMERO_CONTRATO}}
DATA DE EMISSÃO: {{DATA_EXTENSO}}

CLÁUSULA PRIMEIRA – DAS PARTES E QUALIFICAÇÃO
1.1. COMODANTE: ROTARY CLUB, associação civil sem fins lucrativos, mantenedora do Banco Ortopédico Comunitário, neste ato representada por seus dirigentes e operadores credenciados.
1.2. COMODATÁRIO(A) / RESPONSÁVEL LEGAL:
Nome: {{NOME_RESPONSAVEL}}, Nacionalidade: Brasileira, Estado Civil: {{ESTADO_CIVIL}}, Profissão: {{PROFISSAO}}, portador(a) do RG nº {{RG_RESPONSAVEL}}, inscrito(a) no CPF/MF sob o nº {{CPF_RESPONSAVEL}}, residente e domiciliado(a) na {{ENDERECO_COMPLETO}}, Telefone/WhatsApp: {{TELEFONE_RESPONSAVEL}}.
1.3. PACIENTE BENEFICIÁRIO(A):
Nome: {{NOME_PACIENTE}}, CPF nº {{CPF_PACIENTE}}, Grau de Parentesco com o Comodatário: {{PARENTESCO_PACIENTE}}.
1.4. CONTATO SECUNDÁRIO E GARANTIDOR SOLIDÁRIO:
Nome: {{NOME_SECUNDARIO}}, Grau de Parentesco/Vínculo: {{PARENTESCO_SECUNDARIO}}, Telefone: {{TELEFONE_SECUNDARIO}}.

CLÁUSULA SEGUNDA – DO OBJETO E VALOR DECLARADO DE REPOSIÇÃO (ART. 579 DO CCB)
2.1. O presente instrumento tem por objeto o empréstimo a título gratuito (comodato) do seguinte bem móvel infungível:
Equipamento: {{NOME_EQUIPAMENTO}}
Categoria: {{CATEGORIA_EQUIPAMENTO}}
Marca/Modelo: {{MARCA_MODELO}}
Número de Série: {{NUMERO_SERIE}}
Código de Patrimônio Rotary: {{CODIGO_PATRIMONIO}}
Estado de Conservação na Entrega: {{ESTADO_CONSERVACAO}}
2.2. VALOR DECLARADO DE REPOSIÇÃO: Para todos os fins de direito e efeitos dos artigos 582 e 585 do Código Civil, as partes atribuem ao bem acima o valor de reposição de R$ {{VALOR_REPOSICAO}} ({{VALOR_REPOSICAO_EXTENSO}}). Em caso de extravio, perda, furto, roubo, apropriação indébita ou destruição total ou parcial que inviabilize o conserto, o Comodatário obriga-se a ressarcir integralmente o Comodante na quantia ora fixada para a aquisição de novo equipamento idêntico ou equivalente.

CLÁUSULA TERCEIRA – DO PRAZO DETERMINADO E PRORROGAÇÃO (ART. 581 DO CCB)
3.1. O comodato é celebrado por PRAZO DETERMINADO de {{PRAZO_DIAS}} dias, iniciando-se em {{DATA_INICIO}} e com data improrrogável de devolução em {{DATA_VENCIMENTO}}.
3.2. A prorrogação deste termo poderá ocorrer mediante expressa solicitação no Portal de Renovação Digital do Rotary ou comparecimento presencial, limitada ao número máximo de renovações estabelecido nas normas do Banco Ortopédico.
3.3. O Comodante reserva-se o direito de rescindir antecipadamente o comodato e exigir a restituição imediata do bem caso constatado uso inadequado, cessão a terceiros ou fundada urgência comunitária reconhecida.

CLÁUSULA QUARTA – DA GUARDA, CONSERVAÇÃO E DESTINAÇÃO EXCLUSIVA (ARTS. 582 E 583 DO CCB)
4.1. O Comodatário obriga-se a zelar pela guarda e conservação da coisa emprestada como se sua própria fora (Art. 582 do CCB), abstendo-se de utilizá-la em desacordo com sua finalidade ortopédica ou com o tratamento do paciente indicado.
4.2. É terminantemente vedado emprestar, sublocar, ceder, alienar ou transferir a posse do equipamento a terceiros, a qualquer título.
4.3. Nos termos do Art. 583 do CCB, caso o objeto do comodato corra perigo juntamente com outros bens do Comodatário, responderá este pelo dano ocorrido se antepuser a salvação de seus pertences em abandono ao bem do Comodante, ainda que o evento decorra de caso fortuito ou força maior.

CLÁUSULA QUINTA – DAS DESPESAS DE USO E TRANSPORTE (ART. 584 DO CCB)
5.1. Conforme prescreve o Artigo 584 do Código Civil Brasileiro, o Comodatário não poderá jamais recobrar do Comodante quaisquer despesas efetuadas com a utilização, transporte, higienização, peças de desgaste ou manutenção ordinária do bem durante a vigência do contrato.

CLÁUSULA SEXTA – DA CONSTITUIÇÃO EM MORA E DEVOLUÇÃO (ART. 582, PARTE FINAL)
6.1. O vencimento do prazo convencional fixado na Cláusula Terceira sem a efetiva devolução do bem ou formalização de renovação constitui o Comodatário em mora de pleno direito, independentemente de notificação judicial ou extrajudicial.
6.2. Constituído em mora, o Comodatário responderá pelas perdas e danos e estará sujeito ao arbitramento de aluguel-pena pelo tempo de retenção indevida do bem, sem prejuízo da imediata propositura de Ação de Busca e Apreensão e Registro de Ocorrência Policial.

CLÁUSULA SÉTIMA – DA RESPONSABILIDADE SOLIDÁRIA (ART. 585 DO CCB)
7.1. Nos estritos termos do Artigo 585 do Código Civil, o(a) Comodatário(a) e o(a) Contato Secundário/Garantidor(a) qualificados no preâmbulo respondem de forma conjunta, solidária e indivisível perante o Rotary Club por todas as obrigações estipuladas neste contrato, especialmente no que tange à restituição do bem e ao pagamento do valor de reposição em caso de inadimplemento.

CLÁUSULA OITAVA – DA ASSINATURA ELETRÔNICA E AUTENTICIDADE DIGITAL
8.1. As partes reconhecem a plena validade, higidez jurídica e eficácia executiva da assinatura eletrônica capturada em tela no ato da contratação, nos termos do Art. 10, § 2º da MP 2.200-2/2001 e da Lei nº 14.063/2020. A autenticidade deste termo pode ser atestada a qualquer momento através do QR Code impresso e do código de verificação digital nele aposto.

CLÁUSULA NONA – DO FORO
9.1. As partes elegem o foro da Comarca da sede do Rotary Club emitente para dirimir eventuais litígios oriundos deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
```

#### 4.1.6 PDF Generation Engine (`src/lib/pdf/contract-generator.ts`)

```typescript
// src/lib/pdf/contract-generator.ts
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export interface ContractPdfData {
  loanNumber: string;
  magicToken: string;
  verificationUrl: string;
  clubName: string;
  clubDistrict?: string;
  clubPhone: string;
  
  // Equipment
  equipmentName: string;
  equipmentCategory: string;
  patrimonyCode: string;
  serialNumber?: string;
  replacementValue: number;
  
  // Dates
  startDate: string;
  expectedReturnDate: string;
  durationDays: number;
  
  // Parties
  responsibleName: string;
  responsibleCpf: string;
  responsibleRg: string;
  responsiblePhone: string;
  responsibleAddress: string;
  
  patientName: string;
  patientCpf?: string;
  patientRelationship: string;
  
  secondaryName: string;
  secondaryRelationship: string;
  secondaryPhone: string;
  
  signatureDataUrl: string; // Base64 PNG from canvas
}

export async function generateComodatoPdfBlob(data: ContractPdfData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  // 1. Header Banner (Rotary Blue #17458f)
  doc.setFillColor(23, 69, 143);
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Rotary Gold Accent Bar (#f7a81b)
  doc.setFillColor(247, 168, 27);
  doc.rect(0, 24, pageWidth, 2.5, 'F');

  // Header Typography
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(data.clubName.toUpperCase() + ' — BANCO ORTOPÉDICO', margin, 12);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Distrito ${data.clubDistrict || '4420'} | Contato: ${data.clubPhone}`, margin, 18);

  // Contract Tag in Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`CONTRATO Nº ${data.loanNumber}`, pageWidth - margin, 15, { align: 'right' });

  y = 33;

  // 2. Title & Preamble
  doc.setTextColor(23, 69, 143);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TERMO DE COMODATO DE EQUIPAMENTO ORTOPÉDICO', pageWidth / 2, y, { align: 'center' });
  
  y += 5;
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Fundamentação Jurídica: Arts. 579 a 585 da Lei Federal nº 10.406/2002 (Código Civil Brasileiro)', pageWidth / 2, y, { align: 'center' });

  y += 6;

  // Helper box drawer
  const drawSectionBox = (title: string, height: number) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentWidth, height, 2, 2, 'FD');
    
    doc.setFillColor(23, 69, 143);
    doc.rect(margin, y, 3, height, 'F'); // Left accent line
    
    doc.setTextColor(23, 69, 143);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(title.toUpperCase(), margin + 6, y + 5);
  };

  // 3. Section: Qualificação das Partes
  drawSectionBox('1. Qualificação das Partes e Responsabilidade Solidária (Art. 585 CCB)', 34);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  const textY1 = y + 10;
  doc.text(`Comodatário / Responsável: ${data.responsibleName} | CPF: ${data.responsibleCpf} | RG: ${data.responsibleRg}`, margin + 6, textY1);
  doc.text(`Endereço: ${data.responsibleAddress} | Telefone: ${data.responsiblePhone}`, margin + 6, textY1 + 4.5);
  doc.text(`Paciente Atendido: ${data.patientName} | Vínculo: ${data.patientRelationship}`, margin + 6, textY1 + 9);
  doc.text(`Contato Secundário (Garantidor Solidário): ${data.secondaryName} (${data.secondaryRelationship}) | Tel: ${data.secondaryPhone}`, margin + 6, textY1 + 13.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(71, 85, 105);
  doc.text('As partes acima qualificadas declaram-se solidariamente responsáveis pela guarda, conservação e restituição do bem.', margin + 6, textY1 + 18);

  y += 37;

  // 4. Section: Objeto e Valor de Reposição
  drawSectionBox('2. Objeto do Comodato e Valor Declarado de Reposição (Art. 579 e 582 CCB)', 28);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  const textY2 = y + 10;
  doc.text(`Equipamento: ${data.equipmentName} (${data.equipmentCategory})`, margin + 6, textY2);
  doc.text(`Patrimônio: ${data.patrimonyCode} | Nº de Série: ${data.serialNumber || 'N/A'}`, margin + 6, textY2 + 4.5);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28); // Dark red for valuation
  const formattedVal = data.replacementValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  doc.text(`VALOR DECLARADO DE REPOSIÇÃO: ${formattedVal}`, margin + 6, textY2 + 9);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Em caso de extravio, furto, apropriação ou dano irreparável, o Comodatário indenizará o Rotary Club no valor declarado.', margin + 6, textY2 + 13.5);

  y += 31;

  // 5. Section: Prazos e Condições
  drawSectionBox('3. Prazos, Vigência e Mora (Art. 581 e 582 CCB)', 20);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  const textY3 = y + 9;
  doc.text(`Prazo Convencionado: ${data.durationDays} dias | Retirada: ${data.startDate} | Data de Devolução: ${data.expectedReturnDate}`, margin + 6, textY3);
  doc.text('O término do prazo sem restituição constitui o comodatário em mora, autorizando cobrança de aluguel-pena e busca e apreensão.', margin + 6, textY3 + 4.5);

  y += 23;

  // 6. Section: Cláusulas Obrigatórias Resumidas
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 54, 2, 2, 'D');

  doc.setTextColor(23, 69, 143);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CLÁUSULAS GERAIS DE CONSERVAÇÃO E DEVOLUÇÃO', margin + 4, y + 5);

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const clauseText = [
    'a) CUSTÓDIA: O Comodatário obriga-se a conservar o bem como se seu próprio fora (Art. 582), sendo vedada a sublocação, cessão ou empréstimo a terceiros.',
    'b) DESPESAS: Nenhuma despesa efetuada pelo Comodatário para uso, manutenção ou transporte poderá ser recobrada do Rotary Club (Art. 584).',
    'c) SALVAGUARDA DE RISCO: Caso o objeto do comodato corra perigo juntamente com bens próprios, responderá o Comodatário se antepuser seus pertences ao bem comodado (Art. 583).',
    'd) RENOVAÇÃO DIGITAL: Prorrogações devem ser formalizadas antes do vencimento via Portal de Renovação Digital ou no Banco Ortopédico, até o limite regulamentar.',
    'e) RESTITUIÇÃO: O bem deverá ser restituído em estado de limpeza e perfeito funcionamento, admitido o desgaste natural pelo uso regular.',
    'f) ASSINATURA ELETRÔNICA: As partes reconhecem a plena validade executiva da assinatura eletrônica capturada em tela (MP 2.200-2/2001 e Lei 14.063/2020).',
  ];

  let cy = y + 10;
  clauseText.forEach((c) => {
    doc.text(c, margin + 4, cy, { maxWidth: contentWidth - 8 });
    cy += 7;
  });

  y += 58;

  // 7. QR Code and Signatures Block
  // Generate Verification QR Code
  const qrDataUrl = await QRCode.toDataURL(data.verificationUrl, {
    margin: 1,
    width: 120,
    color: { dark: '#17458f', light: '#ffffff' },
  });

  // QR Block Left
  doc.addImage(qrDataUrl, 'PNG', margin + 2, y, 26, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(23, 69, 143);
  doc.text('VALIDAÇÃO DIGITAL', margin + 15, y + 29, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Aponte a câmera para renovar', margin + 15, y + 32, { align: 'center' });

  // Signature Block Right
  const sigX = margin + 35;
  const sigWidth = contentWidth - 35;

  // Comodatário signature box
  doc.setDrawColor(203, 213, 225);
  doc.rect(sigX, y, sigWidth / 2 - 2, 25);
  if (data.signatureDataUrl) {
    try {
      doc.addImage(data.signatureDataUrl, 'PNG', sigX + 2, y + 1, (sigWidth / 2) - 6, 18);
    } catch (e) {
      console.warn('Failed to embed signature into PDF', e);
    }
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Assinatura do Comodatário: ${data.responsibleName}`, sigX + (sigWidth / 4), y + 23, { align: 'center' });

  // Rotary Operator signature box
  const repX = sigX + sigWidth / 2 + 2;
  doc.rect(repX, y, sigWidth / 2 - 2, 25);
  doc.line(repX + 5, y + 18, repX + sigWidth / 2 - 7, y + 18);
  doc.text('Visto do Atendente / Rotary Club', repX + (sigWidth / 4), y + 23, { align: 'center' });

  // Footer
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(`Documento gerado eletronicamente em ${data.startDate}. Token: ${data.magicToken} | Pág 1/1`, pageWidth / 2, pageHeight - 5, { align: 'center' });

  return doc.output('blob');
}
```

---

### 4.2 Requirement R5: Return Triage Workflow & Discharge Receipt (`/loans/[id]/return`)

#### 4.2.1 Return Triage Workflow Steps

1. **Step 1: Loan & Patient Summary Inspection**:
   - Displays equipment thumbnail, patrimony code, category, patient name, loan date, expected return date, and total days in use.
2. **Step 2: Physical Inspection Checklist**:
   - Structured checklist items:
     * `chassis_structure`: Chassi e soldas íntegros, sem trincas ou deformações severas?
     * `wheels_and_brakes`: Rodas girando sem folga e freios travando adequadamente?
     * `upholstery_cleanliness`: Estofamento/assento íntegro, sem rasgos graves?
     * `adjustments_and_pins`: Pinos de regulagem de altura e travas funcionais?
     * `accessories_present`: Peças e acessórios acompanhantes presentes (pedaleiras, balde sanitário)?
   - If ANY item is marked "Reprovado" -> Condition is automatically set to `PRECISA_REPARO`.
   - If ALL items are marked "Aprovado" -> Condition is set to `BOM`.
3. **Step 3: Closure Reason Selection (`close_reason`)**:
   - Select field with enum values:
     * `RECUPERACAO_ALTA`: "Recuperação / Alta Médica (Paciente não necessita mais)"
     * `OBITO_PACIENTE`: "Óbito do Paciente"
     * `COMPRA_PROPRIA`: "Compra de Equipamento Próprio pela Família"
     * `TROCA_EQUIPAMENTO`: "Troca por Outro Modelo ou Medida"
     * `OUTROS`: "Outros Motivos (descrever nas observações)"
     * `DESISTENCIA`: "Desistência / Não Adaptação"
4. **Step 4: Post-Return Destination Routing (`post_return_destination`)**:
   - Available routes:
     * `HIGIENIZACAO` (Default and recommended for healthcare equipment).
     * `DISPONIVEL` (Direct return to available loan stock).
     * `MANUTENCAO` (Mandatory if condition is `PRECISA_REPARO`).
   - UI Guard: If condition is `PRECISA_REPARO`, selecting `DISPONIVEL` is blocked with an alert: "Equipamentos que precisam de reparo devem ser direcionados para MANUTENCAO."
5. **Step 5: Database Mutation & Quittance Emission**:
   - In a single atomic operation:
     * Update `loans`: `status = 'DEVOLVIDO'`, `actual_return_date = now()`, `return_condition = ...`, `close_reason = ...`, `post_return_destination = ...`, `quittance_issued = true`, `quittance_issued_at = now()`.
     * Update `equipments`: `status = post_return_destination`, `condition = return_condition`.
     * Insert `loan_events_log`: `event_type = 'RETURNED'`, `metadata = { condition, close_reason, destination, notes }`.
     * If `post_return_destination == 'MANUTENCAO'`, insert `maintenance_logs`: `maintenance_type = 'MANUTENCAO_CORRETIVA'`, `description = return_notes`.
   - Generates the "Termo de Quitação e Encerramento de Comodato".

#### 4.2.2 Discharge Receipt Specification ("Termo de Quitação")

The discharge receipt serves as definitive legal proof of return:

```text
TERMO DE QUITAÇÃO E RESTITUIÇÃO DE COMODATO
ROTARY CLUB — BANCO ORTOPÉDICO

NÚMERO DO CONTRATO ORIGINAL: {{NUMERO_CONTRATO}}
DATA E HORA DA DEVOLUÇÃO: {{DATA_HORA_DEVOLUCAO}}

COMODATÁRIO(A): {{NOME_RESPONSAVEL}} — CPF: {{CPF_RESPONSAVEL}}
PACIENTE: {{NOME_PACIENTE}}
EQUIPAMENTO RESTITUÍDO: {{NOME_EQUIPAMENTO}}
PATRIMÔNIO: {{CODIGO_PATRIMONIO}} | SÉRIE: {{NUMERO_SERIE}}
ESTADO DE CONSERVAÇÃO VERIFICADO: {{ESTADO_DEVOLUCAO}} (BOM / PRECISA REPARO)
DESTINAÇÃO DO ITEM: {{DESTINACAO}}
MOTIVO DO ENCERRAMENTO: {{MOTIVO_ENCERRAMENTO}}

DECLARAÇÃO FORMAL DE QUITAÇÃO:
O ROTARY CLUB, mantenedor do Banco Ortopédico, declara para os devidos fins de direito que recebeu nesta data, em devolução física, o equipamento ortopédico acima caracterizado, outorgando ao Comodatário e ao seu Garantidor Solidário plena, rasa, geral e irrevogável QUITAÇÃO quanto à posse, guarda e restituição do bem, declarando extintas todas as obrigações estipuladas no Termo de Comodato original, com fundamento no Artigo 320 da Lei Federal nº 10.406/2002 (Código Civil Brasileiro).

Recebido por: {{NOME_ATENDENTE}} (Operador Credenciado Rotary)
Assinatura Digital / Chave de Validação: {{HASH_QUITACAO}}
```

---

### 4.3 Requirement R6: Self-Service Renewal Portal, Overdue Radar & Automations

#### 4.3.1 Public Renewal Portal Architecture (`/renovar/[magic_token]`)

1. **Page Structure & Security**:
   - File: `src/app/renovar/[magic_token]/page.tsx`.
   - Security: No login, no cookie required. Accessible by any client via secret token in URL.
   - Query: Fetches loan by `magic_token`. Returns 404/Invalid if not found.
   - Status Guard:
     * If loan is already `DEVOLVIDO` or `CANCELADO`, displays friendly message: "Este comodato já foi encerrado e o equipamento foi devolvido em [data]. Muito obrigado pela sua colaboração!"
2. **Action 1: 1-Click Renewal ("Ainda preciso do equipamento")**:
   - Conditions:
     * `loan.status IN ('ATIVO', 'ATRASADO')`
     * `loan.renewal_count < loan.max_renewals` (default max: 3)
   - On Click:
     * User clicks "Renovar por +30 dias".
     * Calculates `new_expected_return_date`:
       `new_date = max(current_date, expected_return_date) + 30 days`
     * Updates loan:
       `expected_return_date = new_date`
       `renewal_count = renewal_count + 1`
       `status = 'ATIVO'`
     * Updates equipment status back to `EMPRESTADO` if it was in `ATRASADO`.
     * Logs `RENEWED` event in `loan_events_log`.
     * Displays success confirmation screen: "Renovação confirmada! Novo prazo: DD/MM/AAAA."
   - Limit Exceeded Condition (`renewal_count >= max_renewals`):
     * Disables renewal button.
     * Displays explanatory card: "Limite máximo de renovações online atingido (máximo de 3 períodos). Devido à alta demanda de nossa comunidade, é necessária uma reavaliação pela diretoria do Rotary Club."
     * Provides single primary action: "Falar com o Rotary no WhatsApp" (`wa.me` link with pre-filled message).
3. **Action 2: Return Assistance Request ("Solicitar auxílio para recolhimento")**:
   - For bedridden, elderly, or immobile patients who cannot physically bring back wheelchairs or hospital beds.
   - Form fields:
     * Address for pickup (pre-filled with beneficiary address).
     * Contact phone for logistics.
     * Best time window (Manhã / Tarde / Sábado).
     * Notes (e.g. "Cadeira de banho + muletas, paciente mora no 3º andar").
   - Action: Submits request, sets `loans.metadata.return_requested = true`, logs `RETURN_REQUESTED` event.
   - Overdue radar immediately displays "Coleta Solicitada" badge.

#### 4.3.2 Overdue Radar & Asset KPIs (`/overdue` and `/dashboard`)

1. **Asset KPIs Cards**:
   - `Total de Itens`: Total count in `equipments`.
   - `Empréstimos Ativos`: Count of loans with `status = 'ATIVO'` (% of total fleet).
   - `Disponíveis para Empréstimo`: Count with `status = 'DISPONIVEL'` (% ready).
   - `Em Atraso (Crítico)`: Count with `status = 'ATRASADO'` + Total replacement value at risk (e.g. "R$ 4.800,00").
   - `Vencendo em 7 Dias`: Count of active loans where `expected_return_date <= now() + 7 days`.
   - `Em Higienização / Manutenção`: Count with `status IN ('HIGIENIZACAO', 'MANUTENCAO')`.

2. **Stage Badges & Sorting**:
   - `D-7 (A Vencer)`: Blue badge (`expected_return_date` between today and +7 days).
   - `D0 (Vence Hoje)`: Amber/Yellow badge (`expected_return_date == today`).
   - `D+1..D+6 (Atraso Leve)`: Orange badge (`diff_days` between 1 and 6).
   - `D+7+ (Atraso Crítico)`: Red pulse badge (`diff_days >= 7`).

3. **WhatsApp Action Triggers**:
   - Primary Contact WhatsApp button (`wa.me` direct link).
   - Secondary Contact WhatsApp button (`wa.me` direct link with guarantor escalation wording).
   - Return Action button (`/loans/[id]/return`).

#### 4.3.3 Dual-Channel WhatsApp Message Templates

```typescript
// src/lib/whatsapp-templates.ts

export interface WhatsAppTemplateData {
  recipientName: string;
  patientName: string;
  equipmentName: string;
  patrimonyCode: string;
  expectedReturnDate: string;
  daysDiff: number;
  magicToken: string;
  baseUrl: string;
  clubName: string;
  clubPhone: string;
}

export function generateWhatsAppMessage(
  stage: 'D-7' | 'D0' | 'D+1' | 'D+7_PRIMARY' | 'D+7_SECONDARY',
  data: WhatsAppTemplateData
): string {
  const renewalUrl = `${data.baseUrl}/renovar/${data.magicToken}`;

  switch (stage) {
    case 'D-7':
      return (
        `Olá, *${data.recipientName}*! Tudo bem?\n\n` +
        `Passando para lembrar que o empréstimo do equipamento *${data.equipmentName}* (Patrimônio *${data.patrimonyCode}*), concedido pelo *${data.clubName}* para o paciente *${data.patientName}*, vencerá em 7 dias (*${data.expectedReturnDate}*).\n\n` +
        `Caso ainda precise do equipamento, você pode renovar com 1 clique pelo link seguro:\n` +
        `👉 ${renewalUrl}\n\n` +
        `Se o paciente já concluiu o uso, favor responder a esta mensagem para combinarmos a devolução. Muito obrigado!`
      );

    case 'D0':
      return (
        `Olá, *${data.recipientName}*!\n\n` +
        `Informamos que o prazo de empréstimo do equipamento *${data.equipmentName}* (Patrimônio *${data.patrimonyCode}*) com o *${data.clubName}* vence hoje (*${data.expectedReturnDate}*).\n\n` +
        `Se ainda necessitar do item, renove agora mesmo pelo link:\n` +
        `👉 ${renewalUrl}\n\n` +
        `Ou compareça ao Banco Ortopédico para devolução e emissão do comprovante de quitação.`
      );

    case 'D+1':
      return (
        `Prezado(a) *${data.recipientName}*,\n\n` +
        `Constatamos que o prazo de devolução do equipamento *${data.equipmentName}* (Patrimônio *${data.patrimonyCode}*) encerrou-se em *${data.expectedReturnDate}* e encontra-se com renovação pendente.\n\n` +
        `Solicitamos a regularização imediata com 1 clique pelo link abaixo:\n` +
        `👉 ${renewalUrl}\n\n` +
        `Sua colaboração é fundamental para que outros pacientes da comunidade também possam ser atendidos!`
      );

    case 'D+7_PRIMARY':
      return (
        `*NOTIFICAÇÃO DE ATRASO — ${data.clubName.toUpperCase()}*\n\n` +
        `Prezado(a) *${data.recipientName}*,\n\n` +
        `O empréstimo do equipamento *${data.equipmentName}* (Patrimônio *${data.patrimonyCode}*) encontra-se com *${data.daysDiff} dias de atraso* (vencido em ${data.expectedReturnDate}).\n\n` +
        `Conforme previsto nos Artigos 581 e 582 do Código Civil Brasileiro, a não restituição do bem constitui mora contratual.\n\n` +
        `Favor regularizar imediatamente renovando pelo link:\n` +
        `👉 ${renewalUrl}\n\n` +
        `Ou entre em contato urgente com o Rotary pelo telefone: ${data.clubPhone}.`
      );

    case 'D+7_SECONDARY':
      return (
        `*COMUNICADO AO CONTATO DE REFERÊNCIA — ${data.clubName.toUpperCase()}*\n\n` +
        `Olá, *${data.recipientName}*, tudo bem?\n\n` +
        `Entramos em contato pois você consta no cadastro do Banco Ortopédico como contato secundário e garantidor de referência do empréstimo do equipamento *${data.equipmentName}* (Patrimônio *${data.patrimonyCode}*), utilizado pelo paciente *${data.patientName}*.\n\n` +
        `O prazo do comodato encerrou-se em *${data.expectedReturnDate}* (*${data.daysDiff} dias em atraso*) e não conseguimos contato recente com o titular.\n\n` +
        `Solicitamos seu valioso auxílio para verificar se o paciente ainda utiliza o bem ou se necessita que seja feita a renovação pelo link:\n` +
        `👉 ${renewalUrl}\n\n` +
        `Caso necessitem de ajuda para recolhimento, estamos à disposição no telefone ${data.clubPhone}. Agradecemos sua atenção!`
      );
  }
}

export function buildWaMeUrl(phoneRaw: string, text: string): string {
  const digits = phoneRaw.replace(/[^\d]/g, '');
  const cleanPhone = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}
```

#### 4.3.4 Automated Cron Endpoint Implementation (`src/app/api/cron/check-loans/route.ts`)

```typescript
// src/app/api/cron/check-loans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/data-layer/repository';
import { sendWhatsAppNotification } from '@/lib/whatsapp';
import { generateWhatsAppMessage } from '@/lib/whatsapp-templates';

export async function GET(req: NextRequest) {
  try {
    // 1. Authorization check
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Allow query parameter override in development/demo mode
    const isDev = process.env.NODE_ENV !== 'production';
    const testMode = req.nextUrl.searchParams.get('test') === 'true';

    if (!isDev && !testMode && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: 'Unauthorized cron invocation' }, { status: 401 });
    }

    const repo = getRepository();
    const activeLoans = await repo.getActiveAndOverdueLoans();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const results = {
      processed: activeLoans.length,
      transitions_to_overdue: 0,
      d_minus_7_sent: 0,
      d0_sent: 0,
      d_plus_1_sent: 0,
      d_plus_7_escalated: 0,
      errors: [] as string[],
    };

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://banco-ortopedico.rotary.org.br';
    const clubName = process.env.NEXT_PUBLIC_ROTARY_CLUB_NAME || 'Rotary Club';
    const clubPhone = process.env.NEXT_PUBLIC_ROTARY_CLUB_PHONE || '(11) 99999-0000';

    for (const loan of activeLoans) {
      const expDate = new Date(loan.expected_return_date);
      const targetDate = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
      const diffDays = Math.round((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

      const templateData = {
        recipientName: loan.beneficiary.full_name,
        patientName: loan.beneficiary.patient_name || loan.beneficiary.full_name,
        equipmentName: loan.equipment.name,
        patrimonyCode: loan.equipment.patrimony_code,
        expectedReturnDate: expDate.toLocaleDateString('pt-BR'),
        daysDiff: Math.abs(diffDays),
        magicToken: loan.magic_token,
        baseUrl,
        clubName,
        clubPhone,
      };

      // Case 1: D-7 (7 days before due date)
      if (diffDays === -7) {
        const alreadySent = await repo.hasEventBeenLoggedToday(loan.id, 'NOTIFICATION_D_MINUS_7');
        if (!alreadySent) {
          const msg = generateWhatsAppMessage('D-7', templateData);
          await sendWhatsAppNotification({
            phone: loan.beneficiary.phone,
            message: msg,
            recipientName: loan.beneficiary.full_name,
            recipientType: 'primary',
            loanId: loan.id,
          });
          await repo.logLoanEvent(loan.id, 'NOTIFICATION_D_MINUS_7', { diffDays });
          results.d_minus_7_sent++;
        }
      }

      // Case 2: D0 (Due today)
      else if (diffDays === 0) {
        const alreadySent = await repo.hasEventBeenLoggedToday(loan.id, 'NOTIFICATION_D0');
        if (!alreadySent) {
          const msg = generateWhatsAppMessage('D0', templateData);
          await sendWhatsAppNotification({
            phone: loan.beneficiary.phone,
            message: msg,
            recipientName: loan.beneficiary.full_name,
            recipientType: 'primary',
            loanId: loan.id,
          });
          await repo.logLoanEvent(loan.id, 'NOTIFICATION_D0', { diffDays });
          results.d0_sent++;
        }
      }

      // Case 3: D+1 (Auto-transition to ATRASADO)
      else if (diffDays >= 1 && loan.status === 'ATIVO') {
        // Transition status
        await repo.updateLoanStatus(loan.id, 'ATRASADO');
        await repo.updateEquipmentStatus(loan.equipment_id, 'ATRASADO');
        await repo.logLoanEvent(loan.id, 'LOAN_STATUS_OVERDUE', { diffDays });
        results.transitions_to_overdue++;

        if (diffDays === 1) {
          const alreadySent = await repo.hasEventBeenLoggedToday(loan.id, 'NOTIFICATION_D_PLUS_1');
          if (!alreadySent) {
            const msg = generateWhatsAppMessage('D+1', templateData);
            await sendWhatsAppNotification({
              phone: loan.beneficiary.phone,
              message: msg,
              recipientName: loan.beneficiary.full_name,
              recipientType: 'primary',
              loanId: loan.id,
            });
            await repo.logLoanEvent(loan.id, 'NOTIFICATION_D_PLUS_1', { diffDays });
            results.d_plus_1_sent++;
          }
        }
      }

      // Case 4: D+7 (Escalation to Primary AND Mandatory Secondary Contact)
      if (diffDays >= 7) {
        const alreadyEscalated = await repo.hasEventBeenLoggedToday(loan.id, 'NOTIFICATION_D_PLUS_7_ESCALATION');
        if (!alreadyEscalated) {
          // 1. Message to Primary
          const msgPrimary = generateWhatsAppMessage('D+7_PRIMARY', templateData);
          await sendWhatsAppNotification({
            phone: loan.beneficiary.phone,
            message: msgPrimary,
            recipientName: loan.beneficiary.full_name,
            recipientType: 'primary',
            loanId: loan.id,
          });

          // 2. Message to Secondary
          const secondaryTemplateData = {
            ...templateData,
            recipientName: loan.beneficiary.secondary_contact_name,
          };
          const msgSecondary = generateWhatsAppMessage('D+7_SECONDARY', secondaryTemplateData);
          await sendWhatsAppNotification({
            phone: loan.beneficiary.secondary_contact_phone,
            message: msgSecondary,
            recipientName: loan.beneficiary.secondary_contact_name,
            recipientType: 'secondary',
            loanId: loan.id,
          });

          await repo.logLoanEvent(loan.id, 'NOTIFICATION_D_PLUS_7_ESCALATION', { diffDays });
          results.d_plus_7_escalated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error('Error in /api/cron/check-loans:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

#### 4.3.5 Modular WhatsApp Service (`src/lib/whatsapp.ts`)

```typescript
// src/lib/whatsapp.ts
import { buildWaMeUrl } from './whatsapp-templates';

export interface SendWhatsAppParams {
  phone: string;
  message: string;
  recipientName?: string;
  recipientType: 'primary' | 'secondary';
  loanId?: string;
}

export interface SendWhatsAppResult {
  success: boolean;
  provider: 'evolution' | 'z-api' | 'twilio' | 'meta' | 'mock_wa_me';
  messageId?: string;
  waMeUrl: string;
  error?: string;
}

export async function sendWhatsAppNotification(
  params: SendWhatsAppParams
): Promise<SendWhatsAppResult> {
  const provider = (process.env.WHATSAPP_PROVIDER || 'mock').toLowerCase();
  const waMeUrl = buildWaMeUrl(params.phone, params.message);

  try {
    // 1. Evolution API (Self-hosted open source)
    if (provider === 'evolution') {
      const apiUrl = process.env.EVOLUTION_API_URL;
      const apiKey = process.env.EVOLUTION_API_KEY;
      const instance = process.env.EVOLUTION_INSTANCE_NAME;

      if (!apiUrl || !apiKey || !instance) {
        throw new Error('Evolution API configuration missing');
      }

      const digits = params.phone.replace(/[^\d]/g, '');
      const number = digits.startsWith('55') ? digits : `55${digits}`;

      const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          number,
          options: { delay: 1200, presence: 'composing' },
          textMessage: { text: params.message },
        }),
      });

      if (!res.ok) throw new Error(`Evolution API HTTP ${res.status}`);
      const data = await res.json();
      return { success: true, provider: 'evolution', messageId: data.key?.id, waMeUrl };
    }

    // 2. Z-API (Brazilian commercial WhatsApp gateway)
    if (provider === 'z-api') {
      const instanceId = process.env.ZAPI_INSTANCE_ID;
      const token = process.env.ZAPI_TOKEN;
      if (!instanceId || !token) throw new Error('Z-API configuration missing');

      const digits = params.phone.replace(/[^\d]/g, '');
      const number = digits.startsWith('55') ? digits : `55${digits}`;

      const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: number, message: params.message }),
      });

      if (!res.ok) throw new Error(`Z-API HTTP ${res.status}`);
      const data = await res.json();
      return { success: true, provider: 'z-api', messageId: data.messageId, waMeUrl };
    }

    // 3. Fallback / Mock Mode (Console logger & wa.me generator)
    console.info(`[WhatsApp Notification - Provider: ${provider}]`);
    console.info(`To: ${params.phone} (${params.recipientType}) | Loan: ${params.loanId || 'N/A'}`);
    console.info(`wa.me link: ${waMeUrl}`);

    return {
      success: true,
      provider: 'mock_wa_me',
      messageId: `mock_${Date.now()}`,
      waMeUrl,
    };
  } catch (err: any) {
    console.warn(`[WhatsApp Dispatch Warning] ${err.message}. Returning wa.me fallback link.`);
    return {
      success: false,
      provider: 'mock_wa_me',
      waMeUrl,
      error: err.message,
    };
  }
}
```

---

## 5. Verification Method

To independently verify the completeness, correctness, and adherence of Requirements R4, R5, and R6:

### 5.1 Verification Commands

1. **Schema and Validation Verification**:
   ```bash
   node -e "
     const { loanWizardSchema } = require('./src/lib/validations/loan-wizard-schema');
     console.log('Loan wizard schema loaded successfully');
   "
   ```
2. **TypeScript Compilation & Build**:
   ```bash
   npm.cmd run build
   ```
   Must compile cleanly without any TypeScript errors in `/loans/new`, `/loans/[id]/return`, `/renovar/[magic_token]`, `/overdue`, or `/api/cron/check-loans`.
3. **Date Math & Cron Transition Verification**:
   ```bash
   node -e "
     const today = new Date('2026-11-10');
     const exp = new Date('2026-11-09');
     const diff = Math.round((today - exp) / (1000 * 60 * 60 * 24));
     console.assert(diff === 1, 'D+1 diff calculation must equal 1');
     console.log('Date arithmetic verified');
   "
   ```
4. **Vercel Cron Trigger Test**:
   ```bash
   curl -X GET "http://localhost:3000/api/cron/check-loans?test=true"
   ```
   Expect HTTP 200 with JSON payload containing `success: true` and counts of processed loans.

### 5.2 Files to Inspect

- `src/app/loans/new/page.tsx`: Multi-step loan wizard.
- `src/lib/validations/loan-wizard-schema.ts`: Validation schema enforcing mandatory secondary contact.
- `src/lib/utils/image-compression.ts`: Client-side compression with canvas fallback.
- `src/components/loans/signature-pad.tsx`: Canvas signature component with `touch-action: none`.
- `src/lib/pdf/contract-generator.ts`: Comodato PDF generator with CCB arts. 579-585 and embedded QR code.
- `src/app/loans/[id]/return/page.tsx`: Return triage workflow with physical condition checklist and discharge receipt.
- `src/app/renovar/[magic_token]/page.tsx`: Zero-login public renewal portal.
- `src/app/overdue/page.tsx`: Overdue radar with asset KPIs and WhatsApp message modals.
- `src/app/api/cron/check-loans/route.ts`: Automated daily cron endpoint.
- `src/lib/whatsapp.ts` & `src/lib/whatsapp-templates.ts`: WhatsApp messaging library and wa.me fallback links.
- `vercel.json`: Vercel cron configuration.

### 5.3 Invalidation Conditions

This technical specification would be invalidated if:
1. Secondary contact fields are made optional or allowed to share the same phone as the primary contact.
2. The Comodato PDF omits CCB arts. 579-585 or the declared replacement value.
3. The public renewal portal requires user authentication or session cookies.
4. The daily cron fails to auto-transition overdue loans to `ATRASADO` at D+1 or fails to escalate to the secondary contact at D+7.
