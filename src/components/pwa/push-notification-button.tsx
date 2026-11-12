"use client";

import { useState } from "react";
import { usePwa } from "./pwa-provider";
import { Bell, BellRing, BellOff, Send, Loader2, Smartphone, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function PushNotificationButton() {
  const {
    isSubscribed,
    isLoading,
    pushSupported,
    isStandalone,
    subscribe,
    unsubscribe,
    sendTestPush,
  } = usePwa();

  const [open, setOpen] = useState(false);

  if (!pushSupported) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="Notificações Push no Celular"
          className="relative p-2 rounded-lg text-slate-600 hover:text-rotary-blue hover:bg-slate-100 transition-colors cursor-pointer"
        >
          {isSubscribed ? (
            <BellRing className="w-4 h-4 text-rotary-blue" />
          ) : (
            <Bell className="w-4 h-4 text-slate-500" />
          )}

          {/* Indicator dot */}
          <span
            className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
              isSubscribed ? "bg-emerald-500" : "bg-amber-400"
            }`}
          />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md bg-white text-slate-900 border-slate-200">
        <DialogHeader>
          <div className="flex items-center justify-between pr-4">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-rotary-blue">
              <Bell className="w-5 h-5 text-rotary-blue" />
              Notificações no Celular
            </DialogTitle>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isSubscribed
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {isSubscribed ? "Ativas" : "Desativadas"}
            </span>
          </div>
          <DialogDescription className="text-xs text-slate-600 pt-1">
            Receba notificações na tela de bloqueio do seu celular quando houver atrasos ou devoluções de equipamentos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
            {isSubscribed ? (
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">
                    Seu aparelho está registrado e pronto
                  </p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Mesmo com o aplicativo e navegador fechados, o sistema avisará você sobre novas movimentações.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">
                    Notificações desativadas neste aparelho
                  </p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Clique no botão abaixo para permitir que o navegador ou o PWA envie alertas em tempo real.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            {isSubscribed ? (
              <>
                <Button
                  onClick={async () => {
                    await sendTestPush();
                  }}
                  disabled={isLoading}
                  className="w-full bg-rotary-blue hover:bg-blue-800 text-white font-bold text-xs h-10 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2 text-rotary-gold" />
                  )}
                  Disparar Notificação de Teste
                </Button>

                <Button
                  variant="outline"
                  onClick={async () => {
                    await unsubscribe();
                  }}
                  disabled={isLoading}
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 text-xs border-red-200 h-9 cursor-pointer"
                >
                  <BellOff className="w-3.5 h-3.5 mr-1.5" />
                  Desativar Alertas Push Neste Dispositivo
                </Button>
              </>
            ) : (
              <Button
                onClick={async () => {
                  const ok = await subscribe();
                  if (ok) setOpen(false);
                }}
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Bell className="w-4 h-4 mr-2" />
                )}
                Ativar Notificações no Celular
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
