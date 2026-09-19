/* =========================================================
   Render — componentes reaproveitáveis (fábricas de elemento).
   Nenhuma função aqui lê ou grava no store; recebem dados e
   callbacks prontos, e devolvem nós de DOM ou atualizam nós
   existentes. Isso é o que as torna reaproveitáveis e testáveis.
   ========================================================= */

import { CATEGORIAS, nomeCategoria } from './categorias.js';
import { UNIDADES } from './modelos.js';
import { totalItem, formatarMoeda, formatarQuantidade } from './calculo.js';
import { aplicarMascaraMoeda, definirValorMascarado, valorNumericoMascarado } from './mascara.js';

/**
 * Linha de item da lista — em modo leitura ou em modo edição.
 * @param {Item} item
 * @param {{
 *   emEdicao: boolean,
 *   aoAlternar: (id: string) => void,
 *   aoExcluir: (id: string) => void,
 *   aoIniciarEdicao: (id: string) => void,
 *   aoSalvarEdicao: (id: string, alteracoes: object) => void,
 *   aoCancelarEdicao: (id: string) => void
 * }} acoes
 * @returns {HTMLLIElement}
 */
export function criarLinhaItem(item, acoes) {
  var li = document.createElement('li');
  li.className = 'item' + (item.feito ? ' item--feito' : '');
  li.dataset.id = item.id;

  if (acoes.emEdicao) {
    li.classList.add('item--edicao');
    li.appendChild(criarFormularioEdicao(item, acoes.aoSalvarEdicao, acoes.aoCancelarEdicao));
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
  var partes = [formatarQuantidade(item.quantidade) + ' ' + item.unidade, nomeCategoria(item.categoriaChave)];
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

function criarFormularioEdicao(item, aoSalvar, aoCancelar) {
  var form = document.createElement('form');
  form.className = 'item__edicao';

  var titulo = document.createElement('p');
  titulo.className = 'item__edicao-titulo';
  titulo.appendChild(document.createTextNode('Editando: '));
  var nomeForte = document.createElement('strong');
  nomeForte.textContent = item.nome;
  titulo.appendChild(nomeForte);

  var campoQtd = document.createElement('input');
  campoQtd.type = 'number';
  campoQtd.min = '0.01';
  campoQtd.step = 'any';
  campoQtd.value = String(item.quantidade);
  campoQtd.className = 'item__edicao-campo item__edicao-campo--numero';
  campoQtd.setAttribute('aria-label', 'Quantidade');

  var campoUnidade = criarCampoSelect('Unidade', UNIDADES, item.unidade);
  var campoCategoria = criarCampoSelect('Categoria', CATEGORIAS, item.categoriaChave, true);

  var campoPreco = document.createElement('input');
  campoPreco.type = 'text';
  campoPreco.inputMode = 'decimal';
  campoPreco.placeholder = 'Preço por unidade';
  campoPreco.className = 'item__edicao-campo item__edicao-campo--numero';
  campoPreco.setAttribute('aria-label', 'Preço unitário estimado ou real');
  aplicarMascaraMoeda(campoPreco);
  definirValorMascarado(campoPreco, item.precoUnitario);

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

  form.appendChild(titulo);
  form.appendChild(linha1);
  form.appendChild(linha2);
  form.appendChild(acoesEl);

  form.addEventListener('submit', function (evento) {
    evento.preventDefault();
    aoSalvar(item.id, {
      quantidade: campoQtd.value,
      unidade: campoUnidade.value,
      categoriaChave: campoCategoria.value,
      precoUnitario: valorNumericoMascarado(campoPreco)
    });
  });

  return form;
}

/**
 * Cabeçalho de grupo dentro da lista de pendentes — uma
 * categoria/corredor, na posição definida pelo layout atual.
 */
export function criarCabecalhoGrupo(categoriaChave) {
  var li = document.createElement('li');
  li.className = 'item-grupo';
  li.textContent = nomeCategoria(categoriaChave);
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
 * @param {HTMLElement} el
 * @param {string[]} layoutAtual
 * @param {{aoMover: (indice: number, direcao: number) => void}} acoes
 */
export function renderPainelCorredores(el, layoutAtual, acoes) {
  el.textContent = '';

  var lista = document.createElement('ol');
  lista.className = 'corredores__lista';

  layoutAtual.forEach(function (chave, indice) {
    var li = document.createElement('li');
    li.className = 'corredores__item';

    var nomeEl = document.createElement('span');
    nomeEl.textContent = nomeCategoria(chave);

    var controles = document.createElement('div');
    controles.className = 'corredores__controles';

    var cima = document.createElement('button');
    cima.type = 'button';
    cima.textContent = '↑';
    cima.disabled = indice === 0;
    cima.setAttribute('aria-label', 'Mover ' + nomeCategoria(chave) + ' para cima na rota');
    cima.addEventListener('click', function () { acoes.aoMover(indice, -1); });

    var baixo = document.createElement('button');
    baixo.type = 'button';
    baixo.textContent = '↓';
    baixo.disabled = indice === layoutAtual.length - 1;
    baixo.setAttribute('aria-label', 'Mover ' + nomeCategoria(chave) + ' para baixo na rota');
    baixo.addEventListener('click', function () { acoes.aoMover(indice, 1); });

    controles.appendChild(cima);
    controles.appendChild(baixo);
    li.appendChild(nomeEl);
    li.appendChild(controles);
    lista.appendChild(li);
  });

  el.appendChild(lista);
}
