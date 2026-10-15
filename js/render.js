/* =========================================================
   Render — componentes reaproveitáveis (fábricas de elemento).
   Nenhuma função aqui lê ou grava no store; recebem dados e
   callbacks prontos, e devolvem nós de DOM ou atualizam nós
   existentes. A lista de categorias (fixas + personalizadas)
   é sempre recebida por parâmetro, nunca importada fixa —
   assim um corredor criado pelo usuário aparece em todo lugar
   imediatamente, sem exceção.
   ========================================================= */

import { nomeCategoria } from './categorias.js';
import { UNIDADES } from './modelos.js';
import {
  totalItem, formatarMoeda, formatarQuantidade,
  TIPO_PRECO, ehUnidadeDeMedida, rotuloDoPreco, baseDaUnidade, tipoPrecoEfetivo
} from './calculo.js';
import { aplicarMascaraMoeda, definirValorMascarado, valorNumericoMascarado } from './mascara.js';

/**
 * Linha de item da lista — em modo leitura ou em modo edição.
 * @param {Item} item
 * @param {Categoria[]} todasCategorias
 * @param {{
 *   emEdicao: boolean,
 *   aoAlternar: (id: string) => void,
 *   aoExcluir: (id: string, nome: string) => void,
 *   aoIniciarEdicao: (id: string) => void,
 *   aoSalvarEdicao: (id: string, alteracoes: object) => void,
 *   aoCancelarEdicao: (id: string) => void
 * }} acoes
 * @returns {HTMLLIElement}
 */
export function criarLinhaItem(item, todasCategorias, acoes) {
  var li = document.createElement('li');
  li.className = 'item' + (item.feito ? ' item--feito' : '');
  li.dataset.id = item.id;

  if (acoes.emEdicao) {
    li.classList.add('item--edicao');
    li.appendChild(criarFormularioEdicao(item, todasCategorias, acoes.aoSalvarEdicao, acoes.aoCancelarEdicao));
    return li;
  }

  var marcar = document.createElement('button');
  marcar.type = 'button';
  marcar.className = 'item__marcar';
  marcar.textContent = '✓';
  marcar.setAttribute('aria-pressed', item.feito ? 'true' : 'false');
  marcar.setAttribute('aria-label', (item.feito ? 'Desmarcar ' : 'Marcar como comprado: ') + item.nome);
  marcar.addEventListener('click', function () { acoes.aoAlternar(item.id); });

  var corpo = document.createElement('button');
  corpo.type = 'button';
  corpo.className = 'item__corpo';
  corpo.setAttribute('aria-label', 'Editar ' + item.nome);
  corpo.addEventListener('click', function () { acoes.aoIniciarEdicao(item.id); });

  var nomeEl = document.createElement('span');
  nomeEl.className = 'item__nome';
  nomeEl.textContent = item.nome;

  var detalheEl = document.createElement('span');
  detalheEl.className = 'item__detalhe';
  var partes = [formatarQuantidade(item.quantidade) + ' ' + item.unidade, nomeCategoria(item.categoriaChave, todasCategorias)];
  if (item.precoInput != null) {
    var textoPreco = formatarMoeda(totalItem(item));
    if (item.tipoPreco === TIPO_PRECO.POR_KG_L) textoPreco += ' (' + formatarMoeda(item.precoInput) + '/' + baseDaUnidade(item.unidade) + ')';
    partes.push(textoPreco);
  }
  detalheEl.textContent = partes.join(' · ');

  corpo.appendChild(nomeEl);
  corpo.appendChild(detalheEl);

  var excluir = document.createElement('button');
  excluir.type = 'button';
  excluir.className = 'item__excluir';
  excluir.textContent = '×';
  excluir.setAttribute('aria-label', 'Excluir ' + item.nome);
  excluir.addEventListener('click', function () { acoes.aoExcluir(item.id, item.nome); });

  li.appendChild(marcar);
  li.appendChild(corpo);
  li.appendChild(excluir);

  if (acoes.arrastavel) {
    li.title = 'Mantenha pressionado e arraste para reordenar';
    var alca = document.createElement('span');
    alca.className = 'item__alca';
    alca.setAttribute('aria-hidden', 'true');
    alca.textContent = '⠿';
    li.appendChild(alca);
  }

  return li;
}

