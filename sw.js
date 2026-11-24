/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// service worker do qlista. cache-first: guarda tudo na instalação. mudar a versão abaixo
// sempre que alterar algum arquivo

var VERSAO = 'qlista-v36';

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

// cdn externo é melhor esforço: se estiver fora do ar na instalação, isso não pode derrubar o
// cache dos arquivos do app
var ARQUIVOS_EXTERNOS = [
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js',
  // sdk do firebase (mesma versão do firebaseSync.js). sem ele, abrir sem rede deixava a
  // sincronização morta até recarregar
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js'
];

// módulos que o sdk importa por dentro (nomes que não dá pra saber antes) são guardados na
// primeira vez que carregam
function ehModuloDoFirebase(url) {
  return url.indexOf('https://www.gstatic.com/firebasejs/') === 0;
}

// instalação: guarda os arquivos e assume o controle sozinho (skipWaiting), então a atualização
// é automática. o custo: se alguém estiver digitando na hora que a versão nova assume, o texto
// do campo se perde no recarregamento; itens já adicionados não
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

// ativação: apaga caches de versões antigas
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

// busca: responde do cache e, sem ele, vai pra rede
self.addEventListener('fetch', function (evento) {
  var requisicao = evento.request;

  if (requisicao.method !== 'GET') return;

  // navegação sem rede devolve a página inicial do cache
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
        // guarda cópia nova só do mesmo domínio
        var guardavel = daRede && daRede.status === 200 &&
          (daRede.type === 'basic' || (daRede.type === 'cors' && ehModuloDoFirebase(requisicao.url)));
        if (guardavel) {
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
