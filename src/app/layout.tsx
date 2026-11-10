import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { DesktopHeader } from "@/components/layout/desktop-header";
import { DemoModeBanner } from "@/components/layout/demo-mode-banner";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#17458f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Banco Ortopédico | Rotary Club",
    template: "%s | Rotary Banco Ortopédico",
  },
  description: "Sistema de gestão de banco de aparelhos ortopédicos do Rotary Club com rastreabilidade QR Code e contratos digitais",
  applicationName: "Rotary Banco Ortopédico",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Banco Ortopédico",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/rotary-wheel.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased bg-slate-50 text-slate-900 min-h-screen flex flex-col selection:bg-amber-200 selection:text-blue-900">
        {/* Local Demo Fallback Banner - Hidden during printing */}
        <DemoModeBanner />

        <AuthProvider>
          {/* Desktop Sticky Header - Hidden on Mobile */}
          <DesktopHeader />

          {/* Main Content Area */}
          <main className="flex-1 pb-24 md:pb-8 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4">
            {children}
          </main>

          {/* Mobile Sticky Bottom Navigation with Elevated QR FAB - Hidden on Desktop */}
          <MobileBottomNav />
        </AuthProvider>

        {/* Global Toast Notifications */}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
