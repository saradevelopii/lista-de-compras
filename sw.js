/* =========================================================
   Sacola — Service Worker
   Cache-first: tudo do projeto fica salvo na instalação.
   Troque a versão abaixo sempre que alterar algum arquivo.
   ========================================================= */

var VERSAO = 'sacola-v4';

var ARQUIVOS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './js/modelos.js',
  './js/categorias.js',
  './js/calculo.js',
  './js/armazenamento.js',
  './js/loja.js',
  './js/render.js',
  './js/mascara.js',
  './js/dialogo.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

// Instalação: baixa e guarda todos os arquivos
self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(VERSAO).then(function (cache) {
      return cache.addAll(ARQUIVOS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// Ativação: apaga caches de versões antigas
self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then(function (chaves) {
      return Promise.all(
        chaves.map(function (chave) {
          if (chave !== VERSAO) return caches.delete(chave);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Busca: responde do cache e, se não houver, vai à rede
self.addEventListener('fetch', function (evento) {
  var requisicao = evento.request;

  if (requisicao.method !== 'GET') return;

  // Navegação: sem rede, devolve a página inicial já cacheada
  if (requisicao.mode === 'navigate') {
    evento.respondWith(
      fetch(requisicao).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  evento.respondWith(
    caches.match(requisicao).then(function (resposta) {
      if (resposta) return resposta;

      return fetch(requisicao).then(function (daRede) {
        // Guarda cópias novas do mesmo domínio
        if (daRede && daRede.status === 200 && daRede.type === 'basic') {
          var copia = daRede.clone();
          caches.open(VERSAO).then(function (cache) {
            cache.put(requisicao, copia);
          });
        }
        return daRede;
      });
    })
  );
});
