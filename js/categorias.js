/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// categorias e ordem dos corredores. mistura os corredores fixos (do sistema) com os
// personalizados (do usuário)

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

// ordem física padrão, tirada da própria lista fixa
export var ORDEM_PADRAO = CATEGORIAS_FIXAS.map(function (c) { return c.chave; });

export function combinarCategorias(personalizadas) {
  return CATEGORIAS_FIXAS.concat(Array.isArray(personalizadas) ? personalizadas : []);
}

export function nomeCategoria(chave, todasCategorias) {
  var lista = todasCategorias || CATEGORIAS_FIXAS;
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].chave === chave) return lista[i].nome;
  }
  return 'Outros';
}

// gera uma chave estável (sem acento, minúscula, prefixo p-) a partir do nome e garante que não
// repete nenhuma existente
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

// ordena pela posição da categoria na rota da loja; na mesma categoria mantém a ordem de
// criação; categoria fora da rota vai pro fim
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

// garante que a ordem de corredores tenha exatamente as chaves válidas: mantém as que já
// estavam e põe no fim as que faltam (ex: corredor recém criado)
export function sanearLayout(layoutAtual, chavesValidas) {
  var lista = Array.isArray(layoutAtual) ? layoutAtual : [];
  var presentes = lista.filter(function (c) { return chavesValidas.indexOf(c) !== -1; });
  var faltantes = chavesValidas.filter(function (c) { return presentes.indexOf(c) === -1; });
  return presentes.concat(faltantes);
}
