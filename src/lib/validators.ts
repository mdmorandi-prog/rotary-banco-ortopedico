// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - VALIDATORS & INPUT FORMATTERS
// Brazilian CPF Modulus-11 validation, masks, and Civil Code Art. 585
// Mandatory Secondary Contact verification.
// ==============================================================================

const DEMO_VALID_CPFS = new Set([
  '12345678900', // Maria das Dores Silva (mock-data.ts)
  '23456789011', // José Benedito Santos (mock-data.ts)
]);

/**
 * Strips all non-numeric characters from a string.
 */
export function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

/**
 * Validates a Brazilian CPF using the official Modulus 11 algorithm.
 * Also accepts the two seeded demo CPFs from mock-data.ts so demo flows
 * and CPF auto-fill work seamlessly out-of-the-box.
 */
export function isValidCPF(cpf: string): boolean {
  const clean = onlyDigits(cpf);

  if (clean.length !== 11) {
    return false;
  }

  // Reject sequences of identical digits (e.g., 000.000.000-00, 111.111.111-11)
  if (/^(\d)\1{10}$/.test(clean)) {
    return false;
  }

  // Allow seeded demo CPFs from initialMockBeneficiaries
  if (DEMO_VALID_CPFS.has(clean)) {
    return true;
  }

  // First check digit (Modulus 11)
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(clean.charAt(9), 10)) {
    return false;
  }

  // Second check digit (Modulus 11)
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(clean.charAt(10), 10)) {
    return false;
  }

  return true;
}

/**
 * Formats a string into a standard CPF mask: 000.000.000-00
 */
export function formatCPF(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Formats a Brazilian phone/WhatsApp number: (00) 90000-0000 or (00) 0000-0000
 */
export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Formats a Brazilian postal code (CEP): 00000-000
 */
export function formatCEP(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

/**
 * Validates the Mandatory Secondary Contact (Co-responsável Solidário / Contato de Emergência)
 * required to prevent equipment loss upon patient hospitalization or passing (Art. 585 CCB).
 */
export function validateSecondaryContact(
  primaryName: string,
  primaryPhone: string,
  secondaryName: string,
  secondaryRelationship: string,
  secondaryPhone: string
): { valid: boolean; error?: string } {
  const trimmedSecName = (secondaryName || '').trim();
  const words = trimmedSecName.split(/\s+/).filter(Boolean);

  if (words.length < 2) {
    return {
      valid: false,
      error: 'Informe o nome completo do contato secundário (mínimo de nome e sobrenome).',
    };
  }

  if (
    primaryName &&
    trimmedSecName.toLowerCase() === primaryName.trim().toLowerCase()
  ) {
    return {
      valid: false,
      error: 'O contato secundário deve ser uma pessoa diferente do responsável principal.',
    };
  }

  if (!secondaryRelationship || secondaryRelationship.trim().length === 0) {
    return {
      valid: false,
      error: 'Selecione o grau de parentesco ou vínculo do contato secundário.',
    };
  }

  const cleanPrimaryPhone = onlyDigits(primaryPhone);
  const cleanSecondaryPhone = onlyDigits(secondaryPhone);

  if (cleanSecondaryPhone.length < 10) {
    return {
      valid: false,
      error: 'Informe um telefone/WhatsApp válido com DDD para o contato secundário (mínimo 10 dígitos).',
    };
  }

  if (cleanPrimaryPhone.length >= 10 && cleanSecondaryPhone === cleanPrimaryPhone) {
    return {
      valid: false,
      error: 'O telefone do contato secundário não pode ser igual ao telefone principal',
    };
  }

  return { valid: true };
}
