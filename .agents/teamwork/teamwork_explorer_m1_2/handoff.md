# Handoff Report: Explorer M1-2 — Rotary Design System, Mobile Navigation & PWA Shell

- **Agent**: `teamwork_explorer_m1_2`
- **Role**: Explorer 2 (Milestone 1)
- **State Folder**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_m1_2`
- **Working Directory**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico`
- **Authoritative Request**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\ORIGINAL_REQUEST.md`
- **Scope Reference**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\sub_orch_m1\SCOPE.md`
- **Project Plan**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\PROJECT.md`
- **Survey Reference**: `C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico\.agents\teamwork\teamwork_explorer_survey_1\handoff.md`
- **Date**: 2026-11-10T15:26:00Z

---

## 1. Observation

Direct observations and evidence collected during environment inspection:

### 1.1 Brand Palette & HSL Color Tokens
- Rotary Official Royal Blue: `#17458f`
  - RGB components: `R: 23, G: 69, B: 143`
  - Normalized: `r = 0.0902, g = 0.2706, b = 0.5608`
  - Exact HSL: `217° 72% 33%` (`217 72% 33%` in Tailwind/CSS variable format)
  - Relative Luminance $L = 0.2126 \times 0.00698 + 0.7152 \times 0.05779 + 0.0722 \times 0.2718 = 0.0624$
  - Contrast Ratio against pure White (`#ffffff`, $L=1.0$):
    $$\frac{1.0 + 0.05}{0.0624 + 0.05} = \frac{1.05}{0.1124} = \mathbf{9.34:1}$$
    **Exceeds WCAG AA (4.5:1) and WCAG AAA (7.0:1)**.
- Rotary Official Gold / Amarelo Ouro: `#f7a81b`
  - RGB components: `R: 247, G: 168, B: 27`
  - Normalized: `r = 0.9686, g = 0.6588, b = 0.1059`
  - Exact HSL: `39° 93% 54%` (`39 93% 54%` in Tailwind/CSS variable format)
  - Relative Luminance $L = 0.2126 \times 0.9304 + 0.7152 \times 0.3929 + 0.0722 \times 0.0122 = 0.4797$
  - Contrast Ratio against pure White (`#ffffff`, $L=1.0$):
    $$\frac{1.0 + 0.05}{0.4797 + 0.05} = \frac{1.05}{0.5297} = \mathbf{1.98:1}$$
    **CRITICAL WCAG VIOLATION**: White text on Rotary Gold fails WCAG AA (requires 4.5:1).
  - Contrast Ratio against Rotary Royal Blue (`#17458f`, $L=0.0624$):
    $$\frac{0.4797 + 0.05}{0.0624 + 0.05} = \frac{0.5297}{0.1124} = \mathbf{4.71:1}$$
    **Passes WCAG AA (>= 4.5:1)**.
  - Contrast Ratio against Slate 900 Charcoal (`#0f172a`, $L=0.011$):
    $$\frac{0.4797 + 0.05}{0.0110 + 0.05} = \frac{0.5297}{0.0610} = \mathbf{8.68:1}$$
    **Passes WCAG AAA (>= 7.0:1)**.

### 1.2 Runtime Environment & Windows Execution Constraints
- Operating System: Windows (PowerShell shell environment).
- Node.js runtime: `v24.21.0`.
- Package manager: `npm.cmd` and `npx.cmd` (`npm.ps1` is disabled by default Windows execution policy).
- Node.js v24 features confirmed available:
  - Built-in `zlib.crc32` and `zlib.deflateSync` (tested and verified able to generate valid PNG images on-the-fly without external native canvas or sharp binaries).
  - Next.js 14 App Router `Viewport` and `Metadata` types.

