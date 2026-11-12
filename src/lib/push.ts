// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - WEB PUSH NOTIFICATION ENGINE
// Dispara notificações push seguras para celulares Android e iOS (PWAs instalados)
// ==============================================================================

import { setVapidDetails, sendNotification } from 'web-push';
import { getPgPool } from './db/postgres';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string | null;
  userAgent?: string | null;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
}

// Configuração VAPID (Voluntary Application Server Identification)
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:compliance@hbsc.com.br';
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

let isVapidConfigured = false;
function ensureVapidConfigured() {
  if (isVapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID keys not configured in environment variables');
    return false;
  }
  try {
    setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    isVapidConfigured = true;
    return true;
  } catch (err) {
    console.error('[Push] Erro ao configurar VAPID:', err);
    return false;
  }
}

/**
 * Salva ou atualiza uma subscrição push no PostgreSQL
 */
export async function savePushSubscription(sub: PushSubscriptionData): Promise<void> {
  const pool = getPgPool();
  const id = 'sub_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

  await pool.query(
    `
    INSERT INTO rotary.push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (endpoint)
    DO UPDATE SET
      user_id = COALESCE(EXCLUDED.user_id, rotary.push_subscriptions.user_id),
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_agent = COALESCE(EXCLUDED.user_agent, rotary.push_subscriptions.user_agent),
      updated_at = NOW();
    `,
    [id, sub.userId || null, sub.endpoint, sub.keys.p256dh, sub.keys.auth, sub.userAgent || null]
  );
}

/**
 * Remove uma subscrição push (usuário desativou)
 */
export async function removePushSubscription(endpoint: string): Promise<void> {
  const pool = getPgPool();
  await pool.query(`DELETE FROM rotary.push_subscriptions WHERE endpoint = $1;`, [endpoint]);
}

/**
 * Obtém todas as subscrições push cadastradas
 */
export async function getAllPushSubscriptions(): Promise<
  Array<{ endpoint: string; p256dh: string; auth: string; user_id?: string }>
> {
  const pool = getPgPool();
  const { rows } = await pool.query(`
    SELECT endpoint, p256dh, auth, user_id
    FROM rotary.push_subscriptions
    ORDER BY updated_at DESC;
  `);
  return rows;
}

/**
 * Envia notificação push para todas as pessoas cadastradas (administradores/voluntários).
 * Remove automaticamente subscrições inválidas ou expiradas (410 / 404).
 */
export async function broadcastPushNotification(
  payload: PushPayload
): Promise<{ sent: number; failed: number; total: number }> {
  if (!ensureVapidConfigured()) {
    console.warn('[Push] Notificações push não enviadas: chaves VAPID ausentes');
    return { sent: 0, failed: 0, total: 0 };
  }

  const subscriptions = await getAllPushSubscriptions();
  if (!subscriptions || subscriptions.length === 0) {
    console.log('[Push] Nenhuma subscrição push cadastrada para receber notificação');
    return { sent: 0, failed: 0, total: 0 };
  }

  const jsonPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/dashboard',
    tag: payload.tag || 'rotary-alert-' + Date.now(),
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/icon-192x192.png',
    data: payload.data,
  });

  let sent = 0;
  let failed = 0;
  const pool = getPgPool();

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await sendNotification(pushConfig, jsonPayload, {
          TTL: 60 * 60 * 24, // 24 horas no servidor de push caso o celular esteja sem internet
        });
        sent++;
      } catch (err: any) {
        failed++;
        // Se a assinatura expirou ou o usuário desinstalou o PWA (HTTP 404 ou 410)
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[Push] Removendo subscrição expirada: ${sub.endpoint.substring(0, 30)}...`);
          await pool.query(`DELETE FROM rotary.push_subscriptions WHERE endpoint = $1;`, [
            sub.endpoint,
          ]);
        } else {
          console.error('[Push] Erro ao enviar notificação push:', err.message || err);
        }
      }
    })
  );

  console.log(`[Push Broadcast] Enviadas: ${sent}, Falhas: ${failed}, Total: ${subscriptions.length}`);
  return { sent, failed, total: subscriptions.length };
}
