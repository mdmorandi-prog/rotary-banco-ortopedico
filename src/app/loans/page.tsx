"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  PlusCircle,
  AlertTriangle,
  Search,
  Calendar,
  Phone,
  User,
  Users,
  RefreshCw,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  Package,
  Filter,
} from "lucide-react";
import { dataRepository } from "@/lib/data-layer/repository";
import { Loan, LoanStatus } from "@/lib/data-layer/types";
import {
  LOAN_STATUS_LABELS,
  CATEGORY_LABELS,
  CONDITION_LABELS,
} from "@/lib/constants";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type FilterStatus = "TODOS" | "ATIVO" | "ATRASADO" | "RENOVADO" | "DEVOLVIDO";

const STATUS_BADGE_STYLES: Record<
  LoanStatus,
  { bg: string; text: string; border: string; dot: string }
> = {
  ATIVO: {
    bg: "bg-blue-50",
    text: "text-rotary-blue",
    border: "border-blue-200",
    dot: "bg-rotary-blue",
  },
  RENOVADO: {
    bg: "bg-sky-50",
    text: "text-sky-800",
    border: "border-sky-200",
    dot: "bg-sky-600",
  },
  ATRASADO: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-600",
  },
  DEVOLVIDO: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-600",
  },
  CANCELADO: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-300",
    dot: "bg-slate-500",
  },
  PERDIDO_EXTRAVIADO: {
    bg: "bg-rose-100",
    text: "text-rose-800",
    border: "border-rose-300",
    dot: "bg-rose-700",
  },
};

