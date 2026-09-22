/* =========================================================
   Categorias e ordenação por corredor (index_corredor).
   Suporta corredores fixos (do sistema) e personalizados
   (criados pelo usuário) combinados em uma única lista.
   ========================================================= */

/** @type {Categoria[]} */
export var CATEGORIAS_FIXAS = [
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

/** Ordem física padrão — derivada da própria lista fixa, sem duplicar dados. */
export var ORDEM_PADRAO = CATEGORIAS_FIXAS.map(function (c) { return c.chave; });

/**
 * @param {Categoria[]} personalizadas
 * @returns {Categoria[]} fixas + personalizadas, nessa ordem
 */
export function combinarCategorias(personalizadas) {
  return CATEGORIAS_FIXAS.concat(Array.isArray(personalizadas) ? personalizadas : []);
}

/**
 * @param {string} chave
 * @param {Categoria[]} [todasCategorias] - default: só as fixas
 * @returns {string}
 */
export function nomeCategoria(chave, todasCategorias) {
  var lista = todasCategorias || CATEGORIAS_FIXAS;
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].chave === chave) return lista[i].nome;
  }
  return 'Outros';
}

/**
 * Deriva uma chave estável (sem acento, minúscula, com prefixo
 * "p-" de "personalizada") a partir do nome digitado, garantindo
 * que não colida com nenhuma chave já existente.
 * @param {string} nome
 * @param {string[]} chavesExistentes
 * @returns {string}
 */
export function gerarChaveCategoria(nome, chavesExistentes) {
  var base = 'p-' + String(nome)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  if (!base || base === 'p-') base = 'p-corredor';

  var chave = base;
  var sufixo = 2;
  while (chavesExistentes.indexOf(chave) !== -1) {
    chave = base + '-' + sufixo;
    sufixo++;
  }
  return chave;
}

/**
 * Ordena itens pela posição de sua categoria na rota de loja atual
 * (index_corredor); dentro da mesma categoria, mantém a ordem de
 * criação. Categoria fora da rota atual vai para o fim.
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

/**
 * Garante que uma ordem de corredores seja uma permutação exata
 * do conjunto de chaves válidas atual (fixas + personalizadas):
 * mantém as que já estavam na ordem salva e acrescenta ao fim
 * qualquer chave válida que ainda não apareça nela (por exemplo,
 * um corredor personalizado recém-criado).
 * @param {string[]} layoutAtual
 * @param {string[]} chavesValidas
 * @returns {string[]}
 */
export function sanearLayout(layoutAtual, chavesValidas) {
  var lista = Array.isArray(layoutAtual) ? layoutAtual : [];
  var presentes = lista.filter(function (c) { return chavesValidas.indexOf(c) !== -1; });
  var faltantes = chavesValidas.filter(function (c) { return presentes.indexOf(c) === -1; });
  return presentes.concat(faltantes);
}
