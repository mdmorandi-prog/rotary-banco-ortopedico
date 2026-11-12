import { NextRequest, NextResponse } from 'next/server';
import { savePushSubscription, removePushSubscription } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
    configured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscription, userId } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: 'Dados de subscrição inválidos.' },
        { status: 400 }
      );
    }

    const userAgent = req.headers.get('user-agent') || 'Unknown';

    await savePushSubscription({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userId: userId || null,
      userAgent,
    });

    return NextResponse.json({ success: true, message: 'Subscrição push salva com sucesso!' });
  } catch (error: any) {
    console.error('[API /api/push/subscribe] Erro ao registrar subscrição:', error);
    return NextResponse.json(
      { error: 'Erro interno ao salvar subscrição.', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint ausente.' }, { status: 400 });
    }

    await removePushSubscription(endpoint);
    return NextResponse.json({ success: true, message: 'Subscrição removida com sucesso.' });
  } catch (error: any) {
    console.error('[API /api/push/subscribe] Erro ao remover subscrição:', error);
    return NextResponse.json(
      { error: 'Erro ao remover subscrição.', details: error.message },
      { status: 500 }
    );
  }
}
