/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// histórico de produtos pro autocompletar. a chave é o nome normalizado (minúsculo, sem
// acento), então Café e café contam como o mesmo

function normalizar(nome) {
  return String(nome || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// conta mais um uso do produto. devolve um objeto novo
export function registrarUso(historico, item) {
  var chave = normalizar(item.nome);
  if (!chave) return historico;

  var atual = historico[chave];
  var novo = Object.assign({}, historico);
  novo[chave] = {
    nome: item.nome, // guarda a grafia mais recente, do jeito que a pessoa digitou
    categoriaChave: item.categoriaChave,
    unidade: item.unidade,
    contagem: (atual ? atual.contagem : 0) + 1,
    ultimoUso: Date.now()
  };
  return novo;
}

// sugestões que contêm o texto, do mais usado pro menos; empate vai pelo uso mais recente
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
