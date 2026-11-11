"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Wrench,
  PackageCheck,
  Trash2,
  ClipboardCheck,
  FileText,
  MessageCircle,
  RotateCcw,
  User,
  Package,
  Scale,
} from "lucide-react";
import { dataRepository } from "@/lib/data-layer/repository";
import {
  Loan,
  EquipmentCondition,
  CloseReason,
  EquipmentStatus,
} from "@/lib/data-layer/types";
import {
  DEFAULT_CLUB_INFO,
  CONDITION_LABELS,
  CLOSE_REASON_LABELS,
  STATUS_LABELS,
} from "@/lib/constants";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { buildDischargeWhatsAppLink, sendWhatsAppNotification } from "@/lib/whatsapp";
import { toast } from "sonner";

function sanitizeWhatsAppPhone(phone?: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

const CONDITION_OPTIONS: {
  value: EquipmentCondition;
  title: string;
  subtitle: string;
  badgeColor: string;
}[] = [
  {
    value: "BOM",
    title: "Bom Estado - Sem avarias estruturais",
    subtitle:
      "Estrutura firme, freios/apoios íntegros e pronto após higienização padrão.",
    badgeColor: "border-emerald-300 bg-emerald-50/70 text-emerald-900",
  },
  {
    value: "REGULAR",
    title: "Regular - Desgaste natural de uso",
    subtitle:
      "Pequenas marcas estéticas de uso contínuo, mas 100% seguro e funcional.",
    badgeColor: "border-blue-300 bg-blue-50/70 text-blue-900",
  },
  {
    value: "PRECISA_REPARO",
    title: "Precisa de Reparo - Peça danificada, folga ou pneu furado",
    subtitle:
      "Requer encaminhamento imediato à oficina antes de novo empréstimo.",
    badgeColor: "border-amber-300 bg-amber-50/70 text-amber-900",
  },
  {
    value: "SUCATA",
    title: "Irrecuperável / Baixa Patrimonial",
    subtitle:
      "Comprometimento estrutural grave que inviabiliza uso seguro futuro.",
    badgeColor: "border-red-300 bg-red-50/70 text-red-900",
  },
];

const CLOSE_REASON_OPTIONS: {
  value: CloseReason;
  label: string;
  description: string;
}[] = [
  {
    value: "RECUPERACAO_ALTA",
    label: "Recuperação / Alta Médica",
    description: "Paciente reabilitado ou recebeu alta do tratamento.",
  },
  {
    value: "OBITO_PACIENTE",
    label: "Óbito do Paciente",
    description: "Devolução realizada pela família (priorizar higienização rigorosa).",
  },
  {
    value: "COMPRA_PROPRIA",
    label: "Aquisição de Equipamento Próprio",
    description: "Família adquiriu aparelho próprio e restituiu o do Rotary.",
  },
  {
    value: "TROCA_EQUIPAMENTO",
    label: "Troca por Outro Equipamento",
    description: "Substituição de modelo/tamanho por evolução clínica.",
  },
  {
    value: "DESISTENCIA",
    label: "Desistência de Uso",
    description: "Equipamento não se adaptou à rotina ou deixou de ser utilizado.",
  },
  {
    value: "OUTROS",
    label: "Outros Motivos",
    description: "Devolução administrativa ou encerramento diverso.",
  },
];

const DESTINATION_OPTIONS: {
  value: EquipmentStatus;
  title: string;
  subtitle: string;
  recommended?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "HIGIENIZACAO",
    title: "Enviar para Quarentena de Higienização e Desinfecção",
    subtitle:
      "Protocolo sanitário recomendado (ANVISA) antes de disponibilizar ao próximo paciente.",
    recommended: true,
    icon: Sparkles,
  },
  {
    value: "DISPONIVEL",
    title: "Já Higienizado -> Liberar Direto para Estoque Disponível",
    subtitle:
      "Equipamento já passou por assepsia completa no ato da recepção.",
    icon: PackageCheck,
  },
  {
    value: "MANUTENCAO",
    title: "Enviar para Oficina de Manutenção / Reparo",
    subtitle:
      "Bloqueia novos empréstimos até conclusão do conserto técnico.",
    icon: Wrench,
  },
];

