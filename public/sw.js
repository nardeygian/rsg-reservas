// Service worker del portal: lo hace instalable como PWA y recibe las
// notificaciones push (web push con VAPID, las manda la Edge Function
// `notificador`). Todavía no hace caching: el modo sin conexión entra con la
// app nativa (plan Etapa 5, sección 6.1).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass-through: dejamos que el navegador haga su request normal.
});

// ── Push ──────────────────────────────────────────────────────────────────
// Mensaje: { id, title, body, link, tag }.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "RSG", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "RSG";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.id || data.tag,
      lang: "es",
      data: { link: data.link || "/tu/notificaciones", id: data.id || null },
    }),
  );
});

// Al tocarla: enfoca una pestaña del portal y la lleva al enlace, o abre una.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/tu/notificaciones";
  const url = new URL(link, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of ventanas) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// Si el navegador renueva la suscripción, la bandeja la vuelve a registrar
// la próxima vez que se abra el portal (ver ActivarPush).
