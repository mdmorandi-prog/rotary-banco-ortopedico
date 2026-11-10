"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  User,
  Users,
  Phone,
  MapPin,
  Package,
  QrCode,
  ShieldCheck,
  Scale,
  History,
  PenTool,
  Calendar,
  MessageCircle,
} from "lucide-react";
import { dataRepository } from "@/lib/data-layer/repository";
import { Loan, LoanEventLog, LoanEventType } from "@/lib/data-layer/types";
import {
  DEFAULT_CLUB_INFO,
  LOAN_STATUS_LABELS,
  CATEGORY_LABELS,
  CONDITION_LABELS,
  STATUS_LABELS,
  CLOSE_REASON_LABELS,
} from "@/lib/constants";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

function sanitizeWhatsAppPhone(phone?: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

const EVENT_TYPE_LABELS: Record<
  LoanEventType,
  { label: string; badgeClass: string }
> = {
  CREATED: {
    label: "Contrato Celebrado",
    badgeClass: "bg-blue-50 text-[#17458f] border-blue-200",
  },
  RENEWED: {
    label: "Prazo Renovado (+30 Dias)",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
  },
  STATUS_CHANGE: {
    label: "Alteração de Status",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  RETURNED: {
    label: "Devolução & Triagem Concluída",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  OVERDUE_NOTIFICATION: {
    label: "Notificação de Atraso",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
  },
  QUITTANCE_ISSUED: {
    label: "Termo de Quitação Emitido (Art. 320 CCB)",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
};

export default function LoanDetailsPage() {
  const params = useParams<{ id: string }>();
  const loanId = params?.id || "";

  const [loan, setLoan] = useState<Loan | null>(null);
  const [events, setEvents] = useState<LoanEventLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [renewing, setRenewing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadLoanData = useCallback(async () => {
    if (!loanId) return;
    setLoading(true);
    try {
      const [loanData, eventList] = await Promise.all([
        dataRepository.getLoanById(loanId),
        dataRepository.getLoanEvents(loanId),
      ]);
      setLoan(loanData);
      setEvents(eventList);
    } catch (error) {
      console.error("Erro ao carregar detalhes do comodato:", error);
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    loadLoanData();
  }, [loadLoanData]);

  const handleRenewLoan = async () => {
    if (!loan) return;
    setRenewing(true);
    setFeedback(null);
    try {
      const result = await dataRepository.renewLoan(loan.magic_token);
      if (result.success) {
        setFeedback({
          type: "success",
          text:
            result.message ||
            "Empréstimo renovado por +30 dias com sucesso! O histórico de auditoria foi atualizado.",
        });
        await loadLoanData();
      } else {
        setFeedback({
          type: "error",
          text:
            result.message ||
            "Não foi possível renovar este empréstimo (limite atingido ou contrato encerrado).",
        });
      }
    } catch (error) {
      console.error("Erro ao renovar contrato:", error);
      setFeedback({
        type: "error",
        text: "Ocorreu um erro ao tentar renovar o empréstimo.",
      });
    } finally {
      setRenewing(false);
    }
  };

  const handlePrintContract = async () => {
    if (!loan) return;
    try {
      const { generateComodatoContractPDF } = await import("@/lib/pdf-contract");
      await generateComodatoContractPDF(loan);
    } catch {
      if (typeof window !== "undefined") {
        window.print();
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="h-28 bg-white rounded-xl border border-slate-200" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-56 bg-white rounded-xl border border-slate-200" />
            <div className="h-56 bg-white rounded-xl border border-slate-200" />
          </div>
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
            Contrato de Comodato Não Encontrado
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Não encontramos nenhum contrato com o identificador informado ({loanId}).
          </p>
          <div className="mt-6">
            <Link
              href="/loans"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#17458f] text-white text-sm font-semibold hover:bg-[#0c2340]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para Contratos</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isReturned = loan.status === "DEVOLVIDO";
  const isOverdue = loan.status === "ATRASADO";
  const canRenew =
    !isReturned &&
    loan.status !== "CANCELADO" &&
    loan.renewal_count < loan.max_renewals;

  const replacementValue =
    loan.replacement_value || loan.equipment?.replacement_value || 0;
  const signatureImage = loan.signature_url || loan.signature_image_url;

  const secondaryName =
    loan.beneficiary?.secondary_name ||
    loan.beneficiary?.secondary_contact_name ||
    "Não informado";
  const secondaryRel =
    loan.beneficiary?.secondary_relationship ||
    loan.beneficiary?.secondary_contact_relationship ||
    "Familiar / Co-responsável";
  const secondaryPhone =
    loan.beneficiary?.secondary_phone ||
    loan.beneficiary?.secondary_contact_phone ||
    "";

  const beneficiaryWaPhone = sanitizeWhatsAppPhone(loan.beneficiary?.phone);
  const secondaryWaPhone = sanitizeWhatsAppPhone(secondaryPhone);

  const beneficiaryWaMessage = encodeURIComponent(
    `Olá, ${loan.beneficiary?.full_name || ""}! Aqui é do ${
      DEFAULT_CLUB_INFO.clubName
    }. Entramos em contato referente ao Contrato de Comodato nº ${
      loan.loan_code
    } (${loan.equipment?.name || "Equipamento Ortopédico"} - Patrimônio ${
      loan.equipment?.patrimony_code || ""
    }), com vencimento previsto para ${formatDate(loan.expected_return_date)}.`
  );

  const secondaryWaMessage = encodeURIComponent(
    `Olá, ${secondaryName}! Aqui é do ${
      DEFAULT_CLUB_INFO.clubName
    }. Entramos em contato como contato secundário indicado por ${
      loan.beneficiary?.full_name || "beneficiário"
    } referente ao Contrato de Comodato nº ${loan.loan_code} (${
      loan.equipment?.name || "Equipamento Ortopédico"
    } - Patrimônio ${loan.equipment?.patrimony_code || ""}).`
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 print:bg-white print:pb-0">
      {/* Top Action Navigation Bar */}
      <div className="bg-white border-b border-slate-200 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/loans"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#17458f] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Contratos de Comodato</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrintContract}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4 text-[#17458f]" />
              <span>Imprimir / Baixar Termo de Comodato</span>
            </button>

            <Link
              href={`/renovar/${loan.magic_token}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-slate-900 text-xs sm:text-sm font-semibold transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-[#17458f]" />
              <span>Abrir Portal Público Magic Link</span>
            </Link>

            {canRenew && (
              <button
                type="button"
                disabled={renewing}
                onClick={handleRenewLoan}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#17458f] text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("w-4 h-4", renewing && "animate-spin")}
                />
                <span>{renewing ? "Renovando..." : "Renovar +30 Dias"}</span>
              </button>
            )}

            {!isReturned ? (
              <Link
                href={`/loans/${loan.id}/return`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#17458f] hover:bg-[#0c2340] text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm"
              >
                <RotateCcw className="w-4 h-4 text-[#f7a81b]" />
                <span>Registrar Devolução (Check-in)</span>
              </Link>
            ) : (
              <Link
                href={`/loans/${loan.id}/receipt`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Ver Termo de Quitação</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={cn(
              "p-4 rounded-xl border flex items-center justify-between gap-3 print:hidden",
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            )}
          >
            <div className="flex items-center gap-2.5 text-sm font-medium">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold underline"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Printable Formal Header (Visible on Print and Screen) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div
            className={cn(
              "px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b",
              isReturned
                ? "bg-emerald-50/90 border-emerald-200"
                : isOverdue
                ? "bg-red-50/90 border-red-200"
                : "bg-[#17458f] text-white border-[#0c2340]"
            )}
          >
            <div className="flex items-center gap-3">
              <FileText
                className={cn(
                  "w-6 h-6",
                  isReturned
                    ? "text-emerald-700"
                    : isOverdue
                    ? "text-red-700"
                    : "text-[#f7a81b]"
                )}
              />
              <div>
                <p
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    isReturned
                      ? "text-emerald-700"
                      : isOverdue
                      ? "text-red-700"
                      : "text-amber-300"
                  )}
                >
                  {DEFAULT_CLUB_INFO.clubName} • {DEFAULT_CLUB_INFO.district}
                </p>
                <h1
                  className={cn(
                    "text-xl font-bold",
                    isReturned || isOverdue ? "text-slate-900" : "text-white"
                  )}
                >
                  Termo de Empréstimo Gratuito (Comodato) — {loan.loan_code}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border",
                  isReturned
                    ? "bg-emerald-600 text-white border-emerald-700"
                    : isOverdue
                    ? "bg-red-600 text-white border-red-700"
                    : "bg-[#f7a81b] text-[#0c2340] border-amber-400"
                )}
              >
                Status: {LOAN_STATUS_LABELS[loan.status] || loan.status}
              </span>
            </div>
          </div>

          {/* Summary Metrics Strip */}
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50/60">
            <div className="bg-white p-3.5 rounded-lg border border-slate-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Data da Retirada
              </span>
              <span className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5 mt-1">
                <Calendar className="w-4 h-4 text-[#17458f]" />
                {formatDate(loan.loan_date)}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-slate-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Devolução Prevista
              </span>
              <span
                className={cn(
                  "text-sm sm:text-base font-bold flex items-center gap-1.5 mt-1",
                  isOverdue ? "text-red-700" : "text-slate-900"
                )}
              >
                <Clock
                  className={cn(
                    "w-4 h-4",
                    isOverdue ? "text-red-600" : "text-[#17458f]"
                  )}
                />
                {formatDate(loan.expected_return_date)}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-slate-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Renovações de Prazo
              </span>
              <span className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5 mt-1">
                <RefreshCw className="w-4 h-4 text-[#17458f]" />
                {loan.renewal_count} de {loan.max_renewals} permitidas
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-slate-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Valor de Reposição (Art. 582)
              </span>
              <span className="text-sm sm:text-base font-bold text-[#17458f] flex items-center gap-1.5 mt-1">
                <Scale className="w-4 h-4 text-[#f7a81b]" />
                {formatCurrency(replacementValue)}
              </span>
            </div>
          </div>

          {isReturned && loan.actual_return_date && (
            <div className="px-6 py-3.5 bg-emerald-50 border-t border-emerald-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Devolução registrada em{" "}
                  <strong>{formatDateTime(loan.actual_return_date)}</strong>
                  {loan.close_reason &&
                    ` • Motivo: ${
                      CLOSE_REASON_LABELS[loan.close_reason] ||
                      loan.close_reason
                    }`}
                  {loan.return_condition &&
                    ` • Estado na volta: ${
                      CONDITION_LABELS[loan.return_condition] ||
                      loan.return_condition
                    }`}
                </span>
              </div>
              <Link
                href={`/loans/${loan.id}/receipt`}
                className="text-xs font-bold text-emerald-800 underline hover:text-emerald-950 print:hidden"
              >
                Abrir Comprovante de Quitação (Art. 320 CCB) →
              </Link>
            </div>
          )}
        </div>

        {/* Equipment Card & Beneficiary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Equipment Card */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#17458f]">
                  <Package className="w-4 h-4 text-[#f7a81b]" />
                  <span>Bem Objeto do Comodato</span>
                </div>
                {loan.equipment?.patrimony_code && (
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-blue-50 text-[#17458f] border border-blue-200">
                    {loan.equipment.patrimony_code}
                  </span>
                )}
              </div>

              <h2 className="text-lg font-bold text-slate-900 mt-4">
                {loan.equipment?.name || "Aparelho Ortopédico"}
              </h2>

              {loan.equipment?.model_description && (
                <p className="text-xs text-slate-600 mt-1">
                  {loan.equipment.model_description}
                </p>
              )}

              <dl className="mt-4 space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Categoria:</dt>
                  <dd className="font-semibold text-slate-800">
                    {loan.equipment?.category
                      ? CATEGORY_LABELS[loan.equipment.category] ||
                        loan.equipment.category
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Condição Física:</dt>
                  <dd className="font-semibold text-slate-800">
                    {loan.equipment?.condition
                      ? CONDITION_LABELS[loan.equipment.condition] ||
                        loan.equipment.condition
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Status Atual no Estoque:</dt>
                  <dd className="font-semibold text-slate-800">
                    {loan.equipment?.status
                      ? STATUS_LABELS[loan.equipment.status] ||
                        loan.equipment.status
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-slate-500">Valor Declarado (Art. 582):</dt>
                  <dd className="font-bold text-[#17458f]">
                    {formatCurrency(replacementValue)}
                  </dd>
                </div>
              </dl>
            </div>

            {loan.equipment?.qr_token && (
              <div className="mt-5 pt-4 border-t border-slate-100 print:hidden">
                <Link
                  href={`/item/${loan.equipment.qr_token}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                >
                  <QrCode className="w-4 h-4 text-[#17458f]" />
                  <span>
                    Inspecionar Etiqueta QR ({loan.equipment.qr_token})
                  </span>
                </Link>
              </div>
            )}
          </div>

          {/* Beneficiary & Secondary Contact Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Primary Beneficiary Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#17458f]">
                  <User className="w-4 h-4 text-[#f7a81b]" />
                  <span>Comodatário (Responsável Legal & Beneficiário)</span>
                </div>

                {beneficiaryWaPhone && (
                  <a
                    href={`https://wa.me/${beneficiaryWaPhone}?text=${beneficiaryWaMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-sm print:hidden"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Chamar no WhatsApp</span>
                  </a>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Nome Completo</span>
                  <strong className="text-sm text-slate-900">
                    {loan.beneficiary?.full_name || "—"}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 block">CPF / RG</span>
                  <strong className="text-sm font-mono text-slate-800">
                    {loan.beneficiary?.cpf || "—"}
                    {loan.beneficiary?.rg ? ` • RG: ${loan.beneficiary.rg}` : ""}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 block">Telefone / Celular</span>
                  <strong className="text-sm text-slate-800 inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {loan.beneficiary?.phone || "—"}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 block">Paciente Usuário</span>
                  <strong className="text-sm text-slate-800">
                    {loan.beneficiary?.is_patient_same_as_responsible !== false
                      ? "O próprio comodatário"
                      : `${loan.beneficiary?.patient_name || "Paciente"} (${
                          loan.beneficiary?.patient_relationship || "Familiar"
                        })`}
                  </strong>
                </div>

                <div className="sm:col-span-2 pt-1">
                  <span className="text-slate-400 block">
                    Endereço Residencial Registrado
                  </span>
                  <p className="text-slate-800 font-medium flex items-start gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      {loan.beneficiary?.address_street},{" "}
                      {loan.beneficiary?.address_number}
                      {loan.beneficiary?.address_complement
                        ? ` (${loan.beneficiary.address_complement})`
                        : ""}{" "}
                      — {loan.beneficiary?.address_neighborhood},{" "}
                      {loan.beneficiary?.address_city}/
                      {loan.beneficiary?.address_state} • CEP:{" "}
                      {loan.beneficiary?.address_zipcode ||
                        loan.beneficiary?.address_cep ||
                        "—"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Mandatory Secondary Contact Card (Art. 585 CCB) */}
            <div className="bg-amber-50/60 rounded-xl border border-amber-200 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-amber-200/70">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900">
                  <Users className="w-4 h-4 text-[#17458f]" />
                  <span>
                    Contato Secundário Obrigatório (Co-responsável Solidário •
                    Art. 585 CCB)
                  </span>
                </div>

                {secondaryWaPhone && (
                  <a
                    href={`https://wa.me/${secondaryWaPhone}?text=${secondaryWaMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-sm print:hidden"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Contato Secundário</span>
                  </a>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Nome do Contato</span>
                  <strong className="text-sm text-slate-900">
                    {secondaryName}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    Grau de Parentesco / Vínculo
                  </span>
                  <strong className="text-sm text-slate-800">
                    {secondaryRel}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Telefone Direto</span>
                  <strong className="text-sm text-slate-900 inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#17458f]" />
                    {secondaryPhone || "Não informado"}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Contract Clauses (Arts. 579-585 CCB) & Digital Signature Box */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#17458f]" />
              <h2 className="text-base font-bold text-slate-900">
                Cláusulas Jurídicas do Contrato de Comodato (Código Civil
                Brasileiro — Arts. 579 a 585)
              </h2>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-500">
              Valor de Indenização Fixado: {formatCurrency(replacementValue)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700 leading-relaxed bg-slate-50 p-5 rounded-xl border border-slate-200">
            <div className="space-y-2.5">
              <p>
                <strong>1. Objeto e Gratuidade (Art. 579 do CCB):</strong> O{" "}
                <strong>{DEFAULT_CLUB_INFO.clubName}</strong> (COMODANTE) cede
                gratuitamente ao COMODATÁRIO acima qualificado o aparelho
                ortopédico{" "}
                <strong>
                  {loan.equipment?.name} (Patrimônio{" "}
                  {loan.equipment?.patrimony_code})
                </strong>
                , avaliado em <strong>{formatCurrency(replacementValue)}</strong>
                , para uso exclusivo na reabilitação ou assistência de saúde.
              </p>
              <p>
                <strong>2. Guarda e Conservação (Art. 582 do CCB):</strong> O
                COMODATÁRIO obriga-se a conservar o equipamento como se seu
                próprio fosse, sendo vedado cedê-lo, alugá-lo ou repassá-lo a
                terceiros sem prévia autorização formal do Rotary Club.
              </p>
            </div>
            <div className="space-y-2.5">
              <p>
                <strong>
                  3. Prazo, Renovação e Mora (Art. 582, 2ª parte):
                </strong>{" "}
                O prazo inicial vence em{" "}
                <strong>{formatDate(loan.expected_return_date)}</strong>,
                podendo ser renovado até {loan.max_renewals} vezes pelo link
                digital oficial. Constituído em mora pela não devolução ou
                ausência de renovação, o comodatário responderá pelo risco
                integral e valor de reposição de{" "}
                <strong>{formatCurrency(replacementValue)}</strong>.
              </p>
              <p>
                <strong>4. Responsabilidade Solidária (Art. 585 do CCB):</strong>{" "}
                O responsável legal e o contato secundário indicado respondem
                solidariamente pela restituição íntegra do bem ao Banco
                Ortopédico assim que cessar a necessidade médica.
              </p>
            </div>
          </div>

          {/* Captured Digital Signature Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#17458f]">
                <PenTool className="w-4 h-4 text-[#f7a81b]" />
                <span>Assinatura Digital Capturada em Tela</span>
              </div>
              <p className="text-xs text-slate-600">
                Assinatura eletrônica colhida no ato da celebração do comodato
                em <strong>{formatDateTime(loan.created_at)}</strong>, com
                validade jurídica nos termos do Art. 10, § 2º da MP 2.200-2/2001
                e Lei 14.063/2020.
              </p>
              {loan.notes && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 mt-2">
                  <strong>Observações do Contrato:</strong> {loan.notes}
                </div>
              )}
            </div>

            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center min-h-[140px]">
              {signatureImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signatureImage}
                    alt={`Assinatura digital de ${loan.beneficiary?.full_name}`}
                    className="max-h-24 object-contain"
                  />
                  <div className="w-56 border-t border-slate-400 mt-2 pt-1 text-center">
                    <p className="text-xs font-bold text-slate-800">
                      {loan.beneficiary?.full_name}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500">
                      CPF: {loan.beneficiary?.cpf}
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs font-semibold text-slate-600">
                    Assinatura física arquivada / Termo validado presencialmente
                  </p>
                  <div className="w-56 border-t border-slate-400 mt-8 pt-1 text-center mx-auto">
                    <p className="text-xs font-bold text-slate-800">
                      {loan.beneficiary?.full_name}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500">
                      CPF: {loan.beneficiary?.cpf}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Audit Trail / Event History */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm print:hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#17458f]" />
              <h2 className="text-base font-bold text-slate-900">
                Trilha de Auditoria e Histórico de Eventos do Contrato
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {events.length} evento(s) registrado(s)
            </span>
          </div>

          {events.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Nenhum evento de auditoria complementar registrado para este
              contrato.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {events.map((evt) => {
                const meta = EVENT_TYPE_LABELS[evt.event_type] || {
                  label: evt.event_type,
                  badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
                };
                return (
                  <div
                    key={evt.id}
                    className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                            meta.badgeClass
                          )}
                        >
                          {meta.label}
                        </span>
                        {evt.old_status && evt.new_status && (
                          <span className="text-xs text-slate-500 font-mono">
                            ({evt.old_status} → {evt.new_status})
                          </span>
                        )}
                      </div>
                      {evt.notes && (
                        <p className="text-xs text-slate-700 font-medium">
                          {evt.notes}
                        </p>
                      )}
                    </div>

                    <div className="text-right text-xs text-slate-500 shrink-0">
                      <p className="font-semibold text-slate-700">
                        {formatDateTime(evt.created_at)}
                      </p>
                      {evt.performed_by && (
                        <p className="text-[11px] text-slate-400">
                          Operador: {evt.performed_by}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
