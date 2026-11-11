// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - EVOLUTION API v2 INTEGRATION & QR CODE PAIRING ROUTE
// Manages Evolution API instance configuration in PostgreSQL (rotary.settings),
// fetches live WhatsApp QR Code for pairing, checks connection state, and
// dispatches automated WhatsApp messages.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured, pgDataService } from '@/lib/db/postgres';
import { cleanPhoneForWhatsApp } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export interface ResolvedEvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

export async function getResolvedEvolutionConfig(): Promise<ResolvedEvolutionConfig> {
  let dbSettings: Record<string, string> = {};
  if (isPostgresConfigured()) {
    try {
      dbSettings = await pgDataService.getSettings();
    } catch {
      // Fallback to env vars
    }
  }

  const rawUrl =
    dbSettings.evolution_api_url ||
    process.env.EVOLUTION_API_URL ||
    process.env.WHATSAPP_API_URL ||
    '';

  const baseUrl = rawUrl
    .trim()
    .replace(/\/message\/sendText\/.*$/i, '')
    .replace(/\/$/, '');

  const apiKey = (
    dbSettings.evolution_api_key ||
    process.env.EVOLUTION_API_KEY ||
    process.env.WHATSAPP_API_TOKEN ||
    ''
  ).trim();

  const instanceName = (
    dbSettings.evolution_instance_name ||
    process.env.EVOLUTION_INSTANCE_NAME ||
    'rotary-farroupilha'
  ).trim();

  return { baseUrl, apiKey, instanceName };
}

