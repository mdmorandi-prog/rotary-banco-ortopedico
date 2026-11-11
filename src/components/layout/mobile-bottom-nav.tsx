"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, QrCode, FileText, AlertTriangle, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isFab?: boolean;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (
    pathname === "/login" ||
    pathname.startsWith("/renovar") ||
    (pathname.includes("/receipt") && !user) ||
    (pathname.startsWith("/item/") && !user)
  ) {
    return null;
  }

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Início", icon: LayoutDashboard },
    { href: "/map", label: "Mapa", icon: MapPin },
    { href: "/scan", label: "Escanear", icon: QrCode, isFab: true },
    { href: "/loans", label: "Empréstimos", icon: FileText },
    { href: "/overdue", label: "Radar", icon: AlertTriangle },
  ];

  return (
    <nav
      aria-label="Navegação móvel principal"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-safe no-print"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          if (item.isFab) {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label="Escanear QR Code de Equipamento"
                className="relative -mt-6 group focus:outline-none focus-visible:ring-2 focus-visible:ring-rotary-blue focus-visible:ring-offset-2 rounded-full"
              >
                <div
                  className={cn(
                    "w-14 h-14 rounded-full bg-rotary-blue border-4 border-rotary-gold shadow-lg flex items-center justify-center text-white transition-all duration-150 active:scale-95",
                    isActive ? "ring-2 ring-rotary-blue scale-105" : "hover:scale-105"
                  )}
                >
                  <Icon className="w-7 h-7 text-white stroke-[2.2px]" />
                </div>
                <span
                  className={cn(
                    "block text-[10px] text-center font-bold mt-0.5",
                    isActive ? "text-rotary-blue" : "text-slate-600"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition-colors touch-target focus:outline-none focus-visible:ring-2 focus-visible:ring-rotary-blue rounded-lg",
                isActive
                  ? "text-rotary-blue font-bold"
                  : "text-slate-500 hover:text-slate-900 active:text-rotary-blue"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "w-5 h-5 mb-0.5 transition-transform",
                    isActive && "stroke-[2.5px] scale-110 text-rotary-blue"
                  )}
                />
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
