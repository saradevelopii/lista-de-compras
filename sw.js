/* =========================================================
   Sacola — Service Worker
   Cache-first: tudo do projeto fica salvo na instalação.
   Troque a versão abaixo sempre que alterar algum arquivo.
   ========================================================= */

var VERSAO = 'sacola-v7';

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
  './js/historico.js',
  './js/compartilhar.js',
  './js/link.js',
  './js/firebaseSync.js',
  './js/firebase-config.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

// Instalação: baixa e guarda todos os arquivos, mas NÃO assume o
// controle sozinho — fica em espera até o cliente pedir (ver
// listener de 'message' abaixo), disparado pelo banner "Atualizar"
// em script.js. Assim a pessoa nunca perde o que estava digitando
// por uma troca de versão no meio do uso.
self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(VERSAO).then(function (cache) {
      return cache.addAll(ARQUIVOS);
    })
  );
});

// Permite que a página peça para este Service Worker (em espera)
// assumir o controle imediatamente, sem precisar fechar o app.
self.addEventListener('message', function (evento) {
  if (evento.data && evento.data.tipo === 'ativar-agora') {
    self.skipWaiting();
  }
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
