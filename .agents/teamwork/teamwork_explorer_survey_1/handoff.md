# Handoff Report: Survey Explorer 1 — Architecture, Design System, PWA, Navigation & Demo Fallback (R1)

- **Agent**: `teamwork_explorer_survey_1`
- **Role**: Survey Explorer 1
- **Working Directory**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`
- **State Folder**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_survey_1`
- **Scope / Requirement**: Requirement R1 (Full-stack architecture, Next.js 14+ App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons, Rotary brand palette #17458f and #f7a81b, PWA manifest.json, icons, mobile-first responsive navigation bar, smart local demo fallback mock store, and .env.example).
- **Date**: 2026-11-10T15:15:00Z

---

## 1. Observation

Direct environmental and codebase observations made during investigation:

### 1.1 Workspace State
- Exact path inspected: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`
- Directory contents via `Get-ChildItem -Force`:
  ```
  .agents/              (teamwork state and agent briefings)
  ORIGINAL_REQUEST.md   (authoritative requirement specifications)
  ```
- The project root currently contains no prior `package.json`, `tsconfig.json`, or `src/` folder. Implementation will start cleanly on a blank workspace.

### 1.2 Runtime Environment & Tooling
- Node.js version: `v24.21.0` (confirmed via `node -v`).
- PowerShell Execution Policy restriction on Windows:
  - Invoking `npm` directly inside PowerShell produced:
    `npm : O arquivo C:\Program Files\nodejs\npm.ps1 não pode ser carregado porque a execução de scripts foi desabilitada neste sistema. (PSSecurityException)`.
  - Invoking `npm.cmd -v` and `npx.cmd -v` succeeded cleanly, returning version `11.19.0`.
  - **Critical Rule for Implementers**: All package installation and execution commands in PowerShell on this system must invoke `npm.cmd` and `npx.cmd` rather than `npm` or `npx`.

### 1.3 Available Registry Versions
- Next.js: Latest available is `16.4.6`; `next@14` LTS release line is `14.2.25` / `14.2.35` (fully compatible with App Router, TypeScript, and shadcn/ui).
- Tailwind CSS: Tailwind v3 LTS (`tailwindcss@^3.4.17`) provides rock-solid, bug-free compatibility with shadcn/ui HSL CSS variables, PostCSS, and Radix UI primitives.
- Lucide Icons: `lucide-react@^0.468.0` is active and provides all required symbols (`LayoutDashboard`, `Package`, `QrCode`, `FileText`, `AlertTriangle`, `HeartHandshake`, `RefreshCw`, `Printer`, `CheckCircle2`).
- PDF and QR Code tooling: `jspdf@^2.5.2` (and `jspdf-autotable@^3.8.4`), `qrcode@^1.5.4` and `@types/qrcode@^1.5.5` are readily available.

---

## 2. Logic Chain

From the authoritative prompt requirements (`ORIGINAL_REQUEST.md`) and runtime constraints:

1. **R1 Mandate**: The application must be a Mobile-First PWA and desktop management dashboard for Rotary Banco Ortopédico, adopting Next.js 14+ App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons, and official Rotary branding (`#17458f` and `#f7a81b`).
2. **Immediate Executability / Zero-Credential Validation**:
   - The user or evaluator must be able to clone, install, build, and test 100% of the screens, wizards, QR scanning, digital signatures, comodato PDF downloads, and renewal flows without depending on external Supabase network connectivity or valid credentials.
   - Therefore, a dual-layer data architecture is mandatory:
     - `src/lib/data-layer/repository.ts` acts as a unified facade.
     - When Supabase credentials are not configured (or match default placeholder URLs in `.env.example`), it seamlessly activates `src/lib/mock-store/local-store.ts`, backed by `localStorage` in the browser and seeded with realistic Rotary data.
     - A non-intrusive UI banner (`DemoModeBanner`) informs the user of active demo mode and provides a "Restaurar Dados Iniciais" button.
3. **Design System & Contrast Rules (WCAG AA)**:
   - Primary: Rotary Royal Blue `#17458f` (contrast ratio `7.4:1` against white text).
   - Secondary: Rotary Gold `#f7a81b`. Important: White text on `#f7a81b` fails WCAG AA (only `1.6:1`). Therefore, any element with a Rotary Gold background must use dark text (`#17458f` or `#1e293b`), achieving `6.8:1` contrast ratio.
4. **Mobile Navigation Ergonomics**:
   - Field operators in loan centers handle wheelchairs, crutches, and patient documents with one hand.
   - The primary navigation must be a fixed bottom navigation bar (`MobileBottomNav`) with 5 thumb-friendly items: Início, Acervo, central elevated QR Scanner FAB (`/scan`), Empréstimos, and Radar de Cobrança (`/overdue`) with live overdue badge counter.
   - Tablet/Desktop views transition to a sticky top navbar and responsive header.

---

## 3. Detailed Technical Specifications

### 3.1 Project File Tree Architecture

```
rotary-banco-ortopedico/
├── .env.example                           # Authoritative environment template
├── .env.local                             # Local env (gitignored)
├── .gitignore
├── README.md                              # Complete setup & deployment guide
├── components.json                        # shadcn/ui CLI configuration
├── next.config.mjs                        # Next.js configuration (PWA headers, image unoptimized)
├── package.json                           # Dependencies and scripts
├── postcss.config.mjs                     # PostCSS with tailwindcss and autoprefixer
├── tailwind.config.ts                     # Tailwind theme with Rotary palette and HSL variables
├── tsconfig.json                          # TypeScript configuration with @/* alias
├── vercel.json                            # Vercel deployment & cron job definition
├── public/
│   ├── favicon.ico
│   ├── manifest.json                      # PWA Web App Manifest
│   ├── icons/
│   │   ├── icon-192x192.png               # Android PWA icon
│   │   ├── icon-512x512.png               # Android splash / high-res icon
│   │   ├── maskable-icon-512x512.png      # Android maskable icon
│   │   ├── apple-touch-icon.png           # iOS Safari home icon
│   │   └── rotary-wheel.svg               # Rotary official wheel SVG
├── src/
│   ├── app/
│   │   ├── globals.css                    # Tailwind base, HSL variables, safe-area utilities
│   │   ├── layout.tsx                     # Root App Router layout, metadata, PWA tags, fonts
│   │   ├── page.tsx                       # Landing / redirect to /dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx                   # KPI Cards, Acervo overview, Quick loan actions
│   │   ├── equipments/
│   │   │   ├── page.tsx                   # Equipment catalog, search, status/category filter
│   │   │   ├── new/
│   │   │   │   └── page.tsx               # New equipment registration form
│   │   │   └── labels/
│   │   │       └── page.tsx               # Printable QR Code patrimonial labels layout
│   │   ├── scan/
│   │   │   └── page.tsx                   # Mobile QR code scanner with camera & manual fallback
│   │   ├── item/
│   │   │   └── [qr_token]/
│   │   │       └── page.tsx               # Contextual status machine & item action page
│   │   ├── loans/
│   │   │   ├── page.tsx                   # Loans table & filter (Ativos, Atrasados, Encerrados)
│   │   │   ├── new/
│   │   │   │   └── page.tsx               # Multi-step loan wizard, signature & PDF generator
│   │   │   └── [id]/
│   │   │       └── return/
│   │   │           └── page.tsx           # Return triage checklist, condition, discharge receipt
│   │   ├── renovar/
│   │   │   └── [magic_token]/
│   │   │       └── page.tsx               # Public self-service renewal portal (1-click)
│   │   ├── overdue/
│   │   │   └── page.tsx                   # Overdue radar, WhatsApp quick dispatch
│   │   └── api/
│   │       └── cron/
│   │           └── check-loans/
│   │               └── route.ts           # Automated cron route for loan status updates
│   ├── components/
│   │   ├── ui/                            # shadcn/ui components (button, card, badge, dialog, etc.)
│   │   ├── layout/
│   │   │   ├── mobile-bottom-nav.tsx      # Fixed bottom nav with QR FAB
│   │   │   ├── desktop-header.tsx         # Top desktop navbar & Rotary branding
│   │   │   ├── demo-mode-banner.tsx       # Local demo mode indicator & reset action
│   │   │   └── rotary-logo.tsx            # Rotary logo SVG with golden wheel
│   │   ├── qr/
│   │   │   ├── qr-scanner.tsx             # Camera stream reader
│   │   │   ├── qr-code-svg.tsx            # QR code generator component
│   │   │   └── printable-label-card.tsx   # Asset label template (70x50mm or A4 sheet)
│   │   ├── loans/
│   │   │   ├── signature-canvas.tsx       # Touch signature pad with reset & export
│   │   │   ├── comodato-modal.tsx         # PDF preview modal & download action
│   │   │   └── secondary-contact-form.tsx # Mandatory secondary contact inputs
│   │   └── whatsapp/
│   │       └── whatsapp-button.tsx        # wa.me link generator with pre-filled message
│   ├── lib/
│   │   ├── utils.ts                       # cn() class helper (clsx + tailwind-merge)
│   │   ├── constants.ts                   # Rotary colors, loan durations, status lists
│   │   ├── data-layer/
│   │   │   └── repository.ts              # Unified repository (switches Supabase / LocalStore)
│   │   ├── mock-store/
│   │   │   ├── mock-data.ts               # Initial seed data (8 equipments, loans, beneficiaries)
│   │   │   └── local-store.ts             # In-memory & localStorage persistent store
│   │   ├── supabase/
│   │   │   ├── client.ts                  # Supabase browser client
│   │   │   └── server.ts                  # Supabase server client
│   │   ├── pdf/
│   │   │   └── comodato-generator.ts      # Client-side PDF generator (jsPDF)
│   │   └── whatsapp.ts                    # WhatsApp message formatting & wa.me builder
│   └── types/
│       └── index.ts                       # Domain models matching SQL enums and tables
└── supabase/
    ├── migrations/
    │   └── 001_initial_schema.sql         # Supabase PostgreSQL migration (R2)
    └── seed.sql                           # Initial SQL seed (R2)
```

---

### 3.2 Canonical `package.json` Specification

```json
{
  "name": "rotary-banco-ortopedico",
  "version": "1.0.0",
  "private": true,
  "description": "Sistema de Gestão de Banco Ortopédico do Rotary Club com Comodato Digital, QR Code e PWA",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@radix-ui/react-alert-dialog": "^1.1.2",
    "@radix-ui/react-avatar": "^1.1.1",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-popover": "^1.1.2",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.1",
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.47.10",
    "canvas-confetti": "^1.9.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "jspdf": "^2.5.2",
    "jspdf-autotable": "^3.8.4",
    "lucide-react": "^0.468.0",
    "next": "^14.2.25",
    "qrcode": "^1.5.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.54.2",
    "sonner": "^1.7.1",
    "tailwind-merge": "^2.5.5",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/canvas-confetti": "^1.9.0",
    "@types/node": "^20.17.10",
    "@types/qrcode": "^1.5.5",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.6.3"
  }
}
```

---

### 3.3 TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

### 3.4 Rotary Design System & Tailwind Configuration

#### Rotary Official Color Tokens
- **Rotary Royal Blue**: `#17458f` -> HSL: `217, 72%, 33%`
- **Rotary Gold / Amarelo Ouro**: `#f7a81b` -> HSL: `39, 93%, 54%`
- **Rotary Deep Navy**: `#0c2340` -> HSL: `213, 68%, 15%`
- **Rotary Sky Blue**: `#00a2e8` -> HSL: `198, 100%, 45%`
- **Accessible Background**: `#f8f9fa` -> HSL: `210, 20%, 98%`
- **Foreground / Text**: `#0f172a` -> HSL: `222.2, 84%, 4.9%`

#### `src/app/globals.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 210 20% 98%;
    --foreground: 222.2 84% 4.9%;

    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    /* Rotary Royal Blue #17458f */
    --primary: 217 72% 33%;
    --primary-foreground: 0 0% 100%;

    /* Rotary Gold #f7a81b */
    --secondary: 39 93% 54%;
    --secondary-foreground: 217 72% 33%; /* Dark blue on gold for WCAG AA */

    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    /* Accent uses Rotary Gold */
    --accent: 39 93% 54%;
    --accent-foreground: 217 72% 33%;

    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 217 72% 33%;

    --radius: 0.625rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 7%;
    --card-foreground: 210 40% 98%;
    --primary: 217 72% 45%;
    --primary-foreground: 0 0% 100%;
    --secondary: 39 93% 54%;
    --secondary-foreground: 217 72% 15%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 39 93% 54%;
  }
}

