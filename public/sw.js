// Service Worker for Trend Radar Web Push Alerts

self.addEventListener("push", (event) => {
  console.log("[Service Worker] Received push event:", event);

  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || "🚨 Trend Radar Alert";
    const options = {
      body: data.body || "Emerging high-velocity spike detected in monitored streams.",
      icon: "/icon.png", // fallback placeholder icon
      badge: "/badge.png",
      tag: data.tag || "trend-radar-notification",
      data: {
        url: data.url || "/"
      },
      actions: [
        { action: "view", title: "View Dashboard" }
      ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("[Service Worker] Error displaying push notification:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  const targetUrl = event.notification.data ? event.notification.data.url : "/";

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // If there is an existing app window open, focus it
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
