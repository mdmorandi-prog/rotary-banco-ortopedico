'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertOctagon,
  AlertTriangle,
  Clock,
  MessageCircle,
  Users,
  RefreshCw,
  CornerDownLeft,
  Play,
  ExternalLink,
  Phone,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  Copy,
} from 'lucide-react';
import { dataRepository } from '@/lib/data-layer/repository';
import { Loan } from '@/lib/data-layer/types';
import { CATEGORY_LABELS, LOAN_STATUS_LABELS } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  buildRenewalReminderWhatsAppLink,
  buildSecondaryContactWhatsAppLink,
} from '@/lib/whatsapp';

interface CronExecutionResponse {
  ok: boolean;
  executedAt: string;
  summary: {
    checked: number;
    transitionedToOverdue: number;
    dMinus7Reminders: number;
    dZeroAlerts: number;
    dPlus7Escalations: number;
  };
  actions: Array<{
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
    description: string;
  }>;
}

interface EvaluatedLoan {
  loan: Loan;
  daysOverdue: number; // > 0 means overdue by N days; <= 0 means N days remaining
  daysRemaining: number;
  bucket: 'CRITICAL_7_PLUS' | 'RECENT_OVERDUE_1_TO_6' | 'PREVENTIVE_D7_D0';
}

/**
 * Computes day difference relative to reference date.
 * Uses 2026-11-10 as virtual reference if all mock dates are in late 2026 and system clock differs,
 * ensuring demo data and live data both categorize accurately.
 */
function getReferenceNow(loans: Loan[]): Date {
  const realNow = new Date();
  const has2026Mock = loans.some(
    (l) => l.id === 'loan-001' || l.id === 'loan-002'
  );
  if (has2026Mock && realNow.getFullYear() < 2026) {
    return new Date('2026-11-10T12:00:00Z');
  }
  return realNow;
}

