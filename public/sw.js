// Rotary Club Farroupilha Nova Vicenza - Banco Ortopédico
// Service Worker para PWA e Notificações Web Push (Android & iOS)

const CACHE_NAME = 'rotary-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      ),
    ])
  );
});

// Listener de Notificações Push (executa em background mesmo com o app/navegador fechado)
self.addEventListener('push', (event) => {
  let data = {
    title: 'Rotary Banco Ortopédico',
    body: 'Você tem uma nova notificação do Rotary.',
    url: '/dashboard',
    tag: 'rotary-alert',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const title = data.title || 'Rotary Banco Ortopédico';
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-192x192.png',
    tag: data.tag || 'rotary-alert',
    data: {
      url: data.url || '/dashboard',
      timestamp: Date.now(),
    },
    vibrate: [200, 100, 200],
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Listener de clique na notificação: abre o app ou foca na janela já existente
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se houver uma janela aberta do app, foca nela e navega para a URL
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url === targetUrl) {
            return client.focus();
          }
          if ('navigate' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // Se o app estiver completamente fechado, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