function criarCampoSelect(rotulo, opcoes, valorSelecionado, formatarOpcao) {
  var select = document.createElement('select');
  select.className = 'item__edicao-campo';
  select.setAttribute('aria-label', rotulo);
  opcoes.forEach(function (opcao) {
    var valor = formatarOpcao ? opcao.chave : opcao;
    var texto = formatarOpcao ? opcao.nome : opcao;
    var el = document.createElement('option');
    el.value = valor;
    el.textContent = texto;
    if (valor === valorSelecionado) el.selected = true;
    select.appendChild(el);
  });
  return select;
}

/**
 * Seletor de tipo de preço (só faz sentido para g/ml/kg/L):
 * "Preço fechado" (valor digitado = total da embalagem/etiqueta) ou
 * "Preço por kg/L" (proporcional à quantidade). Usado tanto no
 * formulário de adicionar quanto no de editar.
 * @param {string} tipoInicial
 * @param {string} unidadeInicial
 * @param {(tipo: string) => void} [aoMudar]
 */
export function criarSeletorTipoPreco(tipoInicial, unidadeInicial, aoMudar) {
  var el = document.createElement('div');
  el.className = 'seletor-preco';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'Tipo de preço');

  var tipoAtual = TIPO_PRECO.FECHADO;
  var botoes = {};

  function criarBotao(tipo, texto) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'seletor-preco__opcao';
    b.dataset.tipo = tipo;
    b.textContent = texto;
    b.addEventListener('click', function () { definir(tipo); if (aoMudar) aoMudar(tipo); });
    botoes[tipo] = b;
    el.appendChild(b);
  }

  function definir(tipo) {
    tipoAtual = tipo === TIPO_PRECO.POR_KG_L ? TIPO_PRECO.POR_KG_L : TIPO_PRECO.FECHADO;
    Object.keys(botoes).forEach(function (t) {
      botoes[t].setAttribute('aria-pressed', t === tipoAtual ? 'true' : 'false');
      botoes[t].classList.toggle('seletor-preco__opcao--ativa', t === tipoAtual);
    });
  }

  function definirUnidade(unidade) {
    el.hidden = !ehUnidadeDeMedida(unidade);
    botoes[TIPO_PRECO.POR_KG_L].textContent = 'Preço por ' + baseDaUnidade(unidade);
  }

  criarBotao(TIPO_PRECO.FECHADO, 'Preço fechado');
  criarBotao(TIPO_PRECO.POR_KG_L, 'Preço por kg');
  definir(tipoInicial);
  definirUnidade(unidadeInicial);

  return {
    el: el,
    obter: function () { return tipoAtual; },
    definir: definir,
    definirUnidade: definirUnidade
  };
}

function criarFormularioEdicao(item, todasCategorias, aoSalvar, aoCancelar) {
  var form = document.createElement('form');
  form.className = 'item__edicao';

  var campoNome = document.createElement('input');
  campoNome.type = 'text';
  campoNome.maxLength = 80;
  campoNome.value = item.nome;
  campoNome.className = 'item__edicao-campo item__edicao-campo--nome';
  campoNome.setAttribute('aria-label', 'Nome do produto');
  campoNome.required = true;

  var campoQtd = document.createElement('input');
  campoQtd.type = 'number';
  campoQtd.min = '0.01';
  campoQtd.step = 'any';
  campoQtd.value = String(item.quantidade);
  campoQtd.className = 'item__edicao-campo item__edicao-campo--numero';
  campoQtd.setAttribute('aria-label', 'Quantidade');

  var campoUnidade = criarCampoSelect('Unidade', UNIDADES, item.unidade);
  var campoCategoria = criarCampoSelect('Categoria', todasCategorias, item.categoriaChave, true);

  var campoPreco = document.createElement('input');
  campoPreco.type = 'text';
  campoPreco.inputMode = 'decimal';
  campoPreco.className = 'item__edicao-campo item__edicao-campo--numero';
  aplicarMascaraMoeda(campoPreco);
  definirValorMascarado(campoPreco, item.precoInput); // exatamente o que foi digitado

  var seletorTipo = criarSeletorTipoPreco(item.tipoPreco, item.unidade, atualizarRotuloPreco);

  function atualizarRotuloPreco() {
    var rotulo = rotuloDoPreco(campoUnidade.value, seletorTipo.obter());
    campoPreco.placeholder = rotulo;
    campoPreco.setAttribute('aria-label', rotulo);
  }
  atualizarRotuloPreco();
  campoUnidade.addEventListener('change', function () {
    seletorTipo.definirUnidade(campoUnidade.value);
    atualizarRotuloPreco();
  });

  var linha0 = document.createElement('div');
  linha0.className = 'item__edicao-linha';
  linha0.appendChild(campoNome);

  var linha1 = document.createElement('div');
  linha1.className = 'item__edicao-linha';
  linha1.appendChild(campoQtd);
  linha1.appendChild(campoUnidade);
  linha1.appendChild(campoCategoria);

  var linha2 = document.createElement('div');
  linha2.className = 'item__edicao-linha';
  linha2.appendChild(campoPreco);

  var linhaTipo = document.createElement('div');
  linhaTipo.className = 'item__edicao-linha';
  linhaTipo.appendChild(seletorTipo.el);

  var acoesEl = document.createElement('div');
  acoesEl.className = 'item__edicao-acoes';

  var salvar = document.createElement('button');
  salvar.type = 'submit';
  salvar.className = 'item__edicao-salvar';
  salvar.textContent = 'Salvar';

  var cancelar = document.createElement('button');
  cancelar.type = 'button';
  cancelar.className = 'item__edicao-cancelar';
  cancelar.textContent = 'Cancelar';
  cancelar.addEventListener('click', function () { aoCancelar(item.id); });

  acoesEl.appendChild(salvar);
  acoesEl.appendChild(cancelar);

  form.appendChild(linha0);
  form.appendChild(linha1);
  form.appendChild(linha2);
  form.appendChild(linhaTipo);
  form.appendChild(acoesEl);

  form.addEventListener('submit', function (evento) {
    evento.preventDefault();
    aoSalvar(item.id, {
      nome: campoNome.value,
      quantidade: campoQtd.value,
      unidade: campoUnidade.value,
      categoriaChave: campoCategoria.value,
      tipoPreco: tipoPrecoEfetivo(campoUnidade.value, seletorTipo.obter()),
      precoInput: valorNumericoMascarado(campoPreco)
    });
  });

  return form;
}

