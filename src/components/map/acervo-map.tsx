"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Navigation,
  ExternalLink,
  MessageCircle,
  Phone,
  User,
  Package,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  MapPin,
  Compass,
} from "lucide-react";
import { Loan, EquipmentCategory } from "@/lib/data-layer/types";
import {
  resolveLoanCoordinates,
  buildNavigationUrl,
  ROTARY_FARROUPILHA_SEDE,
} from "@/lib/geocoding";
import { DEFAULT_CLUB_INFO, CATEGORY_LABELS } from "@/lib/constants";
import { formatDate, formatCurrency } from "@/lib/utils";
import { sendWhatsAppNotification, buildRenewalReminderWhatsAppLink } from "@/lib/whatsapp";
import { toast } from "sonner";

interface AcervoMapProps {
  loans: Loan[];
  selectedLoanId?: string | null;
  onSelectLoan?: (loanId: string) => void;
}

export default function AcervoMap({
  loans,
  selectedLoanId,
  onSelectLoan,
}: AcervoMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Farroupilha - RS
    const map = L.map(mapContainerRef.current, {
      center: [ROTARY_FARROUPILHA_SEDE.lat, ROTARY_FARROUPILHA_SEDE.lng],
      zoom: 13,
      zoomControl: true,
    });

    // OpenStreetMap Official Community Tiles (100% Free, Zero API Key Required)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      subdomains: ["a", "b", "c"],
      maxZoom: 19,
    }).addTo(map);

    // Call invalidateSize after render to ensure tiles paint properly
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers when loans or selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // 1. Add Rotary Sede Marker (Farroupilha Headquarters)
    const sedeIcon = L.divIcon({
      className: "rotary-sede-marker",
      html: `
        <div style="
          width: 44px;
          height: 44px;
          background-color: #0c2340;
          border: 3px solid #f7a81b;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(12, 35, 64, 0.4);
          color: #f7a81b;
          font-weight: 900;
          font-size: 20px;
          cursor: pointer;
        ">
          ⚙
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
    });

    const sedeMarker = L.marker(
      [ROTARY_FARROUPILHA_SEDE.lat, ROTARY_FARROUPILHA_SEDE.lng],
      { icon: sedeIcon, zIndexOffset: 1000 }
    ).bindPopup(`
      <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 220px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <span style="background: #0c2340; color: #f7a81b; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase;">Sede Oficial</span>
        </div>
        <h3 style="font-size: 14px; font-weight: bold; color: #0c2340; margin: 0 0 4px 0;">${DEFAULT_CLUB_INFO.clubName}</h3>
        <p style="font-size: 12px; color: #334155; margin: 0 0 6px 0;">${DEFAULT_CLUB_INFO.address}<br>CEP: ${DEFAULT_CLUB_INFO.cep} • ${DEFAULT_CLUB_INFO.city}</p>
        <p style="font-size: 11px; color: #64748b; margin: 0 0 8px 0;">Ponto de partida dos voluntários e coletas.</p>
        <a href="https://maps.google.com/?q=${encodeURIComponent(DEFAULT_CLUB_INFO.address + ', ' + DEFAULT_CLUB_INFO.city)}" target="_blank" style="display: inline-block; background: #0c2340; color: white; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; text-decoration: none;">Abrir Sede no Google Maps</a>
      </div>
    `);
    markersLayer.addLayer(sedeMarker);

    // 2. Add Loan Markers
    const now = new Date();

    loans.forEach((loan) => {
      const coords = resolveLoanCoordinates(loan);
      const isOverdue =
        loan.status === "ATRASADO" ||
        (loan.status !== "DEVOLVIDO" &&
          loan.status !== "CANCELADO" &&
          new Date(loan.expected_return_date) < now);
      const daysUntilReturn = Math.ceil(
        (new Date(loan.expected_return_date).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const isDueSoon =
        !isOverdue &&
        loan.status !== "DEVOLVIDO" &&
        loan.status !== "CANCELADO" &&
        daysUntilReturn <= 7;

      // Color scheme
      let pinColor = "#10b981"; // Green (Em dia)
      let pinBorder = "#047857";
      let statusLabel = "Em dia";
      let statusBadgeBg = "#dcfce7";
      let statusBadgeText = "#166534";

      if (loan.status === "DEVOLVIDO" || loan.status === "CANCELADO") {
        pinColor = "#64748b"; // Grey (Devolvido)
        pinBorder = "#334155";
        statusLabel = "Devolvido (Quitado)";
        statusBadgeBg = "#f1f5f9";
        statusBadgeText = "#334155";
      } else if (isOverdue) {
        pinColor = "#ef4444"; // Red (Atrasado)
        pinBorder = "#b91c1c";
        statusLabel = `Atrasado (${Math.abs(daysUntilReturn)}d)`;
        statusBadgeBg = "#fee2e2";
        statusBadgeText = "#991b1b";
      } else if (isDueSoon) {
        pinColor = "#f59e0b"; // Yellow (Vence em breve)
        pinBorder = "#d97706";
        statusLabel = `Vence em ${daysUntilReturn}d`;
        statusBadgeBg = "#fef3c7";
        statusBadgeText = "#92400e";
      }

      const isSelected = selectedLoanId === loan.id;
      const size = isSelected ? 40 : 32;

      const pinIcon = L.divIcon({
        className: "custom-loan-pin",
        html: `
          <div style="
            width: ${size}px;
            height: ${size}px;
            background-color: ${pinColor};
            border: ${isSelected ? "3px solid #0c2340" : `2px solid ${pinBorder}`};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.15s ease;
          ">
            <div style="
              width: ${size / 2.2}px;
              height: ${size / 2.2}px;
              background-color: white;
              border-radius: 50%;
              transform: rotate(45deg);
            "></div>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
      });

      const marker = L.marker([coords.lat, coords.lng], { icon: pinIcon });

      const wazeUrl = buildNavigationUrl(coords.lat, coords.lng, "waze");
      const googleMapsUrl = buildNavigationUrl(coords.lat, coords.lng, "google");
      const ben = loan.beneficiary;
      const benName = ben?.full_name || "Beneficiário";
      const eqName = loan.equipment?.name || "Equipamento";
      const patrimony = loan.equipment?.patrimony_code || loan.equipment_id;
      const fullAddress = ben
        ? `${ben.address_street}, ${ben.address_number} - ${ben.address_neighborhood}`
        : "Endereço cadastrado";
      const hasGps = Boolean(loan.lat && loan.lng && loan.last_gps_at);

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 250px; max-width: 290px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px;">
            <span style="background: ${statusBadgeBg}; color: ${statusBadgeText}; padding: 2px 7px; border-radius: 12px; font-size: 11px; font-weight: bold;">
              ${statusLabel}
            </span>
            <span style="font-size: 10px; font-weight: bold; color: #64748b; font-family: monospace;">
              #${patrimony}
            </span>
          </div>

          <h4 style="font-size: 13px; font-weight: bold; color: #0c2340; margin: 0 0 2px 0;">
            ${eqName}
          </h4>

          <p style="font-size: 12px; color: #1e293b; font-weight: 600; margin: 0 0 3px 0;">
            👤 ${benName}
          </p>

          <p style="font-size: 11px; color: #475569; margin: 0 0 6px 0; line-height: 1.3;">
            📍 ${fullAddress}
          </p>

          <div style="font-size: 10px; color: ${hasGps ? "#059669" : "#64748b"}; margin-bottom: 10px; font-weight: 500;">
            ${
              hasGps
                ? "✓ Coordenada auditada por GPS do celular"
                : "• Localização aproximada por Bairro/CEP"
            }
          </div>

          <div style="display: flex; flex-direction: column; gap: 5px;">
            <div style="display: flex; gap: 5px;">
              <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #17458f; color: white; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; text-decoration: none;">
                🗺️ Rota Google Maps
              </a>
              <a href="${wazeUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #00bcd4; color: white; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; text-decoration: none;">
                🚙 Rota Waze
              </a>
            </div>

            <a href="/loans/${loan.id}" style="display: block; text-align: center; background: #f1f5f9; color: #0f172a; padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; text-decoration: none; border: 1px solid #cbd5e1;">
              📄 Ver Detalhes do Contrato
            </a>
          </div>
        </div>
      `);

      marker.on("click", () => {
        if (onSelectLoan) onSelectLoan(loan.id);
      });

      markersLayer.addLayer(marker);

      if (isSelected) {
        marker.openPopup();
        map.setView([coords.lat, coords.lng], 15, { animate: true });
      }
    });

    // Auto-fit map bounds so both Rotary Headquarters and all equipment pins are visible
    if (!selectedLoanId && loans.length > 0) {
      const allCoords: [number, number][] = [
        [ROTARY_FARROUPILHA_SEDE.lat, ROTARY_FARROUPILHA_SEDE.lng],
        ...loans.map((l) => {
          const c = resolveLoanCoordinates(l);
          return [c.lat, c.lng] as [number, number];
        }),
      ];
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }
  }, [loans, selectedLoanId, onSelectLoan]);

  return (
    <div className="relative w-full h-[620px] rounded-2xl overflow-hidden border border-slate-300 shadow-md">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Map Legend */}
      <div className="absolute bottom-4 left-4 z-[500] bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-3 shadow-lg text-xs space-y-1.5 pointer-events-auto">
        <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">
          Legenda do Acervo
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-700"></span>
          <span className="text-slate-700 font-medium">Em dia / Regular</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-700"></span>
          <span className="text-slate-700 font-medium">Vencendo em 7 dias</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 border border-red-700"></span>
          <span className="text-slate-700 font-medium">Atrasado / Coleta pendente</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-slate-500 border border-slate-700"></span>
          <span className="text-slate-700 font-medium">Devolvido / Histórico</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <span className="w-3.5 h-3.5 rounded-full bg-[#0c2340] border border-[#f7a81b] flex items-center justify-center text-[9px] text-[#f7a81b] font-bold">
            ⚙
          </span>
          <span className="text-slate-800 font-bold">Sede Rotary (R. Nataly Valentini, 75)</span>
        </div>
      </div>
    </div>
  );
}

