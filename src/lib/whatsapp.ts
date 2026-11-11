// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - WHATSAPP NOTIFICATION SERVICE & DEEP-LINK GENERATOR
// Supports REST Webhook APIs (Evolution API / Z-API / Twilio) and universal
// https://wa.me/ fallback links with pre-filled messages in Portuguese.
// ==============================================================================

import { Loan } from './data-layer/types';
import { DEFAULT_CLUB_INFO } from './constants';
import { formatCurrency, formatDate } from './utils';

export interface WhatsAppLinkPayload {
  phone: string;
  message: string;
  url: string;
}

export interface WhatsAppSendResult {
  sentViaApi: boolean;
  fallbackUrl: string;
  timestamp: string;
}

/**
 * Strips all non-numeric characters and ensures the Brazilian country code (55) is prefixed.
 */
export function cleanPhoneForWhatsApp(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '5513997654321';
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  return `55${digits}`;
}

/**
 * Resolves the base application URL for deep links (Magic Renewal Portal, receipts, etc.).
 */
function resolveBaseUrl(baseUrl?: string): string {
  if (baseUrl) return baseUrl.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}

/**
 * Builds a universal https://wa.me/ deep link.
 */
export function createWaMeUrl(phone: string, message: string): string {
  const cleanedPhone = cleanPhoneForWhatsApp(phone);
  return `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * 1. Checkout Confirmation & Comodato Summary Link
 */
export function buildCheckoutWhatsAppLink(
  loan: Loan,
  baseUrl?: string
): WhatsAppLinkPayload {
  const appUrl = resolveBaseUrl(baseUrl);
  const beneficiaryName = loan.beneficiary?.full_name || 'Beneficiário(a)';
  const firstName = beneficiaryName.split(' ')[0];
  const itemName = loan.equipment?.name || 'Equipamento Ortopédico';
  const patrimony = loan.equipment?.patrimony_code || loan.equipment_id;
  const returnDate = formatDate(loan.expected_return_date);
  const replacementVal = formatCurrency(
    loan.replacement_value || loan.equipment?.replacement_value || 0
  );
  const renewalUrl = `${appUrl}/renovar/${loan.magic_token}`;
  const rawPhone = loan.beneficiary?.phone || DEFAULT_CLUB_INFO.contactPhone;
  const phone = cleanPhoneForWhatsApp(rawPhone);

  const message =
    `Olá, *${firstName}*! Aqui é do *Banco de Aparelhos Ortopédicos do ${DEFAULT_CLUB_INFO.clubName}*.\n\n` +
    `Confirmamos o seu empréstimo gratuito (Comodato Arts. 579-585 do Código Civil):\n` +
    `• *Equipamento:* ${itemName}\n` +
    `• *Patrimônio:* #${patrimony}\n` +
    `• *Código do Contrato:* ${loan.loan_code}\n` +
    `• *Valor de Referência:* ${replacementVal}\n` +
    `• *Previsão de Devolução/Renovação:* ${returnDate}\n\n` +
    `📄 *Contrato Assinado (2ª via em PDF):*\n` +
    `Para visualizar e baixar o seu Termo de Comodato assinado em PDF, ou para renovar o prazo em 1 clique, acesse seu portal exclusivo:\n` +
    `${renewalUrl}\n\n` +
    `Desejamos uma excelente e rápida recuperação! Em caso de dúvidas, fale conosco pelo WhatsApp: ${DEFAULT_CLUB_INFO.contactPhone}.`;

  return {
    phone,
    message,
    url: createWaMeUrl(phone, message),
  };
}

/**
 * 2. Renewal Reminder & Overdue Notice (D-7, D0, OVERDUE) with Magic Link
 */