export default function ReturnTriagePage() {
  const params = useParams<{ id: string }>();
  const loanId = params?.id || "";

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [completedLoan, setCompletedLoan] = useState<Loan | null>(null);
  const [resendingWa, setResendingWa] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [condition, setCondition] = useState<EquipmentCondition>("BOM");
  const [closeReason, setCloseReason] =
    useState<CloseReason>("RECUPERACAO_ALTA");
  const [destination, setDestination] =
    useState<EquipmentStatus>("HIGIENIZACAO");
  const [notes, setNotes] = useState<string>("");

  const loadLoan = useCallback(async () => {
    if (!loanId) return;
    setLoading(true);
    try {
      const data = await dataRepository.getLoanById(loanId);
      setLoan(data);
      if (data?.status === "DEVOLVIDO") {
        setCompletedLoan(data);
      }
    } catch (error) {
      console.error("Erro ao carregar contrato para devolução:", error);
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    loadLoan();
  }, [loadLoan]);

  // Auto-select destination based on physical condition and close reason rules
  const handleSelectCondition = (newCondition: EquipmentCondition) => {
    setCondition(newCondition);
    if (newCondition === "PRECISA_REPARO" || newCondition === "SUCATA") {
      setDestination("MANUTENCAO");
    } else if (newCondition === "BOM" || closeReason === "OBITO_PACIENTE") {
      setDestination("HIGIENIZACAO");
    }
  };

  const handleSelectCloseReason = (newReason: CloseReason) => {
    setCloseReason(newReason);
    if (condition === "PRECISA_REPARO") {
      setDestination("MANUTENCAO");
    } else if (newReason === "OBITO_PACIENTE" || condition === "BOM") {
      setDestination("HIGIENIZACAO");
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await dataRepository.returnLoan(loan.id, {
        condition,
        close_reason: closeReason,
        destination,
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        const refreshed = await dataRepository.getLoanById(loan.id);
        const finalLoan = refreshed || result.loan;
        setCompletedLoan(finalLoan);
        setLoan(finalLoan);

        // Auto dispatch Discharge Receipt via WhatsApp if Evolution API is online
        try {
          const dischargePayload = buildDischargeWhatsAppLink(finalLoan);
          sendWhatsAppNotification(dischargePayload.phone, dischargePayload.message);
        } catch {
          // Non-blocking
        }
      } else {
        setErrorMsg(
          result.message ||
            "Não foi possível concluir a devolução do equipamento."
        );
      }
    } catch (error) {
      console.error("Erro ao processar devolução:", error);
      setErrorMsg("Erro inesperado ao salvar a triagem de devolução.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendDischargeWhatsApp = async () => {
    const target = completedLoan || loan;
    if (!target) return;
    setResendingWa(true);
    try {
      const dischargePayload = buildDischargeWhatsAppLink(target);
      const res = await sendWhatsAppNotification(
        dischargePayload.phone,
        dischargePayload.message
      );
      if (res.sentViaApi) {
        toast.success(
          "Termo de Quitação reenviado no WhatsApp do beneficiário com sucesso!"
        );
      } else {
        toast.info("Abrindo WhatsApp Web como contingência...");
        window.open(dischargePayload.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      toast.error("Erro ao reenviar pelo WhatsApp.");
    } finally {
      setResendingWa(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="h-40 bg-white rounded-xl border border-slate-200" />
          <div className="h-96 bg-white rounded-xl border border-slate-200" />
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
            Contrato Não Localizado
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Não foi possível localizar o empréstimo ({loanId}) para realizar o
            check-in de devolução.
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

  const activeLoan = completedLoan || loan;
  const secondaryName =
    activeLoan.beneficiary?.secondary_name ||
    activeLoan.beneficiary?.secondary_contact_name ||
    "Co-responsável Solidário";
  const waPhone = sanitizeWhatsAppPhone(activeLoan.beneficiary?.phone);
  const returnTimestamp =
    activeLoan.actual_return_date ||
    activeLoan.quittance_issued_at ||
    new Date().toISOString();

  const whatsappDischargeText = encodeURIComponent(
    `*TERMO DE DEVOLUÇÃO E QUITAÇÃO DE COMODATO (Art. 320 do Código Civil)*\n\n` +
      `O *${DEFAULT_CLUB_INFO.clubName}* (${DEFAULT_CLUB_INFO.district}) declara para os devidos fins que recebeu de *${
        activeLoan.beneficiary?.full_name || "Comodatário"
      }* (CPF ${activeLoan.beneficiary?.cpf || "—"}) o equipamento ortopédico:\n` +
      `• *Equipamento:* ${activeLoan.equipment?.name || "Aparelho Ortopédico"}\n` +
      `• *Patrimônio:* ${activeLoan.equipment?.patrimony_code || "—"}\n` +
      `• *Protocolo do Contrato:* ${activeLoan.loan_code}\n` +
      `• *Data/Hora da Devolução:* ${formatDateTime(returnTimestamp)}\n` +
      `• *Estado Físico na Volta:* ${
        CONDITION_LABELS[activeLoan.return_condition || condition] || condition
      }\n\n` +
      `Fica outorgada *PLENA, GERAL E IRREVOGÁVEL QUITAÇÃO* (Art. 320 CCB), extinguindo-se a responsabilidade civil do comodatário e do contato secundário solidário (*${secondaryName}*). Muito obrigado por cuidar do patrimônio comunitário do Rotary!`
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href={`/loans/${loan.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#17458f] mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar aos Detalhes do Contrato {loan.loan_code}</span>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <ClipboardCheck className="w-6 h-6 text-[#17458f]" />
              <span>
                Triagem Pós-Devolução e Encerramento de Comodato
              </span>
            </h1>
          </div>

          <span className="font-mono text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-[#17458f] border border-blue-200">
            Protocolo: {loan.loan_code}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Summary Banner of Loan Being Returned */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 text-[#17458f]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Equipamento Retornando
              </span>
              <p className="text-sm font-bold text-slate-900">
                {loan.equipment?.name || "Equipamento Ortopédico"}
              </p>
              <p className="text-xs font-mono text-[#17458f] font-semibold">
                Patrimônio: {loan.equipment?.patrimony_code || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 text-[#17458f]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Comodatário / Responsável
              </span>
              <p className="text-sm font-bold text-slate-900">
                {loan.beneficiary?.full_name || "—"}
              </p>
              <p className="text-xs text-slate-500 font-mono">
                CPF: {loan.beneficiary?.cpf || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Responsabilidade Civil (Art. 582)
              </span>
              <p className="text-sm font-bold text-slate-900">
                {formatCurrency(
                  loan.replacement_value ||
                    loan.equipment?.replacement_value ||
                    0
                )}
              </p>
              <p className="text-xs text-slate-500">
                Retirado em {formatDate(loan.loan_date)}
              </p>
            </div>
          </div>
        </div>

        {/* If Completed: Display Digital Discharge Receipt (Art. 320 CCB) */}
        {completedLoan ? (
          <div className="bg-white rounded-2xl border-2 border-emerald-500 shadow-md overflow-hidden">
            <div className="bg-emerald-600 text-white px-6 py-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-amber-300 shrink-0" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 block">
                    Devolução Concluída com Sucesso • Art. 320 do Código Civil
                  </span>
                  <h2 className="text-xl font-bold">
                    Comprovante Digital de Devolução e Quitação de Comodato
                  </h2>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-white text-emerald-800 text-xs font-extrabold uppercase">
                Dívida / Responsabilidade Extinta
              </span>
            </div>

            <div className="p-6 space-y-6">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-950 leading-relaxed">
                O <strong>{DEFAULT_CLUB_INFO.clubName}</strong> certifica que o
                equipamento{" "}
                <strong>
                  {activeLoan.equipment?.name} (Patrimônio{" "}
                  {activeLoan.equipment?.patrimony_code})
                </strong>{" "}
                foi devidamente restituído ao Banco Ortopédico em{" "}
                <strong>{formatDateTime(returnTimestamp)}</strong>, outorgando-se
                plena, geral e irrevogável <strong>QUITAÇÃO</strong> ao
                comodatário{" "}
                <strong>{activeLoan.beneficiary?.full_name}</strong> (CPF{" "}
                {activeLoan.beneficiary?.cpf}) e liberando o contato secundário
                solidário (<strong>{secondaryName}</strong>) de qualquer
                obrigação contratual referente ao protocolo{" "}
                <strong>{activeLoan.loan_code}</strong>.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block font-semibold uppercase">
                    Estado Físico Aferido
                  </span>
                  <strong className="text-sm text-slate-900 mt-1 block">
                    {CONDITION_LABELS[
                      activeLoan.return_condition || condition
                    ] || condition}
                  </strong>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block font-semibold uppercase">
                    Motivo do Encerramento
                  </span>
                  <strong className="text-sm text-slate-900 mt-1 block">
                    {CLOSE_REASON_LABELS[
                      activeLoan.close_reason || closeReason
                    ] || closeReason}
                  </strong>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block font-semibold uppercase">
                    Novo Destino no Estoque
                  </span>
                  <strong className="text-sm text-[#17458f] mt-1 block">
                    {STATUS_LABELS[
                      activeLoan.post_return_destination || destination
                    ] || destination}
                  </strong>
                </div>
              </div>

              {(activeLoan.return_notes || notes) && (
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <strong>Observações da Vistoria Técnica:</strong>{" "}
                  {activeLoan.return_notes || notes}
                </div>
              )}

              {/* Automated WhatsApp Dispatch Status Banner */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs sm:text-sm text-emerald-950 font-medium">
                  <strong>Termo de Quitação Oficial enviado no WhatsApp!</strong> O comprovante de devolução (Art. 320 CCB) foi disparado automaticamente pelo WhatsApp do Rotary ({waPhone}).
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <Link
                  href="/loans"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para Lista de Contratos</span>
                </Link>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={resendingWa}
                    onClick={handleResendDischargeWhatsApp}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold transition-colors shadow-sm cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>
                      {resendingWa ? "Reenviando..." : "Reenviar no WhatsApp via API"}
                    </span>
                  </button>

                  <Link
                    href={`/loans/${loan.id}/receipt`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#17458f] hover:bg-[#0c2340] text-white text-sm font-bold transition-colors shadow-sm"
                  >
                    <FileText className="w-4 h-4 text-[#f7a81b]" />
                    <span>Ver / Imprimir Termo de Quitação</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Step-by-Step Return Triage Form */
          <form onSubmit={handleSubmitReturn} className="space-y-6">
            {errorMsg && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* STEP 1: Checklist de Estado Físico na Volta */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#17458f]">
                    Passo 1 de 4 • Vistoria Física Obrigatória
                  </span>
                  <h2 className="text-lg font-bold text-slate-900">
                    1. Checklist de Estado Físico na Volta
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {CONDITION_OPTIONS.map((opt) => {
                  const selected = condition === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectCondition(opt.value)}
                      className={cn(
                        "text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between",
                        selected
                          ? "border-[#17458f] bg-blue-50/50 ring-2 ring-[#17458f]/15 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {opt.title}
                        </span>
                        <span
                          className={cn(
                            "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                            selected
                              ? "border-[#17458f] bg-[#17458f]"
                              : "border-slate-300"
                          )}
                        >
                          {selected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        {opt.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: Motivo do Encerramento */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#17458f]">
                  Passo 2 de 4 • Estatística Social do Banco Ortopédico
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  2. Motivo do Encerramento do Comodato
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {CLOSE_REASON_OPTIONS.map((opt) => {
                  const selected = closeReason === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectCloseReason(opt.value)}
                      className={cn(
                        "text-left p-3.5 rounded-xl border-2 transition-all",
                        selected
                          ? "border-[#17458f] bg-blue-50/50 ring-2 ring-[#17458f]/15 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900">
                          {opt.label}
                        </span>
                        {selected && (
                          <CheckCircle2 className="w-4 h-4 text-[#17458f] shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                        {opt.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 3: Destino Imediato do Equipamento (Protocolo ANVISA / Triagem) */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#17458f]">
                  Passo 3 de 4 • Máquina de Estados & Controle Sanitário
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  3. Destino Imediato do Equipamento (Protocolo ANVISA / Triagem)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  O sistema pré-seleciona automaticamente a rota mais segura
                  conforme o estado físico e o motivo da devolução.
                </p>
              </div>

              <div className="space-y-3">
                {DESTINATION_OPTIONS.map((opt) => {
                  const selected = destination === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDestination(opt.value)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3.5",
                        selected
                          ? "border-[#17458f] bg-blue-50/50 ring-2 ring-[#17458f]/15 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <div
                        className={cn(
                          "p-2.5 rounded-lg shrink-0 mt-0.5",
                          selected
                            ? "bg-[#17458f] text-[#f7a81b]"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {opt.title}
                          </span>
                          {opt.recommended && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#f7a81b] text-[#0c2340]">
                              Padrão Recomendado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {opt.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}

                {condition === "SUCATA" && (
                  <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800 font-medium">
                    <Trash2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>
                      Atenção: Como o estado físico foi marcado como{" "}
                      <strong>Irrecuperável / Baixa Patrimonial (SUCATA)</strong>,
                      o equipamento será baixado do estoque ativo para evitar
                      empréstimos acidentais.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 4: Observações da Vistoria */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#17458f]">
                  Passo 4 de 4 • Registro Técnico & Quitação
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  4. Observações da Vistoria
                </h2>
              </div>

              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Descreva observações sobre pneus, freios, estofamento, higienização prévia ou detalhes informados pelo familiar no ato da entrega..."
                className="w-full p-3.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#17458f] focus:bg-white text-slate-900"
              />
            </div>

            {/* Submit Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-600 max-w-md">
                Ao confirmar, o contrato <strong>{loan.loan_code}</strong> será
                encerrado como <strong>DEVOLVIDO</strong> e o{" "}
                <strong>Termo Digital de Quitação (Art. 320 CCB)</strong> será
                emitido imediatamente.
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/loans/${loan.id}`}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </Link>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#17458f] hover:bg-[#0c2340] text-white text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4 text-[#f7a81b]" />
                  <span>
                    {submitting
                      ? "Processando Quitação..."
                      : "Confirmar Devolução e Emitir Quitação (Art. 320 CCB)"}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
