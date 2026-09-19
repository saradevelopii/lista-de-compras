/* =========================================================
   Categorias e ordenação por corredor (index_corredor)
   ========================================================= */

/** @type {Categoria[]} */
export const CATEGORIAS = [
  { chave: 'hortifruti', nome: 'Hortifrúti' },
  { chave: 'padaria', nome: 'Padaria' },
  { chave: 'laticinios', nome: 'Laticínios e frios' },
  { chave: 'carnes', nome: 'Carnes e peixes' },
  { chave: 'mercearia', nome: 'Mercearia' },
  { chave: 'bebidas', nome: 'Bebidas' },
  { chave: 'limpeza', nome: 'Limpeza' },
  { chave: 'higiene', nome: 'Higiene e farmácia' },
  { chave: 'outros', nome: 'Outros' }
];

var CHAVES_VALIDAS = CATEGORIAS.map(function (c) { return c.chave; });

/**
 * Ordem física padrão dos corredores — ponto de partida para
 * a "Ordenação de Corredores"; o usuário pode reorganizar
 * livremente a partir daqui.
 */
export var ORDEM_PADRAO = ['hortifruti', 'padaria', 'laticinios', 'carnes', 'mercearia', 'bebidas', 'limpeza', 'higiene', 'outros'];

export function nomeCategoria(chave) {
  for (var i = 0; i < CATEGORIAS.length; i++) {
    if (CATEGORIAS[i].chave === chave) return CATEGORIAS[i].nome;
  }
  return 'Outros';
}

/**
 * Garante que uma lista de chaves seja uma permutação válida de
 * todas as categorias conhecidas — protege contra layout salvo
 * corrompido ou de uma versão antiga do app.
 * @param {string[]} chaves
 * @returns {string[]}
 */
export function sanearLayout(chaves) {
  if (!Array.isArray(chaves)) return ORDEM_PADRAO.slice();
  var validas = chaves.filter(function (c) { return CHAVES_VALIDAS.indexOf(c) !== -1; });
  var faltantes = CHAVES_VALIDAS.filter(function (c) { return validas.indexOf(c) === -1; });
  var completo = validas.concat(faltantes);
  return completo.length === CHAVES_VALIDAS.length ? completo : ORDEM_PADRAO.slice();
}

/**
 * Ordena itens pela posição de sua categoria na rota de loja atual
 * (index_corredor); dentro da mesma categoria, mantém a ordem de
 * criação. Categoria desconhecida vai para o fim.
 * @param {Item[]} itens
 * @param {string[]} ordemChaves
 * @returns {Item[]}
 */
export function ordenarPorCorredor(itens, ordemChaves) {
  var indice = {};
  ordemChaves.forEach(function (chave, i) { indice[chave] = i; });

  return itens.slice().sort(function (a, b) {
    var ia = indice.hasOwnProperty(a.categoriaChave) ? indice[a.categoriaChave] : ordemChaves.length;
    var ib = indice.hasOwnProperty(b.categoriaChave) ? indice[b.categoriaChave] : ordemChaves.length;
    if (ia !== ib) return ia - ib;
    return a.criadoEm - b.criadoEm;
  });
}