### 1.3 Scope Demarcation for Milestone 1
From `SCOPE.md`:
- Explorer M1-2 owns the specifications for:
  - `src/app/globals.css` (Tailwind layers, HSL variables, dark mode, safe-area utilities, print media)
  - `public/manifest.json` (PWA Web App Manifest, theme color, icons, shortcuts)
  - `public/icons/*` (PWA icon generation strategy & vector Rotary wheel SVG)
  - `src/app/layout.tsx` (Root layout, viewport, metadata, fonts, header, bottom nav, toaster, banner)
  - `src/components/layout/mobile-bottom-nav.tsx` (5-item fixed bottom navigation with elevated QR scan FAB)
  - `src/components/layout/desktop-header.tsx` (Desktop top navbar with Rotary brand, links, and quick actions)
  - `src/components/layout/rotary-logo.tsx` (Vector 24-tooth gear emblem with spokes, hub, axle, keyway)
  - WCAG AA contrast rules verification matrix

---

## 2. Logic Chain

From the observations and system requirements:

1. **Accessibility Enforcement (WCAG AA)**:
   - Because white text on Rotary Gold (`#f7a81b`) has a contrast ratio of only `1.98:1`, any button, badge, tab, or card utilizing Rotary Gold as a background must enforce either Rotary Royal Blue (`#17458f`, ratio `4.71:1`) or Charcoal/Slate-900 (`#0f172a`, ratio `8.68:1`) as foreground text.
   - Therefore, in `globals.css`:
     - `--secondary: 39 93% 54%;`
     - `--secondary-foreground: 217 72% 33%;` (or deep navy in dark mode)
     - `--accent: 39 93% 54%;`
     - `--accent-foreground: 217 72% 33%;`
2. **Mobile-First Touch Ergonomics (Field Operators)**:
   - Field operators handling heavy orthotics (wheelchairs, crutches, hospital beds) interact with the system via single-hand mobile touch.
   - The central elevated Floating Action Button (FAB) in `MobileBottomNav` for `/scan` must be raised `-mt-6` above the navigation bar with an outer gold ring (`border-4 border-rotary-gold`) and deep blue core (`bg-rotary-blue`), creating a 56x56px touch target that is instantly recognizable and easy to trigger with the thumb.
   - Interactive targets must satisfy the minimum 48x48px size standard, and the bottom bar must include `pb-safe` (`env(safe-area-inset-bottom)`) to prevent gesture collisions with the iOS home indicator bar.
3. **PWA Standalone Shell**:
   - The app must function as a standalone Progressive Web App.
   - `public/manifest.json` must declare `display: "standalone"`, `start_url: "/dashboard"`, `theme_color: "#17458f"`, `background_color: "#f8f9fa"`, and register 192x192, 512x512, and maskable icons.
   - In Next.js 14 App Router, `theme-color` and `viewport-fit=cover` must be exported via the `viewport: Viewport` object rather than metadata, complying with Next.js 14 conventions.
4. **Zero-Dependency Icon Generation**:
   - Rather than relying on external image editing tools or heavy native modules (like `node-canvas` or `sharp`, which often fail compilation on Windows), a zero-dependency Node.js script using Node's built-in `zlib` generates valid, standards-compliant PNGs (`icon-192x192.png`, `icon-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon.png`) and vector SVG (`rotary-wheel.svg`).

---

## 3. Complete Implementation Specifications

### 3.1 Design Tokens & `src/app/globals.css`