/**
 * Constrói o grupo inteiro de um corredor dentro da lista de
 * pendentes: um cabeçalho fixo e, logo abaixo, uma sublista
 * própria daquele corredor — é essa sublista que fica arrastável,
 * o que naturalmente impede um item de "vazar" pra outro corredor
 * só de arrastar (teria que reclassificar a categoria pra isso).
 * @param {string} categoriaChave
 * @param {Item[]} itensDaCategoria
 * @param {Categoria[]} todasCategorias
 * @param {string|null} itemEmEdicaoId - id do item em edição, se houver
 * @param {object} acoesItem - callbacks comuns (aoAlternar, aoExcluir, ...), sem emEdicao/arrastavel
 * @returns {HTMLLIElement}
 */
export function criarGrupoDeItens(categoriaChave, itensDaCategoria, todasCategorias, itemEmEdicaoId, acoesItem) {
  var li = document.createElement('li');
  li.className = 'item-grupo-container';

  var cabecalho = document.createElement('div');
  cabecalho.className = 'item-grupo';
  cabecalho.textContent = nomeCategoria(categoriaChave, todasCategorias);
  li.appendChild(cabecalho);

  var sublista = document.createElement('ul');
  sublista.className = 'item-grupo-lista';
  sublista.dataset.categoria = categoriaChave;

  itensDaCategoria.forEach(function (item) {
    var acoesDoItem = Object.assign({ emEdicao: item.id === itemEmEdicaoId, arrastavel: true }, acoesItem);
    sublista.appendChild(criarLinhaItem(item, todasCategorias, acoesDoItem));
  });

  li.appendChild(sublista);
  return li;
}

/**
 * Atualiza o painel financeiro fixo com total, saldo e alerta.
 * @param {HTMLElement} el
 * @param {{total: number, orcamento: number|null, saldo: number|null, status: string}} dados
 */
export function renderPainelFinanceiro(el, dados) {
  el.dataset.status = dados.status;
  el.querySelector('[data-total]').textContent = formatarMoeda(dados.total);

  var saldoEl = el.querySelector('[data-saldo]');
  var linhaSaldo = el.querySelector('[data-linha-saldo]');
  if (dados.saldo == null) {
    linhaSaldo.hidden = true;
    saldoEl.textContent = ''; // nunca deixa um valor antigo "preso" no DOM, mesmo se o CSS falhar
  } else {
    linhaSaldo.hidden = false;
    saldoEl.textContent = formatarMoeda(dados.saldo);
  }

  var badge = el.querySelector('[data-badge]');
  if (dados.status === 'alerta' || dados.status === 'estourado') {
    badge.hidden = false;
    badge.textContent = dados.status === 'estourado' ? 'Orçamento estourado' : 'Perto do limite';
  } else {
    badge.hidden = true;
  }
}