export function buildRenewalReminderWhatsAppLink(
  loan: Loan,
  stage: 'D-7' | 'D0' | 'OVERDUE',
  baseUrl?: string
): WhatsAppLinkPayload {
  const appUrl = resolveBaseUrl(baseUrl);
  const beneficiaryName = loan.beneficiary?.full_name || 'Beneficiário(a)';
  const firstName = beneficiaryName.split(' ')[0];
  const itemName = loan.equipment?.name || 'Equipamento Ortopédico';
  const patrimony = loan.equipment?.patrimony_code || loan.equipment_id;
  const returnDate = formatDate(loan.expected_return_date);
  const renewalUrl = `${appUrl}/renovar/${loan.magic_token}`;
  const rawPhone = loan.beneficiary?.phone || DEFAULT_CLUB_INFO.contactPhone;
  const phone = cleanPhoneForWhatsApp(rawPhone);

  let message = '';

  if (stage === 'D-7') {
    message =
      `Olá, *${firstName}*! Tudo bem? Aqui é do *Banco Ortopédico do ${DEFAULT_CLUB_INFO.clubName}*.\n\n` +
      `Lembramos que o prazo atual do seu empréstimo do item *${itemName}* (*#${patrimony}*) vence em *7 dias* (${returnDate}).\n\n` +
      `✅ *Ainda está utilizando o aparelho?* Você pode renovar gratuitamente por *+30 dias* com apenas 1 clique no link abaixo (não precisa de senha):\n` +
      `${renewalUrl}\n\n` +
      `🙏 *Já concluiu o uso?* Pelo mesmo link você encontra nosso endereço para devolução ou pode solicitar apoio da nossa equipe. Sua resposta ajuda outras famílias na fila de espera!`;
  } else if (stage === 'D0') {
    message =
      `Olá, *${firstName}*! Aqui é do *Banco Ortopédico do ${DEFAULT_CLUB_INFO.clubName}*.\n\n` +
      `Hoje (*${returnDate}*) encerra o período atual do seu empréstimo do equipamento *${itemName}* (*#${patrimony}*).\n\n` +
      `👉 *Para renovar por +30 dias agora mesmo* ou combinar a devolução, clique no link rápido:\n` +
      `${renewalUrl}\n\n` +
      `Contamos com sua confirmação para manter seu cadastro regularizado!`;
  } else {
    message =
      `Olá, *${firstName}*. Aqui é da coordenação do *Banco Ortopédico do ${DEFAULT_CLUB_INFO.clubName}*.\n\n` +
      `Identificamos que o prazo do empréstimo do item *${itemName}* (*#${patrimony}*), previsto para *${returnDate}*, encontra-se vencido.\n\n` +
      `⚠️ Sabemos que imprevistos acontecem! Se o paciente *ainda precisa do equipamento*, regularize e prorrogue gratuitamente por *+30 dias* clicando no link abaixo:\n` +
      `${renewalUrl}\n\n` +
      `Caso já não esteja mais utilizando, pedimos a gentileza de devolver o equipamento para atendermos pacientes urgentes na fila da comunidade, ou solicitar recolhimento domiciliar pelo link acima.`;
  }

  return {
    phone,
    message,
    url: createWaMeUrl(phone, message),
  };
}

/**
 * 3. Secondary Contact Active Recovery Link (D+7 Escalation)
 * Exact required message template for the reference/family contact.
 */
export function buildSecondaryContactWhatsAppLink(
  loan: Loan,
  daysOverdue: number,
  baseUrl?: string
): WhatsAppLinkPayload {
  const appUrl = resolveBaseUrl(baseUrl);
  const secondaryName =
    loan.beneficiary?.secondary_name ||
    loan.beneficiary?.secondary_contact_name ||
    'Contato de Referência';
  const secondaryRelation =
    loan.beneficiary?.secondary_relationship ||
    loan.beneficiary?.secondary_contact_relationship ||
    'Familiar/Referência';
  const beneficiaryName = loan.beneficiary?.full_name || 'Beneficiário';
  const patientName =
    loan.beneficiary?.is_patient_same_as_responsible === false &&
    loan.beneficiary?.patient_name
      ? `${loan.beneficiary.patient_name} (Responsável: ${beneficiaryName})`
      : beneficiaryName;
  const itemName = loan.equipment?.name || 'Equipamento Ortopédico';
  const patrimony = loan.equipment?.patrimony_code || loan.equipment_id;
  const returnDate = formatDate(loan.expected_return_date);
  const renewalUrl = `${appUrl}/renovar/${loan.magic_token}`;
  const rawPhone =
    loan.beneficiary?.secondary_phone ||
    loan.beneficiary?.secondary_contact_phone ||
    loan.beneficiary?.phone ||
    DEFAULT_CLUB_INFO.contactPhone;
  const phone = cleanPhoneForWhatsApp(rawPhone);

  const message =
    `Olá *${secondaryName}* (${secondaryRelation}), você foi indicado como contato de referência no empréstimo do item *${itemName}* (*#${patrimony}*) para *${patientName}* junto ao Banco Ortopédico do Rotary (${DEFAULT_CLUB_INFO.clubName}).\n\n` +
    `Não conseguimos contato recente no telefone principal e o prazo de renovação/devolução venceu em *${returnDate}* (${Math.max(1, daysOverdue)} dias em atraso).\n\n` +
    `Gostaríamos apenas de saber se o paciente ainda necessita do equipamento:\n` +
    `• *Se ainda precisar:* basta clicar no link abaixo para renovar gratuitamente por +30 dias:\n` +
    `${renewalUrl}\n\n` +
    `• *Se não estiver mais em uso:* você também pode ver o endereço de devolução ou pedir auxílio para retirada em domicílio pelo mesmo link.\n\n` +
    `Agradecemos imensamente sua colaboração solidária!`;

  return {
    phone,
    message,
    url: createWaMeUrl(phone, message),
  };
}