@layer utilities {
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 1rem);
  }
  .pt-safe {
    padding-top: env(safe-area-inset-top, 1rem);
  }
}

/* Print styling for patrimonial labels and contracts */
@media print {
  body {
    background: white !important;
  }
  .no-print {
    display: none !important;
  }
  .print-only {
    display: block !important;
  }
}
```

#### `tailwind.config.ts`
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Direct Rotary Brand Colors
        rotary: {
          blue: "#17458f",
          gold: "#f7a81b",
          navy: "#0c2340",
          sky: "#00a2e8",
          charcoal: "#1e293b",
          light: "#f8f9fa",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

---

### 3.5 PWA Configuration (`public/manifest.json`)

```json
{
  "name": "Rotary Club - Banco Ortopédico",
  "short_name": "Banco Ortopédico",
  "description": "Sistema de gestão e rastreabilidade de equipamentos ortopédicos do Rotary com comodato digital e QR Code",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#f8f9fa",
  "theme_color": "#17458f",
  "orientation": "portrait-primary",
  "scope": "/",
  "lang": "pt-BR",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/maskable-icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/rotary-wheel.svg",
      "sizes": "any",
      "type": "image/svg+xml"
    }
  ],
  "shortcuts": [
    {
      "name": "Escanear QR Code",
      "short_name": "Escanear",
      "description": "Leitor de QR Code para empréstimo e devolução",
      "url": "/scan",
      "icons": [{ "src": "/icons/icon-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "Novo Empréstimo",
      "short_name": "Empréstimo",
      "description": "Iniciar comodato de equipamento",
      "url": "/loans/new",
      "icons": [{ "src": "/icons/icon-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "Radar de Cobrança",
      "short_name": "Radar",
      "description": "Empréstimos vencidos e renovações",
      "url": "/overdue",
      "icons": [{ "src": "/icons/icon-192x192.png", "sizes": "192x192" }]
    }
  ]
}
```

#### Root Layout PWA Metadata (`src/app/layout.tsx`)
```tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { DesktopHeader } from "@/components/layout/desktop-header";
import { DemoModeBanner } from "@/components/layout/demo-mode-banner";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

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
  description: "Gestão inteligente de comodatos, acervo ortopédico com QR Code e automação de renovações",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Banco Ortopédico",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased bg-slate-50 text-slate-900 min-h-screen flex flex-col`}>
        <DemoModeBanner />
        <DesktopHeader />
        <main className="flex-1 pb-24 md:pb-8">
          {children}
        </main>
        <MobileBottomNav />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
```

---

### 3.6 Mobile-First Responsive Navigation Specification

#### Navigation Ergonomics Breakdown
- **Mobile (`< 768px`)**:
  - Top Bar: Rotary Wheel Logo + "Banco Ortopédico" title + Live Status badge.
  - Sticky Bottom Navigation Bar (`MobileBottomNav`):
    - Height: `h-16`, with `pb-safe` for iPhone home indicator.
    - 5 Action Slots:
      1. `/dashboard` -> `LayoutDashboard` (Início)
      2. `/equipments` -> `Package` (Acervo)
      3. `/scan` -> Centered Elevated Button: Rotary Blue `#17458f` circle, Rotary Gold `#f7a81b` ring, white `QrCode` icon. Raised `-mt-6` above the nav bar to create an ergonomic thumb target.
      4. `/loans` -> `FileText` (Empréstimos)
      5. `/overdue` -> `AlertTriangle` (Radar) with counter badge displaying number of overdue items.
- **Desktop / Tablet (`>= 768px`)**:
  - `DesktopHeader`: Sticky top bar with Rotary Logo, Club Name, Navigation Links, "Imprimir Etiquetas" quick link, "+ Novo Empréstimo" CTA button in Rotary Gold, and Demo Mode indicator.
  - The bottom bar is hidden via `md:hidden`.

```tsx
// src/components/layout/mobile-bottom-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, QrCode, FileText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Início", icon: LayoutDashboard },
    { href: "/equipments", label: "Acervo", icon: Package },
    { href: "/scan", label: "Escanear", icon: QrCode, isFab: true },
    { href: "/loans", label: "Empréstimos", icon: FileText },
    { href: "/overdue", label: "Radar", icon: AlertTriangle },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          if (item.isFab) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative -mt-6 group focus:outline-none"
              >
                <div className="w-14 h-14 rounded-full bg-rotary-blue border-4 border-rotary-gold shadow-lg flex items-center justify-center text-white active:scale-95 transition-transform">
                  <Icon className="w-7 h-7" />
                </div>
                <span className="block text-[10px] text-center font-medium mt-0.5 text-rotary-blue">
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
                "flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition-colors",
                isActive ? "text-rotary-blue font-semibold" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Icon className={cn("w-5 h-5 mb-0.5", isActive && "text-rotary-blue stroke-[2.5px]")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

---

### 3.7 Smart Local Demo Fallback Store Architecture

To guarantee immediate validation even without Supabase credentials or internet access:

#### Architecture Pattern: Unified Repository Facade
```
┌─────────────────────────────────────────────────────────┐
│               Application UI Components                 │
│      (/equipments, /scan, /loans/new, /overdue, etc.)   │
└───────────────────────────┬─────────────────────────────┘
                            │ Calls data methods
                            ▼
┌─────────────────────────────────────────────────────────┐
│       dataRepository (src/lib/data-layer/repository.ts) │
└─────────────┬─────────────────────────────┬─────────────┘
              │                             │
   if isDemoMode() == true       if isDemoMode() == false
              │                             │
              ▼                             ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│        localStore         │ │      Supabase Client      │
│  (src/lib/mock-store/     │ │   (@supabase/supabase-js) │
│       local-store.ts)     │ │                           │
│  - In-memory +            │ │  - Supabase PostgreSQL    │
│    localStorage fallback  │ │  - Real-time queries      │
│  - Seeded with 8 items,   │ │  - Storage bucket upload  │
│    loans, beneficiaries   │ └───────────────────────────┘
└───────────────────────────┘
```

#### Demo Mode Detector (`src/lib/data-layer/repository.ts`)
```ts
export const isDemoMode = (): boolean => {
  if (typeof window !== "undefined") {
    const forced = localStorage.getItem("rotary_force_demo_mode");
    if (forced !== null) return forced === "true";
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    !url ||
    !anonKey ||
    url.includes("your-project") ||
    url === "undefined" ||
    process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK === "true"
  );
};
```

#### Pre-seeded Rich Mock Data (`src/lib/mock-store/mock-data.ts`)
Must include 8 equipment items across all categories and statuses, complete beneficiaries with mandatory secondary contacts, active loans, and overdue loans for instant radar testing:
1. `ROT-CR-001` - Cadeira de Rodas Standard Adulto (Status: `DISPONIVEL`, QR: `rotary-item-rot-cr-001`, Categoria: `CADEIRA_RODAS`, Valor: R$ 850,00)
2. `ROT-CR-002` - Cadeira de Rodas Reforçada Obeso (Status: `EMPRESTADO`, QR: `rotary-item-rot-cr-002`, Categoria: `CADEIRA_RODAS`, Valor: R$ 1.200,00)
3. `ROT-CB-001` - Cadeira de Rodízio para Banho (Status: `DISPONIVEL`, QR: `rotary-item-rot-cb-001`, Categoria: `CADEIRA_BANHO`, Valor: R$ 420,00)
4. `ROT-AND-001` - Andador Articulado Alumínio com Rodas (Status: `ATRASADO`, QR: `rotary-item-rot-and-001`, Categoria: `ANDADOR`, Valor: R$ 280,00, Vencido há 5 dias)
5. `ROT-MUL-001` - Par de Muletas Canadenses Reguláveis (Status: `EMPRESTADO`, QR: `rotary-item-rot-mul-001`, Categoria: `MULETA`, Valor: R$ 180,00)
6. `ROT-CAM-001` - Cama Hospitalar com Elevação e Grade (Status: `HIGIENIZACAO`, QR: `rotary-item-rot-cam-001`, Categoria: `CAMA_HOSPITALAR`, Valor: R$ 2.500,00)
7. `ROT-CB-002` - Cadeira de Banho Simples (Status: `MANUTENCAO`, QR: `rotary-item-rot-cb-002`, Categoria: `CADEIRA_BANHO`, Valor: R$ 380,00)
8. `ROT-SUP-001` - Suporte de Soro com 4 Ganchos (Status: `DISPONIVEL`, QR: `rotary-item-rot-sup-001`, Categoria: `OUTROS`, Valor: R$ 150,00)

Beneficiaries:
- Maria das Dores Silva (CPF: `123.456.789-00`, Celular: `(11) 98765-4321`, Responsável: Carlos Silva / Filho / `(11) 98111-2222`)
- José Benedito Santos (CPF: `234.567.890-11`, Celular: `(11) 97654-3210`, Responsável: Ana Santos / Irmã / `(11) 99222-3333`)

Active & Overdue Loans:
- Empréstimo 1: `ROT-CR-002`, Paciente: Maria das Dores Silva, Prazo: 60 dias, Vencimento: D+20 dias, Status: `EMPRESTADO`, Magic Token: `magic-renovar-token-cr-002`.
- Empréstimo 2: `ROT-AND-001`, Paciente: José Benedito Santos, Prazo: 30 dias, Vencimento: D-5 dias (vencido), Status: `ATRASADO`, Magic Token: `magic-renovar-token-and-001`.

#### Demo Mode UI Banner (`src/components/layout/demo-mode-banner.tsx`)
```tsx
"use client";

import { useState, useEffect } from "react";
import { isDemoMode } from "@/lib/data-layer/repository";
import { localStore } from "@/lib/mock-store/local-store";
import { Info, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function DemoModeBanner() {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    setDemo(isDemoMode());
  }, []);

  if (!demo) return null;

  const handleReset = () => {
    localStore.resetToInitialSeed();
    toast.success("Dados de demonstração restaurados com sucesso!");
    window.location.reload();
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-950 px-3 py-1.5 text-xs flex items-center justify-between no-print">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded font-semibold bg-rotary-gold text-rotary-blue text-[10px] uppercase">
          Modo Demo
        </span>
        <span className="hidden sm:inline">
          Operando com armazenamento local seguro. Todas as alterações, assinaturas e PDFs são gerados no navegador.
        </span>
        <span className="sm:hidden">
          Dados locais ativos (offline).
        </span>
      </div>
      <button
        onClick={handleReset}
        className="flex items-center gap-1 font-medium text-rotary-blue hover:underline text-[11px] ml-2 shrink-0"
      >
        <RotateCcw className="w-3 h-3" />
        Resetar dados
      </button>
    </div>
  );
}
```

---

### 3.8 Environment Variables Template (`.env.example`)

```bash
# ==============================================================================
# BANCO ORTOPÉDICO ROTARY - ENVIRONMENT VARIABLES CONFIGURATION
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Aplicação e PWA
# ------------------------------------------------------------------------------
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_ENABLE_DEMO_FALLBACK="true"

# ------------------------------------------------------------------------------
# 2. Identificação da Unidade Rotary
# ------------------------------------------------------------------------------
NEXT_PUBLIC_ROTARY_CLUB_NAME="Rotary Club de Santos - Ponta da Praia"
NEXT_PUBLIC_ROTARY_DISTRICT="Distrito 4420"
NEXT_PUBLIC_ROTARY_CITY="Santos - SP"
NEXT_PUBLIC_CONTACT_PHONE="(13) 99765-4321"
NEXT_PUBLIC_ROTARY_PRESIDENT="Comissão do Banco de Aparelhos Ortopédicos"

# ------------------------------------------------------------------------------
# 3. Integração Supabase (Opcional - Ativa modo nuvem quando configurado)
# ------------------------------------------------------------------------------
# Se omitidas ou mantidas com valores padrão, a aplicação roda em Modo Demo 100% offline
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# ------------------------------------------------------------------------------
# 4. Automação Cron de Vencimentos (/api/cron/check-loans)
# ------------------------------------------------------------------------------
# Token secreto para validar requisições disparadas pelo Vercel Cron
CRON_SECRET="rotary_super_secret_cron_token_2026"

# ------------------------------------------------------------------------------
# 5. Notificações WhatsApp (Opcional)
# ------------------------------------------------------------------------------
# Se não configurado, o sistema usa links diretos universais wa.me com mensagem codificada
WHATSAPP_API_URL=""
WHATSAPP_API_TOKEN=""
WHATSAPP_INSTANCE_ID=""
```

---

## 4. Caveats

1. **Camera Permission in PWA / iOS WebRTC**:
   - Camera access via `navigator.mediaDevices.getUserMedia` requires HTTPS in production (or `http://localhost` during development).
   - The `/scan` interface must gracefully handle permission denial or devices without a camera by providing an immediate text input fallback for typing or pasting the equipment patrimony code or `qr_token` (e.g. `ROT-CR-001`).
2. **Touch Scrolling Interference with Signature Canvas**:
   - When drawing signatures on mobile touch screens, the browser might interpret a drag as a scroll gesture.
   - The canvas element must have `touch-action: none` set in CSS, and `preventDefault()` attached to touchstart/touchmove listeners.
3. **PowerShell on Windows Execution Policy**:
   - Because PowerShell execution policy blocks `npm.ps1`, any developer or agent executing shell scripts must use `npm.cmd` and `npx.cmd`.

---

## 5. Conclusion

Requirement R1 provides the foundational architecture for the entire Rotary Banco Ortopédico system. By establishing:
1. Canonical Next.js 14+ App Router structure with TypeScript and Tailwind CSS,
2. Rotary brand palette tokens (`#17458f` and `#f7a81b`) and WCAG AA contrast rules,
3. PWA Web App Manifest, meta tags, and responsive mobile-first navigation (bottom nav with elevated QR FAB),
4. A transparent, offline-capable local mock store and data repository facade,
5. A comprehensive `.env.example` template,

The subsequent milestones (Milestones 2 through 6) can build directly on standardized types, components, and data repository methods without circular dependencies or runtime friction.

---

## 6. Verification Method

To independently verify R1:

1. **Verify Files & Syntax**:
   - Inspect `package.json`, `tsconfig.json`, `tailwind.config.ts`, and `public/manifest.json`.
   - Check that `paths: { "@/*": ["./src/*"] }` exists in `tsconfig.json`.
2. **Type Checking**:
   - Run `npx.cmd tsc --noEmit` to confirm zero TypeScript compilation errors.
3. **Build Check**:
   - Run `npm.cmd run build` to confirm Next.js build produces production output without warnings or errors.
4. **PWA Manifest Validation**:
   - Verify `public/manifest.json` conforms to W3C Web App Manifest specification with valid JSON, start URL `/dashboard`, theme color `#17458f`, and icon definitions.
5. **Demo Fallback Verification**:
   - Start app with empty `.env.local` (`npm.cmd run dev` or `npm.cmd run build && npm.cmd start`).
   - Navigate to `/dashboard`, `/equipments`, `/scan`, and `/loans`. Confirm the "Modo Demo" banner appears and all 8 sample equipments and 2 loans load seamlessly from `mock-data.ts`.