/**
 * Redesenha a lista reordenável de corredores (Ordenação de Corredores).
 * A reordenação em si é ligada externamente (script.js chama
 * tornarOrdenavel no elemento .corredores__lista já montado aqui)
 * — por isso esta função não recebe mais callbacks de mover.
 * @param {HTMLElement} el
 * @param {string[]} layoutAtual
 * @param {Categoria[]} todasCategorias
 */
/**
 * Redesenha a lista reordenável de corredores (Ordenação de Corredores).
 * Corredores personalizados ganham "Renomear"/"Excluir"; os fixos do
 * sistema (Hortifrúti, Padaria etc.) ficam só com o nome e a alça —
 * são o padrão compartilhado, não "seus" pra editar ou remover.
 * @param {HTMLElement} el
 * @param {string[]} layoutAtual
 * @param {Categoria[]} todasCategorias
 * @param {Set<string>} chavesPersonalizadas
 * @param {{aoRenomear:Function, aoExcluir:Function}} acoes
 */
export function renderPainelCorredores(el, layoutAtual, todasCategorias, chavesPersonalizadas, acoes) {
  el.textContent = '';

  var lista = document.createElement('ol');
  lista.className = 'corredores__lista';

  layoutAtual.forEach(function (chave) {
    var ehPersonalizado = chavesPersonalizadas.has(chave);
    var nome = nomeCategoria(chave, todasCategorias);

    var li = document.createElement('li');
    li.className = 'corredores__item';
    li.dataset.id = chave;
    li.title = 'Mantenha pressionado a alça e arraste para reordenar';

    var alca = document.createElement('span');
    alca.className = 'corredores__alca';
    alca.setAttribute('aria-hidden', 'true');
    alca.textContent = '⠿';

    var nomeEl = document.createElement('span');
    nomeEl.className = 'corredores__nome';
    nomeEl.textContent = nome;

    li.appendChild(alca);
    li.appendChild(nomeEl);

    if (ehPersonalizado) {
      var botaoRenomear = document.createElement('button');
      botaoRenomear.type = 'button';
      botaoRenomear.className = 'corredores__acao';
      botaoRenomear.textContent = 'Renomear';
      botaoRenomear.addEventListener('click', function () { acoes.aoRenomear(chave, nome); });

      var botaoExcluir = document.createElement('button');
      botaoExcluir.type = 'button';
      botaoExcluir.className = 'corredores__acao corredores__acao--excluir';
      botaoExcluir.textContent = 'Excluir';
      botaoExcluir.addEventListener('click', function () { acoes.aoExcluir(chave, nome); });

      li.appendChild(botaoRenomear);
      li.appendChild(botaoExcluir);
    }

    lista.appendChild(li);
  });

  el.appendChild(lista);
}

/**
 * Lista de listas (tela "Minhas Listas"): cada uma com botão de
 * ativar, renomear e excluir.
 * @param {HTMLElement} el
 * @param {Array<{id:string, nome:string}>} listas
 * @param {string} listaAtivaId
 * @param {{aoAlternar:Function, aoRenomear:Function, aoExcluir:Function}} acoes
 */
/**
 * Redesenha a barra horizontal deslizante de abas de listas. Cada aba
 * é um <div> (não-interativo) contendo um ou dois <button> IRMÃOS —
 * nunca um botão dentro de outro botão, que é inválido em HTML e
 * quebra de formas imprevisíveis em leitores de tela. A aba ATIVA
 * ganha um segundo botão, "⋮" (opções), pra renomear/excluir.
 * @param {HTMLElement} el
 * @param {Array<{id:string,nome:string}>} listas
 * @param {string} listaAtivaId
 * @param {{aoAlternar:Function, aoAbrirOpcoes:Function, aoCriarNova:Function}} acoes
 */
/**
 * Redesenha a tela de gerenciamento de pastas: cada pasta é uma
 * linha com botão de ativar (o nome) + Renomear + Excluir — mesmo
 * padrão usado nas listas, um nível acima na hierarquia.
 * @param {HTMLElement} el
 * @param {Array<{id:string,nome:string}>} pastas
 * @param {string} pastaAtivaId
 * @param {{aoAlternar:Function, aoRenomear:Function, aoExcluir:Function}} acoes
 */
