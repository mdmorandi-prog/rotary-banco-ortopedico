"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  MessageCircle,
  QrCode,
  CheckCircle2,
  RefreshCw,
  Send,
  LogOut,
  Server,
  KeyRound,
  Smartphone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface EvolutionStatusResponse {
  configured: boolean;
  baseUrl: string;
  instanceName: string;
  hasApiKey: boolean;
  state: "open" | "connecting" | "close" | "unconfigured" | "error";
}

export function EvolutionConfigDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("rotary-evolution-2026");
  const [instanceName, setInstanceName] = useState("rotary-farroupilha");
  const [state, setState] = useState<string>("unconfigured");
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [qrcodeBase64, setQrcodeBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  const [testPhone, setTestPhone] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/whatsapp/evolution", { cache: "no-store" });
      const data: EvolutionStatusResponse = await res.json();
      if (data.baseUrl) setBaseUrl(data.baseUrl);
      if (data.instanceName) setInstanceName(data.instanceName);
      setState(data.state || "unconfigured");
      if (data.state === "open") {
        setQrcodeBase64(null);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchStatus();
      const interval = setInterval(() => {
        fetchStatus();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [open, fetchStatus]);

  const handleSaveAndConnectQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseUrl.trim().startsWith("http")) {
      toast.error(
        "Informe a URL completa da sua Evolution API na Oracle Cloud (ex.: http://SEU_IP_ORACLE:8080)."
      );
      return;
    }
    if (!apiKey.trim()) {
      toast.error("Informe a API Key da Evolution API.");
      return;
    }

    setSaving(true);
    setGeneratingQr(true);
    try {
      const saveRes = await fetch("/api/whatsapp/evolution", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evolution_api_url: baseUrl.trim(),
          evolution_api_key: apiKey.trim(),
          evolution_instance_name: instanceName.trim() || "rotary-farroupilha",
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success) {
        toast.error(saveData.error || "Erro ao salvar configuração.");
        return;
      }

      toast.success("Configuração salva no banco PostgreSQL! Gerando QR Code...");

      const qrRes = await fetch("/api/whatsapp/evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect_qr" }),
      });
      const qrData = await qrRes.json();
      if (!qrRes.ok || !qrData.success) {
        toast.error(
          qrData.error ||
            "Configuração salva! Verifique se o container da Evolution API já está rodando na Oracle Cloud."
        );
        await fetchStatus();
        return;
      }

      if (qrData.qrcodeBase64) {
        setQrcodeBase64(qrData.qrcodeBase64);
        setPairingCode(qrData.pairingCode || null);
        setState("connecting");
        toast.success(
          "QR Code gerado! Abra o WhatsApp do Rotary -> Aparelhos Conectados e aponte a câmera."
        );
      } else if (qrData.state === "open") {
        setQrcodeBase64(null);
        setState("open");
        toast.success("WhatsApp do Rotary já está conectado e ativo!");
      }
    } catch {
      toast.error("Erro ao conectar com a Evolution API.");
    } finally {
      setSaving(false);
      setGeneratingQr(false);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      toast.error("Informe um número de WhatsApp com DDD para o teste.");
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch("/api/whatsapp/evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          phone: testPhone.trim(),
          message:
            "✅ *Teste Oficial — Rotary Club de Farroupilha*\n\nSua integração com a *Evolution API* está ativa! Os alertas de empréstimo, renovação e devolução estão configurados para envio automático.",
        }),
      });
      const data = await res.json();
      if (res.ok && data.sentViaApi) {
        toast.success("Mensagem de teste enviada automaticamente pelo WhatsApp!");
      } else {
        toast.error(
          data.error ||
            "Não foi possível enviar via API. Verifique se o QR Code do WhatsApp já foi lido."
        );
      }
    } catch {
      toast.error("Falha ao disparar mensagem de teste.");
    } finally {
      setSendingTest(false);
    }
  };

  const handleLogoutInstance = async () => {
    try {
      await fetch("/api/whatsapp/evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      setQrcodeBase64(null);
      setState("close");
      toast.success("WhatsApp desconectado da instância.");
    } catch {
      toast.error("Erro ao desconectar instância.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#17458f] font-extrabold">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            WhatsApp Automático (Evolution API • Oracle Cloud)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600">
            Conecte a sua instância gratuita da <strong>Evolution API</strong> na Oracle Cloud
            para envio 100% automático nos empréstimos, devoluções e alertas diários.
          </DialogDescription>
        </DialogHeader>

        {/* Status Banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#17458f]" />
            <span className="text-xs font-bold text-slate-700">Status da Conexão:</span>
          </div>
          <div className="flex items-center gap-2">
            {state === "open" ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Conectado (Automático Ativo)
              </Badge>
            ) : state === "connecting" ? (
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[11px]">
                Aguardando Leitura do QR Code
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-600 text-[11px]">
                Modo 1-Clique (Aguardando Conexão)
              </Badge>
            )}
            <button
              type="button"
              onClick={fetchStatus}
              disabled={loadingStatus}
              title="Atualizar status da conexão"
              className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveAndConnectQr} className="space-y-3.5 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              URL da Evolution API (Oracle Cloud) *
            </label>
            <div className="relative">
              <Server className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                required
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://SEU_IP_ORACLE:8080"
                className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#17458f]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Global API Key (apikey) *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="rotary-evolution-2026"
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#17458f]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nome da Instância
              </label>
              <input
                type="text"
                required
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="rotary-farroupilha"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#17458f]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {state === "open" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLogoutInstance}
                className="text-xs text-red-600 border-red-200 hover:bg-red-50"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Desconectar WhatsApp
              </Button>
            )}

            <Button
              type="submit"
              disabled={saving || generatingQr}
              className="bg-[#17458f] hover:bg-[#0c2340] text-white font-bold text-xs ml-auto"
            >
              <QrCode className="w-4 h-4 mr-1.5" />
              {generatingQr
                ? "Conectando e Gerando QR Code..."
                : "Salvar e Gerar QR Code do WhatsApp"}
            </Button>
          </div>
        </form>

        {/* Live QR Code Display */}
        {qrcodeBase64 && (
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center space-y-2">
            <p className="text-xs font-bold text-emerald-950">
              Escaneie com o WhatsApp do Rotary (Menu → Aparelhos Conectados)
            </p>
            <div className="bg-white p-3 rounded-xl inline-block shadow-sm border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  qrcodeBase64.startsWith("data:image")
                    ? qrcodeBase64
                    : `data:image/png;base64,${qrcodeBase64}`
                }
                alt="QR Code de Pareamento WhatsApp Evolution API"
                className="w-52 h-52 mx-auto object-contain"
              />
            </div>
            {pairingCode && (
              <p className="text-xs text-slate-600">
                Código de Pareamento: <strong className="font-mono">{pairingCode}</strong>
              </p>
            )}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchStatus}
                className="text-xs font-bold text-emerald-800 border-emerald-300 bg-white"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Já escaneei — Verificar Conexão
              </Button>
            </div>
          </div>
        )}

        {/* Test Message Sender */}
        <div className="pt-3 border-t border-slate-200 space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Testar Disparo Automático no WhatsApp
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="(54) 99999-9999"
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#17458f]"
            />
            <Button
              type="button"
              onClick={handleSendTest}
              disabled={sendingTest}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {sendingTest ? "Enviando..." : "Testar Envio"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

