// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - GEOCODING & FARROUPILHA COORDINATES RESOLVER
// Converts addresses and neighborhoods in Farroupilha - RS into geographic
// coordinates (lat, lng) at zero cost (no paid Google Maps API credits).
// ==============================================================================

import { DEFAULT_CLUB_INFO } from './constants';

export interface GeoCoordinate {
  lat: number;
  lng: number;
  source: 'GPS_EXACT' | 'GEOCODED' | 'NEIGHBORHOOD_ESTIMATE' | 'ROTARY_SEDE';
}

/**
 * Official Headquarters of Rotary Club de Farroupilha
 * Rua Nataly Valentini, 75 - Farroupilha/RS - CEP: 95180-000
 */
export const ROTARY_FARROUPILHA_SEDE: GeoCoordinate = {
  lat: DEFAULT_CLUB_INFO.headquartersCoordinates.lat,
  lng: DEFAULT_CLUB_INFO.headquartersCoordinates.lng,
  source: 'ROTARY_SEDE',
};

/**
 * Farroupilha - RS Neighborhood Reference Coordinates Dictionary
 * Based on municipal perimeter and IBGE census sectors.
 */
export const FARROUPILHA_NEIGHBORHOODS: Record<string, { lat: number; lng: number }> = {
  centro: { lat: -29.2241, lng: -51.3435 },
  'sao luiz': { lat: -29.2175, lng: -51.3362 },
  'do parque': { lat: -29.229, lng: -51.349 },
  'primeiro de maio': { lat: -29.2312, lng: -51.334 },
  '1 de maio': { lat: -29.2312, lng: -51.334 },
  'nova vicenza': { lat: -29.215, lng: -51.352 },
  cinquentenario: { lat: -29.2205, lng: -51.357 },
  'cinqüentenário': { lat: -29.2205, lng: -51.357 },
  'pio x': { lat: -29.2285, lng: -51.3585 },
  planalto: { lat: -29.211, lng: -51.341 },
  america: { lat: -29.2135, lng: -51.328 },
  'américa': { lat: -29.2135, lng: -51.328 },
  belvedere: { lat: -29.236, lng: -51.342 },
  'volta grande': { lat: -29.208, lng: -51.331 },
  industrial: { lat: -29.238, lng: -51.356 },
  medianeira: { lat: -29.234, lng: -51.351 },
  'bela vista': { lat: -29.226, lng: -51.325 },
  cruzeiro: { lat: -29.219, lng: -51.321 },
  imigrante: { lat: -29.222, lng: -51.331 },
  vicentina: { lat: -29.214, lng: -51.348 },
  'monte pasqual': { lat: -29.241, lng: -51.338 },
  'santo antonio': { lat: -29.206, lng: -51.345 },
  'santo antônio': { lat: -29.206, lng: -51.345 },
  forqueta: { lat: -29.202, lng: -51.298 },
  caravaggio: { lat: -29.245, lng: -51.365 },
};

/**
 * Normalizes strings by removing accents and lowercasing for lookup
 */
function normalizeName(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Resolves a coordinate for a loan address in Farroupilha.
 * If exact GPS exists, uses it; otherwise calculates the neighborhood position
 * with a deterministic scatter jitter based on street & house number.
 */
export function resolveLoanCoordinates(
  loan: {
    lat?: number;
    lng?: number;
    beneficiary?: {
      address_neighborhood?: string;
      address_street?: string;
      address_number?: string;
      address_city?: string;
    };
  }
): GeoCoordinate {
  // 1. Exact GPS Check-in previously captured
  if (loan.lat && loan.lng && !isNaN(Number(loan.lat)) && !isNaN(Number(loan.lng))) {
    return {
      lat: Number(loan.lat),
      lng: Number(loan.lng),
      source: 'GPS_EXACT',
    };
  }

  const neighborhood = loan.beneficiary?.address_neighborhood || '';
  const street = loan.beneficiary?.address_street || '';
  const numberStr = loan.beneficiary?.address_number || '';
  const cleanNeighborhood = normalizeName(neighborhood);

  // 2. Find matching Farroupilha neighborhood
  let baseCoords = FARROUPILHA_NEIGHBORHOODS['centro'];
  for (const [key, coords] of Object.entries(FARROUPILHA_NEIGHBORHOODS)) {
    if (cleanNeighborhood.includes(key) || key.includes(cleanNeighborhood)) {
      baseCoords = coords;
      break;
    }
  }

  // 3. Apply deterministic scatter offset based on street & number
  // so pins in the same neighborhood don't overlap completely on the exact same pixel
  const seedString = `${street}-${numberStr}-${cleanNeighborhood}`;
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(i);
    hash |= 0;
  }

  const offsetLat = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.007; // ~350m radius
  const offsetLng = ((Math.abs(hash * 31) % 1000) / 1000 - 0.5) * 0.007;

  return {
    lat: Number((baseCoords.lat + offsetLat).toFixed(6)),
    lng: Number((baseCoords.lng + offsetLng).toFixed(6)),
    source: 'NEIGHBORHOOD_ESTIMATE',
  };
}

/**
 * Builds direct navigation deep-link for Waze or Google Maps
 */
export function buildNavigationUrl(lat: number, lng: number, app: 'google' | 'waze' = 'google'): string {
  if (app === 'waze') {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
