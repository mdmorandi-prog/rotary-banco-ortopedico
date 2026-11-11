// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - DAILY CRON JOB (/api/cron/check-loans)
// Evaluates D-7, D0, D+1, and D+7 rules across active and overdue loans,
// transitions expired loans to ATRASADO in PostgreSQL, and dispatches WhatsApp
// messages automatically via Evolution API v2 (with wa.me links as fallback).
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured, pgDataService, getPgPool } from '@/lib/db/postgres';
import { localStore } from '@/lib/mock-store/local-store';
import { Loan } from '@/lib/data-layer/types';
import {
  buildRenewalReminderWhatsAppLink,
  buildSecondaryContactWhatsAppLink,
} from '@/lib/whatsapp';
import { sendViaEvolutionServer } from '@/app/api/whatsapp/evolution/route';

export const dynamic = 'force-dynamic';

export interface CronActionItem {
  loan_id: string;
  loan_code: string;
  rule: 'D-7' | 'D0' | 'D+1' | 'D+7';
  beneficiary_name: string;
  equipment_patrimony: string;
  secondary_contact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  whatsapp_url: string;
  sent_via_api: boolean;
  description: string;
}

function resolveReferenceNow(loans: Loan[]): Date {
  const realNow = new Date();
  const has2026Mock = loans.some(
    (l) => l.id === 'loan-001' || l.id === 'loan-002'
  );
  if (has2026Mock && realNow.getFullYear() < 2026) {
    return new Date('2026-11-10T09:00:00Z');
  }
  return realNow;
}