/**
 * 4. Discharge Receipt (Termo de Quitação Art. 320 CCB) Notification Link
 */
export function buildDischargeWhatsAppLink(
  loan: Loan,
  baseUrl?: string
): WhatsAppLinkPayload {
  const appUrl = resolveBaseUrl(baseUrl);
  const beneficiaryName = loan.beneficiary?.full_name || 'Beneficiário(a)';
  const firstName = beneficiaryName.split(' ')[0];
  const itemName = loan.equipment?.name || 'Equipamento Ortopédico';
  const patrimony = loan.equipment?.patrimony_code || loan.equipment_id;
  const receiptUrl = `${appUrl}/loans/${loan.id}/receipt`;
  const rawPhone = loan.beneficiary?.phone || DEFAULT_CLUB_INFO.contactPhone;
  const phone = cleanPhoneForWhatsApp(rawPhone);

  const message =
    `Olá, *${firstName}*! O *Banco de Aparelhos Ortopédicos do ${DEFAULT_CLUB_INFO.clubName}* agradece a devolução do equipamento *${itemName}* (*#${patrimony}*).\n\n` +
    `📜 *Comprovante de Devolução e Termo de Quitação (Art. 320 do Código Civil):*\n` +
    `Seu contrato de comodato (*${loan.loan_code}*) encontra-se formalmente encerrado e quitado. Você pode visualizar ou baixar seu comprovante oficial no link abaixo:\n` +
    `${receiptUrl}\n\n` +
    `Seu gesto de cuidado e devolução já permitirá ajudar uma nova família da nossa comunidade. Muito obrigado!`;

  return {
    phone,
    message,
    url: createWaMeUrl(phone, message),
  };
}

/**
 * Sends a WhatsApp message via configured REST API (Evolution API / Z-API / Twilio compatible)
 * or gracefully returns the wa.me fallback deep link when running without external API credentials.
 */
export async function sendWhatsAppNotification(
  phone: string,
  message: string
): Promise<WhatsAppSendResult> {
  const cleanedPhone = cleanPhoneForWhatsApp(phone);
  const fallbackUrl = createWaMeUrl(cleanedPhone, message);
  const timestamp = new Date().toISOString();

  // If called from the browser, delegate to our internal Evolution API proxy route (/api/whatsapp/evolution)
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/whatsapp/evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          phone: cleanedPhone,
          message,
        }),
      });
      const data = await res.json();
      return {
        sentViaApi: Boolean(res.ok && data?.sentViaApi),
        fallbackUrl,
        timestamp,
      };
    } catch {
      return {
        sentViaApi: false,
        fallbackUrl,
        timestamp,
      };
    }
  }

  const rawApiUrl = process.env.EVOLUTION_API_URL || process.env.WHATSAPP_API_URL;
  const apiToken = process.env.EVOLUTION_API_KEY || process.env.WHATSAPP_API_TOKEN;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'rotary-farroupilha';

  if (!rawApiUrl || rawApiUrl === 'undefined' || rawApiUrl.trim() === '') {
    return {
      sentViaApi: false,
      fallbackUrl,
      timestamp,
    };
  }

  const normalizedUrl = rawApiUrl.includes('/message/sendText/')
    ? rawApiUrl
    : `${rawApiUrl.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(instanceName)}`;

  try {
    const response = await fetch(normalizedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiToken
          ? {
              Authorization: `Bearer ${apiToken}`,
              apikey: apiToken,
            }
          : {}),
      },
      body: JSON.stringify({
        number: cleanedPhone,
        phone: cleanedPhone,
        text: message,
        message,
        delay: 1000,
        linkPreview: true,
      }),
    });

    if (!response.ok) {
      return {
        sentViaApi: false,
        fallbackUrl,
        timestamp,
      };
    }

    return {
      sentViaApi: true,
      fallbackUrl,
      timestamp,
    };
  } catch {
    return {
      sentViaApi: false,
      fallbackUrl,
      timestamp,
    };
  }
}
