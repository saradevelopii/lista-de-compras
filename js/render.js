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
import { totalItem, formatarMoeda, formatarQuantidade } from './calculo.js';
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
  if (item.precoUnitario != null) partes.push(formatarMoeda(totalItem(item)));
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
  campoPreco.placeholder = 'Preço por unidade';
  campoPreco.className = 'item__edicao-campo item__edicao-campo--numero';
  campoPreco.setAttribute('aria-label', 'Preço unitário estimado ou real');
  aplicarMascaraMoeda(campoPreco);
  definirValorMascarado(campoPreco, item.precoUnitario);

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
  form.appendChild(acoesEl);

  form.addEventListener('submit', function (evento) {
    evento.preventDefault();
    aoSalvar(item.id, {
      nome: campoNome.value,
      quantidade: campoQtd.value,
      unidade: campoUnidade.value,
      categoriaChave: campoCategoria.value,
      precoUnitario: valorNumericoMascarado(campoPreco)
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
export function renderPainelCorredores(el, layoutAtual, todasCategorias) {
  el.textContent = '';

  var lista = document.createElement('ol');
  lista.className = 'corredores__lista';

  layoutAtual.forEach(function (chave) {
    var li = document.createElement('li');
    li.className = 'corredores__item';
    li.dataset.id = chave;
    li.title = 'Mantenha pressionado e arraste para reordenar';

    var alca = document.createElement('span');
    alca.className = 'corredores__alca';
    alca.setAttribute('aria-hidden', 'true');
    alca.textContent = '⠿';

    var nomeEl = document.createElement('span');
    nomeEl.className = 'corredores__nome';
    nomeEl.textContent = nomeCategoria(chave, todasCategorias);

    li.appendChild(alca);
    li.appendChild(nomeEl);
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
export function renderListaDeListas(el, listas, listaAtivaId, acoes) {
  el.textContent = '';
  var ul = document.createElement('ul');
  ul.className = 'listas__lista';

  listas.forEach(function (lista) {
    var li = document.createElement('li');
    li.className = 'listas__item' + (lista.id === listaAtivaId ? ' listas__item--ativa' : '');

    var botaoAtivar = document.createElement('button');
    botaoAtivar.type = 'button';
    botaoAtivar.className = 'listas__nome';
    botaoAtivar.textContent = lista.nome;
    if (lista.id === listaAtivaId) botaoAtivar.setAttribute('aria-current', 'true');
    botaoAtivar.addEventListener('click', function () { acoes.aoAlternar(lista.id); });

    var botaoRenomear = document.createElement('button');
    botaoRenomear.type = 'button';
    botaoRenomear.className = 'listas__acao';
    botaoRenomear.textContent = 'Renomear';
    botaoRenomear.addEventListener('click', function () { acoes.aoRenomear(lista.id, lista.nome); });

    var botaoExcluir = document.createElement('button');
    botaoExcluir.type = 'button';
    botaoExcluir.className = 'listas__acao listas__acao--excluir';
    botaoExcluir.textContent = 'Excluir';
    botaoExcluir.disabled = listas.length <= 1;
    botaoExcluir.addEventListener('click', function () { acoes.aoExcluir(lista.id, lista.nome); });

    li.appendChild(botaoAtivar);
    li.appendChild(botaoRenomear);
    li.appendChild(botaoExcluir);
    ul.appendChild(li);
  });

  el.appendChild(ul);
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
