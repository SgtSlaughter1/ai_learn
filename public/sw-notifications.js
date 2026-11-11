/* Loaded by the service worker (vite.config.ts, workbox.importScripts).
   Clicking a pop-up opens the page it points to, reusing an open tab of the app. */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = new URL((event.notification.data && event.notification.data.url) || '/dashboard', self.location.origin);
    if (url.origin !== self.location.origin) return;
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
            const tab = tabs.find((t) => new URL(t.url).origin === url.origin);
            if (tab) return tab.navigate(url.href).then((t) => (t || tab).focus()).catch(() => self.clients.openWindow(url.href));
            return self.clients.openWindow(url.href);
        })
    );
});