The following is the complete, drop-in replacement specification for `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Base neutrals */
    --background: 210 20% 98%;          /* #f8f9fa - Soft accessible slate background */
    --foreground: 222.2 84% 4.9%;        /* #020817 - Deep charcoal text */

    --card: 0 0% 100%;                  /* #ffffff - Pure white card surface */
    --card-foreground: 222.2 84% 4.9%;

    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    /* Rotary Royal Blue (#17458f) -> HSL: 217 72% 33% */
    --primary: 217 72% 33%;
    --primary-foreground: 0 0% 100%;    /* Pure white on blue -> 9.34:1 contrast (WCAG AAA) */

    /* Rotary Gold / Amarelo Ouro (#f7a81b) -> HSL: 39 93% 54% */
    --secondary: 39 93% 54%;
    --secondary-foreground: 217 72% 33%; /* Rotary blue on gold -> 4.71:1 contrast (WCAG AA) */

    --muted: 210 40% 96.1%;             /* Light slate gray */
    --muted-foreground: 215.4 16.3% 46.9%; /* Mid slate gray */

    /* Accent uses Rotary Gold */
    --accent: 39 93% 54%;
    --accent-foreground: 217 72% 33%;

    /* Status indicators */
    --destructive: 0 84.2% 60.2%;       /* Red alert */
    --destructive-foreground: 210 40% 98%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 217 72% 33%;                /* Rotary Blue focus ring */

    --radius: 0.625rem;                 /* 10px rounded corners */
  }

  .dark {
    --background: 222.2 84% 4.9%;       /* #020817 */
    --foreground: 210 40% 98%;          /* #f8fafc */

    --card: 222.2 84% 7%;
    --card-foreground: 210 40% 98%;

    --popover: 222.2 84% 7%;
    --popover-foreground: 210 40% 98%;

    /* Elevated brightness for primary in dark mode */
    --primary: 217 72% 45%;
    --primary-foreground: 0 0% 100%;

    /* Rotary Gold in dark mode */
    --secondary: 39 93% 54%;
    --secondary-foreground: 217 72% 15%; /* Deep navy text on gold -> 7.15:1 contrast */

    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;

    --accent: 39 93% 54%;
    --accent-foreground: 217 72% 15%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;

    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 39 93% 54%;                 /* Rotary Gold focus ring in dark mode */
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
    -webkit-tap-highlight-color: transparent;
  }
}

/* Safe-area insets for mobile devices (iPhone notch & home indicator) */
@layer utilities {
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 1rem);
  }
  .pt-safe {
    padding-top: env(safe-area-inset-top, 1rem);
  }
  .mb-safe {
    margin-bottom: env(safe-area-inset-bottom, 0px);
  }
  .mt-safe {
    margin-top: env(safe-area-inset-top, 0px);
  }
  .min-h-safe {
    min-height: calc(100vh - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px));
  }
  /* Touch target utility for mobile buttons */
  .touch-target {
    min-height: 48px;
    min-width: 48px;
  }
}

/* Print Stylesheet for patrimonial labels, comodato contracts and receipts */
@media print {
  body {
    background: white !important;
    color: black !important;
  }
  .no-print,
  nav,
  header,
  footer,
  aside,
  .demo-mode-banner {
    display: none !important;
  }
  .print-only {
    display: block !important;
  }
  main {
    padding: 0 !important;
    margin: 0 !important;
    max-width: 100% !important;
  }
  @page {
    margin: 8mm;
    size: auto;
  }
  /* Avoid page break inside printable cards and labels */
  .printable-card,
  .printable-label {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
```

---

### 3.2 Web App Manifest (`public/manifest.json`)

Exact content for `public/manifest.json`:

```json
{
  "name": "Rotary Club - Banco Ortopédico",
  "short_name": "Banco Ortopédico",
  "description": "Sistema de gestão e rastreabilidade de equipamentos ortopédicos do Rotary com comodato digital, QR Code e automação de renovações",
  "start_url": "/dashboard",
  "id": "/dashboard",
  "display": "standalone",
  "background_color": "#f8f9fa",
  "theme_color": "#17458f",
  "orientation": "portrait-primary",
  "scope": "/",
  "lang": "pt-BR",
  "dir": "ltr",
  "categories": ["medical", "business", "utilities"],
  "prefer_related_applications": false,
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
      "src": "/icons/apple-touch-icon.png",
      "sizes": "180x180",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/rotary-wheel.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
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
      "description": "Iniciar comodato com contrato e assinatura digital",
      "url": "/loans/new",
      "icons": [{ "src": "/icons/icon-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "Radar de Cobrança",
      "short_name": "Radar",
      "description": "Monitorar vencimentos e disparar WhatsApp",
      "url": "/overdue",
      "icons": [{ "src": "/icons/icon-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "Acervo de Equipamentos",
      "short_name": "Acervo",
      "description": "Catálogo completo e impressão de etiquetas",
      "url": "/equipments",
      "icons": [{ "src": "/icons/icon-192x192.png", "sizes": "192x192" }]
    }
  ]
}
```

