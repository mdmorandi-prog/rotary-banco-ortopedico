import { NextRequest, NextResponse } from 'next/server';
import { geocodeWithGoogle } from '@/lib/geocoding';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const street = searchParams.get('street') || '';
  const number = searchParams.get('number') || '';
  const neighborhood = searchParams.get('neighborhood') || '';
  const city = searchParams.get('city') || 'Farroupilha';
  const cep = searchParams.get('cep') || '';

  // 1. Try Google Geocoding first (Rooftop precision)
  const googleRes = await geocodeWithGoogle({ street, number, neighborhood, city, cep });
  if (googleRes) {
    return NextResponse.json({ ok: true, source: 'GOOGLE', ...googleRes });
  }

  // 2. Fallback to AwesomeAPI CEP Geocoding
  if (cep) {
    try {
      const cleanCep = cep.replace(/\D/g, '');
      const res = await fetch(`https://cep.awesomeapi.com.br/json/${cleanCep}`);
      if (res.ok) {
        const data = await res.json();
        if (data.lat && data.lng) {
          return NextResponse.json({
            ok: true,
            source: 'CEP_AWESOME',
            lat: parseFloat(data.lat),
            lng: parseFloat(data.lng),
          });
        }
      }
    } catch (err) {
      console.error('[AwesomeAPI fallback error]', err);
    }
  }

  return NextResponse.json({ ok: false, error: 'Coordenadas não encontradas' }, { status: 404 });
}