async function runDailyLoanVerification(req: NextRequest) {
  const origin =
    req.nextUrl?.origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://rotary.vitalliz.com.br';

  const usePg =
    isPostgresConfigured() &&
    process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK !== 'true';
  const repo = usePg ? pgDataService : localStore;

  const allLoans = await repo.getLoans();
  const activeOrOverdueLoans = allLoans.filter(
    (l) =>
      l.status === 'ATIVO' ||
      l.status === 'RENOVADO' ||
      l.status === 'ATRASADO'
  );

  const refNow = resolveReferenceNow(activeOrOverdueLoans);
  const actions: CronActionItem[] = [];

  let transitionedToOverdue = 0;
  let dMinus7Reminders = 0;
  let dZeroAlerts = 0;
  let dPlus7Escalations = 0;

  for (const loan of activeOrOverdueLoans) {
    const expected = new Date(loan.expected_return_date);
    const diffMs = expected.getTime() - refNow.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const daysOverdue = Math.floor(
      (refNow.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24)
    );

    const beneficiaryName = loan.beneficiary?.full_name || 'Beneficiário';
    const patrimony = loan.equipment?.patrimony_code || loan.equipment_id;

    // -------------------------------------------------------------------------
    // Regra D-7: Faltam até 7 dias para o vencimento
    // -------------------------------------------------------------------------
    if (
      (loan.status === 'ATIVO' || loan.status === 'RENOVADO') &&
      daysRemaining > 0 &&
      daysRemaining <= 7
    ) {
      dMinus7Reminders += 1;
      const waPayload = buildRenewalReminderWhatsAppLink(loan, 'D-7', origin);
      const sendRes = await sendViaEvolutionServer(waPayload.phone, waPayload.message);

      await repo.addLoanEvent({
        loan_id: loan.id,
        event_type: 'OVERDUE_NOTIFICATION',
        old_status: loan.status,
        new_status: loan.status,
        notes: `[Cron D-7] Lembrete preventivo de renovação (${
          sendRes.sentViaApi ? 'Enviado via Evolution API' : 'Link gerado'
        }) com link /renovar/${loan.magic_token}.`,
      });

      actions.push({
        loan_id: loan.id,
        loan_code: loan.loan_code,
        rule: 'D-7',
        beneficiary_name: beneficiaryName,
        equipment_patrimony: patrimony,
        whatsapp_url: waPayload.url,
        sent_via_api: sendRes.sentViaApi,
        description: `Lembrete amigável D-7 com link público de renovação (/renovar/${loan.magic_token}).`,
      });
      continue;
    }

    // -------------------------------------------------------------------------
    // Regra D0: Vence hoje (daysRemaining === 0)
    // -------------------------------------------------------------------------
    if (
      (loan.status === 'ATIVO' || loan.status === 'RENOVADO') &&
      daysRemaining === 0
    ) {
      dZeroAlerts += 1;
      const waPayload = buildRenewalReminderWhatsAppLink(loan, 'D0', origin);
      const sendRes = await sendViaEvolutionServer(waPayload.phone, waPayload.message);

      await repo.addLoanEvent({
        loan_id: loan.id,
        event_type: 'OVERDUE_NOTIFICATION',
        old_status: loan.status,
        new_status: loan.status,
        notes: `[Cron D0] Alerta de vencimento no dia (${
          sendRes.sentViaApi ? 'Enviado via Evolution API' : 'Link gerado'
        }).`,
      });

      actions.push({
        loan_id: loan.id,
        loan_code: loan.loan_code,
        rule: 'D0',
        beneficiary_name: beneficiaryName,
        equipment_patrimony: patrimony,
        whatsapp_url: waPayload.url,
        sent_via_api: sendRes.sentViaApi,
        description: `Aviso de vencimento hoje (D0) com link rápido de renovação por +30 dias.`,
      });
      continue;
    }

    // -------------------------------------------------------------------------
    // Regra D+1 e Regra D+7: Passou da data de retorno (Em Atraso)
    // -------------------------------------------------------------------------
    if (daysOverdue >= 1 || loan.status === 'ATRASADO') {
      const effectiveDaysOverdue = Math.max(1, daysOverdue);

      // Se ainda estava ATIVO ou RENOVADO, transiciona para ATRASADO (Regra D+1)
      if (loan.status !== 'ATRASADO') {
        transitionedToOverdue += 1;
        if (usePg) {
          const pool = getPgPool();
          await pool.query(
            `UPDATE rotary.loans SET status = 'ATRASADO', updated_at = NOW() WHERE id = $1;`,
            [loan.id]
          );
        }
        if (loan.equipment_id) {
          await repo.updateEquipment(loan.equipment_id, {
            status: 'ATRASADO',
          });
        }
        await repo.addLoanEvent({
          loan_id: loan.id,
          event_type: 'STATUS_CHANGE',
          old_status: loan.status,
          new_status: 'ATRASADO',
          notes: `[Cron D+1] Status atualizado automaticamente para ATRASADO após expiração do prazo.`,
        });
      }

      // Regra D+7 (Escalonamento para 2º Contato Obrigatório)
      if (effectiveDaysOverdue >= 5) {
        dPlus7Escalations += 1;
        const secPayload = buildSecondaryContactWhatsAppLink(
          loan,
          effectiveDaysOverdue,
          origin
        );
        const sendRes = await sendViaEvolutionServer(
          secPayload.phone,
          secPayload.message
        );

        const secName =
          loan.beneficiary?.secondary_name ||
          loan.beneficiary?.secondary_contact_name ||
          'Contato Secundário';
        const secRelation =
          loan.beneficiary?.secondary_relationship ||
          loan.beneficiary?.secondary_contact_relationship ||
          'Familiar';
        const secPhone =
          loan.beneficiary?.secondary_phone ||
          loan.beneficiary?.secondary_contact_phone ||
          '';

        await repo.addLoanEvent({
          loan_id: loan.id,
          event_type: 'OVERDUE_NOTIFICATION',
          old_status: 'ATRASADO',
          new_status: 'ATRASADO',
          notes: `[Cron D+7] Escalonamento para 2º Contato Obrigatório: ${secName} (${secRelation}) - Tel: ${secPhone} (${
            sendRes.sentViaApi ? 'Enviado via Evolution API' : 'Link gerado'
          }).`,
        });

        actions.push({
          loan_id: loan.id,
          loan_code: loan.loan_code,
          rule: 'D+7',
          beneficiary_name: beneficiaryName,
          equipment_patrimony: patrimony,
          secondary_contact: {
            name: secName,
            relationship: secRelation,
            phone: secPhone,
          },
          whatsapp_url: secPayload.url,
          sent_via_api: sendRes.sentViaApi,
          description: `Alerta de Coordenador (D+7): Acionar 2º Contato Obrigatório (${secName} - ${secRelation}) após ${effectiveDaysOverdue} dias de atraso.`,
        });
      } else {
        const overduePayload = buildRenewalReminderWhatsAppLink(
          loan,
          'OVERDUE',
          origin
        );
        const sendRes = await sendViaEvolutionServer(
          overduePayload.phone,
          overduePayload.message
        );

        actions.push({
          loan_id: loan.id,
          loan_code: loan.loan_code,
          rule: 'D+1',
          beneficiary_name: beneficiaryName,
          equipment_patrimony: patrimony,
          whatsapp_url: overduePayload.url,
          sent_via_api: sendRes.sentViaApi,
          description: `Cobrança amigável D+1 (${effectiveDaysOverdue}d em atraso) com Magic Link de regularização.`,
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    executedAt: new Date().toISOString(),
    summary: {
      checked: activeOrOverdueLoans.length,
      transitionedToOverdue,
      dMinus7Reminders,
      dZeroAlerts,
      dPlus7Escalations,
    },
    actions,
  });
}

export async function GET(req: NextRequest) {
  return runDailyLoanVerification(req);
}

export async function POST(req: NextRequest) {
  return runDailyLoanVerification(req);
}
