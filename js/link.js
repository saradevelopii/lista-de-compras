/* =========================================================
   Link compartilhável — usa o hash da URL (#lista=ID), não o
   caminho nem query string, para funcionar em qualquer host
   estático (GitHub Pages incluso) sem configuração de rotas.
   ========================================================= */

/**
 * @param {string} listaId
 * @returns {string}
 */
export function gerarLinkCompartilhavel(listaId) {
  var base = window.location.origin + window.location.pathname;
  return base + '#lista=' + encodeURIComponent(listaId);
}

/**
 * @returns {string|null} o id da lista presente na URL atual, se houver
 */
export function obterListaIdDaURL() {
  var hash = window.location.hash || '';
  var casamento = hash.match(/lista=([^&]+)/);
  return casamento ? decodeURIComponent(casamento[1]) : null;
}

/**
 * Remove o #lista=... da URL depois de já ter sido consumido,
 * para não reprocessar ao navegar dentro do próprio app.
 */
export function limparListaIdDaURL() {
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
