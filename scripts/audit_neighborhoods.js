const fs = require('fs');
const https = require('https');

function fetchNominatim(query) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Farroupilha, RS, Brasil')}&format=json&limit=1`;
    https.get(url, { headers: { 'User-Agent': 'RotaryBancoOrtopedicoFarroupilha/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.length > 0) {
            resolve({ lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon), name: json[0].display_name });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

const neighborhoods = [
  'Monte Pasqual',
  'Centro',
  'São Luiz',
  'Do Parque',
  'Primeiro de Maio',
  'Nova Vicenza',
  'Cinquentenário',
  'Pio X',
  'Planalto',
  'América',
  'Belvedere',
  'Volta Grande',
  'Industrial',
  'Medianeira',
  'Bela Vista',
  'Cruzeiro',
  'Imigrante',
  'Vicentina',
  'Santo Antônio',
  'Forqueta',
  'Caravaggio'
];

async function main() {
  const results = {};
  for (const n of neighborhoods) {
    const res = await fetchNominatim(n);
    if (res) {
      console.log(`'${n.toLowerCase()}': { lat: ${res.lat.toFixed(6)}, lng: ${res.lng.toFixed(6)} }, // ${res.name.split(',')[0]}`);
    } else {
      console.log(`FAILED for ${n}`);
    }
    await new Promise(r => setTimeout(r, 1000)); // be nice to OSM
  }
}

main();
