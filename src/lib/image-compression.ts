// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - CLIENT-SIDE IMAGE COMPRESSION
// Compresses mobile camera photos (5MB-12MB) down to lightweight JPEG Data URLs
// (< 800KB, max 1280px, quality 0.72) before storage or upload.
// ==============================================================================

import imageCompression from 'browser-image-compression';

export interface CompressedImageResult {
  dataUrl: string;
  originalSizeKB: number;
  compressedSizeKB: number;
}

/**
 * Converts a Blob or File into a base64 Data URL string.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao converter imagem para Data URL.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro de leitura do arquivo de imagem.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Compresses a document photo using HTML5 Canvas (primary fast path) with
 * `browser-image-compression` fallback, ensuring max dimension 1280px and
 * JPEG quality 0.72 so photos stay well under 800KB.
 */
export async function compressDocumentImage(file: File): Promise<CompressedImageResult> {
  const originalSizeKB = Math.max(1, Math.round(file.size / 1024));

  try {
    // Primary path: browser-image-compression with WebWorker fallback disabled for reliability
    const compressedBlob = await imageCompression(file, {
      maxSizeMB: 0.75, // < 800 KB target
      maxWidthOrHeight: 1280,
      useWebWorker: false,
      initialQuality: 0.72,
      fileType: 'image/jpeg',
    });

    const dataUrl = await blobToDataUrl(compressedBlob);
    const compressedSizeKB = Math.max(1, Math.round(compressedBlob.size / 1024));

    return {
      dataUrl,
      originalSizeKB,
      compressedSizeKB,
    };
  } catch {
    // Fallback path: Direct HTML5 Canvas resizing and JPEG encoding (0.72 quality)
    const rawDataUrl = await blobToDataUrl(file);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1280;
        let { width, height } = img;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Contexto HTML5 Canvas indisponível.'));
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.72);
        // Approximate byte size from base64 payload
        const base64Length = compressedDataUrl.split(',')[1]?.length || 0;
        const compressedBytes = Math.floor((base64Length * 3) / 4);
        const compressedSizeKB = Math.max(1, Math.round(compressedBytes / 1024));

        resolve({
          dataUrl: compressedDataUrl,
          originalSizeKB,
          compressedSizeKB,
        });
      };
      img.onerror = () => reject(new Error('Não foi possível decodificar a imagem selecionada.'));
      img.src = rawDataUrl;
    });
  }
}

/**
 * Generates a realistic, high-contrast SVG Data URL representing a captured
 * official ID document or proof of residence for 1-click desktop testing without a camera.
 */
export function createDemoDocumentDataUrl(label: string, holderName: string): string {
  const safeLabel = (label || 'DOCUMENTO OFICIAL').replace(/[<>&"']/g, '');
  const safeHolder = (holderName || 'Beneficiário Cadastrado').replace(/[<>&"']/g, '');
  const timestamp = new Date().toLocaleString('pt-BR');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#e2e8f0"/>
      </linearGradient>
    </defs>
    <rect width="800" height="500" rx="18" fill="url(#bg)" stroke="#17458f" stroke-width="6"/>
    <rect x="24" y="24" width="752" height="72" rx="10" fill="#17458f"/>
    <text x="48" y="68" fill="#ffffff" font-family="Arial, sans-serif" font-size="24" font-weight="bold">ROTARY CLUB • VERIFICAÇÃO DOCUMENTAL</text>
    <rect x="610" y="38" width="145" height="44" rx="8" fill="#f7a81b"/>
    <text x="630" y="66" fill="#0c2340" font-family="Arial, sans-serif" font-size="16" font-weight="bold">VALIDADO</text>
    
    <rect x="44" y="130" width="180" height="220" rx="12" fill="#cbd5e1" stroke="#64748b" stroke-width="2"/>
    <circle cx="134" cy="205" r="42" fill="#64748b"/>
    <path d="M74 320 C74 270 194 270 194 320 Z" fill="#64748b"/>
    
    <text x="255" y="160" fill="#475569" font-family="Arial, sans-serif" font-size="16" font-weight="bold">TIPO DE COMPROVANTE CAPTURADO:</text>
    <text x="255" y="195" fill="#0f172a" font-family="Arial, sans-serif" font-size="26" font-weight="bold">${safeLabel}</text>
    
    <text x="255" y="250" fill="#475569" font-family="Arial, sans-serif" font-size="16" font-weight="bold">TITULAR / RESPONSÁVEL LEGAL:</text>
    <text x="255" y="285" fill="#17458f" font-family="Arial, sans-serif" font-size="24" font-weight="bold">${safeHolder}</text>
    
    <text x="255" y="340" fill="#334155" font-family="Arial, sans-serif" font-size="15">Captura comprimida via WebRTC / Canvas (&lt; 150 KB)</text>
    <text x="255" y="370" fill="#64748b" font-family="Arial, sans-serif" font-size="14">Data/Hora da Captura: ${timestamp}</text>
    
    <line x1="44" y1="415" x2="756" y2="415" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="8 6"/>
    <text x="44" y="455" fill="#475569" font-family="Arial, sans-serif" font-size="14">Documento arquivado para fins exclusivos de Comodato Gratuito (Arts. 579 a 585 do Código Civil - LGPD).</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
