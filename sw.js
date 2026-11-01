/* Service worker — offline app shell */
const VERSION = 'fullbid-v4';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/store.js', './js/geometry.js', './js/ui.js', './js/model3d.js', './js/floorplan.js',
  './js/estimate-ui.js', './js/document.js', './js/measure.js', './js/model-ui.js', './js/brand.js', './js/configurator-ui.js', './js/pricing-ui.js', './js/suppliers-ui.js', './js/changeorder-ui.js',
  './js/scanner/scan.js', './js/scanner/webxr-ar.js', './js/scanner/gyro.js', './js/scanner/manual.js',
  './js/pricing/catalog.js', './js/pricing/regional.js', './js/pricing/estimator.js', './js/pricing/smart.js', './js/pricing/ai.js', './js/pricing/ai-prompt.js', './js/pricing/profile.js', './js/pricing/suppliers.js', './js/pricing/products.js', './js/pricing/tiers.js', './js/zip.js', './vendor/anthropic-sdk.js',
  './vendor/three/three.module.min.js', './vendor/three/addons/controls/OrbitControls.js',
  './vendor/three/addons/exporters/GLTFExporter.js', './vendor/three/addons/exporters/OBJExporter.js',
  './vendor/three/addons/exporters/PLYExporter.js', './vendor/three/addons/exporters/STLExporter.js',
  './icons/icon.svg'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => null)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
