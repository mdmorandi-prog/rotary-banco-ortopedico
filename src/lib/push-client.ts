// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - CLIENT-SIDE PWA & WEB PUSH UTILS
// Suporte multiplataforma (Android Chrome, iOS Safari 16.4+, Desktop Chrome/Edge)
// ==============================================================================

/**
 * Converte chave pública VAPID codificada em Base64 para Uint8Array
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registra o Service Worker do PWA
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (error) {
    console.warn('[PWA] Falha ao registrar Service Worker:', error);
    return null;
  }
}

/**
 * Obtém a subscrição push existente no navegador
 */
export async function getExistingPushSubscription(
  registration?: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  const reg = registration || (await navigator.serviceWorker.ready);
  return await reg.pushManager.getSubscription();
}

/**
 * Solicita permissão e subscreve o dispositivo nas notificações Push
 */
export async function subscribeToPushNotifications(
  vapidPublicKey: string,
  userId?: string
): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Notificações Push não são suportadas neste navegador.');
  }

  // Solicita permissão explícita ao usuário
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissão de notificações não foi concedida pelo usuário.');
  }

  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

  // Subscreve com o servidor de push da Apple/Google
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as unknown as BufferSource,
  });

  // Salva no Neon PostgreSQL via /api/push/subscribe
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      userId,
    }),
  });

  if (!response.ok) {
    throw new Error('Falha ao sincronizar subscrição com o servidor.');
  }

  return subscription;
}

/**
 * Cancela a subscrição de notificações push
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;

  // Remove do servidor
  try {
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch (err) {
    console.warn('[Push] Erro ao deletar no servidor:', err);
  }

  return await subscription.unsubscribe();
}
