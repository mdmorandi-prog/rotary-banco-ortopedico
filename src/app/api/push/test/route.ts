import { NextRequest, NextResponse } from 'next/server';
import { broadcastPushNotification } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const title = body.title || 'Rotary Club Farroupilha Nova Vicenza';
    const message = body.body || '🔔 Teste de Notificação Push Ativo! Se você está lendo isso, seu celular receberá alertas mesmo com o aplicativo fechado.';
    const url = body.url || '/dashboard';

    const result = await broadcastPushNotification({
      title,
      body: message,
      url,
      tag: 'test-push-' + Date.now(),
    });

    return NextResponse.json({
      success: true,
      result,
      message: `Notificação enviada para ${result.sent} dispositivo(s).`,
    });
  } catch (error: any) {
    console.error('[API /api/push/test] Erro ao disparar push de teste:', error);
    return NextResponse.json(
      { error: 'Erro ao disparar push de teste.', details: error.message },
      { status: 500 }
    );
  }
}
