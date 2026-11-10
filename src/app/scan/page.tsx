"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  CameraOff,
  QrCode,
  Search,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Package,
  Keyboard,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { dataRepository } from "@/lib/data-layer/repository";
import { Equipment } from "@/lib/data-layer/types";
import {
  CATEGORY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Extracts either the qr_token or patrimony_code from a scanned QR payload.
 * Handles full URLs like https://.../item/rotary-item-rot-cr-001, relative paths
 * like /item/rotary-item-rot-cr-001, raw tokens, or patrimony codes.
 */
function extractTokenFromScan(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) return "";

  try {
    if (trimmed.includes("/item/")) {
      const parts = trimmed.split("/item/");
      const candidate = parts[parts.length - 1].split(/[?#]/)[0].trim();
      if (candidate) return decodeURIComponent(candidate);
    }
  } catch {
    // Fallback to raw trimmed string
  }

  return trimmed;
}

export default function QrScannerPage() {
  const router = useRouter();
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>("");

  // Equipments for Quick Demo Simulation Grid
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loadingEquipments, setLoadingEquipments] = useState<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    const fetchItems = async () => {
      try {
        setLoadingEquipments(true);
        const list = await dataRepository.getEquipments();
        if (isMountedRef.current) {
          setEquipments(list);
        }
      } catch (err) {
        console.error("Failed to load equipments for simulator:", err);
      } finally {
        if (isMountedRef.current) {
          setLoadingEquipments(false);
        }
      }
    };

    fetchItems();

    return () => {
      isMountedRef.current = false;
      stopScannerSafely();
    };
  }, []);

  const stopScannerSafely = async () => {
    const instance = scannerRef.current;
    if (!instance) return;
    try {
      if (instance.isScanning) {
        await instance.stop();
      }
      instance.clear();
    } catch {
      // Ignore cleanup errors when unmounting
    } finally {
      scannerRef.current = null;
      if (isMountedRef.current) {
        setIsCameraActive(false);
      }
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    const token = extractTokenFromScan(decodedText);
    if (!token) return;

    await stopScannerSafely();
    toast.success(`QR Code lido com sucesso: ${token}`);
    router.push("/item/" + encodeURIComponent(token));
  };

  const startCamera = async () => {
    setCameraError(null);
    setIsStartingCamera(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      if (scannerRef.current) {
        await stopScannerSafely();
      }

      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Frame without QR code - ignore
        }
      );

      if (isMountedRef.current) {
        setIsCameraActive(true);
      }
    } catch (err: unknown) {
      console.warn("Camera access failed or unavailable:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Permissão de câmera negada ou nenhum dispositivo de vídeo encontrado.";
      if (isMountedRef.current) {
        setCameraError(
          `Não foi possível acessar a câmera (${message}). Utilize a consulta manual por código ou o Simulador Rápido abaixo.`
        );
        setIsCameraActive(false);
      }
    } finally {
      if (isMountedRef.current) {
        setIsStartingCamera(false);
      }
    }
  };

  const toggleCamera = async () => {
    if (isCameraActive) {
      await stopScannerSafely();
    } else {
      await startCamera();
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractTokenFromScan(manualInput);
    if (!token) {
      toast.error(
        "Digite um código patrimonial (ex: ROT-CR-001) ou token QR válido."
      );
      return;
    }
    router.push("/item/" + encodeURIComponent(token));
  };

  const handleSimulateScan = async (item: Equipment) => {
    if (isCameraActive) {
      await stopScannerSafely();
    }
    toast.success(
      `Leitura QR simulada: ${item.patrimony_code} (${STATUS_LABELS[item.status] || item.status})`
    );
    router.push("/item/" + encodeURIComponent(item.qr_token));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 text-rotary-blue text-xs font-bold uppercase tracking-wider border border-blue-200">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Roteamento Contextual por Estado</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Leitor de QR Code Patrimonial
          </h1>
          <p className="text-sm text-slate-600">
            Aponte a câmera para a etiqueta do equipamento para abrir
            automaticamente o Empréstimo, Devolução ou Triagem.
          </p>
        </div>

        <Link
          href="/equipments"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors self-start sm:self-auto shrink-0"
        >
          <Package className="w-4 h-4 text-slate-600" />
          <span>Ver Catálogo Completo</span>
        </Link>
      </div>

      {/* Main Grid: Camera Scanner + Manual Input */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Viewfinder */}
        <div className="lg:col-span-7 bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-md flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rotary-blue flex items-center justify-center border border-blue-400/30">
                <QrCode className="w-5 h-5 text-rotary-gold" />
              </div>
              <div>
                <h2 className="text-base font-bold leading-tight">
                  Câmera Óptica QR Code
                </h2>
                <p className="text-xs text-slate-400">
                  {isCameraActive
                    ? "Câmera ativa — posicione o QR Code no centro"
                    : "Toque em Iniciar Câmera para ler a etiqueta"}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isStartingCamera}
              onClick={toggleCamera}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm",
                isCameraActive
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-rotary-gold hover:bg-amber-400 text-rotary-blue",
                isStartingCamera && "opacity-60 cursor-wait"
              )}
            >
              {isCameraActive ? (
                <>
                  <CameraOff className="w-4 h-4" />
                  <span>Parar Câmera</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>
                    {isStartingCamera ? "Iniciando..." : "Iniciar Câmera"}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Viewfinder Container */}
          <div className="relative w-full aspect-square max-h-[340px] mx-auto bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center">
            {/* html5-qrcode target container */}
            <div id="qr-reader" className="w-full h-full" />

            {/* Idle Overlay & Rotary-styled Reticle when camera is off */}
            {!isCameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90">
                {/* Reticle Corners */}
                <div className="relative w-52 h-52 flex flex-col items-center justify-center">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-rotary-gold rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-rotary-gold rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-rotary-gold rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-rotary-gold rounded-br-xl" />

                  <QrCode className="w-16 h-16 text-slate-600 mb-3" />
                  <p className="text-xs font-semibold text-slate-300 max-w-[170px]">
                    Visor pronto para leitura de etiqueta patrimonial Rotary
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isStartingCamera}
                  onClick={startCamera}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-rotary-gold text-rotary-blue hover:bg-amber-400 shadow-md transition-all active:scale-95"
                >
                  <Camera className="w-4 h-4 stroke-[2.5px]" />
                  <span>
                    {isStartingCamera
                      ? "Solicitando permissão..."
                      : "Ativar Câmera Agora"}
                  </span>
                </button>
              </div>
            )}

            {/* Active Reticle Overlay */}
            {isCameraActive && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative w-60 h-60">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-rotary-gold rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-rotary-gold rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-rotary-gold rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-rotary-gold rounded-br-lg" />
                  <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-rotary-gold/80 shadow-[0_0_8px_#f7a81b] animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* Camera Error / Fallback Notice */}
          {cameraError && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rotary-gold shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* Right Column: Manual Input Fallback & State Machine Guide */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Manual Input Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-rotary-blue flex items-center justify-center border border-blue-200">
                <Keyboard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Consulta Manual por Código
                </h2>
                <p className="text-xs text-slate-500">
                  Sem câmera? Digite o código impresso na etiqueta
                </p>
              </div>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="manual-patrimony-input"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  Código Patrimonial ou Token QR
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="manual-patrimony-input"
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Ex: ROT-CR-001 ou rotary-item-rot-cr-001"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-rotary-blue text-white hover:bg-blue-800 shadow-xs transition-all"
              >
                <span>Consultar Equipamento</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Contextual State Machine Info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Como funciona o QR Code Contextual?
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>
                  <strong className="text-slate-900">Item DISPONÍVEL:</strong>{" "}
                  Abre diretamente o botão para iniciar um novo Comodato Digital
                  (Check-out).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-rotary-blue mt-1.5 shrink-0" />
                <span>
                  <strong className="text-slate-900">
                    Item EMPRESTADO / ATRASADO:
                  </strong>{" "}
                  Exibe os dados do beneficiário e permite Registrar Devolução
                  (Check-in) ou Renovar Prazo (+30 dias).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-600 mt-1.5 shrink-0" />
                <span>
                  <strong className="text-slate-900">
                    Item em HIGIENIZAÇÃO / MANUTENÇÃO:
                  </strong>{" "}
                  Exibe painel de quarentena ANVISA/Oficina com liberação em 1
                  clique para o estoque.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Demo Simulation Grid ("Simulador Rápido de Leitura QR - Modo Teste") */}
      <div className="bg-white rounded-2xl border-2 border-amber-300/80 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-rotary-blue flex items-center justify-center border border-amber-300 shrink-0">
              <Sparkles className="w-5 h-5 text-rotary-blue" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Simulador Rápido de Leitura QR - Modo Teste
              </h2>
              <p className="text-xs text-slate-600">
                Clique em qualquer equipamento abaixo para simular a leitura
                instantânea da etiqueta QR em diferentes estados operacionais:
              </p>
            </div>
          </div>
        </div>

        {loadingEquipments ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-24 rounded-xl bg-slate-100 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {equipments.map((item) => {
              const statusStyle = STATUS_COLORS[item.status] || {
                bg: "bg-slate-100",
                text: "text-slate-700",
                border: "border-slate-300",
              };

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSimulateScan(item)}
                  className="text-left p-3.5 rounded-xl border border-slate-200 hover:border-rotary-blue hover:bg-blue-50/40 transition-all group flex flex-col justify-between gap-2 shadow-2xs"
                >
                  <div className="w-full flex items-center justify-between gap-1.5">
                    <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-slate-900 text-white group-hover:bg-rotary-blue transition-colors">
                      {item.patrimony_code}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        statusStyle.bg,
                        statusStyle.text,
                        statusStyle.border
                      )}
                    >
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-rotary-blue">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                      <span>
                        {CATEGORY_LABELS[item.category] || item.category}
                      </span>
                      <span className="font-semibold text-rotary-blue inline-flex items-center gap-0.5">
                        Simular QR <ArrowRight className="w-3 h-3" />
                      </span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