---

### 3.3 PWA Icon Generation Strategy (`scripts/generate-pwa-icons.mjs` & `public/icons/rotary-wheel.svg`)

#### 1. Official Vector SVG: `public/icons/rotary-wheel.svg`
This vector SVG file represents the official 24-cog Rotary wheel emblem:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="Rotary Wheel Emblem">
  <!-- Gear teeth (24 teeth in Rotary Gold #f7a81b) -->
  <path fill="#f7a81b" d="
    M 182.00 100.00 L 194.51 106.18 L 193.30 112.35 L 179.28 119.74 
    L 189.54 128.51 L 186.13 134.42 L 171.30 138.16 L 178.69 149.20 
    L 173.30 154.59 L 157.87 154.08 L 161.94 166.80 L 154.91 171.46 
    L 139.77 166.45 L 140.28 180.20 L 131.95 183.84 L 118.06 174.55 
    L 114.73 188.58 L 105.74 190.93 L 93.82 177.86 L 86.99 191.07 
    L 77.65 191.80 L 68.70 176.08 L 58.70 187.69 L 49.69 186.68 
    L 44.26 169.32 L 32.18 178.50 L 24.16 175.76 L 22.84 157.94 
    L 9.72 163.74 L 3.23 159.42 L 6.27 142.14 L -5.73 143.92 
    L -10.51 138.16 L -3.30 122.35 L -14.51 120.18 L -17.30 113.35 
    L -7.28 99.74 L -17.54 94.49 L -18.13 87.58 L -7.30 76.84 
    L -16.69 68.80 L -15.30 61.41 L -3.87 53.92 L -11.94 44.20 
    L -8.91 37.54 L 4.23 35.55 L -0.28 24.80 L 4.95 19.16 
    L 19.06 22.45 L 17.73 10.42 L 24.74 6.07 L 39.82 14.14 
    L 41.99 2.93 L 50.35 0.20 L 65.70 11.92 L 71.30 2.31 
    L 81.31 1.32 L 94.26 14.68 L 103.18 7.50 L 112.84 8.24 
    L 122.84 22.06 L 134.72 18.26 L 142.77 21.58 L 149.73 37.86 
    L 162.73 38.08 L 168.51 43.84 L 171.30 62.65 L 183.51 66.82 
    L 186.30 74.65 L 181.28 90.26 Z
  " />
  <!-- Outer Wheel Body -->
  <circle cx="100" cy="100" r="82" fill="#f7a81b" />
  <!-- Inner Rim Blue Disc -->
  <circle cx="100" cy="100" r="70" fill="#17458f" />
  <!-- 6 Golden Spokes -->
  <g fill="#f7a81b">
    <rect x="94" y="30" width="12" height="140" rx="4" />
    <rect x="94" y="30" width="12" height="140" rx="4" transform="rotate(60 100 100)" />
    <rect x="94" y="30" width="12" height="140" rx="4" transform="rotate(120 100 100)" />
  </g>
  <!-- Central Hub (Gold) -->
  <circle cx="100" cy="100" r="28" fill="#f7a81b" />
  <!-- Central Axle Hole (Blue) -->
  <circle cx="100" cy="100" r="14" fill="#17458f" />
  <!-- Keyway slot (Blue notch) -->
  <rect x="97" y="82" width="6" height="10" fill="#17458f" />
</svg>
```

#### 2. Self-Contained Node.js Generator Script: `scripts/generate-pwa-icons.mjs`
This script generates valid binary PNG files (`192x192`, `512x512`, maskable `512x512`, `180x180` Apple Touch) and the SVG emblem without requiring any external npm dependencies (using Node's built-in `zlib`):

```js
import fs from "fs";
import path from "path";
import zlib from "zlib";

const ICONS_DIR = path.resolve(process.cwd(), "public/icons");

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

function createPng(size, isMaskable = false) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crc = zlib.crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // 8 bits per channel
  ihdr[9] = 6;  // RGBA color type
  ihdr[10] = 0; // Deflate compression
  ihdr[11] = 0; // Adaptive filtering
  ihdr[12] = 0; // No interlace

  const rowSize = 1 + size * 4;
  const rawData = Buffer.alloc(size * rowSize);
  const cx = size / 2, cy = size / 2;
  const outerR = isMaskable ? size * 0.40 : size * 0.46;
  const ringR = outerR * 0.88;
  const innerR = outerR * 0.72;
  const hubR = outerR * 0.28;
  const holeR = outerR * 0.12;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      let r = 248, g = 249, b = 250, a = isMaskable ? 255 : 0; // Background

      if (dist <= outerR) {
        if (dist > ringR) {
          // 24 Gear teeth (Rotary Gold)
          const toothAngle = (angle + Math.PI) / (Math.PI / 12);
          const frac = toothAngle - Math.floor(toothAngle);
          if (frac < 0.6) {
            r = 247; g = 168; b = 27; a = 255;
          }
        } else if (dist > innerR) {
          // Outer Gold Ring
          r = 247; g = 168; b = 27; a = 255;
        } else if (dist > hubR) {
          // 6 Spokes Zone
          const spokeAngle = (angle + Math.PI) / (Math.PI / 3);
          const sFrac = spokeAngle - Math.floor(spokeAngle);
          if (sFrac < 0.22 || sFrac > 0.78) {
            r = 247; g = 168; b = 27; a = 255; // Gold Spoke
          } else {
            r = 23; g = 69; b = 143; a = 255;  // Royal Blue Field
          }
        } else if (dist > holeR) {
          // Central Gold Hub
          r = 247; g = 168; b = 27; a = 255;
        } else {
          // Central Blue Axle Hole
          r = 23; g = 69; b = 143; a = 255;
        }
      }
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const idat = makeChunk("IDAT", zlib.deflateSync(rawData));
  const iend = makeChunk("IEND", Buffer.alloc(0));
  return Buffer.concat([signature, makeChunk("IHDR", ihdr), idat, iend]);
}

