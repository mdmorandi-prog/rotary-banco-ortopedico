"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wrench,
  DollarSign,
  QrCode,
  Plus,
  ArrowRight,
  ShieldCheck,
  Calendar,
  User,
  Users,
  ExternalLink,
} from "lucide-react";
import { dataRepository } from "@/lib/data-layer/repository";
import { DashboardMetrics, Loan } from "@/lib/data-layer/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DEFAULT_CLUB_INFO, STATUS_COLORS, LOAN_STATUS_LABELS } from "@/lib/constants";
import { RotaryLogo } from "@/components/layout/rotary-logo";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentLoans, setRecentLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [m, loans] = await Promise.all([
          dataRepository.getDashboardMetrics(),
          dataRepository.getLoans(),
        ]);
        setMetrics(m);
        setRecentLoans(loans.slice(0, 5));
      } catch (err) {
        console.error("Failed to load dashboard metrics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner / Rotary Welcome */}
      <div className="bg-gradient-to-r from-rotary-blue to-[#0c2340] rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 opacity-10 pointer-events-none">
          <RotaryLogo size={360} />
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-semibold text-amber-300 mb-3 border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{DEFAULT_CLUB_INFO.clubName} • {DEFAULT_CLUB_INFO.district}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Banco de Aparelhos Ortopédicos
            </h1>
            <p className="mt-2 text-sm sm:text-base text-blue-100 font-normal leading-relaxed">
              Rastreabilidade de equipamentos via QR Code, contratos digitais de comodato e controle automatizado de renovações.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button
                asChild
                className="bg-rotary-gold text-rotary-blue hover:bg-amber-400 font-bold shadow-sm"
              >
                <Link href="/loans/new">
                  <Plus className="w-4 h-4 mr-1.5 stroke-[3px]" />
                  Novo Empréstimo
                </Link>
              </Button>
            <Button
              asChild
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/scan">
                <QrCode className="w-4 h-4 mr-1.5" />
                Escanear QR Code
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/overdue">
                <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-300" />
                Radar de Cobrança
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/users">
                <Users className="w-4 h-4 mr-1.5 text-amber-300" />
                Usuários & MFA
              </Link>
            </Button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Acervo */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">
              Total do Acervo
            </CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg text-rotary-blue">
              <Package className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {loading ? "..." : metrics?.totalEquipments ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Equipamentos cadastrados
            </p>
          </CardContent>
        </Card>

        {/* Disponíveis */}
        <Card className="hover:shadow-md transition-shadow border-emerald-100 bg-emerald-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-emerald-800">
              Disponíveis
            </CardTitle>
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
              {loading ? "..." : metrics?.availableCount ?? 0}
            </div>
            <p className="text-[11px] text-emerald-600 mt-1">
              Prontos para empréstimo
            </p>
          </CardContent>
        </Card>

        {/* Emprestados */}
        <Card className="hover:shadow-md transition-shadow border-blue-100 bg-blue-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-rotary-blue">
              Emprestados
            </CardTitle>
            <div className="p-2 bg-blue-100 rounded-lg text-rotary-blue">
              <Clock className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-rotary-blue">
              {loading ? "..." : metrics?.loanedCount ?? 0}
            </div>
            <p className="text-[11px] text-blue-600 mt-1">
              Comodatos ativos
            </p>
          </CardContent>
        </Card>

        {/* Atrasados */}
        <Card className="hover:shadow-md transition-shadow border-red-200 bg-red-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-red-800">
              Atrasados
            </CardTitle>
            <div className="p-2 bg-red-100 rounded-lg text-red-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-red-700">
              {loading ? "..." : metrics?.overdueCount ?? 0}
            </div>
            <Link
              href="/overdue"
              className="text-[11px] text-red-600 hover:text-red-800 font-semibold mt-1 inline-flex items-center gap-1 hover:underline"
            >
              <span>Ver radar de cobrança</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics & Quick Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Value at Risk / Patrimônio */}
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-700" />
                Patrimônio em Circulação
              </CardTitle>
              <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-100/50 text-[10px]">
                Art. 582 CCB
              </Badge>
            </div>
            <CardDescription className="text-xs text-amber-800">
              Valor declarado de reposição sob guarda de beneficiários
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-black text-amber-950">
              {loading ? "..." : formatCurrency(metrics?.valueAtRisk ?? 0)}
            </div>
            <p className="text-[11px] text-amber-800 mt-1">
              Garantido pelo Termo de Comodato Digital
            </p>
          </CardContent>
        </Card>

        {/* Maintenance and Sanitation */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-slate-600" />
                Higienização & Manutenção
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                Oficina
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Itens em processo de revisão ou desinfecção
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-black text-slate-800">
              {loading ? "..." : metrics?.maintenanceCount ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Indisponíveis temporariamente
            </p>
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rotary-blue" />
                Vencendo nos Próximos 7 Dias
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                D-7
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Avisos preventivos prontos para disparo
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-black text-rotary-blue">
              {loading ? "..." : metrics?.expiringIn7DaysCount ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Candidatos a renovação rápida via Magic Link
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Loans Section */}
      <Card>
        <CardHeader className="p-5 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
              Empréstimos Recentes
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Últimos contratos firmados e monitoramento de devoluções
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link href="/loans">
              Ver Todos
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Carregando comodatos...
            </div>
          ) : recentLoans.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Nenhum empréstimo registrado no momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentLoans.map((loan) => {
                const statusColor = STATUS_COLORS[loan.status] || {
                  bg: "bg-slate-100",
                  text: "text-slate-700",
                  border: "border-slate-200",
                };
                return (
                  <div
                    key={loan.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-50 text-rotary-blue mt-0.5 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900">
                            {loan.beneficiary?.full_name || "Beneficiário"}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}>
                            {LOAN_STATUS_LABELS[loan.status] || loan.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span className="font-semibold text-slate-700">
                            {loan.equipment?.name || "Equipamento"}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">
                            {loan.equipment?.patrimony_code}
                          </span>
                          <span>•</span>
                          <span>Prev. Retorno: {formatDate(loan.expected_return_date)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {loan.status === "ATRASADO" ? (
                        <Button
                          asChild
                          size="sm"
                          variant="destructive"
                          className="h-8 text-xs font-semibold"
                        >
                          <Link href={`/overdue`}>
                            Cobrar WhatsApp
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-rotary-blue hover:text-rotary-blue border-blue-200 hover:bg-blue-50"
                        >
                          <Link href={`/item/${loan.equipment?.qr_token}`}>
                            Ver Item
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
