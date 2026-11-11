"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Phone,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { dataRepository } from "@/lib/data-layer/repository";
import { Equipment, Loan } from "@/lib/data-layer/types";
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/constants";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface ItemRouteProps {
  params: {
    qr_token: string;
  };
}

export default function ContextualEquipmentItemPage({
  params,
}: ItemRouteProps) {
  const decodedToken = decodeURIComponent(params.qr_token || "");

  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Action states
  const [releaseNotes, setReleaseNotes] = useState<string>(
    "Higienização ANVISA concluída com quaternário de amônio / inspeção mecânica aprovada."
  );
  const [isReleasing, setIsReleasing] = useState<boolean>(false);
  const [isRenewing, setIsRenewing] = useState<boolean>(false);

  const loadItemContext = useCallback(async () => {
    try {
      setLoading(true);
      const eq = await dataRepository.getEquipmentByQrToken(decodedToken);
      setEquipment(eq);

      if (eq) {
        const loan = await dataRepository.getActiveLoanByEquipmentId(eq.id);
        setActiveLoan(loan);

        // Quiet background GPS check-in audit on physical QR scan
        if (loan && typeof window !== "undefined" && "geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude, accuracy } = pos.coords;
              dataRepository
                .updateLoanGps(loan.id, latitude, longitude, accuracy)
                .catch(() => {});
            },
            () => {},
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
          );
        }

        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : "https://rotary-ortopedico.org.br";
        const targetUrl = `${origin}/item/${eq.qr_token}`;
        const url = await QRCode.toDataURL(targetUrl, {
          width: 240,
          margin: 1,
          color: {
            dark: "#0c2340",
            light: "#ffffff",
          },
        });
        setQrDataUrl(url);
      }
    } catch (err) {
      console.error("Failed to load equipment context:", err);
      toast.error("Erro ao consultar dados do equipamento.");
    } finally {
      setLoading(false);
    }
  }, [decodedToken]);

  useEffect(() => {
    loadItemContext();
  }, [loadItemContext]);

  const handleReleaseEquipment = async () => {
    if (!equipment) return;
    try {
      setIsReleasing(true);
      const updated = await dataRepository.releaseEquipment(
        equipment.id,
        "DISPONIVEL",
        releaseNotes.trim() || "Liberado para estoque disponível"
      );
      setEquipment({ ...updated });
      toast.success(
        `Equipamento ${equipment.patrimony_code} liberado para Estoque Disponível!`
      );
    } catch (err) {
      console.error("Release error:", err);
      toast.error("Não foi possível liberar o equipamento.");
    } finally {
      setIsReleasing(false);
    }
  };

  const handleRenewLoan = async () => {
    if (!activeLoan) return;
    try {
      setIsRenewing(true);
      const res = await dataRepository.renewLoan(activeLoan.magic_token);
      if (res.success) {
        toast.success(res.message || "Prazo renovado por +30 dias!");
        await loadItemContext();
      } else {
        toast.error(res.message || "Não foi possível renovar o empréstimo.");
      }
    } catch (err) {
      console.error("Renew error:", err);
      toast.error("Erro ao processar renovação de prazo.");
    } finally {
      setIsRenewing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-10 w-48 bg-slate-200 rounded-xl animate-pulse" />
        <div className="bg-white rounded-2xl border border-slate-200 p-6 h-72 animate-pulse" />
        <div className="bg-white rounded-2xl border border-slate-200 p-6 h-64 animate-pulse" />
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-5 shadow-sm my-8">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Equipamento Não Encontrado
          </h1>
          <p className="text-sm text-slate-600">
            Não localizamos nenhum equipamento correspondente ao código ou token{" "}
            <code className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-900">
              {decodedToken}
            </code>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/scan"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-rotary-blue text-white hover:bg-blue-800"
          >
            <QrCode className="w-4 h-4" />
            <span>Escanear Novamente</span>
          </Link>
          <Link
            href="/equipments"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ir para o Catálogo</span>
          </Link>
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_COLORS[equipment.status] || {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-300",
  };

  // Compute remaining or overdue days if loaned
  let daysDiff = 0;
  let isOverdue = equipment.status === "ATRASADO";
  if (activeLoan) {
    const now = new Date();
    const expected = new Date(activeLoan.expected_return_date);
    daysDiff = Math.ceil(
      (expected.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff < 0 || activeLoan.status === "ATRASADO") {
      isOverdue = true;
    }
  }

  const beneficiary = activeLoan?.beneficiary;
  const secondaryName =
    beneficiary?.secondary_name ||
    beneficiary?.secondary_contact_name ||
    "Não informado";
  const secondaryRelation =
    beneficiary?.secondary_relationship ||
    beneficiary?.secondary_contact_relationship ||
    "Familiar";
  const secondaryPhone =
    beneficiary?.secondary_phone ||
    beneficiary?.secondary_contact_phone ||
    "";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/equipments"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-2xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Catálogo</span>
          </Link>
          <Link
            href="/scan"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rotary-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
          >
            <QrCode className="w-4 h-4" />
            <span>Ler Outro QR</span>
          </Link>
        </div>

        <Link
          href="/equipments/labels"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-2xs transition-colors"
        >
          <Printer className="w-4 h-4 text-slate-600" />
          <span>Imprimir Etiqueta Deste Item</span>
        </Link>
      </div>

      {/* 1. CONTEXTUAL STATE MACHINE ACTION PANEL (Top Priority for Volunteer) */}
      {equipment.status === "DISPONIVEL" && (
        <div className="bg-emerald-50/90 border-2 border-emerald-400 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-extrabold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Pronto para Empréstimo Imediato</span>
              </div>
              <h2 className="text-2xl font-extrabold text-emerald-950">
                Equipamento Higienizado e Disponível no Estoque
              </h2>
              <p className="text-sm text-emerald-800">
                Este aparelho passou pela triagem técnica e sanitária. Clique
                abaixo para iniciar o Termo de Comodato Digital (Check-out).
              </p>
            </div>
          </div>

          <Link
            href={`/loans/new?equipment_id=${equipment.id}`}
            className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base sm:text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 active:scale-[0.99]"
          >
            <span>Iniciar Empréstimo (Check-out)</span>
            <ArrowRight className="w-5 h-5 stroke-[2.75px]" />
          </Link>
        </div>
      )}

      {(equipment.status === "EMPRESTADO" ||
        equipment.status === "ATRASADO") && (
        <div
          className={cn(
            "rounded-2xl border-2 p-6 sm:p-7 shadow-sm space-y-6",
            isOverdue
              ? "bg-red-50/80 border-red-400"
              : "bg-blue-50/70 border-blue-300"
          )}
        >
          {/* Loan Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200/80">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider",
                    isOverdue
                      ? "bg-red-600 text-white"
                      : "bg-rotary-blue text-white"
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {isOverdue
                      ? "Empréstimo em Atraso"
                      : "Comodato Ativo em Curso"}
                  </span>
                </span>
                {activeLoan && (
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-white text-slate-800 border border-slate-200">
                    Contrato: {activeLoan.loan_code}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                {isOverdue
                  ? `Prazo vencido há ${Math.abs(daysDiff)} dias`
                  : `Devolução prevista em ${daysDiff} dias`}
              </h2>
            </div>

            {activeLoan && (
              <Link
                href={`/loans/${activeLoan.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-rotary-blue hover:bg-slate-50 border border-slate-200 shadow-2xs self-start"
              >
                <FileText className="w-4 h-4" />
                <span>Ver Contrato Completo</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {/* Beneficiary & Secondary Contact Details */}
          {activeLoan ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primary Beneficiary Card */}
              <div className="bg-white rounded-xl p-4 border border-slate-200/90 space-y-2.5 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-rotary-blue">
                  <User className="w-4 h-4" />
                  <span>Beneficiário / Comodatário Responsável</span>
                </div>
                <div>
                  <p className="text-base font-extrabold text-slate-900">
                    {beneficiary?.full_name || "Beneficiário Cadastrado"}
                  </p>
                  <p className="text-xs font-mono text-slate-600">
                    CPF: {beneficiary?.cpf || "—"}
                  </p>
                </div>
                {beneficiary?.phone && (
                  <div className="pt-1 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      {beneficiary.phone}
                    </span>
                    <a
                      href={`https://wa.me/55${beneficiary.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors"
                    >
                      Abrir WhatsApp
                    </a>
                  </div>
                )}
              </div>

              {/* Mandatory Secondary Contact Card */}
              <div className="bg-white rounded-xl p-4 border border-slate-200/90 space-y-2.5 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-800">
                  <Users className="w-4 h-4 text-rotary-gold" />
                  <span>Contato Secundário Obrigatório (Art. 585 CCB)</span>
                </div>
                <div>
                  <p className="text-base font-bold text-slate-900">
                    {secondaryName}
                  </p>
                  <p className="text-xs text-slate-600">
                    Vínculo / Parentesco:{" "}
                    <strong className="text-slate-800">
                      {secondaryRelation}
                    </strong>
                  </p>
                </div>
                {secondaryPhone && (
                  <div className="pt-1 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Phone className="w-3.5 h-3.5 text-rotary-blue" />
                      {secondaryPhone}
                    </span>
                    <a
                      href={`https://wa.me/55${secondaryPhone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-rotary-blue bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors"
                    >
                      Contatar Familiar
                    </a>
                  </div>
                )}
              </div>

              {/* Loan Dates & Renewals Summary Bar */}
              <div className="md:col-span-2 bg-white rounded-xl p-4 border border-slate-200/90 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-slate-500 block">
                      Data de Retirada:
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {formatDate(activeLoan.loan_date)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-rotary-blue shrink-0" />
                  <div>
                    <span className="text-slate-500 block">
                      Vencimento Atual:
                    </span>
                    <span
                      className={cn(
                        "font-extrabold text-sm",
                        isOverdue ? "text-red-600" : "text-slate-900"
                      )}
                    >
                      {formatDate(activeLoan.expected_return_date)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-slate-500 block">
                      Renovações Utilizadas:
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {activeLoan.renewal_count}/{activeLoan.max_renewals}{" "}
                      renovações
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-700 bg-white p-4 rounded-xl border border-slate-200">
              Este equipamento consta como emprestado. Verifique os contratos em{" "}
              <Link href="/loans" className="text-rotary-blue font-bold underline">
                Empréstimos
              </Link>
              .
            </p>
          )}

          {/* Two Giant Action Buttons */}
          {activeLoan && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <Link
                href={`/loans/${activeLoan.id}/return`}
                className="w-full py-4 px-5 rounded-2xl bg-rotary-blue hover:bg-blue-800 text-white font-extrabold text-base shadow-md transition-all flex items-center justify-center gap-2.5 active:scale-[0.99]"
              >
                <RotateCcw className="w-5 h-5 stroke-[2.5px]" />
                <span>Registrar Devolução (Check-in)</span>
              </Link>

              <button
                type="button"
                disabled={
                  isRenewing ||
                  activeLoan.renewal_count >= activeLoan.max_renewals
                }
                onClick={handleRenewLoan}
                className="w-full py-4 px-5 rounded-2xl bg-rotary-gold hover:bg-amber-400 text-rotary-blue font-extrabold text-base shadow-md transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                <RefreshCw
                  className={cn(
                    "w-5 h-5 stroke-[2.5px]",
                    isRenewing && "animate-spin"
                  )}
                />
                <span>
                  {isRenewing
                    ? "Renovando Prazo..."
                    : activeLoan.renewal_count >= activeLoan.max_renewals
                      ? "Limite de Renovações Atingido"
                      : "Renovar Prazo (+30 dias)"}
                </span>
              </button>
            </div>
          )}

          {activeLoan && (
            <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
              <span>
                Link Self-Service do Beneficiário:{" "}
                <Link
                  href={`/renovar/${activeLoan.magic_token}`}
                  className="font-mono font-bold text-rotary-blue underline"
                >
                  /renovar/{activeLoan.magic_token}
                </Link>
              </span>
            </div>
          )}
        </div>
      )}

      {(equipment.status === "HIGIENIZACAO" ||
        equipment.status === "MANUTENCAO") && (
        <div
          className={cn(
            "rounded-2xl border-2 p-6 sm:p-7 shadow-sm space-y-5",
            equipment.status === "HIGIENIZACAO"
              ? "bg-purple-50/90 border-purple-400"
              : "bg-amber-50/90 border-amber-400"
          )}
        >
          <div className="space-y-1.5">
            <div
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider text-white",
                equipment.status === "HIGIENIZACAO"
                  ? "bg-purple-700"
                  : "bg-amber-700"
              )}
            >
              {equipment.status === "HIGIENIZACAO" ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Quarentena Sanitária Obrigatória (ANVISA)</span>
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4" />
                  <span>Em Manutenção / Oficina Ortopédica</span>
                </>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {equipment.status === "HIGIENIZACAO"
                ? "Equipamento em Desinfecção Pós-Retorno"
                : "Equipamento em Reparo Mecânico / Substituição de Peças"}
            </h2>
            <p className="text-sm text-slate-700">
              {equipment.status === "HIGIENIZACAO"
                ? "Por exigência de biossegurança, itens recém-devolvidos permanecem bloqueados para novos empréstimos até a conclusão da desinfecção."
                : "Este aparelho aguarda conclusão de reparo técnico na oficina voluntária antes de retornar ao acervo ativo."}
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-2">
            <label
              htmlFor="release-triage-notes"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Observações de Liberação / Laudo de Triagem
            </label>
            <input
              id="release-triage-notes"
              type="text"
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="Descreva o procedimento de higienização ou reparo realizado..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rotary-blue"
            />
          </div>

          <button
            type="button"
            disabled={isReleasing}
            onClick={handleReleaseEquipment}
            className={cn(
              "w-full py-4 px-6 rounded-2xl text-white font-extrabold text-base sm:text-lg shadow-md transition-all flex items-center justify-center gap-3 active:scale-[0.99]",
              equipment.status === "HIGIENIZACAO"
                ? "bg-purple-700 hover:bg-purple-800"
                : "bg-amber-600 hover:bg-amber-700",
              isReleasing && "opacity-60 cursor-wait"
            )}
          >
            <CheckCircle2 className="w-5 h-5 stroke-[2.75px]" />
            <span>
              {isReleasing
                ? "Liberando Equipamento..."
                : "Liberar para Estoque Disponível"}
            </span>
          </button>
        </div>
      )}

      {/* 2. FULL EQUIPMENT IDENTITY CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
          {/* Left Identity Details */}
          <div className="flex-1 space-y-4 w-full">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-base font-extrabold px-3 py-1 rounded-xl bg-slate-900 text-white">
                {equipment.patrimony_code}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                  statusStyle.bg,
                  statusStyle.text,
                  statusStyle.border
                )}
              >
                <span className="w-2 h-2 rounded-full bg-current" />
                {STATUS_LABELS[equipment.status] || equipment.status}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-rotary-blue border border-blue-200">
                {CATEGORY_LABELS[equipment.category] || equipment.category}
              </span>
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                {equipment.name}
              </h1>
              {equipment.model_description && (
                <p className="text-sm text-slate-600 mt-1">
                  {equipment.model_description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block">Marca / Modelo</span>
                <span className="font-bold text-slate-900 text-sm">
                  {equipment.brand_model || "Padrão Rotary"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block">Número de Série</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {equipment.serial_number || "S/N"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block">
                  Estado de Conservação
                </span>
                <span className="font-bold text-slate-900 text-sm inline-flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  {CONDITION_LABELS[equipment.condition] || equipment.condition}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block">
                  Valor de Reposição (CCB Art. 582)
                </span>
                <span className="font-extrabold text-rotary-blue text-sm">
                  {formatCurrency(equipment.replacement_value)}
                </span>
              </div>
            </div>

            {equipment.notes && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                <strong className="text-slate-900 block mb-0.5">
                  Histórico / Observações Técnicas:
                </strong>
                {equipment.notes}
              </div>
            )}
          </div>

          {/* Right QR Code Identity Box */}
          <div className="w-full md:w-56 shrink-0 bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col items-center text-center space-y-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rotary-blue">
              QR Code Patrimonial
            </span>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code ${equipment.patrimony_code}`}
                className="w-40 h-40 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs"
              />
            ) : (
              <div className="w-40 h-40 rounded-xl bg-slate-200 animate-pulse" />
            )}
            <code className="text-[11px] font-mono text-slate-600 break-all">
              {equipment.qr_token}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
