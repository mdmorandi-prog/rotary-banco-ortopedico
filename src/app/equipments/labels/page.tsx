"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  ArrowLeft,
  CheckSquare,
  Square,
  Printer,
  Grid,
  Tag,
  QrCode,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { dataRepository } from "@/lib/data-layer/repository";
import { Equipment } from "@/lib/data-layer/types";
import { CATEGORY_LABELS, DEFAULT_CLUB_INFO } from "@/lib/constants";
import { RotaryLogo } from "@/components/layout/rotary-logo";
import { cn } from "@/lib/utils";

type PrintLayoutMode = "A4_GRID" | "THERMAL_60X40";

export default function PrintableQrLabelsPage() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [qrCodeMap, setQrCodeMap] = useState<Record<string, string>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>("TODAS");
  const [layoutMode, setLayoutMode] = useState<PrintLayoutMode>("A4_GRID");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadAndGenerateQrs = async () => {
      try {
        setLoading(true);
        const list = await dataRepository.getEquipments();
        setEquipments(list);
        setSelectedIds(new Set(list.map((item) => item.id)));

        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : "https://rotary-ortopedico.org.br";

        const map: Record<string, string> = {};
        for (const eq of list) {
          const targetUrl = `${origin}/item/${eq.qr_token}`;
          try {
            map[eq.id] = await QRCode.toDataURL(targetUrl, {
              width: 180,
              margin: 1,
              color: {
                dark: "#000000",
                light: "#ffffff",
              },
            });
          } catch (qrErr) {
            console.error(`Failed QR for ${eq.patrimony_code}`, qrErr);
          }
        }
        setQrCodeMap(map);
      } catch (err) {
        console.error("Failed to load equipments for labels:", err);
        toast.error("Erro ao carregar equipamentos para geração de etiquetas.");
      } finally {
        setLoading(false);
      }
    };

    loadAndGenerateQrs();
  }, []);

  const filteredEquipments = useMemo(() => {
    if (categoryFilter === "TODAS") return equipments;
    if (categoryFilter === "MULETA") {
      return equipments.filter(
        (e) =>
          e.category === "MULETA" ||
          e.category === "MULETA_AXILAR" ||
          e.category === "MULETA_CANADENSE"
      );
    }
    return equipments.filter((e) => e.category === categoryFilter);
  }, [equipments, categoryFilter]);

  const selectedEquipments = useMemo(() => {
    return filteredEquipments.filter((e) => selectedIds.has(e.id));
  }, [filteredEquipments, selectedIds]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of filteredEquipments) {
        next.add(item.id);
      }
      return next;
    });
  };

  const handleDeselectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of filteredEquipments) {
        next.delete(item.id);
      }
      return next;
    });
  };

  const handlePrint = () => {
    if (selectedEquipments.length === 0) {
      toast.error("Selecione ao menos um equipamento para imprimir.");
      return;
    }
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Control Panel (Hidden during Print via .no-print) */}
      <div className="no-print space-y-5">
        {/* Top Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/equipments"
                className="inline-flex items-center gap-1 text-xs font-bold text-rotary-blue hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar ao Catálogo</span>
              </Link>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Identificação Patrimonial Vinílica / Térmica
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Gerador de Etiquetas QR Code para Impressão
            </h1>
            <p className="text-sm text-slate-600">
              Selecione os equipamentos e o formato de papel (Folha A4 3x7 ou
              Rolo Térmico 60x40mm) para impressão imediata.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            disabled={selectedEquipments.length === 0}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-extrabold bg-rotary-gold text-rotary-blue hover:bg-amber-400 shadow-md transition-all active:scale-95 disabled:opacity-50 shrink-0"
          >
            <Printer className="w-5 h-5 stroke-[2.5px]" />
            <span>
              Imprimir Etiquetas Selecionadas ({selectedEquipments.length})
            </span>
          </button>
        </div>

        {/* Layout Mode & Category Filter Controls */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
            {/* Layout Mode Switcher */}
            <div className="space-y-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                Formato de Impressão
              </span>
              <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setLayoutMode("A4_GRID")}
                  className={cn(
                    "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all",
                    layoutMode === "A4_GRID"
                      ? "bg-rotary-blue text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Grid className="w-4 h-4" />
                  <span>Folha A4 (Grade 3 Colunas / Múltiplas Etiquetas)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode("THERMAL_60X40")}
                  className={cn(
                    "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all",
                    layoutMode === "THERMAL_60X40"
                      ? "bg-rotary-blue text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Tag className="w-4 h-4" />
                  <span>Etiqueta Térmica 60x40mm / 50x30mm (Zebra/Elgin)</span>
                </button>
              </div>
            </div>

            {/* Category Filter & Bulk Selection */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
                  Filtrar Categoria
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                >
                  <option value="TODAS">Todas as Categorias</option>
                  <option value="CADEIRA_RODAS">Cadeiras de Rodas</option>
                  <option value="CADEIRA_BANHO">Cadeiras de Banho</option>
                  <option value="MULETA">Muletas</option>
                  <option value="ANDADOR">Andadores</option>
                  <option value="CAMA_HOSPITALAR">Camas Hospitalares</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rotary-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Selecionar Todos</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllFiltered}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Limpar Seleção</span>
                </button>
              </div>
            </div>
          </div>

          {/* Equipment Selection Pills */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-600 block">
              Clique para marcar ou desmarcar os itens que serão impressos:
            </span>
            <div className="flex flex-wrap gap-2">
              {filteredEquipments.map((eq) => {
                const isSelected = selectedIds.has(eq.id);
                return (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => toggleItem(eq.id)}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                      isSelected
                        ? "bg-blue-50 text-rotary-blue border-rotary-blue shadow-2xs"
                        : "bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-700"
                    )}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-rotary-blue" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span className="font-mono">{eq.patrimony_code}</span>
                    <span className="font-normal truncate max-w-[140px]">
                      {eq.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* PRINTABLE PREVIEW & OUTPUT SURFACE */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-36 rounded-xl bg-white border border-slate-200 animate-pulse"
            />
          ))}
        </div>
      ) : selectedEquipments.length === 0 ? (
        <div className="no-print bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
          <QrCode className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-base font-bold text-slate-800">
            Nenhuma etiqueta selecionada para impressão
          </p>
          <p className="text-xs text-slate-500">
            Clique em &ldquo;Selecionar Todos&rdquo; acima para visualizar e
            imprimir as etiquetas QR.
          </p>
        </div>
      ) : (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs print:border-none print:shadow-none print:p-0">
          <div className="no-print mb-4 flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
            <span>
              Pré-visualização fiel de impressão (
              {layoutMode === "A4_GRID"
                ? "Grade A4 3 Colunas"
                : "Etiquetas Térmicas Individuais 60x40mm"}
              )
            </span>
            <span>Clube: {DEFAULT_CLUB_INFO.clubName}</span>
          </div>

          <div
            className={cn(
              layoutMode === "A4_GRID"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 gap-3 print:gap-2.5"
                : "flex flex-col items-center gap-4 print:gap-4"
            )}
          >
            {selectedEquipments.map((eq) => {
              const qrSrc = qrCodeMap[eq.id];

              return (
                <div
                  key={eq.id}
                  className={cn(
                    "printable-label border-2 border-slate-900 rounded-xl bg-white p-3 flex flex-col justify-between text-slate-900",
                    layoutMode === "THERMAL_60X40" &&
                      "w-full max-w-[320px] print:w-[60mm] print:max-w-[60mm]"
                  )}
                >
                  {/* Label Top Header */}
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-300">
                    <RotaryLogo size={26} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wider text-rotary-blue leading-tight">
                        BANCO ORTOPÉDICO ROTARY - USO TEMPORÁRIO
                      </p>
                      <p className="text-[8px] font-semibold text-slate-600 truncate">
                        {DEFAULT_CLUB_INFO.clubName}
                      </p>
                    </div>
                  </div>

                  {/* Label Body: Left Info + Right QR */}
                  <div className="flex items-center justify-between gap-2.5 py-2">
                    <div className="flex-1 min-w-0 space-y-1">
                      <span className="inline-block text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                        {CATEGORY_LABELS[eq.category] || eq.category}
                      </span>
                      <div className="font-mono text-lg font-black tracking-tight text-slate-950 leading-none">
                        {eq.patrimony_code}
                      </div>
                      <p className="text-[10px] font-bold text-slate-800 line-clamp-2 leading-snug">
                        {eq.name}
                      </p>
                    </div>

                    <div className="shrink-0 flex flex-col items-center">
                      {qrSrc ? (
                        <img
                          src={qrSrc}
                          alt={`QR ${eq.patrimony_code}`}
                          className="w-20 h-20 object-contain border border-slate-300 rounded p-0.5 bg-white"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-slate-100 rounded border border-slate-200" />
                      )}
                    </div>
                  </div>

                  {/* Label Footer: Return Phone */}
                  <div className="pt-1.5 border-t border-slate-300 flex items-center justify-between text-[8.5px] font-bold text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5 text-rotary-blue" />
                      Devolução: {DEFAULT_CLUB_INFO.contactPhone}
                    </span>
                    <span className="font-mono text-[8px] text-slate-500">
                      ESCANEIE O QR
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
