"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  QrCode,
  Printer,
  CheckCircle2,
  Package,
  Wrench,
  Sparkles,
  ArrowRight,
  X,
  Filter,
  Tag,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { dataRepository } from "@/lib/data-layer/repository";
import {
  Equipment,
  EquipmentCategory,
  EquipmentCondition,
  EquipmentStatus,
} from "@/lib/data-layer/types";
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";

type StatusFilterOption = "TODOS" | EquipmentStatus;
type CategoryFilterOption =
  | "TODAS"
  | "CADEIRA_RODAS"
  | "CADEIRA_BANHO"
  | "MULETA"
  | "ANDADOR"
  | "CAMA_HOSPITALAR"
  | "OUTROS";

const STATUS_PILLS: { value: StatusFilterOption; label: string }[] = [
  { value: "TODOS", label: "Todos os Status" },
  { value: "DISPONIVEL", label: "Disponível" },
  { value: "EMPRESTADO", label: "Emprestado" },
  { value: "ATRASADO", label: "Atrasado" },
  { value: "HIGIENIZACAO", label: "Higienização" },
  { value: "MANUTENCAO", label: "Manutenção" },
  { value: "BAIXADO", label: "Baixado" },
];

const CATEGORY_PILLS: { value: CategoryFilterOption; label: string }[] = [
  { value: "TODAS", label: "Todas Categorias" },
  { value: "CADEIRA_RODAS", label: "Cadeira de Rodas" },
  { value: "CADEIRA_BANHO", label: "Cadeira de Banho" },
  { value: "MULETA", label: "Muletas" },
  { value: "ANDADOR", label: "Andador" },
  { value: "CAMA_HOSPITALAR", label: "Cama Hospitalar" },
  { value: "OUTROS", label: "Outros" },
];