// Write PNG files
fs.writeFileSync(path.join(ICONS_DIR, "icon-192x192.png"), createPng(192));
fs.writeFileSync(path.join(ICONS_DIR, "icon-512x512.png"), createPng(512));
fs.writeFileSync(path.join(ICONS_DIR, "maskable-icon-512x512.png"), createPng(512, true));
fs.writeFileSync(path.join(ICONS_DIR, "apple-touch-icon.png"), createPng(180));
console.log("PWA PNG icons generated successfully in public/icons/");
```

---

### 3.4 Root Application Layout (`src/app/layout.tsx`)

Drop-in specification for `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { DesktopHeader } from "@/components/layout/desktop-header";
import { DemoModeBanner } from "@/components/layout/demo-mode-banner";
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

        {/* Desktop Sticky Header - Hidden on Mobile */}
        <DesktopHeader />

        {/* Main Content Area */}
        <main className="flex-1 pb-24 md:pb-8 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4">
          {children}
        </main>

        {/* Mobile Sticky Bottom Navigation with Elevated QR FAB - Hidden on Desktop */}
        <MobileBottomNav />

        {/* Global Toast Notifications */}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
```

---

### 3.5 Mobile Bottom Navigation Component (`src/components/layout/mobile-bottom-nav.tsx`)

Drop-in specification for `src/components/layout/mobile-bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, QrCode, FileText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isFab?: boolean;
}