function sanitizeWhatsAppPhone(phone?: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export default function LoansListPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("TODOS");

  const loadLoans = async () => {
    setLoading(true);
    try {
      const data = await dataRepository.getLoans();
      setLoans(data);
    } catch (error) {
      console.error("Erro ao carregar contratos de comodato:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, []);

  const counts = useMemo(() => {
    return {
      TODOS: loans.length,
      ATIVO: loans.filter((l) => l.status === "ATIVO").length,
      ATRASADO: loans.filter((l) => l.status === "ATRASADO").length,
      RENOVADO: loans.filter((l) => l.status === "RENOVADO").length,
      DEVOLVIDO: loans.filter((l) => l.status === "DEVOLVIDO").length,
    };
  }, [loans]);

  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      if (statusFilter !== "TODOS" && loan.status !== statusFilter) {
        return false;
      }

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, "");

      const matchesCode = loan.loan_code?.toLowerCase().includes(q);
      const matchesBeneficiaryName = loan.beneficiary?.full_name
        ?.toLowerCase()
        .includes(q);
      const matchesPatientName = loan.beneficiary?.patient_name
        ?.toLowerCase()
        .includes(q);
      const matchesCpf =
        loan.beneficiary?.cpf?.toLowerCase().includes(q) ||
        (qDigits.length > 0 &&
          loan.beneficiary?.cpf?.replace(/\D/g, "").includes(qDigits));
      const matchesEquipmentName = loan.equipment?.name
        ?.toLowerCase()
        .includes(q);
      const matchesPatrimony = loan.equipment?.patrimony_code
        ?.toLowerCase()
        .includes(q);

      return Boolean(
        matchesCode ||
          matchesBeneficiaryName ||
          matchesPatientName ||
          matchesCpf ||
          matchesEquipmentName ||
          matchesPatrimony
      );
    });
  }, [loans, statusFilter, searchQuery]);

  const filterPills: { key: FilterStatus; label: string }[] = [
    { key: "TODOS", label: "Todos" },
    { key: "ATIVO", label: "Ativos" },
    { key: "ATRASADO", label: "Atrasados" },
    { key: "RENOVADO", label: "Renovados" },
    { key: "DEVOLVIDO", label: "Devolvidos" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Header Banner */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#17458f] mb-1">
                <FileText className="w-4 h-4 text-[#f7a81b]" />
                <span>Gestão Jurídica & Operacional • CCB Arts. 579 a 585</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Contratos de Empréstimo (Comodato)
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Controle integral de termos assinados, prazos de devolução,
                renovações via Magic Link e termos de quitação.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/overdue"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-sm transition-colors shadow-sm"
              >
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Radar de Cobrança</span>
                {counts.ATRASADO > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-red-600 text-white">
                    {counts.ATRASADO}
                  </span>
                )}
              </Link>

              <Link
                href="/loans/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#17458f] hover:bg-[#0c2340] text-white font-semibold text-sm transition-colors shadow-sm"
              >
                <PlusCircle className="w-4 h-4 text-[#f7a81b]" />
                <span>Novo Empréstimo</span>
              </Link>
            </div>
          </div>

          {/* Search & Status Filters Bar */}
          <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-slate-100">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xl">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por protocolo (CMD-...), beneficiário, CPF, equipamento ou patrimônio..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#17458f] focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <Filter className="w-4 h-4 text-slate-400 mr-1 hidden sm:block shrink-0" />
              {filterPills.map((pill) => {
                const isActive = statusFilter === pill.key;
                const count = counts[pill.key];
                return (
                  <button
                    key={pill.key}
                    type="button"
                    onClick={() => setStatusFilter(pill.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap border",
                      isActive
                        ? "bg-[#17458f] text-white border-[#17458f] shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded-full text-[11px]",
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map((skeleton) => (
              <div
                key={skeleton}
                className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse"
              >
                <div className="h-5 bg-slate-200 rounded w-1/4 mb-4" />
                <div className="h-4 bg-slate-100 rounded w-1/2 mb-3" />
                <div className="h-16 bg-slate-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Nenhum contrato de comodato encontrado
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Não localizamos contratos para os filtros selecionados. Tente
              ajustar sua busca ou inicie um novo empréstimo.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              {(searchQuery || statusFilter !== "TODOS") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("TODOS");
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  Limpar Filtros
                </button>
              )}
              <Link
                href="/loans/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#17458f] text-white text-sm font-semibold hover:bg-[#0c2340]"
              >
                <PlusCircle className="w-4 h-4 text-[#f7a81b]" />
                <span>Novo Empréstimo</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLoans.map((loan) => {
              const badgeStyle =
                STATUS_BADGE_STYLES[loan.status] || STATUS_BADGE_STYLES.ATIVO;
              const isActiveOrOverdue =
                loan.status === "ATIVO" ||
                loan.status === "RENOVADO" ||
                loan.status === "ATRASADO";
              const isReturned = loan.status === "DEVOLVIDO";

              const secondaryName =
                loan.beneficiary?.secondary_name ||
                loan.beneficiary?.secondary_contact_name ||
                "Não informado";
              const secondaryRel =
                loan.beneficiary?.secondary_relationship ||
                loan.beneficiary?.secondary_contact_relationship ||
                "Familiar";
              const secondaryPhone =
                loan.beneficiary?.secondary_phone ||
                loan.beneficiary?.secondary_contact_phone ||
                "";

              const waBeneficiary = sanitizeWhatsAppPhone(
                loan.beneficiary?.phone
              );

              return (
                <div
                  key={loan.id}
                  className={cn(
                    "bg-white rounded-xl border transition-all shadow-sm hover:shadow-md overflow-hidden",
                    loan.status === "ATRASADO"
                      ? "border-red-300 ring-1 ring-red-100"
                      : "border-slate-200"
                  )}
                >
                  {/* Top Bar of Card */}
                  <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Status Badge */}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                          badgeStyle.bg,
                          badgeStyle.text,
                          badgeStyle.border
                        )}
                      >
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            badgeStyle.dot
                          )}
                        />
                        {LOAN_STATUS_LABELS[loan.status] || loan.status}
                      </span>

                      {/* Protocol Code */}
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-200/75 text-slate-800">
                        Protocolo: {loan.loan_code}
                      </span>

                      {/* Patrimony Badge */}
                      {loan.equipment && (
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2.5 py-1 rounded bg-blue-50 text-[#17458f] border border-blue-200">
                          <Package className="w-3.5 h-3.5" />
                          {loan.equipment.patrimony_code}
                        </span>
                      )}
                    </div>

                    {/* Renewal Counter & Replacement Value */}
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                        Renovações:{" "}
                        <strong className="text-slate-900">
                          {loan.renewal_count}/{loan.max_renewals}
                        </strong>
                      </span>
                      <span className="hidden sm:inline text-slate-300">|</span>
                      <span className="hidden sm:inline font-medium">
                        Valor de Reposição:{" "}
                        <strong className="text-slate-800">
                          {formatCurrency(
                            loan.replacement_value ||
                              loan.equipment?.replacement_value ||
                              0
                          )}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                    {/* Equipment & Dates Info */}
                    <div className="lg:col-span-4 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Equipamento Ortopédico
                      </div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>
                          {loan.equipment?.name || "Equipamento Registrado"}
                        </span>
                      </h3>
                      {loan.equipment?.category && (
                        <p className="text-xs text-slate-500">
                          Categoria:{" "}
                          <span className="font-medium text-slate-700">
                            {CATEGORY_LABELS[loan.equipment.category] ||
                              loan.equipment.category}
                          </span>
                          {loan.equipment.condition && (
                            <>
                              {" • "}Condição:{" "}
                              <span className="font-medium text-slate-700">
                                {CONDITION_LABELS[loan.equipment.condition] ||
                                  loan.equipment.condition}
                              </span>
                            </>
                          )}
                        </p>
                      )}

                      {/* Dates Row */}
                      <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Retirada:</span>
                          <strong className="text-slate-800">
                            {formatDate(loan.loan_date)}
                          </strong>
                        </div>

                        <div
                          className={cn(
                            "flex items-center gap-1.5",
                            loan.status === "ATRASADO"
                              ? "text-red-700 font-bold"
                              : "text-slate-600"
                          )}
                        >
                          <Clock
                            className={cn(
                              "w-3.5 h-3.5",
                              loan.status === "ATRASADO"
                                ? "text-red-600"
                                : "text-slate-400"
                            )}
                          />
                          <span>Vencimento:</span>
                          <strong>
                            {formatDate(loan.expected_return_date)}
                          </strong>
                        </div>

                        {loan.actual_return_date && (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              Devolvido em: {formatDate(loan.actual_return_date)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Beneficiary & Secondary Contact Info */}
                    <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 rounded-lg p-3.5 border border-slate-100">
                      {/* Primary Beneficiary */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          <User className="w-3.5 h-3.5 text-[#17458f]" />
                          <span>Comodatário / Beneficiário</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {loan.beneficiary?.full_name || "Beneficiário"}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          CPF: {loan.beneficiary?.cpf || "—"}
                        </p>
                        {loan.beneficiary?.phone && (
                          <div className="pt-0.5">
                            <a
                              href={`https://wa.me/${waBeneficiary}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#17458f] hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{loan.beneficiary.phone}</span>
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Mandatory Secondary Contact */}
                      <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3">
                        <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          <Users className="w-3.5 h-3.5 text-[#f7a81b]" />
                          <span>Contato Secundário</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {secondaryName}
                        </p>
                        <p className="text-xs text-slate-500">
                          Vínculo: {secondaryRel}
                        </p>
                        {secondaryPhone && (
                          <p className="text-xs text-slate-600 font-medium flex items-center gap-1 pt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{secondaryPhone}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons Column */}
                    <div className="lg:col-span-4 flex flex-wrap lg:justify-end items-center gap-2.5">
                      <Link
                        href={`/loans/${loan.id}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs transition-colors shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#17458f]" />
                        <span>Detalhes / Termo</span>
                      </Link>

                      {isActiveOrOverdue && (
                        <>
                          <Link
                            href={`/loans/${loan.id}/return`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#17458f] hover:bg-[#0c2340] text-white font-semibold text-xs transition-colors shadow-sm"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-[#f7a81b]" />
                            <span>Registrar Devolução</span>
                          </Link>

                          <Link
                            href={`/renovar/${loan.magic_token}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-slate-900 font-semibold text-xs transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-[#17458f]" />
                            <span>Link de Renovação</span>
                          </Link>
                        </>
                      )}

                      {isReturned && (
                        <Link
                          href={`/loans/${loan.id}/receipt`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Termo de Quitação</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