export default function EquipmentsCatalogPage() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>("TODOS");
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilterOption>("TODAS");

  // Modal State ("Novo Equipamento")
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form State
  const [patrimonyCode, setPatrimonyCode] = useState<string>("ROT-CR-009");
  const [category, setCategory] = useState<EquipmentCategory>("CADEIRA_RODAS");
  const [name, setName] = useState<string>("");
  const [brandModel, setBrandModel] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [serialNumber, setSerialNumber] = useState<string>("");
  const [condition, setCondition] = useState<EquipmentCondition>("NOVO");
  const [replacementValue, setReplacementValue] = useState<string>("800");
  const [notes, setNotes] = useState<string>("");

  const loadEquipments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dataRepository.getEquipments();
      setEquipments(data);
    } catch (err) {
      console.error("Failed to fetch equipments:", err);
      toast.error("Não foi possível carregar o acervo de equipamentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEquipments();
  }, [loadEquipments]);

  const handleReleaseToStock = async (item: Equipment) => {
    try {
      setReleasingId(item.id);
      await dataRepository.releaseEquipment(
        item.id,
        "DISPONIVEL",
        "Liberado para uso após triagem"
      );
      toast.success(
        `Equipamento ${item.patrimony_code} liberado para estoque disponível!`
      );
      await loadEquipments();
    } catch (err) {
      console.error("Failed to release equipment:", err);
      toast.error("Erro ao liberar equipamento para o estoque.");
    } finally {
      setReleasingId(null);
    }
  };

  const resetForm = (nextCount?: number) => {
    const count = nextCount ?? equipments.length + 1;
    const padded = String(count).padStart(3, "0");
    setPatrimonyCode(`ROT-CR-${padded}`);
    setCategory("CADEIRA_RODAS");
    setName("");
    setBrandModel("");
    setDescription("");
    setSerialNumber("");
    setCondition("NOVO");
    setReplacementValue("800");
    setNotes("");
  };

  const handleOpenModal = () => {
    resetForm(equipments.length + 1);
    setIsModalOpen(true);
  };

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPatrimony = patrimonyCode.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanPatrimony || !cleanName) {
      toast.error("Preencha o Código Patrimonial e o Nome do Equipamento.");
      return;
    }

    const exists = equipments.some(
      (eq) => eq.patrimony_code.toUpperCase() === cleanPatrimony
    );
    if (exists) {
      toast.error(
        `Já existe um equipamento com o patrimônio ${cleanPatrimony}.`
      );
      return;
    }

    const numericValue = Number(replacementValue) || 800;
    const qr_token = `rotary-item-${cleanPatrimony
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")}`;

    try {
      setSubmitting(true);
      await dataRepository.createEquipment({
        patrimony_code: cleanPatrimony,
        qr_token,
        category,
        name: cleanName,
        brand_model: brandModel.trim() || undefined,
        model_description: description.trim() || undefined,
        serial_number: serialNumber.trim() || undefined,
        status: "DISPONIVEL",
        condition,
        replacement_value: numericValue,
        acquisition_date: new Date().toISOString().split("T")[0],
        notes: notes.trim() || undefined,
      });

      toast.success(
        `Equipamento ${cleanPatrimony} cadastrado com sucesso no acervo!`
      );
      setIsModalOpen(false);
      await loadEquipments();
    } catch (err) {
      console.error("Failed to create equipment:", err);
      toast.error("Erro ao cadastrar novo equipamento.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEquipments = useMemo(() => {
    return equipments.filter((item) => {
      // 1. Status filter
      if (statusFilter !== "TODOS" && item.status !== statusFilter) {
        return false;
      }

      // 2. Category filter
      if (categoryFilter !== "TODAS") {
        if (categoryFilter === "MULETA") {
          if (
            item.category !== "MULETA" &&
            item.category !== "MULETA_AXILAR" &&
            item.category !== "MULETA_CANADENSE"
          ) {
            return false;
          }
        } else if (categoryFilter === "OUTROS") {
          if (
            item.category !== "OUTROS" &&
            item.category !== "COLCHAO_PNEUMATICO" &&
            item.category !== "SUPORTE_SORO"
          ) {
            return false;
          }
        } else if (item.category !== categoryFilter) {
          return false;
        }
      }

      // 3. Search filter
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesPatrimony = item.patrimony_code.toLowerCase().includes(q);
        const matchesBrand =
          item.brand_model?.toLowerCase().includes(q) ?? false;
        const matchesSerial =
          item.serial_number?.toLowerCase().includes(q) ?? false;

        if (!matchesName && !matchesPatrimony && !matchesBrand && !matchesSerial) {
          return false;
        }
      }

      return true;
    });
  }, [equipments, statusFilter, categoryFilter, searchQuery]);

  // Summary counts for quick reference
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { TODOS: equipments.length };
    for (const eq of equipments) {
      counts[eq.status] = (counts[eq.status] || 0) + 1;
    }
    return counts;
  }, [equipments]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 text-rotary-blue text-xs font-bold uppercase tracking-wider border border-blue-200">
            <Package className="w-3.5 h-3.5" />
            <span>Gestão Patrimonial & Rastreabilidade QR</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Acervo de Equipamentos Ortopédicos
          </h1>
          <p className="text-sm text-slate-600">
            Controle de disponibilidade, triagem sanitária ANVISA, manutenção e
            etiquetas QR Code do Rotary Club.
          </p>
        </div>

        {/* Action Buttons Cluster */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/equipments/labels"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Imprimir Etiquetas QR</span>
          </Link>

          <Link
            href="/scan"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-rotary-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
          >
            <QrCode className="w-4 h-4 text-rotary-blue" />
            <span>Escanear QR</span>
          </Link>

          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-rotary-gold text-rotary-blue hover:bg-amber-400 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.75px]" />
            <span>Cadastrar Equipamento</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código patrimonial (ex: ROT-CR-001), nome, marca/modelo ou número de série..."
            className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rotary-blue focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Filter className="w-3.5 h-3.5 text-rotary-blue" />
            <span>Filtrar por Status Operacional</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_PILLS.map((pill) => {
              const active = statusFilter === pill.value;
              const count = statusCounts[pill.value] ?? 0;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setStatusFilter(pill.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                    active
                      ? "bg-rotary-blue text-white border-rotary-blue shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <span>{pill.label}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px]",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-200/80 text-slate-600"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Tag className="w-3.5 h-3.5 text-rotary-gold" />
            <span>Filtrar por Categoria Ortopédica</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_PILLS.map((pill) => {
              const active = categoryFilter === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setCategoryFilter(pill.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                    active
                      ? "bg-amber-50 text-rotary-blue border-rotary-gold ring-1 ring-rotary-gold font-bold"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-medium text-slate-600">
          Exibindo{" "}
          <span className="font-bold text-slate-900">
            {filteredEquipments.length}
          </span>{" "}
          de <span className="font-bold text-slate-900">{equipments.length}</span>{" "}
          equipamentos cadastrados
        </p>
        {(statusFilter !== "TODOS" ||
          categoryFilter !== "TODAS" ||
          searchQuery.trim() !== "") && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter("TODOS");
              setCategoryFilter("TODAS");
              setSearchQuery("");
            }}
            className="text-xs font-bold text-rotary-blue hover:underline"
          >
            Limpar filtros ativos
          </button>
        )}
      </div>

      {/* Equipment Responsive Card Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="bg-white rounded-2xl border border-slate-200 p-5 h-64 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex justify-between">
                  <div className="h-6 w-28 bg-slate-200 rounded-md" />
                  <div className="h-6 w-24 bg-slate-200 rounded-full" />
                </div>
                <div className="h-5 w-3/4 bg-slate-200 rounded" />
                <div className="h-4 w-1/2 bg-slate-100 rounded" />
              </div>
              <div className="h-10 w-full bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredEquipments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-slate-900">
              Nenhum equipamento encontrado
            </h3>
            <p className="text-sm text-slate-500">
              Não encontramos itens com os filtros selecionados. Tente ajustar
              sua busca ou cadastre um novo equipamento no acervo.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("TODOS");
                setCategoryFilter("TODAS");
                setSearchQuery("");
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Mostrar Todos
            </button>
            <button
              type="button"
              onClick={handleOpenModal}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-rotary-blue text-white hover:bg-blue-800"
            >
              + Cadastrar Equipamento
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEquipments.map((item) => {
            const statusStyle = STATUS_COLORS[item.status] || {
              bg: "bg-slate-100",
              text: "text-slate-700",
              border: "border-slate-300",
            };
            const isTriageOrMaint =
              item.status === "HIGIENIZACAO" || item.status === "MANUTENCAO";

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-3.5">
                  {/* Top Row: Monospace Patrimony Code & Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-extrabold tracking-tight px-2.5 py-1 rounded-lg bg-slate-900 text-white">
                      {item.patrimony_code}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                        statusStyle.bg,
                        statusStyle.text,
                        statusStyle.border
                      )}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </div>

                  {/* Category & Condition Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-rotary-blue border border-blue-100">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      <ShieldCheck className="w-3 h-3 text-slate-500" />
                      Estado: {CONDITION_LABELS[item.condition] || item.condition}
                    </span>
                  </div>

                  {/* Title & Brand/Model */}
                  <div>
                    <h2 className="text-base font-bold text-slate-900 group-hover:text-rotary-blue transition-colors line-clamp-1">
                      {item.name}
                    </h2>
                    <p className="text-xs font-medium text-slate-500 mt-0.5 line-clamp-1">
                      {item.brand_model ||
                        item.model_description ||
                        "Modelo padrão Rotary"}
                      {item.serial_number ? ` • Série: ${item.serial_number}` : ""}
                    </p>
                  </div>

                  {/* Metadata / Replacement Value */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">
                      Valor Patrimonial (CCB):
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(item.replacement_value)}
                    </span>
                  </div>

                  {item.notes && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 line-clamp-2">
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* Contextual Action Footer */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/item/${item.qr_token}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-2xs transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5 text-rotary-blue" />
                    <span>Ver Ficha / QR</span>
                  </Link>

                  {item.status === "DISPONIVEL" && (
                    <Link
                      href={`/loans/new?equipment_id=${item.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors"
                    >
                      <span>Emprestar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  {isTriageOrMaint && (
                    <button
                      type="button"
                      disabled={releasingId === item.id}
                      onClick={() => handleReleaseToStock(item)}
                      className={cn(
                        "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shadow-2xs transition-colors",
                        item.status === "HIGIENIZACAO"
                          ? "bg-purple-600 hover:bg-purple-700"
                          : "bg-amber-600 hover:bg-amber-700",
                        releasingId === item.id && "opacity-60 cursor-wait"
                      )}
                    >
                      {item.status === "HIGIENIZACAO" ? (
                        <Sparkles className="w-3.5 h-3.5" />
                      ) : (
                        <Wrench className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {releasingId === item.id
                          ? "Liberando..."
                          : "Liberar p/ Estoque"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog Modal: "Novo Equipamento" */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-novo-equipamento-title"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full overflow-hidden my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-rotary-blue text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <Package className="w-5 h-5 text-rotary-gold" />
                </div>
                <div>
                  <h2
                    id="modal-novo-equipamento-title"
                    className="text-lg font-bold leading-tight"
                  >
                    Novo Equipamento Ortopédico
                  </h2>
                  <p className="text-xs text-blue-100">
                    Gera automaticamente o token e etiqueta QR Code patrimonial
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateEquipment} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Código Patrimonial *
                  </label>
                  <input
                    type="text"
                    required
                    value={patrimonyCode}
                    onChange={(e) =>
                      setPatrimonyCode(e.target.value.toUpperCase())
                    }
                    placeholder="Ex: ROT-CR-009"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    QR Token:{" "}
                    <code className="text-rotary-blue font-mono">
                      rotary-item-
                      {patrimonyCode
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "-")}
                    </code>
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Categoria *
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as EquipmentCategory)
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                  >
                    <option value="CADEIRA_RODAS">Cadeira de Rodas</option>
                    <option value="CADEIRA_BANHO">Cadeira de Banho</option>
                    <option value="MULETA">Muleta (Par)</option>
                    <option value="ANDADOR">Andador</option>
                    <option value="CAMA_HOSPITALAR">Cama Hospitalar</option>
                    <option value="COLCHAO_PNEUMATICO">
                      Colchão Pneumático
                    </option>
                    <option value="SUPORTE_SORO">Suporte de Soro</option>
                    <option value="OUTROS">Outros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome do Equipamento *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Cadeira de Rodas Dobrável Adulto Até 120kg"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Marca / Modelo
                  </label>
                  <input
                    type="text"
                    value={brandModel}
                    onChange={(e) => setBrandModel(e.target.value)}
                    placeholder="Ex: Ortobras / Jaguaribe / Mercur"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Número de Série
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="Ex: SN-2026-9981"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Descrição Técnica / Dimensões
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Assento 44cm, pneus maciços, apoio de pés removível"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Estado de Conservação *
                  </label>
                  <select
                    value={condition}
                    onChange={(e) =>
                      setCondition(e.target.value as EquipmentCondition)
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                  >
                    <option value="NOVO">Novo</option>
                    <option value="BOM">Bom Estado</option>
                    <option value="REGULAR">Regular (Marcas de Uso)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Valor de Reposição (R$ - CCB Art. 582) *
                  </label>
                  <input
                    type="number"
                    min="50"
                    step="10"
                    required
                    value={replacementValue}
                    onChange={(e) => setReplacementValue(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observações / Origem de Doação
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Doado na campanha distrital; revisado e higienizado."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-rotary-gold text-rotary-blue hover:bg-amber-400 shadow-sm transition-all disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5px]" />
                  <span>
                    {submitting ? "Salvando..." : "Salvar e Gerar QR Code"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