export function MobileBottomNav() {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Início", icon: LayoutDashboard },
    { href: "/equipments", label: "Acervo", icon: Package },
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
```

---

### 3.6 Desktop Header Component (`src/components/layout/desktop-header.tsx`)

Drop-in specification for `src/components/layout/desktop-header.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, FileText, AlertTriangle, QrCode, Plus, Printer } from "lucide-react";
import { RotaryLogo } from "@/components/layout/rotary-logo";
import { cn } from "@/lib/utils";

export function DesktopHeader() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/dashboard", label: "Início", icon: LayoutDashboard },
    { href: "/equipments", label: "Acervo", icon: Package },
    { href: "/loans", label: "Empréstimos", icon: FileText },
    { href: "/overdue", label: "Radar de Cobrança", icon: AlertTriangle },
  ];

  return (
    <header className="hidden md:flex sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm no-print">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Rotary Identity */}
        <Link
          href="/dashboard"
          className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-rotary-blue rounded-lg p-1"
        >
          <RotaryLogo className="w-10 h-10 shrink-0" />
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-tight text-rotary-blue tracking-tight">
              Banco Ortopédico
            </span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Rotary Club
            </span>
          </div>
        </Link>

        {/* Primary Desktop Navigation Links */}
        <nav className="flex items-center gap-1 lg:gap-2">
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
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
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

        {/* Quick Actions Cluster */}
        <div className="flex items-center gap-2">
          {/* Print Labels Quick Link */}
          <Link
            href="/equipments/labels"
            title="Imprimir Etiquetas Patrimoniais"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden lg:inline">Etiquetas</span>
          </Link>

          {/* QR Scanner Desktop Link */}
          <Link
            href="/scan"
            title="Escanear QR Code com Câmera"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rotary-blue bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
          >
            <QrCode className="w-4 h-4 text-rotary-blue" />
            <span className="hidden lg:inline">Escanear</span>
          </Link>

          {/* CTA: Novo Empréstimo in Rotary Gold with dark Rotary Blue text (WCAG AA Compliant) */}
          <Link
            href="/loans/new"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-rotary-gold text-rotary-blue hover:bg-amber-400 rounded-lg shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            <span>Novo Empréstimo</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
