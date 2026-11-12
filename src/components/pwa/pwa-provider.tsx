"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  registerServiceWorker,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getExistingPushSubscription,
} from "@/lib/push-client";

interface PwaContextType {
  isStandalone: boolean;
  canInstall: boolean;
  isIOS: boolean;
  pushSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  promptInstall: () => Promise<void>;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  sendTestPush: () => Promise<boolean>;
}

const PwaContext = createContext<PwaContextType | null>(null);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detecta se já está rodando instalado como PWA
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");
    setIsStandalone(standaloneMode);

    // Detecta dispositivo iOS (iPhone / iPad)
    const ua = window.navigator.userAgent;
    const isIosDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(isIosDevice);

    // Detecta suporte a Push API e Service Worker
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    setPushSupported(supported);

    // Registra Service Worker
    registerServiceWorker().then((reg) => {
      if (reg) {
        getExistingPushSubscription(reg).then((sub) => {
          setIsSubscribed(Boolean(sub));
        });
      }
    });

    // Captura evento de instalação do navegador (Android Chrome / Edge / Desktop)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setCanInstall(false);
      setDeferredPrompt(null);
      toast.success("Aplicativo do Rotary instalado com sucesso!");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        toast.info(
          "Para instalar no iPhone/iPad: toque no botão Compartilhar (quadrado com seta) e selecione 'Adicionar à Tela de Início'.",
          { duration: 8000 }
        );
      } else {
        toast.info("Acesse pelo menu do seu navegador e clique em 'Instalar Aplicativo'.");
      }
      return;
    }

    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsStandalone(true);
        setCanInstall(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error("[PWA] Erro ao disparar instalação:", err);
    }
  }, [deferredPrompt, isIOS]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        toast.error("Chave pública de notificações não configurada.");
        return false;
      }

      // No iOS, a notificação só é permitida após adicionar à tela de início
      if (isIOS && !isStandalone) {
        toast.warning(
          "No iPhone, instale o aplicativo primeiro adicionando-o à 'Tela de Início' para liberar as notificações.",
          { duration: 7000 }
        );
      }

      const sub = await subscribeToPushNotifications(vapidKey);
      if (sub) {
        setIsSubscribed(true);
        toast.success("Notificações push ativadas com sucesso neste dispositivo!", {
          description: "Você receberá alertas de vencimento e devoluções mesmo com o app fechado.",
        });
        return true;
      }
      return false;
    } catch (error: any) {
      console.error("[PWA] Erro ao ativar notificações:", error);
      toast.error("Não foi possível ativar as notificações: " + (error.message || "Permissão negada"));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isIOS, isStandalone]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await unsubscribeFromPushNotifications();
      if (success) {
        setIsSubscribed(false);
        toast.info("Notificações push desativadas neste dispositivo.");
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error("Erro ao desativar notificações.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendTestPush = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Rotary Farroupilha Nova Vicenza",
          body: "🔔 Notificação Push recebida com sucesso! O sistema está pronto para avisar sobre vencimentos e devoluções mesmo fechado.",
          url: "/dashboard",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Notificação enviada pelo servidor!", {
          description: `Disparada para ${data.result?.sent || 1} dispositivo(s). Verifique sua tela de bloqueio.`,
        });
        return true;
      } else {
        toast.error(data.error || "Falha ao enviar notificação de teste.");
        return false;
      }
    } catch (error) {
      toast.error("Erro de conexão ao testar notificação.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <PwaContext.Provider
      value={{
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
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error("usePwa deve ser utilizado dentro de um PwaProvider");
  }
  return context;
}