export default function OverdueRadarPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningCron, setRunningCron] = useState<boolean>(false);
  const [cronResult, setCronResult] = useState<CronExecutionResponse | null>(null);
  const [processingLoanId, setProcessingLoanId] = useState<string | null>(null);

  const loadLoans = useCallback(async () => {
    try {
      setLoading(true);
      const allLoans = await dataRepository.getLoans();
      setLoans(allLoans);
    } catch (err) {
      console.error('Erro ao carregar empréstimos no Radar de Atrasos:', err);
      toast.error('Falha ao carregar lista de empréstimos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  const refNow = getReferenceNow(loans);

  // Filter active/overdue loans and classify into the 3 urgency buckets
  const evaluatedLoans: EvaluatedLoan[] = loans
    .filter(
      (l) =>
        l.status === 'ATIVO' ||
        l.status === 'RENOVADO' ||
        l.status === 'ATRASADO'
    )
    .map((loan) => {
      const expected = new Date(loan.expected_return_date);
      const diffMs = refNow.getTime() - expected.getTime();
      let daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      let daysRemaining = Math.ceil((expected.getTime() - refNow.getTime()) / (1000 * 60 * 60 * 24));

      // Ensure any loan explicitly marked ATRASADO has at least 1 day overdue
      if (loan.status === 'ATRASADO' && daysOverdue < 1) {
        daysOverdue = 5;
        daysRemaining = -5;
      }

      let bucket: EvaluatedLoan['bucket'] = 'PREVENTIVE_D7_D0';
      if (daysOverdue >= 7) {
        bucket = 'CRITICAL_7_PLUS';
      } else if (daysOverdue >= 1 || loan.status === 'ATRASADO') {
        bucket = 'RECENT_OVERDUE_1_TO_6';
      } else {
        bucket = 'PREVENTIVE_D7_D0';
      }

      return {
        loan,
        daysOverdue,
        daysRemaining,
        bucket,
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const criticalLoans = evaluatedLoans.filter((e) => e.bucket === 'CRITICAL_7_PLUS');
  const recentOverdueLoans = evaluatedLoans.filter((e) => e.bucket === 'RECENT_OVERDUE_1_TO_6');
  const preventiveLoans = evaluatedLoans.filter((e) => e.bucket === 'PREVENTIVE_D7_D0');

  const handlePrimaryWhatsApp = async (item: EvaluatedLoan) => {
    const { loan, daysOverdue } = item;
    const stage: 'D-7' | 'D0' | 'OVERDUE' =
      daysOverdue >= 1 || loan.status === 'ATRASADO'
        ? 'OVERDUE'
        : item.daysRemaining <= 0
        ? 'D0'
        : 'D-7';

    const payload = buildRenewalReminderWhatsAppLink(loan, stage);

    await dataRepository.addLoanEvent({
      loan_id: loan.id,
      event_type: 'OVERDUE_NOTIFICATION',
      old_status: loan.status,
      new_status: loan.status,
      notes: `Notificação WhatsApp (${stage}) enviada ao titular ${
        loan.beneficiary?.full_name || ''
      } com Magic Link de renovação (/renovar/${loan.magic_token}).`,
    });

    toast.success(`Abrindo WhatsApp para ${loan.beneficiary?.full_name || 'Titular'}...`);
    window.open(payload.url, '_blank', 'noopener,noreferrer');
  };

  const handleSecondaryContactWhatsApp = async (item: EvaluatedLoan) => {
    const { loan, daysOverdue } = item;
    const payload = buildSecondaryContactWhatsAppLink(loan, Math.max(1, daysOverdue));

    const secName =
      loan.beneficiary?.secondary_name ||
      loan.beneficiary?.secondary_contact_name ||
      'Contato Secundário';
    const secRel =
      loan.beneficiary?.secondary_relationship ||
      loan.beneficiary?.secondary_contact_relationship ||
      'Referência';

    await dataRepository.addLoanEvent({
      loan_id: loan.id,
      event_type: 'OVERDUE_NOTIFICATION',
      old_status: loan.status,
      new_status: loan.status,
      notes: `Acionamento de 2º Contato Obrigatório (${secName} - ${secRel}) via WhatsApp para recuperação ativa do item #${
        loan.equipment?.patrimony_code || ''
      }.`,
    });

    toast.success(`Acionando 2º Contato: ${secName} (${secRel}) no WhatsApp!`);
    window.open(payload.url, '_blank', 'noopener,noreferrer');
  };

  const handleQuickRenew = async (loan: Loan) => {
    try {
      setProcessingLoanId(loan.id);
      const res = await dataRepository.renewLoan(loan.magic_token);
      if (res.success) {
        toast.success(res.message || 'Empréstimo renovado por +30 dias com sucesso!');
        await loadLoans();
      } else {
        toast.error(res.message || 'Não foi possível renovar este empréstimo.');
      }
    } catch (err) {
      console.error('Erro ao renovar empréstimo:', err);
      toast.error('Erro ao renovar empréstimo.');
    } finally {
      setProcessingLoanId(null);
    }
  };

  const handleCopyMagicLink = (loan: Loan) => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const url = `${origin}/renovar/${loan.magic_token}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success('Magic Link público (/renovar) copiado para a área de transferência!');
    }
  };

  const handleRunDailyCron = async () => {
    try {
      setRunningCron(true);
      const response = await fetch('/api/cron/check-loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data: CronExecutionResponse = await response.json();
      setCronResult(data);
      await loadLoans();
      toast.success(
        `Rotina Diária executada! ${data.summary.checked} empréstimos avaliados.`
      );
    } catch (err) {
      console.error('Erro ao executar rotina Cron:', err);
      toast.error('Erro ao simular rotina diária de verificação.');
    } finally {
      setRunningCron(false);
    }
  };

  const renderLoanCard = (item: EvaluatedLoan) => {
    const { loan, daysOverdue, daysRemaining, bucket } = item;
    const ben = loan.beneficiary;
    const eq = loan.equipment;

    const secName =
      ben?.secondary_name || ben?.secondary_contact_name || 'Não informado';
    const secRelation =
      ben?.secondary_relationship || ben?.secondary_contact_relationship || 'Familiar';
    const secPhone =
      ben?.secondary_phone || ben?.secondary_contact_phone || ben?.phone || '';

    const isCritical = bucket === 'CRITICAL_7_PLUS';
    const isOverdue = bucket === 'CRITICAL_7_PLUS' || bucket === 'RECENT_OVERDUE_1_TO_6';

    return (
      <div
        key={loan.id}
        className={`rounded-2xl bg-white shadow-sm border-2 transition p-5 sm:p-6 space-y-5 ${
          isCritical
            ? 'border-red-500 ring-2 ring-red-100'
            : isOverdue
            ? 'border-amber-400'
            : 'border-slate-200'
        }`}
      >
        {/* Top Row: Equipment, Status & Days Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#0c2340] text-[#f7a81b]">
                #{eq?.patrimony_code || loan.equipment_id}
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Contrato {loan.loan_code}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                  loan.status === 'ATRASADO'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-blue-100 text-[#17458f]'
                }`}
              >
                {LOAN_STATUS_LABELS[loan.status] || loan.status}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
              {eq?.name || 'Equipamento Ortopédico'}{' '}
              {eq?.category && (
                <span className="text-sm font-medium text-slate-500">
                  ({CATEGORY_LABELS[eq.category] || eq.category})
                </span>
              )}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {daysOverdue >= 1 || loan.status === 'ATRASADO' ? (
              <span
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-extrabold text-sm ${
                  isCritical
                    ? 'bg-red-700 text-white'
                    : 'bg-amber-100 text-amber-950 border border-amber-300'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                {Math.max(1, daysOverdue)} {Math.max(1, daysOverdue) === 1 ? 'dia' : 'dias'} em
                atraso
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-sm bg-blue-50 text-[#17458f] border border-blue-200">
                <Clock className="w-4 h-4" />
                {daysRemaining <= 0
                  ? 'Vence Hoje (Regra D0)'
                  : `Vence em ${daysRemaining} dias`}
              </span>
            )}

            <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Prazo: {formatDate(loan.expected_return_date)}
            </div>
          </div>
        </div>

        {/* Middle Row: Primary Beneficiary & Mandatory Secondary Contact Highlight Box */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Primary Beneficiary */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Beneficiário Titular (Comodatário)
            </div>
            <div className="text-base font-extrabold text-slate-900">
              {ben?.full_name || 'Beneficiário'}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
              <span className="inline-flex items-center gap-1 font-medium">
                <Phone className="w-3.5 h-3.5 text-[#17458f]" />
                {ben?.phone || 'Sem telefone'}
              </span>
              <span>CPF: {ben?.cpf || '—'}</span>
            </div>
            {ben && (
              <div className="text-xs text-slate-600 pt-1">
                📍 {ben.address_street}, {ben.address_number} - {ben.address_neighborhood},{' '}
                {ben.address_city}/{ben.address_state}
              </div>
            )}
          </div>

          {/* Mandatory Secondary Contact (Highlighted for Active Recovery) */}
          <div
            className={`rounded-xl p-4 border-2 space-y-1.5 ${
              isCritical
                ? 'bg-red-50 border-red-400'
                : isOverdue
                ? 'bg-amber-50/80 border-amber-300'
                : 'bg-blue-50/50 border-blue-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                  isCritical ? 'text-red-800' : 'text-[#17458f]'
                }`}
              >
                <Users className="w-4 h-4" />
                2º Contato Obrigatório (Referência Familiar)
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/80 text-slate-800 border border-slate-300">
                {secRelation}
              </span>
            </div>
            <div className="text-base font-extrabold text-slate-900">{secName}</div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-800">
              <span className="inline-flex items-center gap-1 font-bold">
                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                {secPhone}
              </span>
              <span className="text-xs text-slate-600">
                Valor de Reposição: <strong>{formatCurrency(loan.replacement_value)}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Row: 1-Click Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Cobrar/Lembrar Titular no WhatsApp */}
            <button
              type="button"
              onClick={() => handlePrimaryWhatsApp(item)}
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              Cobrar/Lembrar Titular no WhatsApp
            </button>

            {/* 2. Acionar 2º Contato */}
            <button
              type="button"
              onClick={() => handleSecondaryContactWhatsApp(item)}
              className={`inline-flex items-center gap-2 font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition cursor-pointer ${
                isCritical
                  ? 'bg-red-700 hover:bg-red-800 text-white'
                  : 'bg-[#f7a81b] hover:bg-[#e59400] text-[#0c2340]'
              }`}
            >
              <Users className="w-4 h-4" />
              Acionar 2º Contato ({secName} - {secRelation})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Copy Magic Link */}
            <button
              type="button"
              onClick={() => handleCopyMagicLink(loan)}
              title="Copiar link público de renovação sem senha"
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3 py-2.5 rounded-xl transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              Magic Link
            </button>

            <Link
              href={`/renovar/${loan.magic_token}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-[#17458f] font-semibold text-xs px-3 py-2.5 rounded-xl transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir Portal
            </Link>

            {/* 3. Renovar +30d */}
            <button
              type="button"
              disabled={processingLoanId === loan.id || loan.renewal_count >= loan.max_renewals}
              onClick={() => handleQuickRenew(loan)}
              className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-[#17458f] border border-blue-200 font-bold text-sm px-3.5 py-2.5 rounded-xl transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${processingLoanId === loan.id ? 'animate-spin' : ''}`}
              />
              Renovar +30d ({loan.renewal_count}/{loan.max_renewals})
            </button>

            {/* 4. Registrar Devolução */}
            <Link
              href={`/loans/${loan.id}/return`}
              className="inline-flex items-center gap-1.5 bg-[#0c2340] hover:bg-[#17458f] text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
            >
              <CornerDownLeft className="w-4 h-4 text-[#f7a81b]" />
              Registrar Devolução
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header & Cron Simulator Trigger */}
      <div className="bg-gradient-to-r from-[#0c2340] to-[#17458f] rounded-2xl p-6 sm:p-8 text-white shadow-lg border-b-4 border-[#f7a81b]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-white/10 text-[#f7a81b] px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              Recuperação Ativa de Ativos • Arts. 579 a 585 CCB
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">
              Radar de Cobrança Ativa e Controle de Atrasos
            </h1>
            <p className="text-slate-200 text-sm sm:text-base max-w-2xl">
              Acione beneficiários titulares ou o 2º Contato Obrigatório via WhatsApp com 1 clique,
              envie o Magic Link de renovação sem senha e simule a régua diária de notificações.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleRunDailyCron}
              disabled={runningCron}
              className="inline-flex items-center justify-center gap-2.5 bg-[#f7a81b] hover:bg-[#e59400] text-[#0c2340] font-black text-sm sm:text-base px-5 py-3.5 rounded-xl shadow-lg transition disabled:opacity-60 cursor-pointer"
            >
              <Play className={`w-5 h-5 fill-current ${runningCron ? 'animate-pulse' : ''}`} />
              {runningCron
                ? 'Executando Régua Diária...'
                : 'Executar Rotina Diária (Simular Cron D-7 / D0 / D+1 / D+7)'}
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/15">
          <div className="bg-white/10 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-red-200 font-bold">
                1. Crítico (7+ dias / 2º Contato)
              </div>
              <div className="text-2xl font-black text-white mt-0.5">
                {criticalLoans.length}
              </div>
            </div>
            <AlertOctagon className="w-8 h-8 text-red-400" />
          </div>

          <div className="bg-white/10 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-amber-200 font-bold">
                2. Atenção (Vencidos 1 a 6 dias)
              </div>
              <div className="text-2xl font-black text-white mt-0.5">
                {recentOverdueLoans.length}
              </div>
            </div>
            <AlertTriangle className="w-8 h-8 text-[#f7a81b]" />
          </div>

          <div className="bg-white/10 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-blue-200 font-bold">
                3. Preventivo (D-7 / D0 / Ativos)
              </div>
              <div className="text-2xl font-black text-white mt-0.5">
                {preventiveLoans.length}
              </div>
            </div>
            <Clock className="w-8 h-8 text-sky-300" />
          </div>
        </div>
      </div>

      {/* Cron Execution Summary Panel (When triggered) */}
      {cronResult && (
        <section
          aria-label="Resultado da Rotina Diária Cron"
          className="bg-white rounded-2xl border-2 border-[#17458f] shadow-md p-6 space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Relatório de Execução da Régua Automática (/api/cron/check-loans)
                </h2>
                <p className="text-xs text-slate-500">
                  Executado em {new Date(cronResult.executedAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCronResult(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg bg-slate-100"
            >
              Fechar Relatório
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-500">Avaliados</div>
              <div className="text-xl font-black text-slate-900">
                {cronResult.summary.checked}
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
              <div className="text-xs font-bold text-[#17458f]">Lembretes D-7</div>
              <div className="text-xl font-black text-[#17458f]">
                {cronResult.summary.dMinus7Reminders}
              </div>
            </div>
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
              <div className="text-xs font-bold text-amber-800">Alertas D0 (Hoje)</div>
              <div className="text-xl font-black text-amber-900">
                {cronResult.summary.dZeroAlerts}
              </div>
            </div>
            <div className="bg-orange-50 p-3 rounded-xl border border-orange-200">
              <div className="text-xs font-bold text-orange-800">Transição D+1</div>
              <div className="text-xl font-black text-orange-900">
                {cronResult.summary.transitionedToOverdue}
              </div>
            </div>
            <div className="bg-red-50 p-3 rounded-xl border border-red-200">
              <div className="text-xs font-bold text-red-800">Escalonamento D+7</div>
              <div className="text-xl font-black text-red-900">
                {cronResult.summary.dPlus7Escalations}
              </div>
            </div>
          </div>

          {cronResult.actions.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold uppercase text-slate-500">
                Ações e Notificações Geradas pelo Cron:
              </div>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                {cronResult.actions.map((act, idx) => (
                  <div
                    key={`${act.loan_id}-${idx}`}
                    className="p-3.5 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#0c2340] text-[#f7a81b] font-mono font-bold text-xs">
                          {act.rule}
                        </span>
                        <span className="font-bold text-slate-900">
                          {act.beneficiary_name}
                        </span>
                        <span className="text-xs font-mono text-slate-600">
                          (#{act.equipment_patrimony})
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{act.description}</p>
                      {act.secondary_contact && (
                        <p className="text-xs font-semibold text-red-700">
                          2º Contato: {act.secondary_contact.name} (
                          {act.secondary_contact.relationship}) • {act.secondary_contact.phone}
                        </p>
                      )}
                    </div>
                    <a
                      href={act.whatsapp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 py-2 rounded-lg shrink-0 self-start sm:self-center"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Disparar WhatsApp
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <div className="w-10 h-10 border-4 border-[#17458f] border-t-[#f7a81b] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-600 font-medium">
            Analisando prazos de empréstimos e contatos de referência...
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* CATEGORY 1: CRÍTICO (7+ DIAS DE ATRASO / ACIONAR CONTATO SECUNDÁRIO) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-red-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-700 text-white flex items-center justify-center">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-red-950">
                    1. Crítico — Atrasados há 7+ dias / Acionar Contato Secundário
                  </h2>
                  <p className="text-xs sm:text-sm text-red-800">
                    Regra D+7: Sem retorno do titular. Acione imediatamente o 2º Contato Obrigatório
                    da família para localizar ou renovar o equipamento.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-red-100 text-red-900 font-black text-sm">
                {criticalLoans.length}
              </span>
            </div>

            {criticalLoans.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-600 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>
                  Nenhum empréstimo crítico com 7+ dias de atraso no momento. Use os cartões abaixo
                  para testar o acionamento do 2º Contato!
                </span>
              </div>
            ) : (
              <div className="space-y-4">{criticalLoans.map(renderLoanCard)}</div>
            )}
          </section>

          {/* CATEGORY 2: ATENÇÃO (VENCIDOS RECENTEMENTE: 1 A 6 DIAS DE ATRASO) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-amber-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    2. Atenção — Vencidos recentemente (1 a 6 dias de atraso)
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Regra D+1: Prazo recém-expirado. Envie o Magic Link no WhatsApp do titular ou já
                    consulte o contato secundário.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-black text-sm">
                {recentOverdueLoans.length}
              </span>
            </div>

            {recentOverdueLoans.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-600">
                Nenhum empréstimo na faixa de 1 a 6 dias de atraso.
              </div>
            ) : (
              <div className="space-y-4">{recentOverdueLoans.map(renderLoanCard)}</div>
            )}
          </section>

          {/* CATEGORY 3: PREVENTIVO (VENCENDO NOS PRÓXIMOS 7 DIAS / ATIVOS) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-blue-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#17458f] text-white flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    3. Preventivo — Vencendo nos próximos 7 dias e Empréstimos Ativos (Regra D-7 e
                    D0)
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Envie o lembrete amigável com o link público de renovação antes que o empréstimo
                    entre em atraso.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-100 text-[#17458f] font-black text-sm">
                {preventiveLoans.length}
              </span>
            </div>

            {preventiveLoans.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-600">
                Nenhum empréstimo ativo preventivo listado.
              </div>
            ) : (
              <div className="space-y-4">{preventiveLoans.map(renderLoanCard)}</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