export function renderPainelPastas(el, pastas, pastaAtivaId, acoes) {
  el.textContent = '';
  var ul = document.createElement('ul');
  ul.className = 'pastas__lista';

  pastas.forEach(function (pasta) {
    var li = document.createElement('li');
    li.className = 'pastas__item' + (pasta.id === pastaAtivaId ? ' pastas__item--ativa' : '');

    var botaoAtivar = document.createElement('button');
    botaoAtivar.type = 'button';
    botaoAtivar.className = 'pastas__nome';
    botaoAtivar.textContent = pasta.nome;
    if (pasta.id === pastaAtivaId) botaoAtivar.setAttribute('aria-current', 'true');
    botaoAtivar.addEventListener('click', function () { acoes.aoAlternar(pasta.id); });

    var botaoRenomear = document.createElement('button');
    botaoRenomear.type = 'button';
    botaoRenomear.className = 'pastas__acao';
    botaoRenomear.textContent = 'Renomear';
    botaoRenomear.addEventListener('click', function () { acoes.aoRenomear(pasta.id, pasta.nome); });

    var botaoExcluir = document.createElement('button');
    botaoExcluir.type = 'button';
    botaoExcluir.className = 'pastas__acao pastas__acao--excluir';
    botaoExcluir.textContent = 'Excluir';
    botaoExcluir.disabled = pastas.length <= 1;
    botaoExcluir.addEventListener('click', function () { acoes.aoExcluir(pasta.id, pasta.nome); });

    li.appendChild(botaoAtivar);
    li.appendChild(botaoRenomear);
    li.appendChild(botaoExcluir);
    ul.appendChild(li);
  });

  el.appendChild(ul);
}

export function renderAbasDeListas(el, listas, listaAtivaId, acoes) {
  el.textContent = '';

  listas.forEach(function (lista) {
    var ativa = lista.id === listaAtivaId;

    var aba = document.createElement('div');
    aba.className = 'aba-lista' + (ativa ? ' aba-lista--ativa' : '');
    aba.setAttribute('role', 'presentation');

    var botaoNome = document.createElement('button');
    botaoNome.type = 'button';
    botaoNome.className = 'aba-lista__nome';
    botaoNome.textContent = lista.nome;
    botaoNome.setAttribute('role', 'tab');
    botaoNome.setAttribute('aria-selected', ativa ? 'true' : 'false');
    botaoNome.addEventListener('click', function () { acoes.aoAlternar(lista.id); });
    aba.appendChild(botaoNome);

    if (ativa) {
      var botaoOpcoes = document.createElement('button');
      botaoOpcoes.type = 'button';
      botaoOpcoes.className = 'aba-lista__opcoes';
      botaoOpcoes.textContent = '⋮';
      botaoOpcoes.setAttribute('aria-label', 'Opções da lista ' + lista.nome);
      botaoOpcoes.addEventListener('click', function () { acoes.aoAbrirOpcoes(lista.id, lista.nome); });
      aba.appendChild(botaoOpcoes);
    }

    el.appendChild(aba);
  });

  var abaNova = document.createElement('div');
  abaNova.className = 'aba-lista aba-lista--nova';
  var botaoNova = document.createElement('button');
  botaoNova.type = 'button';
  botaoNova.className = 'aba-lista__nome';
  botaoNova.textContent = '+ Nova Lista';
  botaoNova.addEventListener('click', function () { acoes.aoCriarNova(); });
  abaNova.appendChild(botaoNova);
  el.appendChild(abaNova);
}

/**
 * Dropdown de sugestões do autocompletar, posicionado logo
 * abaixo do campo de nome do produto.
 * @param {HTMLElement} el
 * @param {Array<{nome:string, categoriaChave:string, unidade:string}>} sugestoes
 * @param {(sugestao: object) => void} aoEscolher
 */
export function renderSugestoes(el, sugestoes, aoEscolher) {
  el.textContent = '';
  el.hidden = sugestoes.length === 0;
  if (sugestoes.length === 0) return;

  sugestoes.forEach(function (sugestao) {
    var botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'sugestoes__item';
    botao.textContent = sugestao.nome;
    // usa mousedown (dispara antes do blur do campo de texto) para o clique não ser perdido
    botao.addEventListener('mousedown', function (evento) {
      evento.preventDefault();
      aoEscolher(sugestao);
    });
    el.appendChild(botao);
  });
}
