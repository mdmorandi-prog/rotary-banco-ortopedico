'use client';

import { useState, useEffect } from 'react';
import { isDemoMode } from '@/lib/data-layer/repository';
import { localStore } from '@/lib/mock-store/local-store';
import { RotateCcw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export function DemoModeBanner() {
  const [demo, setDemo] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDemo(isDemoMode());
  }, []);

  // Avoid SSR hydration mismatch
  if (!mounted || !demo) return null;

  const handleReset = () => {
    try {
      localStore.resetToInitialSeed();
      toast.success('Dados de demonstração restaurados com sucesso para o estado inicial!');
      // Short delay to allow toast to render before reload
      setTimeout(() => {
        window.location.reload();
      }, 400);
    } catch {
      toast.error('Erro ao resetar dados de demonstração.');
    }
  };

  return (
    <aside
      role="status"
      aria-label="Aviso de Modo Demonstração"
      className="bg-amber-50 border-b border-amber-200 text-amber-950 px-3 py-1.5 text-xs flex items-center justify-between no-print relative z-50 shadow-sm"
    >
      <div className="flex items-center gap-2 max-w-[85%]">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-[#f7a81b] text-[#17458f] text-[10px] uppercase tracking-wider shrink-0 shadow-xs">
          <ShieldAlert className="w-3 h-3" />
          Modo Demo
        </span>
        <span className="hidden md:inline font-medium">
          Armazenamento local ativo (offline). Todas as ações, assinaturas e PDFs operam 100% no seu navegador sem dependência de banco de dados.
        </span>
        <span className="md:hidden truncate font-medium">
          Armazenamento local ativo (offline).
        </span>
      </div>

      <button
        type="button"
        onClick={handleReset}
        title="Restaurar os 8 equipamentos e 2 empréstimos originais de exemplo"
        className="flex items-center gap-1 font-semibold text-[#17458f] hover:text-[#0c2340] hover:underline text-[11px] ml-2 shrink-0 px-2 py-0.5 rounded border border-amber-300 bg-white shadow-2xs transition-colors cursor-pointer"
      >
        <RotateCcw className="w-3 h-3 text-[#17458f]" />
        <span>Resetar dados</span>
      </button>
    </aside>
  );
}
