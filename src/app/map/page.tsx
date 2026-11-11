"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  MapPin,
  Search,
  Filter,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Navigation,
  MessageCircle,
  ExternalLink,
  RefreshCw,
  Phone,
  User,
  ShieldCheck,
  Compass,
} from "lucide-react";
import { dataRepository } from "@/lib/data-layer/repository";
import { Loan, EquipmentCategory } from "@/lib/data-layer/types";
import { CATEGORY_LABELS, DEFAULT_CLUB_INFO } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { buildNavigationUrl, resolveLoanCoordinates } from "@/lib/geocoding";
import { sendWhatsAppNotification, buildRenewalReminderWhatsAppLink } from "@/lib/whatsapp";
import { toast } from "sonner";

// Dynamic import for Leaflet map to disable SSR
const AcervoMap = dynamic(() => import("@/components/map/acervo-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[620px] rounded-2xl bg-slate-100 border border-slate-300 flex flex-col items-center justify-center gap-3 animate-pulse">
      <Compass className="w-10 h-10 text-[#17458f] animate-spin" />
      <span className="text-sm font-bold text-slate-600">
        Carregando Mapa do Acervo em Farroupilha - RS...
      </span>
    </div>
  ),
});

export default function AcervoMapPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "EM_DIA" | "D7" | "ATRASADO">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  const loadLoans = async () => {
    try {
      setLoading(true);
      const data = await dataRepository.getLoans();
      setLoans(data);
    } catch (err) {
      console.error("Erro ao carregar mapa do acervo:", err);
      toast.error("Não foi possível carregar os empréstimos no mapa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, []);

  const nowDate = useMemo(() => new Date(), []);

  // Active items in field
  const fieldLoans = useMemo(() => {
    return loans.filter(
      (l) => l.status === "ATIVO" || l.status === "ATRASADO" || l.status === "RENOVADO"
    );
  }, [loans]);

  // Compute metrics
  const metrics = useMemo(() => {
    const nowDate = new Date();
    let emDia = 0;
    let d7 = 0;
    let atrasados = 0;
    let gpsAuditados = 0;

    fieldLoans.forEach((l) => {
      const isOverdue = l.status === "ATRASADO" || new Date(l.expected_return_date) < nowDate;
      const daysUntil = Math.ceil(
        (new Date(l.expected_return_date).getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (isOverdue) {
        atrasados++;
      } else if (daysUntil <= 7) {
        d7++;
      } else {
        emDia++;
      }

      if (l.lat && l.lng && l.last_gps_at) {
        gpsAuditados++;
      }
    });

    return {
      total: fieldLoans.length,
      emDia,
      d7,
      atrasados,
      gpsAuditados,
    };
  }, [fieldLoans]);

  // Filtered loans based on search and selected pills
  const filteredLoans = useMemo(() => {
    const nowDate = new Date();
    return fieldLoans.filter((l) => {
      const isOverdue = l.status === "ATRASADO" || new Date(l.expected_return_date) < nowDate;
      const daysUntil = Math.ceil(
        (new Date(l.expected_return_date).getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const isDueSoon = !isOverdue && daysUntil <= 7;

      // Status filter
      if (statusFilter === "EM_DIA" && (isOverdue || isDueSoon)) return false;
      if (statusFilter === "D7" && !isDueSoon) return false;
      if (statusFilter === "ATRASADO" && !isOverdue) return false;

      // Category filter
      if (categoryFilter !== "ALL" && l.equipment?.category !== categoryFilter) return false;

      // Text Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const benName = (l.beneficiary?.full_name || "").toLowerCase();
        const eqName = (l.equipment?.name || "").toLowerCase();
        const patrimony = (l.equipment?.patrimony_code || "").toLowerCase();
        const neighborhood = (l.beneficiary?.address_neighborhood || "").toLowerCase();
        const street = (l.beneficiary?.address_street || "").toLowerCase();

        return (
          benName.includes(q) ||
          eqName.includes(q) ||
          patrimony.includes(q) ||
          neighborhood.includes(q) ||
          street.includes(q)
        );
      }

      return true;
    });
  }, [fieldLoans, statusFilter, categoryFilter, searchTerm]);

  const handleQuickWhatsApp = async (loan: Loan) => {
    try {
      const isOverdue =
        loan.status === "ATRASADO" || new Date(loan.expected_return_date) < new Date();
      const payload = buildRenewalReminderWhatsAppLink(loan, isOverdue ? "OVERDUE" : "D-7");
      const res = await sendWhatsAppNotification(payload.phone, payload.message);
      if (res.sentViaApi) {
        toast.success(`Lembrete enviado via WhatsApp do Rotary para ${loan.beneficiary?.full_name}!`);
      } else {
        toast.info("Abrindo WhatsApp Web como contingência...");
        window.open(payload.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      toast.error("Erro ao enviar mensagem pelo WhatsApp.");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Sede Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#17458f]">
            <MapPin className="w-4 h-4 text-[#f7a81b]" />
            <span>Geolocalização & Rastreamento em Tempo Real</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Mapa do Acervo em Farroupilha - RS
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Visualização territorial de todos os aparelhos ortopédicos cedidos em comodato pela comunidade.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadLoans}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Atualizar</span>
          </button>

          <a
            href="https://maps.google.com/?q=Rua+Nataly+Valentini,+75,+Farroupilha+-+RS"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0c2340] text-white text-xs font-bold hover:bg-[#17458f] transition shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-[#f7a81b]"></span>
            <span>Sede: R. Nataly Valentini, 75</span>
            <ExternalLink className="w-3 h-3 text-[#f7a81b]" />
          </a>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Aparelhos no Campo
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</div>
          <span className="text-[10px] text-slate-500 font-medium">Farroupilha e região</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
            🟢 Em Dia (Regular)
          </span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{metrics.emDia}</div>
          <span className="text-[10px] text-emerald-600 font-medium">Uso autorizado</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
            🟡 Alerta D-7
          </span>
          <div className="text-2xl font-black text-amber-700 mt-1">{metrics.d7}</div>
          <span className="text-[10px] text-amber-600 font-medium">Vencem em até 7 dias</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-800 block">
            🔴 Atrasados / Radar
          </span>
          <div className="text-2xl font-black text-red-700 mt-1">{metrics.atrasados}</div>
          <span className="text-[10px] text-red-600 font-medium">Ponto de coleta rápida</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 block">
            📍 GPS Auditado
          </span>
          <div className="text-2xl font-black text-[#17458f] mt-1">{metrics.gpsAuditados}</div>
          <span className="text-[10px] text-blue-600 font-medium">Auditados pelo celular</span>
        </div>
      </div>

      {/* Main Map & Interactive Radar Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Map */}
        <div className="lg:col-span-8 space-y-4">
          {/* Quick Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-[#0c2340] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Todos ({fieldLoans.length})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("EM_DIA")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === "EM_DIA"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                }`}
              >
                🟢 Em Dia ({metrics.emDia})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("D7")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === "D7"
                    ? "bg-amber-500 text-white"
                    : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
                }`}
              >
                🟡 Alerta D-7 ({metrics.d7})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("ATRASADO")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === "ATRASADO"
                    ? "bg-red-600 text-white"
                    : "bg-red-50 text-red-800 hover:bg-red-100 border border-red-200"
                }`}
              >
                🔴 Atrasados ({metrics.atrasados})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Filtrar por Categoria de Equipamento"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-rotary-blue"
              >
                <option value="ALL">Todas Categorias</option>
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive Map View */}
          <AcervoMap
            loans={filteredLoans}
            selectedLoanId={selectedLoanId}
            onSelectLoan={(id) => setSelectedLoanId(id)}
          />
        </div>

        {/* Right Column: Radar List with 1-click Navigation & Actions */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[680px] overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-[#17458f]" />
                <span>Aparelhos no Radar ({filteredLoans.length})</span>
              </h3>
              <span className="text-[11px] font-semibold text-slate-500">
                Farroupilha, RS
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por paciente, bairro, rua ou patrimônio..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rotary-blue"
              />
            </div>
          </div>

          {/* Scrollable Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
            {filteredLoans.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-500 text-xs">
                Nenhum equipamento localizado com os filtros selecionados.
              </div>
            ) : (
              filteredLoans.map((loan) => {
                const isOverdue =
                  loan.status === "ATRASADO" || new Date(loan.expected_return_date) < nowDate;
                const daysUntil = Math.ceil(
                  (new Date(loan.expected_return_date).getTime() - nowDate.getTime()) /
                    (1000 * 60 * 60 * 24)
                );
                const isDueSoon = !isOverdue && daysUntil <= 7;
                const isSelected = selectedLoanId === loan.id;
                const coords = resolveLoanCoordinates(loan);
                const googleMapsUrl = buildNavigationUrl(coords.lat, coords.lng, "google");
                const wazeUrl = buildNavigationUrl(coords.lat, coords.lng, "waze");
                const ben = loan.beneficiary;

                return (
                  <div
                    key={loan.id}
                    onClick={() => setSelectedLoanId(loan.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? "border-[#17458f] bg-blue-50/50 ring-1 ring-[#17458f]"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {loan.equipment?.name || "Equipamento"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                          isOverdue
                            ? "bg-red-100 text-red-800"
                            : isDueSoon
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isOverdue
                          ? `Atrasado (${Math.abs(daysUntil)}d)`
                          : isDueSoon
                          ? `Vence em ${daysUntil}d`
                          : "Em dia"}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-slate-600 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800 truncate">
                        {ben?.full_name || "Beneficiário"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 mt-1 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#17458f] shrink-0 mt-0.5" />
                      <span className="line-clamp-1">
                        {ben?.address_street}, {ben?.address_number} • {ben?.address_neighborhood}
                      </span>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#17458f] hover:bg-[#0c2340] text-white text-[10px] font-bold transition shadow-xs"
                        >
                          <Navigation className="w-3 h-3 text-[#f7a81b]" />
                          <span>Google Maps</span>
                        </a>

                        <a
                          href={wazeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold transition shadow-xs"
                        >
                          <span>Waze</span>
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickWhatsApp(loan);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition shadow-xs cursor-pointer"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Avisar</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
