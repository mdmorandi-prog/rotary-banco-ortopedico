"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  MessageCircle,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Scale,
  Calendar,
  Package,
  User,
  Users,
} from "lucide-react";
import { dataRepository } from "@/lib/data-layer/repository";
import { Loan } from "@/lib/data-layer/types";
import {
  DEFAULT_CLUB_INFO,
  CATEGORY_LABELS,
  CONDITION_LABELS,
  CLOSE_REASON_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { toast } from "sonner";
import { buildDischargeWhatsAppLink, sendWhatsAppNotification } from "@/lib/whatsapp";

function sanitizeWhatsAppPhone(phone?: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export default function DischargeReceiptPage() {
  const params = useParams<{ id: string }>();
  const loanId = params?.id || "";

  const { user } = useAuth();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sendingWa, setSendingWa] = useState<boolean>(false);

  const handleResendWhatsApp = async () => {
    if (!loan) return;
    setSendingWa(true);
    try {
      const payload = buildDischargeWhatsAppLink(loan);
      const res = await sendWhatsAppNotification(payload.phone, payload.message);
      if (res.sentViaApi) {
        toast.success("✅ Termo de Quitação enviado com sucesso pelo WhatsApp do Rotary!");
      } else {
        toast.info("Abrindo WhatsApp Web como contingência...");
        window.open(payload.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      toast.error("Erro ao enviar pelo WhatsApp.");
    } finally {
      setSendingWa(false);
    }
  };

  const loadLoan = useCallback(async () => {
    if (!loanId) return;
    setLoading(true);
    try {
      const data = await dataRepository.getLoanById(loanId);
      setLoan(data);
    } catch (error) {
      console.error("Erro ao carregar comprovante de quitação:", error);
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    loadLoan();
  }, [loadLoan]);

  const handlePrint = async () => {
    if (!loan) return;
    try {
      const { generateDischargeReceiptPDF } = await import("@/lib/pdf-contract");
      await generateDischargeReceiptPDF(loan);
    } catch {
      if (typeof window !== "undefined") {
        window.print();
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="h-[520px] bg-white rounded-2xl border border-slate-200" />
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900">
            Termo de Quitação Não Encontrado
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Não foi possível localizar o contrato solicitado ({loanId}).
          </p>
          <div className="mt-6">
            <Link
              href={user ? "/loans" : "/"}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#17458f] text-white text-sm font-semibold hover:bg-[#0c2340]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{user ? "Voltar para Contratos" : "Voltar ao Início"}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const returnDateTime =
    loan.actual_return_date ||
    loan.quittance_issued_at ||
    loan.updated_at ||
    new Date().toISOString();

  const returnConditionLabel = loan.return_condition
    ? CONDITION_LABELS[loan.return_condition] || loan.return_condition
    : loan.equipment?.condition
    ? CONDITION_LABELS[loan.equipment.condition] || loan.equipment.condition
    : "Vistoriado e Recebido";

  const closeReasonLabel = loan.close_reason
    ? CLOSE_REASON_LABELS[loan.close_reason] || loan.close_reason
    : "Restituição Voluntária do Bem";

  const secondaryName =
    loan.beneficiary?.secondary_name ||
    loan.beneficiary?.secondary_contact_name ||
    "Não informado";
  const secondaryRelationship =
    loan.beneficiary?.secondary_relationship ||
    loan.beneficiary?.secondary_contact_relationship ||
    "Co-responsável";
  const secondaryPhone =
    loan.beneficiary?.secondary_phone ||
    loan.beneficiary?.secondary_contact_phone ||
    "";

  const replacementValue =
    loan.replacement_value || loan.equipment?.replacement_value || 0;

  const waBeneficiaryPhone = sanitizeWhatsAppPhone(loan.beneficiary?.phone);
  const waReceiptMessage = encodeURIComponent(
    `*TERMO DE DEVOLUÇÃO E QUITAÇÃO DE COMODATO (Art. 320 do Código Civil Brasileiro)*\n\n` +
      `*${DEFAULT_CLUB_INFO.clubName}* (${DEFAULT_CLUB_INFO.district})\n` +
      `Protocolo de Quitação: *QUIT-${loan.loan_code}*\n\n` +
      `Certificamos que *${
        loan.beneficiary?.full_name || "Comodatário"
      }* (CPF: ${
        loan.beneficiary?.cpf || "—"
      }) restituiu ao Banco Ortopédico o equipamento *${
        loan.equipment?.name || "Aparelho Ortopédico"
      }* (Patrimônio *${
        loan.equipment?.patrimony_code || "—"
      }*), em *${formatDateTime(
        returnDateTime
      )}*, apresentando estado físico *${returnConditionLabel}*.\n\n` +
      `Nos termos do *Art. 320 do Código Civil Brasileiro*, damos *PLENA, GERAL E IRREVOGÁVEL QUITAÇÃO* do Contrato de Comodato nº ${
        loan.loan_code
      }, exonerando o comodatário e o contato secundário solidário (*${secondaryName}*) de qualquer responsabilidade civil ou financeira (${formatCurrency(
        replacementValue
      )}).`
  );

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:p-0">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="max-w-3xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        {user ? (
          <div className="flex items-center gap-3">
            <Link
              href={`/loans/${loan.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-[#17458f] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Detalhes do Contrato</span>
            </Link>
            <span className="text-slate-300">|</span>
            <Link
              href="/loans"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Todos os Contratos
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>Documento Oficial Autenticado • Rotary Club</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          {user ? (
            <button
              type="button"
              disabled={sendingWa}
              onClick={handleResendWhatsApp}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition-colors shadow-sm cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>
                {sendingWa ? "Reenviando..." : "Reenviar no WhatsApp via API"}
              </span>
            </button>
          ) : (
            <a
              href={`https://wa.me/?text=${waReceiptMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition-colors shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Compartilhar via WhatsApp</span>
            </a>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#17458f] hover:bg-[#0c2340] text-white text-xs sm:text-sm font-bold transition-colors shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#f7a81b]" />
            <span>Imprimir / Salvar PDF</span>
          </button>
        </div>
      </div>

      {/* Formal Printable Document Container */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-300 shadow-lg overflow-hidden print:shadow-none print:border-slate-400 print:rounded-none">
        {/* Rotary Official Header */}
        <div className="bg-[#17458f] text-white px-8 py-6 border-b-4 border-[#f7a81b] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#f7a81b]">
              <ShieldCheck className="w-4 h-4" />
              <span> Rotary International • {DEFAULT_CLUB_INFO.district}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {DEFAULT_CLUB_INFO.clubName}
            </h1>
            <p className="text-xs text-blue-100">
              {DEFAULT_CLUB_INFO.president} • {DEFAULT_CLUB_INFO.city} • Tel:{" "}
              {DEFAULT_CLUB_INFO.contactPhone}
            </p>
          </div>

          <div className="bg-[#0c2340] px-4 py-3 rounded-xl border border-blue-800 text-right shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
              Protocolo de Quitação
            </span>
            <span className="font-mono text-sm sm:text-base font-extrabold text-white">
              QUIT-{loan.loan_code}
            </span>
          </div>
        </div>

        {/* Document Title Banner */}
        <div className="bg-emerald-50 border-b border-emerald-200 px-8 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 uppercase tracking-wide">
                TERMO DE DEVOLUÇÃO E QUITAÇÃO DE COMODATO
              </h2>
              <p className="text-xs font-semibold text-emerald-800">
                Emitido nos termos do Art. 320 e Arts. 579 a 585 do Código Civil
                Brasileiro (Lei nº 10.406/2002)
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-extrabold uppercase tracking-wider">
            Obrigação Quitada
          </span>
        </div>

        {/* Body Content */}
        <div className="p-8 space-y-6 text-slate-800">
          {/* Formal Legal Declaration */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm leading-relaxed text-justify">
            Pelo presente instrumento particular de quitação regular, o{" "}
            <strong>{DEFAULT_CLUB_INFO.clubName}</strong>, na qualidade de{" "}
            <strong>COMODANTE</strong>, declara para todos os fins de direito que
            recebeu em restituição o equipamento ortopédico abaixo discriminado,
            anteriormente cedido em empréstimo gratuito (comodato) sob o
            protocolo nº <strong>{loan.loan_code}</strong>. Em conformidade com
            o <strong>Art. 320 do Código Civil Brasileiro</strong>, outorga-se{" "}
            <strong>PLENA, GERAL, RASA E IRREVOGÁVEL QUITAÇÃO</strong> ao
            Comodatário e ao seu Co-responsável Solidário, extinguindo-se
            integralmente a responsabilidade civil e patrimonial no valor de{" "}
            <strong>{formatCurrency(replacementValue)}</strong>.
          </div>

          {/* 1. Qualification of Discharged Parties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Beneficiary */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#17458f] border-b border-slate-100 pb-2">
                <User className="w-4 h-4 text-[#f7a81b]" />
                <span>Comodatário Desonerado</span>
              </div>
              <dl className="text-xs space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Nome Completo:</dt>
                  <dd className="font-bold text-slate-900">
                    {loan.beneficiary?.full_name || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">CPF:</dt>
                  <dd className="font-mono font-semibold text-slate-800">
                    {loan.beneficiary?.cpf || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Telefone:</dt>
                  <dd className="font-medium text-slate-800">
                    {loan.beneficiary?.phone || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Cidade / UF:</dt>
                  <dd className="font-medium text-slate-800">
                    {loan.beneficiary?.address_city || "—"} /{" "}
                    {loan.beneficiary?.address_state || "SP"}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Secondary Contact Released from Joint Liability */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-900 border-b border-emerald-200/70 pb-2">
                <Users className="w-4 h-4 text-emerald-700" />
                <span>Co-Responsável Solidário Liberado (Art. 585 CCB)</span>
              </div>
              <dl className="text-xs space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-slate-600">Contato Secundário:</dt>
                  <dd className="font-bold text-slate-900">{secondaryName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Vínculo / Parentesco:</dt>
                  <dd className="font-semibold text-slate-800">
                    {secondaryRelationship}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Telefone:</dt>
                  <dd className="font-medium text-slate-800">
                    {secondaryPhone || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Situação Solidária:</dt>
                  <dd className="font-bold text-emerald-700">
                    Solidariedade Extinta
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* 2. Returned Equipment & Inspection Details */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#17458f]">
                <Package className="w-4 h-4 text-[#f7a81b]" />
                <span>Especificação da Coisa Restituída (Art. 320 CCB)</span>
              </div>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-blue-50 text-[#17458f] border border-blue-200">
                Patrimônio: {loan.equipment?.patrimony_code || "—"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
              <div>
                <span className="text-slate-400 block">
                  Descrição do Equipamento
                </span>
                <strong className="text-sm text-slate-900">
                  {loan.equipment?.name || "Equipamento Ortopédico"}
                </strong>
                {loan.equipment?.category && (
                  <span className="block text-[11px] text-slate-500">
                    Categoria:{" "}
                    {CATEGORY_LABELS[loan.equipment.category] ||
                      loan.equipment.category}
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block">
                  Estado Físico na Devolução
                </span>
                <strong className="text-sm text-emerald-700">
                  {returnConditionLabel}
                </strong>
                <span className="block text-[11px] text-slate-500">
                  Motivo: {closeReasonLabel}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block">
                  Valor de Reposição Desonerado
                </span>
                <strong className="text-sm text-[#17458f] flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-[#f7a81b]" />
                  {formatCurrency(replacementValue)}
                </strong>
                <span className="block text-[11px] text-slate-500">
                  Etiqueta QR: {loan.equipment?.qr_token || "—"}
                </span>
              </div>
            </div>

            {loan.return_notes && (
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-700">
                <strong>Laudo / Observações da Recepção:</strong>{" "}
                {loan.return_notes}
              </div>
            )}
          </div>

          {/* 3. Chronology & Timestamps (Art. 320 Time and Place) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-400 font-semibold uppercase block">
                Data da Retirada Inicial
              </span>
              <strong className="text-sm text-slate-800 flex items-center gap-1.5 mt-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formatDate(loan.loan_date)}
              </strong>
            </div>

            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-emerald-800 font-semibold uppercase block">
                Data e Hora da Devolução
              </span>
              <strong className="text-sm text-emerald-950 flex items-center gap-1.5 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {formatDateTime(returnDateTime)}
              </strong>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-400 font-semibold uppercase block">
                Local de Restituição
              </span>
              <strong className="text-sm text-slate-800 flex items-center gap-1.5 mt-1">
                <FileText className="w-3.5 h-3.5 text-[#17458f]" />
                {DEFAULT_CLUB_INFO.city}
              </strong>
            </div>
          </div>

          {/* 4. Signatures & Digital Authentication Footer */}
          <div className="pt-8 mt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-xs">
            <div className="space-y-1">
              <div className="h-12 flex items-end justify-center">
                <span className="font-serif italic text-base text-[#17458f] font-bold">
                  {DEFAULT_CLUB_INFO.clubName}
                </span>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <p className="font-bold text-slate-900">
                  {DEFAULT_CLUB_INFO.president}
                </p>
                <p className="text-slate-500">
                  Comodante • Recebedor Autorizado ({DEFAULT_CLUB_INFO.district})
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="h-12 flex items-end justify-center">
                <span className="text-xs text-emerald-700 font-semibold">
                  [ Quitação Eletrônica Registrada — Art. 320 CCB ]
                </span>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <p className="font-bold text-slate-900">
                  {loan.beneficiary?.full_name || "Comodatário"}
                </p>
                <p className="text-slate-500 font-mono">
                  CPF: {loan.beneficiary?.cpf || "—"} • Comodatário Restituinte
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
            Documento digital autenticado pelo Sistema de Gestão do Banco
            Ortopédico do {DEFAULT_CLUB_INFO.clubName} • Código de Verificação:{" "}
            <span className="font-mono text-slate-600">
              {loan.id.toUpperCase()}-{loan.loan_code}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
