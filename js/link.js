/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// link de compartilhamento pelo hash da url (#lista=ID), que funciona em qualquer host
// estático, github pages incluso, sem configurar rota

export function gerarLinkCompartilhavel(listaId) {
  var base = window.location.origin + window.location.pathname;
  return base + '#lista=' + encodeURIComponent(listaId);
}

export function obterListaIdDaURL() {
  var hash = window.location.hash || '';
  var casamento = hash.match(/lista=([^&]+)/);
  return casamento ? decodeURIComponent(casamento[1]) : null;
}

// tira o #lista=... da url depois de usar, pra não processar de novo
export function limparListaIdDaURL() {
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
