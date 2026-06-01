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

// Evento de Instalação: Armazena em cache todos os ativos estáticos iniciais
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Evento de Ativação: Limpa caches antigos quando há alteração na versão (CACHE_NAME)
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

// Evento de Requisição (Fetch): Tenta buscar na rede e atualiza o cache, caindo para o cache em caso de falha (off-line)
self.addEventListener('fetch', (e) => {
  // Ignora requisições não-GET e chamadas de API do próprio backend
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request).then((res) => {
      // Ignora respostas que não sejam de sucesso (status 200) para evitar cache corrompido
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
