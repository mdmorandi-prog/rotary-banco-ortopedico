"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FileText,
  AlertTriangle,
  QrCode,
  Plus,
  Printer,
  Users,
  LogOut,
  ShieldCheck,
  MapPin,
} from "lucide-react";
import { RotaryLogo } from "@/components/layout/rotary-logo";
import { useAuth } from "@/components/auth/auth-provider";
import { PushNotificationButton } from "@/components/pwa/push-notification-button";
import { cn } from "@/lib/utils";

export function DesktopHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (
    pathname === "/login" ||
    pathname.startsWith("/renovar") ||
    (pathname.includes("/receipt") && !user) ||
    (pathname.startsWith("/item/") && !user)
  ) {
    return null;
  }

  const navLinks = [
    { href: "/dashboard", label: "Início", icon: LayoutDashboard },
    { href: "/equipments", label: "Acervo", icon: Package },
    { href: "/map", label: "Mapa", icon: MapPin },
    { href: "/loans", label: "Empréstimos", icon: FileText },
    { href: "/overdue", label: "Radar", icon: AlertTriangle },
    { href: "/users", label: "Usuários & MFA", icon: Users },
  ];

  return (
    <header className="hidden md:flex sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm no-print">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Rotary Club de Farroupilha Official Lockup */}
        <Link
          href="/dashboard"
          className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-rotary-blue rounded-lg p-1"
        >
          <RotaryLogo variant="full" size={44} />
          <div className="hidden lg:flex flex-col pl-2.5 border-l border-slate-200">
            <span className="font-extrabold text-xs leading-tight text-rotary-blue uppercase tracking-wider">
              Banco Ortopédico
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              Distrito 4700
            </span>
          </div>
        </Link>

        {/* Primary Desktop Navigation Links */}
        <nav className="flex items-center gap-1 lg:gap-1.5">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/dashboard" && pathname.startsWith(link.href));
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-rotary-blue font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive && "text-rotary-blue stroke-[2.5px]")} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Quick Actions & User MFA Profile Cluster */}
        <div className="flex items-center gap-2">
          {/* Print Labels Quick Link */}
          <Link
            href="/equipments/labels"
            title="Imprimir Etiquetas Patrimoniais"
            className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden xl:inline">Etiquetas</span>
          </Link>

          {/* QR Scanner Desktop Link */}
          <Link
            href="/scan"
            title="Escanear QR Code com Câmera"
            className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-rotary-blue bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
          >
            <QrCode className="w-4 h-4 text-rotary-blue" />
            <span className="hidden xl:inline">Escanear</span>
          </Link>

          {/* Push Notification Toggle Bell */}
          <PushNotificationButton />

          {/* CTA: Novo Empréstimo in Rotary Gold with dark Rotary Blue text (WCAG AA Compliant) */}
          <Link
            href="/loans/new"
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold bg-rotary-gold text-rotary-blue hover:bg-amber-400 rounded-lg shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            <span>Empréstimo</span>
          </Link>

          {/* Authenticated User & Logout Button */}
          {user && (
            <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-slate-200">
              <Link
                href="/users"
                title={`Logado como ${user.full_name} (${user.email})`}
                className="hidden lg:flex flex-col items-end text-right px-2 py-1 rounded-lg hover:bg-slate-50"
              >
                <span className="text-xs font-bold text-slate-800 leading-tight max-w-[130px] truncate">
                  {user.full_name}
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  MFA Ativo
                </span>
              </Link>
              <button
                type="button"
                onClick={logout}
                title="Sair / Trocar Usuário (Validar MFA)"
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