export async function sendViaEvolutionServer(
  phone: string,
  message: string
): Promise<{ sentViaApi: boolean; error?: string }> {
  const { baseUrl, apiKey, instanceName } = await getResolvedEvolutionConfig();
  if (!baseUrl || !apiKey) {
    return { sentViaApi: false, error: 'Evolution API não configurada.' };
  }

  const number = cleanPhoneForWhatsApp(phone);
  const endpoint = `${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        number,
        text: message,
        delay: 1000,
        linkPreview: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        sentViaApi: false,
        error: `Evolution API HTTP ${res.status}: ${errText.slice(0, 160)}`,
      };
    }

    return { sentViaApi: true };
  } catch (err: any) {
    return {
      sentViaApi: false,
      error: err?.message || 'Falha de conexão com a Evolution API.',
    };
  }
}

export async function GET() {
  try {
    const { baseUrl, apiKey, instanceName } = await getResolvedEvolutionConfig();
    if (!baseUrl || !apiKey) {
      return NextResponse.json({
        configured: false,
        baseUrl: baseUrl || '',
        instanceName,
        hasApiKey: Boolean(apiKey),
        state: 'unconfigured',
      });
    }

    // Query live connectionState from Evolution API
    try {
      const stateRes = await fetch(
        `${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`,
        {
          method: 'GET',
          headers: { apikey: apiKey },
          cache: 'no-store',
        }
      );

      if (stateRes.ok) {
        const data = await stateRes.json();
        const state =
          data?.instance?.state ||
          data?.state ||
          'close';
        return NextResponse.json({
          configured: true,
          baseUrl,
          instanceName,
          hasApiKey: true,
          state,
        });
      }
    } catch {
      // Instance may not be created yet or server unreachable
    }

    return NextResponse.json({
      configured: true,
      baseUrl,
      instanceName,
      hasApiKey: true,
      state: 'close',
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        configured: false,
        state: 'error',
        error: err?.message || 'Erro ao consultar status da Evolution API.',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const baseUrl = String(body.evolution_api_url || '')
      .trim()
      .replace(/\/message\/sendText\/.*$/i, '')
      .replace(/\/$/, '');
    const apiKey = String(body.evolution_api_key || '').trim();
    const instanceName =
      String(body.evolution_instance_name || 'rotary-farroupilha')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '-') || 'rotary-farroupilha';

    if (!baseUrl || !baseUrl.startsWith('http')) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Informe a URL completa da sua Evolution API (ex.: http://SEU_IP_ORACLE:8080 ou https://whatsapp.vitalliz.com.br).',
        },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Informe a Global API Key (apikey) da sua Evolution API.',
        },
        { status: 400 }
      );
    }

    if (isPostgresConfigured()) {
      await pgDataService.setSettings({
        evolution_api_url: baseUrl,
        evolution_api_key: apiKey,
        evolution_instance_name: instanceName,
      });
    }

    return NextResponse.json({
      success: true,
      baseUrl,
      instanceName,
      message: 'Configuração da Evolution API salva no banco de dados com sucesso!',
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Erro ao salvar configuração da Evolution API.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || 'send');
    const { baseUrl, apiKey, instanceName } = await getResolvedEvolutionConfig();

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Configure primeiro a URL e a API Key da Evolution API na Central de WhatsApp.',
        },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------------
    // ACTION 1: CREATE INSTANCE (IF NEEDED) & FETCH QR CODE FOR WHATSAPP PAIRING
    // ------------------------------------------------------------------------
    if (action === 'connect_qr') {
      // 1. Try creating the instance first (ignore if already exists)
      try {
        const createRes = await fetch(`${baseUrl}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: apiKey,
          },
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        });

        if (createRes.ok) {
          const createData = await createRes.json();
          const initialQr =
            createData?.qrcode?.base64 ||
            createData?.base64 ||
            null;
          if (initialQr) {
            return NextResponse.json({
              success: true,
              state: 'connecting',
              qrcodeBase64: initialQr,
              pairingCode: createData?.qrcode?.pairingCode || null,
            });
          }
        }
      } catch {
        // Proceed to /instance/connect
      }

      // 2. Connect / fetch fresh QR code for existing instance
      const connectRes = await fetch(
        `${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`,
        {
          method: 'GET',
          headers: { apikey: apiKey },
          cache: 'no-store',
        }
      );

      if (!connectRes.ok) {
        const errText = await connectRes.text().catch(() => '');
        return NextResponse.json(
          {
            success: false,
            error: `Não foi possível obter o QR Code da Evolution API (${connectRes.status}): ${errText.slice(0, 140)}`,
          },
          { status: 502 }
        );
      }

      const connectData = await connectRes.json();
      const qrcodeBase64 =
        connectData?.base64 ||
        connectData?.qrcode?.base64 ||
        null;
      const state =
        connectData?.instance?.state ||
        connectData?.state ||
        (qrcodeBase64 ? 'connecting' : 'open');

      return NextResponse.json({
        success: true,
        state,
        qrcodeBase64,
        pairingCode: connectData?.pairingCode || connectData?.qrcode?.pairingCode || null,
      });
    }

    // ------------------------------------------------------------------------
    // ACTION 2: DISCONNECT / LOGOUT WHATSAPP INSTANCE
    // ------------------------------------------------------------------------
    if (action === 'logout') {
      await fetch(
        `${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`,
        {
          method: 'DELETE',
          headers: { apikey: apiKey },
        }
      ).catch(() => null);

      return NextResponse.json({
        success: true,
        state: 'close',
        message: 'Sessão do WhatsApp desconectada.',
      });
    }

    // ------------------------------------------------------------------------
    // ACTION 3: SEND WHATSAPP MESSAGE VIA EVOLUTION API v2
    // ------------------------------------------------------------------------
    const phone = String(body.phone || '').trim();
    const message = String(body.message || '').trim();

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: 'Informe o telefone e a mensagem para envio.' },
        { status: 400 }
      );
    }

    const result = await sendViaEvolutionServer(phone, message);
    return NextResponse.json({
      success: result.sentViaApi,
      sentViaApi: result.sentViaApi,
      error: result.error,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Erro ao comunicar com a Evolution API.',
      },
      { status: 500 }
    );
  }
}

