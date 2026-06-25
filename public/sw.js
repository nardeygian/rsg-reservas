// Service worker mínimo para que la app sea instalable como PWA.
// No hace caching agresivo todavía — basta con existir y pasar requests para
// que el navegador la considere instalable. El caching offline serio entra
// más adelante cuando definamos qué páginas tienen sentido offline.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass-through: dejamos que el navegador haga su request normal.
});
