/* =========================================================
   Qlista — Service Worker
   Cache-first: tudo do projeto fica salvo na instalação.
   Troque a versão abaixo sempre que alterar algum arquivo.
   ========================================================= */

var VERSAO = 'qlista-v21';

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
  './js/identidade.js',
  './js/historico.js',
  './js/compartilhar.js',
  './js/link.js',
  './js/ordenacao.js',
  './js/firebaseSync.js',
  './js/firebase-config.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

// Recursos de CDN externo: cacheados em "melhor esforço". Se o CDN
// estiver fora do ar ou bloqueado no momento da instalação, isso NÃO
// pode derrubar o pré-cache dos arquivos próprios — o app inteiro não
// deveria depender da disponibilidade de um domínio de terceiros.
var ARQUIVOS_EXTERNOS = [
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js'
];

// Instalação: baixa e guarda todos os arquivos, e já assume o
// controle sozinho assim que terminar (skipWaiting automático) —
// a atualização é 100% automática, sem precisar de nenhum clique.
// A pequena troca: se alguém estiver digitando algo bem na hora
// em que a nova versão assume, o texto não salvo daquele campo
// pode se perder no recarregamento — itens já adicionados não são
// afetados, só o que estava sendo digitado naquele instante.
self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(VERSAO).then(function (cache) {
      return cache.addAll(ARQUIVOS).then(function () {
        return Promise.all(ARQUIVOS_EXTERNOS.map(function (url) {
          return cache.add(url).catch(function (erro) {
            console.warn('Não foi possível pré-cachear o recurso externo (segue sem ele por enquanto):', url, erro);
          });
        }));
      });
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
