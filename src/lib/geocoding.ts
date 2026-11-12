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
 * Audited with OpenStreetMap & Municipal IBGE sectors
 */
export const FARROUPILHA_NEIGHBORHOODS: Record<string, { lat: number; lng: number }> = {
  'monte pasqual': { lat: -29.220757, lng: -51.316315 },
  centro: { lat: -29.227212, lng: -51.346962 },
  'sao luiz': { lat: -29.233448, lng: -51.390998 },
  'são luiz': { lat: -29.233448, lng: -51.390998 },
  'do parque': { lat: -29.230488, lng: -51.343570 },
  parque: { lat: -29.230488, lng: -51.343570 },
  'primeiro de maio': { lat: -29.241850, lng: -51.350219 },
  '1 de maio': { lat: -29.241850, lng: -51.350219 },
  'nova vicenza': { lat: -29.213481, lng: -51.347329 },
  cinquentenario: { lat: -29.205077, lng: -51.349157 },
  'cinqüentenário': { lat: -29.205077, lng: -51.349157 },
  'pio x': { lat: -29.231699, lng: -51.335491 },
  planalto: { lat: -29.221808, lng: -51.343752 },
  america: { lat: -29.234920, lng: -51.326730 },
  'américa': { lat: -29.234920, lng: -51.326730 },
  belvedere: { lat: -29.205089, lng: -51.358517 },
  'volta grande': { lat: -29.235812, lng: -51.337474 },
  industrial: { lat: -29.225296, lng: -51.325278 },
  medianeira: { lat: -29.218115, lng: -51.332233 },
  'bela vista': { lat: -29.211996, lng: -51.358588 },
  cruzeiro: { lat: -29.212488, lng: -51.341153 },
  imigrante: { lat: -29.233475, lng: -51.353502 },
  vicentina: { lat: -29.218219, lng: -51.353536 },
  'santo antonio': { lat: -29.239391, lng: -51.340775 },
  'santo antônio': { lat: -29.239391, lng: -51.340775 },
  forqueta: { lat: -29.201461, lng: -51.289274 },
  caravaggio: { lat: -29.174074, lng: -51.345716 },
};

/**
 * Common Farroupilha arterial streets direct coordinates
 */
export const FARROUPILHA_STREET_LANDMARKS: Record<string, { lat: number; lng: number }> = {
  'jose maioli': { lat: -29.222675, lng: -51.314535 },
  'josé maioli': { lat: -29.222675, lng: -51.314535 },
  'nataly valentini': { lat: -29.230026, lng: -51.344540 },
  'julio de castilhos': { lat: -29.227212, lng: -51.346962 },
  'júlio de castilhos': { lat: -29.227212, lng: -51.346962 },
  'coronel pena de moraes': { lat: -29.225500, lng: -51.344800 },
  'independencia': { lat: -29.223800, lng: -51.342100 },
  'independência': { lat: -29.223800, lng: -51.342100 },
};

/**
 * Normalizes strings by removing accents and lowercasing for lookup
 */
export function normalizeName(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Resolves a coordinate for a loan address in Farroupilha.
 * 1. Exact GPS Check-in previously captured on loan
 * 2. Exact Geocoded coordinates on beneficiary
 * 3. Exact street landmark in Farroupilha
 * 4. Audited neighborhood position with deterministic house-number offset
 */
export function resolveLoanCoordinates(
  loan: {
    lat?: number;
    lng?: number;
    beneficiary?: {
      lat?: number;
      lng?: number;
      address_neighborhood?: string;
      address_street?: string;
      address_number?: string;
      address_city?: string;
    };
  }
): GeoCoordinate {
  // 1. Exact GPS Check-in previously captured on the loan
  if (loan.lat && loan.lng && !isNaN(Number(loan.lat)) && !isNaN(Number(loan.lng))) {
    return {
      lat: Number(loan.lat),
      lng: Number(loan.lng),
      source: 'GPS_EXACT',
    };
  }

  // 2. Exact geocoded coordinates stored on the beneficiary
  if (
    loan.beneficiary?.lat &&
    loan.beneficiary?.lng &&
    !isNaN(Number(loan.beneficiary.lat)) &&
    !isNaN(Number(loan.beneficiary.lng))
  ) {
    return {
      lat: Number(loan.beneficiary.lat),
      lng: Number(loan.beneficiary.lng),
      source: 'GEOCODED',
    };
  }

  const street = loan.beneficiary?.address_street || '';
  const numberStr = loan.beneficiary?.address_number || '';
  const neighborhood = loan.beneficiary?.address_neighborhood || '';
  const cleanStreet = normalizeName(street);
  const cleanNeighborhood = normalizeName(neighborhood);

  // 3. Known street landmark in Farroupilha
  for (const [key, coords] of Object.entries(FARROUPILHA_STREET_LANDMARKS)) {
    const cleanKey = normalizeName(key);
    if (cleanStreet.includes(cleanKey) || cleanKey.includes(cleanStreet)) {
      return {
        lat: coords.lat,
        lng: coords.lng,
        source: 'GEOCODED',
      };
    }
  }

  // 4. Find matching Farroupilha neighborhood
  let baseCoords = FARROUPILHA_NEIGHBORHOODS['centro'];
  for (const [key, coords] of Object.entries(FARROUPILHA_NEIGHBORHOODS)) {
    const cleanKey = normalizeName(key);
    if (cleanNeighborhood.includes(cleanKey) || cleanKey.includes(cleanNeighborhood)) {
      baseCoords = coords;
      break;
    }
  }

  // Apply slight deterministic scatter offset based on street & number
  // so distinct addresses don't stack on the exact same pixel
  const seedString = `${cleanStreet}-${numberStr}-${cleanNeighborhood}`;
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(i);
    hash |= 0;
  }

  const offsetLat = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.003; // ~150m radius
  const offsetLng = ((Math.abs(hash * 31) % 1000) / 1000 - 0.5) * 0.003;

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

/**
 * Geocodes an exact Farroupilha address using Google Maps Geocoding API
 * Provides high-precision ROOFTOP / door-number coordinates.
 */
export async function geocodeWithGoogle(address: {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
}): Promise<{ lat: number; lng: number; formatted_address?: string; location_type?: string } | null> {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    'AIzaSyB3PZCsTYgh3ljNAMj5TUDh9cbI70MreEU';

  if (!apiKey) return null;

  const parts = [
    address.street ? `${address.street}${address.number ? `, ${address.number}` : ''}` : '',
    address.neighborhood,
    address.city || 'Farroupilha',
    address.state || 'RS',
    address.cep,
    'Brasil',
  ].filter(Boolean);

  const query = encodeURIComponent(parts.join(', '));
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return {
        lat: loc.lat,
        lng: loc.lng,
        formatted_address: data.results[0].formatted_address,
        location_type: data.results[0].geometry.location_type,
      };
    }
  } catch (err) {
    console.error('[Google Geocoding error]', err);
  }
  return null;
}

