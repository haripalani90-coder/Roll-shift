// DataShift Service Worker — handles background notifications
const CACHE_NAME = 'datashift-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

// Install & cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Fetch (serve from cache, fallback to network)
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// Listen for messages from the main page
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIFICATIONS') {
    const { startHour, endHour, intervalMinutes, weekTitle, weekRange } = e.data;
    scheduleNext(startHour, endHour, intervalMinutes, weekTitle, weekRange);
  }
  if (e.data && e.data.type === 'CANCEL_NOTIFICATIONS') {
    // Just acknowledge — actual cancellation handled by page
    console.log('[SW] Notifications cancelled');
  }
});

// Show push notification
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: '📚 Study Time!', body: 'Open DataShift to track your progress.' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'datashift-reminder',
      renotify: true,
      actions: [
        { action: 'open', title: '📖 Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

// Notification click
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'open' || !e.action) {
    e.waitUntil(
      clients.matchAll({ type: 'window' }).then(list => {
        if (list.length > 0) return list[0].focus();
        return clients.openWindow('/');
      })
    );
  }
});

function scheduleNext(startHour, endHour, intervalMinutes, weekTitle, weekRange) {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  // Check if we're inside the allowed window
  const inWindow = h >= startHour && h < endHour;
  if (!inWindow) return;

  const delayMs = intervalMinutes * 60 * 1000;

  setTimeout(() => {
    const n = new Date();
    const nh = n.getHours();
    if (nh >= startHour && nh < endHour) {
      self.registration.showNotification('⏰ Study Reminder — DataShift', {
        body: `Time to study: ${weekTitle} · ${weekRange}`,
        tag: 'datashift-reminder',
        renotify: true,
        icon: '/icon-192.png',
        actions: [
          { action: 'open', title: '📖 Open App' }
        ]
      });
    }
    // Schedule next one
    scheduleNext(startHour, endHour, intervalMinutes, weekTitle, weekRange);
  }, delayMs);
}