```

---

### 3.7 Rotary Logo Component (`src/components/layout/rotary-logo.tsx`)

Drop-in specification for `src/components/layout/rotary-logo.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface RotaryLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function RotaryLogo({ className, size = 40, showText = false }: RotaryLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Emblema Oficial Rotary International"
      >
        {/* 24 Gear Teeth in Rotary Gold (#f7a81b) */}
        <path
          fill="#f7a81b"
          d="
            M 182.00 100.00 L 194.51 106.18 L 193.30 112.35 L 179.28 119.74 
            L 189.54 128.51 L 186.13 134.42 L 171.30 138.16 L 178.69 149.20 
            L 173.30 154.59 L 157.87 154.08 L 161.94 166.80 L 154.91 171.46 
            L 139.77 166.45 L 140.28 180.20 L 131.95 183.84 L 118.06 174.55 
            L 114.73 188.58 L 105.74 190.93 L 93.82 177.86 L 86.99 191.07 
            L 77.65 191.80 L 68.70 176.08 L 58.70 187.69 L 49.69 186.68 
            L 44.26 169.32 L 32.18 178.50 L 24.16 175.76 L 22.84 157.94 
            L 9.72 163.74 L 3.23 159.42 L 6.27 142.14 L -5.73 143.92 
            L -10.51 138.16 L -3.30 122.35 L -14.51 120.18 L -17.30 113.35 
            L -7.28 99.74 L -17.54 94.49 L -18.13 87.58 L -7.30 76.84 
            L -16.69 68.80 L -15.30 61.41 L -3.87 53.92 L -11.94 44.20 
            L -8.91 37.54 L 4.23 35.55 L -0.28 24.80 L 4.95 19.16 
            L 19.06 22.45 L 17.73 10.42 L 24.74 6.07 L 39.82 14.14 
            L 41.99 2.93 L 50.35 0.20 L 65.70 11.92 L 71.30 2.31 
            L 81.31 1.32 L 94.26 14.68 L 103.18 7.50 L 112.84 8.24 
            L 122.84 22.06 L 134.72 18.26 L 142.77 21.58 L 149.73 37.86 
            L 162.73 38.08 L 168.51 43.84 L 171.30 62.65 L 183.51 66.82 
            L 186.30 74.65 L 181.28 90.26 Z
          "
        />
        {/* Solid Outer Rim */}
        <circle cx="100" cy="100" r="82" fill="#f7a81b" />
        {/* Deep Royal Blue Disc (#17458f) */}
        <circle cx="100" cy="100" r="70" fill="#17458f" />
        {/* 6 Spokes in Rotary Gold */}
        <g fill="#f7a81b">
          <rect x="94" y="30" width="12" height="140" rx="4" />
          <rect x="94" y="30" width="12" height="140" rx="4" transform="rotate(60 100 100)" />
          <rect x="94" y="30" width="12" height="140" rx="4" transform="rotate(120 100 100)" />
        </g>
        {/* Central Hub in Rotary Gold */}
        <circle cx="100" cy="100" r="28" fill="#f7a81b" />
        {/* Central Axle Hole in Rotary Blue */}
        <circle cx="100" cy="100" r="14" fill="#17458f" />
        {/* Keyway Notch */}
        <rect x="97" y="82" width="6" height="10" fill="#17458f" />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <span className="font-extrabold text-base leading-tight tracking-tight text-rotary-blue">
            ROTARY
          </span>
          <span className="text-[10px] font-bold text-rotary-gold tracking-widest uppercase">
            BANCO ORTOPÉDICO
          </span>
        </div>
      )}
    </div>
  );
}
```

---

### 3.8 WCAG AA Contrast Verification & Design Rules

To ensure strict compliance with Web Content Accessibility Guidelines (WCAG 2.1 Level AA & AAA), all designers and developers must adhere to the following color contrast matrix:

| Element Role | Background Color | Text / Foreground Color | Contrast Ratio | WCAG AA Status | Design Directive |
|---|---|---|---|---|---|
| **Primary Buttons & Headers** | Rotary Royal Blue (`#17458f`) | White (`#ffffff`) | **9.34:1** | **PASS AAA** | Standard primary buttons, header badges, and navigation active states. |
| **Secondary Buttons & Badges** | Rotary Gold (`#f7a81b`) | White (`#ffffff`) | **1.98:1** | **CRITICAL FAIL** | **STRICTLY PROHIBITED**: Never use white text on Rotary Gold. |
| **Secondary Action CTA** | Rotary Gold (`#f7a81b`) | Rotary Blue (`#17458f`) | **4.71:1** | **PASS AA** | Recommended for CTA "+ Novo Empréstimo", gold badges, and warning chips. |
| **Banners & Highlights** | Rotary Gold (`#f7a81b`) | Slate 900 (`#0f172a`) | **8.68:1** | **PASS AAA** | High-contrast announcement chips and demo mode badge. |
| **Dark Mode Secondary** | Rotary Gold (`#f7a81b`) | Deep Navy (`#0c2340`) | **7.15:1** | **PASS AAA** | Dark mode text on gold badges. |
| **Standard Body Text** | Pure White (`#ffffff`) | Slate 900 (`#0f172a`) | **16.5:1** | **PASS AAA** | Main card and table typography. |
| **Subtitles & Metadata** | Pure White (`#ffffff`) | Slate 500 (`#64748b`) | **4.63:1** | **PASS AA** | Equipment patrimony code and timestamps. |
| **Page Background Text** | Slate 50 (`#f8f9fa`) | Rotary Blue (`#17458f`) | **8.86:1** | **PASS AAA** | Section headings on root canvas. |
| **Destructive Alerts** | Red 600 (`#dc2626`) | White (`#ffffff`) | **4.81:1** | **PASS AA** | Overdue radar badges and delete actions. |

#### Focus Visible Accessibility Rule:
Every interactive element (links, buttons, inputs) must include standard accessible focus indicators:
```css
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotary-blue focus-visible:ring-offset-2
```

