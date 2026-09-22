/* =========================================================
   Histórico de produtos — funções puras que operam sobre o
   objeto carregado/salvo por armazenamento.js. Cada entrada é
   chaveada pelo nome normalizado (minúsculo, sem acento) do
   produto, para que "Café" e "café" contem como o mesmo item.
   ========================================================= */

function normalizar(nome) {
  return String(nome || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Registra (ou incrementa) o uso de um produto no histórico.
 * Imutável: retorna um novo objeto, não modifica o recebido.
 * @param {Object} historico
 * @param {{nome: string, categoriaChave: string, unidade: string}} item
 * @returns {Object}
 */
export function registrarUso(historico, item) {
  var chave = normalizar(item.nome);
  if (!chave) return historico;

  var atual = historico[chave];
  var novo = Object.assign({}, historico);
  novo[chave] = {
    nome: item.nome, // guarda a grafia mais recente (maiúsculas/acentos como o usuário digitou)
    categoriaChave: item.categoriaChave,
    unidade: item.unidade,
    contagem: (atual ? atual.contagem : 0) + 1,
    ultimoUso: Date.now()
  };
  return novo;
}

/**
 * Busca sugestões que contenham o texto digitado, ordenadas por
 * frequência de uso (mais usado primeiro) e, em empate, pelo uso
 * mais recente.
 * @param {Object} historico
 * @param {string} textoDigitado
 * @param {number} [limite]
 * @returns {Array<{nome: string, categoriaChave: string, unidade: string, contagem: number}>}
 */
export function buscarSugestoes(historico, textoDigitado, limite) {
  var termo = normalizar(textoDigitado);
  if (!termo) return [];

  return Object.keys(historico)
    .filter(function (chave) { return chave.indexOf(termo) !== -1; })
    .map(function (chave) { return historico[chave]; })
    .sort(function (a, b) {
      if (b.contagem !== a.contagem) return b.contagem - a.contagem;
      return b.ultimoUso - a.ultimoUso;
    })
    .slice(0, limite || 6);
}
