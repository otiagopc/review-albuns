const CACHE_NAME = 'loopd-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/logo.svg',
  './icons/logo-bg.svg'
];

// salva no cache os arquivos iniciais
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// limpa caches antigos se mudar a versao
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// busca da rede, atualiza o cache e usa o cache se falhar
self.addEventListener('fetch', (e) => {
  // ignora chamadas que nao sao get ou sao da api
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request).then((res) => {
      // ignora erros para nao salvar cache quebrado
      if (!res || res.status !== 200 || res.type !== 'basic') {
        return res;
      }

      const resClone = res.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(e.request, resClone);
      });
      return res;
    }).catch(() => {
      return caches.match(e.request);
    })
  );
});