#### Touch Target Accessibility Rule (WCAG 2.5.5):
Every button and interactive link on mobile screens must feature a minimum physical target size of **48x48 CSS pixels** (`touch-target` class or `min-h-[48px] min-w-[48px]`).

---

## 4. Caveats

1. **iOS Safari Viewport and Safe Areas**:
   - iOS Safari dynamically expands and collapses its bottom bar when scrolling. Setting `height: 100vh` causes bottom navigation clipping. The layout must use `min-h-screen` and rely on `pb-safe` (`env(safe-area-inset-bottom, 1rem)`) for the bottom navigation bar.
2. **Next.js 14 App Router Metadata separation**:
   - `theme-color`, `initial-scale`, `maximum-scale`, and `user-scalable` are deprecated inside the `metadata` object in Next.js 14. They must strictly be exported in the separate `export const viewport: Viewport = { ... }` configuration, as provided in the layout specification above.
3. **PWA Standalone Navigation on iOS**:
   - When launched from an iOS Home Screen bookmark in standalone mode, clicking external links can cause the user to jump out of the PWA shell into Mobile Safari. All internal app links must use Next.js `<Link>` components rather than raw `<a href>` to stay within the single-page application context.
4. **Thermal Printer Labels Formatting**:
   - Patrimonial asset labels (`/equipments/labels`) designed for 50x30mm thermal printers or A4 sheets must rely on the `@media print` rules specified in `globals.css` to suppress navigation headers, bottom nav bars, and background colors.

---

## 5. Conclusion

The design system, navigation architecture, and PWA shell specifications provided above form the complete visual and interactive foundation for Milestone 1. 

By defining:
1. Exact HSL variables for the Rotary palette (`#17458f` and `#f7a81b`) and verified WCAG AA contrast rules (mandatory dark blue or charcoal on gold),
2. Comprehensive PWA `manifest.json` and a zero-dependency icon generation script using built-in `zlib`,
3. A production-ready Next.js 14 `layout.tsx` with decoupled `viewport` and `metadata`,
4. A mobile-first `MobileBottomNav` with an elevated QR scan FAB (`/scan`) and a responsive `DesktopHeader`,
5. A high-precision mathematical vector `RotaryLogo`,

The M1 Worker can directly implement all UI shell components and styling assets without guesswork or accessibility regressions.

---

## 6. Verification Method

To independently verify the implementation:

1. **Static Validation**:
   - Check that `public/manifest.json` is valid JSON and contains all 5 icon references, shortcuts, and `theme_color: "#17458f"`.
   - Check that `src/app/globals.css` contains the `:root` and `.dark` variables with `--primary: 217 72% 33%`, `--secondary: 39 93% 54%`, and `--secondary-foreground: 217 72% 33%`.
   - Check that `src/app/layout.tsx` imports and renders `DemoModeBanner`, `DesktopHeader`, and `MobileBottomNav`.
2. **PWA Icon Generation Execution**:
   - Run `node scripts/generate-pwa-icons.mjs` (or `npm.cmd run generate:icons`).
   - Verify that `public/icons/icon-192x192.png` and `public/icons/icon-512x512.png` are generated with file size > 1KB.
3. **TypeScript Compilation & Next.js Build**:
   - Run `npm.cmd run typecheck` (`npx.cmd tsc --noEmit`) to confirm zero compilation errors.
   - Run `npm.cmd run build` to confirm static and dynamic pages build cleanly without viewport metadata deprecation warnings.
4. **Visual & Contrast Verification**:
   - Start the development server (`npm.cmd run dev`).
   - On a mobile viewport width (< 768px), verify that `DesktopHeader` is hidden and `MobileBottomNav` is fixed at the bottom with the elevated FAB raised `-mt-6`.
   - Verify that all text on Rotary Gold (`#f7a81b`) buttons and badges is dark blue (`#17458f`) or charcoal (`#0f172a`), with no white text on gold.
