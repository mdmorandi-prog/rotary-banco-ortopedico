"use client";

import { useState } from "react";
import { usePwa } from "./pwa-provider";
import {
  Bell,
  BellRing,
  Download,
  Smartphone,
  Share,
  PlusSquare,
  CheckCircle2,
  X,
  Send,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function PwaInstallBanner() {
  const {
    isStandalone,
    canInstall,
    isIOS,
    pushSupported,
    isSubscribed,
    isLoading,
    promptInstall,
    subscribe,
    unsubscribe,
    sendTestPush,
  } = usePwa();

  const [dismissed, setDismissed] = useState(false);
  const [iosModalOpen, setIosModalOpen] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-blue-900 via-rotary-blue to-slate-900 text-white rounded-xl p-4 sm:p-5 shadow-sm border border-blue-800 relative overflow-hidden transition-all">
      {/* Background Accent */}
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-radial from-amber-400/10 to-transparent pointer-events-none" />

      {/* Dismiss Button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-blue-200 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        title="Ocultar aviso"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-6">
        {/* Left Info Column */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 text-rotary-gold mt-0.5 sm:mt-0">
            {isSubscribed ? (
              <BellRing className="w-5 h-5 text-amber-300 animate-pulse" />
            ) : isStandalone ? (
              <Smartphone className="w-5 h-5 text-emerald-400" />
            ) : (
              <Download className="w-5 h-5 text-amber-300" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm sm:text-base text-white">
                {isSubscribed
                  ? "Notificações Push Ativas no Dispositivo"
                  : isStandalone
                  ? "Aplicativo Rotary Instalado"
                  : "Aplicativo Oficial do Banco Ortopédico"}
              </h3>
              {isStandalone && (
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> App PWA
                </span>
              )}
            </div>

            <p className="text-xs text-blue-100/90 mt-1 max-w-xl leading-relaxed">
              {isSubscribed
                ? "Este aparelho receberá avisos automáticos de vencimento e solicitações de devolução mesmo com o app fechado."
                : isStandalone
                ? "Ative os alertas push para ser notificado de devoluções e vencimentos diretamente na sua tela de bloqueio."
                : isIOS
                ? "Adicione o app à tela inicial do seu iPhone ou iPad para usar em tela cheia e receber notificações push."
                : "Instale o app diretamente no seu Android, iPhone ou computador para acesso instantâneo e alertas em tempo real."}
            </p>
          </div>
        </div>

        {/* Right Actions Column */}
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          {/* Botão de Instalação (se ainda não instalado) */}
          {!isStandalone && (
            <>
              {isIOS ? (
                <Dialog open={iosModalOpen} onOpenChange={setIosModalOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="bg-rotary-gold text-rotary-blue hover:bg-amber-400 font-bold shadow-sm text-xs h-9 px-3.5 cursor-pointer"
                    >
                      <Share className="w-3.5 h-3.5 mr-1.5" />
                      Como Instalar no iOS
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md bg-white text-slate-900 border-slate-200">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-rotary-blue text-base font-bold">
                        <Smartphone className="w-5 h-5 text-rotary-blue" />
                        Instalar no iPhone ou iPad
                      </DialogTitle>
                      <DialogDescription className="text-slate-600 text-xs">
                        Siga o passo a passo de 3 segundos no Safari do iOS:
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3.5 py-2 text-xs">
                      <div className="flex items-start gap-3 p-2.5 bg-blue-50/70 rounded-lg border border-blue-100">
                        <span className="w-5 h-5 rounded-full bg-rotary-blue text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                          1
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">
                            Toque no botão Compartilhar do Safari
                          </p>
                          <p className="text-slate-500 mt-0.5">
                            É o ícone de um quadrado com uma seta para cima{" "}
                            <Share className="w-3.5 h-3.5 inline text-blue-600" /> na barra
                            inferior do navegador.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-2.5 bg-blue-50/70 rounded-lg border border-blue-100">
                        <span className="w-5 h-5 rounded-full bg-rotary-blue text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                          2
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">
                            Role e selecione &quot;Adicionar à Tela de Início&quot;
                          </p>
                          <p className="text-slate-500 mt-0.5">
                            Toque na opção{" "}
                            <span className="font-semibold text-slate-700">
                              &quot;Adicionar à Tela de Início&quot;
                            </span>{" "}
                            <PlusSquare className="w-3.5 h-3.5 inline text-blue-600" /> e confirme
                            no canto superior.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                          3
                        </span>
                        <div>
                          <p className="font-semibold text-emerald-900">
                            Abra o app na Tela Inicial e Ative os Alertas
                          </p>
                          <p className="text-emerald-700 mt-0.5">
                            O app abrirá limpo em tela cheia com o ícone do Rotary. Toque em
                            &quot;Ativar Notificações&quot; para receber os avisos push na tela de
                            bloqueio.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        size="sm"
                        onClick={() => setIosModalOpen(false)}
                        className="bg-rotary-blue text-white hover:bg-blue-800 font-semibold text-xs"
                      >
                        Entendi, vou instalar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button
                  size="sm"
                  onClick={promptInstall}
                  className="bg-rotary-gold text-rotary-blue hover:bg-amber-400 font-bold shadow-sm text-xs h-9 px-3.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Instalar Aplicativo
                </Button>
              )}
            </>
          )}

          {/* Botão de Ativar / Desativar / Testar Notificações */}
          {pushSupported && (
            <>
              {isSubscribed ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={sendTestPush}
                    disabled={isLoading}
                    className="border-white/30 text-white bg-white/10 hover:bg-white/20 text-xs h-9 px-3 cursor-pointer"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                    )}
                    Testar Notificação
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={unsubscribe}
                    disabled={isLoading}
                    className="text-blue-200 hover:text-red-300 hover:bg-red-900/30 text-[11px] h-9 px-2"
                  >
                    Desativar
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={subscribe}
                  disabled={isLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-3.5 shadow-sm cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Bell className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Ativar Notificações no Celular
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
