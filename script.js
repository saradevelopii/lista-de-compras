/* =========================================================
   Sacola — orquestração da aplicação.

   Este é o único arquivo que conhece o DOM e o store ao mesmo
   tempo. Ele não contém regra de negócio (isso está em
   modelos/categorias/calculo/loja) nem construção de elementos
   complexos (isso está em render.js) — só liga um ao outro.
   ========================================================= */

import { loja } from './js/loja.js';
import { totalCarrinho, statusOrcamento, saldoRestante } from './js/calculo.js';
import { aplicarMascaraMoeda, valorNumericoMascarado, definirValorMascarado } from './js/mascara.js';
import { criarConfirmador } from './js/dialogo.js';
import {
  criarLinhaItem,
  criarCabecalhoGrupo,
  renderPainelFinanceiro,
  renderPainelCorredores
} from './js/render.js';

/* ---------- Referências de DOM ---------- */

var telaListaEl = document.getElementById('tela-lista');
var telaCorredoresEl = document.getElementById('tela-corredores');

var listaEl = document.getElementById('lista');
var listaConcluidosEl = document.getElementById('lista-concluidos');
var secaoConcluidosEl = document.getElementById('secao-concluidos');
var concluidosTituloEl = document.getElementById('concluidos-titulo');
var botaoAlternarConcluidosEl = document.getElementById('alternar-concluidos');
var botaoLimparConcluidosEl = document.getElementById('limpar-concluidos');

var vazioEl = document.getElementById('vazio');
var vazioPendentesEl = document.getElementById('vazio-pendentes');
var contagemEl = document.getElementById('contagem');

var painelFinanceiroEl = document.getElementById('painel-financeiro');
var campoOrcamentoEl = document.getElementById('campo-orcamento');

var botaoCorredoresEl = document.getElementById('botao-corredores');
var painelCorredoresEl = document.getElementById('painel-corredores');

var formularioEl = document.getElementById('formulario');
var campoNomeEl = document.getElementById('campo-nome');
var campoQuantidadeEl = document.getElementById('campo-quantidade');
var campoUnidadeEl = document.getElementById('campo-unidade');
var campoCategoriaEl = document.getElementById('campo-categoria');
var campoPrecoEl = document.getElementById('campo-preco');

var toastEl = document.getElementById('toast');
var toastMensagemEl = document.getElementById('toast-mensagem');
var toastDesfazerEl = document.getElementById('toast-desfazer');

/* ---------- Estado apenas de UI (não persistido) ---------- */

var itemEmEdicaoId = null;
var concluidosExpandido = false;
var telaAtual = 'lista'; // 'lista' | 'corredores'
var temporizadorToastErro = null;

/* ---------- Diálogo de confirmação de remoção ---------- */

var confirmarRemocao = criarConfirmador({
  overlay: document.getElementById('dialogo-remover'),
  mensagem: document.getElementById('dialogo-mensagem'),
  botaoCancelar: document.getElementById('dialogo-cancelar'),
  botaoConfirmar: document.getElementById('dialogo-remover-botao')
});

/* ---------- Máscara de moeda no campo do formulário principal ---------- */

aplicarMascaraMoeda(campoPrecoEl);

/* ---------- Ações de item ---------- */

var acoesItem = {
  aoAlternar: function (id) { loja.alternarItem(id); },

  aoExcluir: function (id, nome) {
    confirmarRemocao('Tem certeza que deseja remover “' + nome + '” da lista?', 'Remover').then(function (confirmado) {
      if (confirmado) loja.excluirItem(id);
    });
  },

  aoIniciarEdicao: function (id) { itemEmEdicaoId = id; desenhar(); },
  aoCancelarEdicao: function () { itemEmEdicaoId = null; desenhar(); },

  // Fecha a edição ANTES de acionar o store: a notificação do store
  // dispara desenhar() de forma síncrona, então itemEmEdicaoId já
  // precisa refletir "nenhum item em edição" nesse momento — senão
  // a linha é redesenhada ainda em modo edição e só o clique
  // seguinte fecha de fato (esse era o bug do clique duplo).
  aoSalvarEdicao: function (id, alteracoes) {
    itemEmEdicaoId = null;
    loja.editarItem(id, alteracoes);
  }
};

/* ---------- Renderização ---------- */

function desenhar() {
  desenharListas();
  desenharPainelFinanceiro();
  if (telaAtual === 'corredores') desenharPainelCorredores();
}

function desenharListas() {
  var pendentes = loja.itensPendentesOrdenados();
  var concluidos = loja.itensConcluidos();

  // --- pendentes, agrupados por corredor ---
  listaEl.textContent = '';
  var categoriaAnterior = null;
  var fragmentoPendentes = document.createDocumentFragment();

  pendentes.forEach(function (item) {
    if (item.categoriaChave !== categoriaAnterior) {
      fragmentoPendentes.appendChild(criarCabecalhoGrupo(item.categoriaChave));
      categoriaAnterior = item.categoriaChave;
    }
    fragmentoPendentes.appendChild(criarLinhaItem(item, Object.assign({ emEdicao: item.id === itemEmEdicaoId }, acoesItem)));
  });
  listaEl.appendChild(fragmentoPendentes);

  // --- concluídos, dentro do acordeão ---
  secaoConcluidosEl.hidden = concluidos.length === 0;
  concluidosTituloEl.textContent = 'Concluídos (' + concluidos.length + ')';
  botaoAlternarConcluidosEl.setAttribute('aria-expanded', String(concluidosExpandido));
  listaConcluidosEl.hidden = !concluidosExpandido;

  listaConcluidosEl.textContent = '';
  var fragmentoConcluidos = document.createDocumentFragment();
  concluidos.forEach(function (item) {
    fragmentoConcluidos.appendChild(criarLinhaItem(item, Object.assign({ emEdicao: item.id === itemEmEdicaoId }, acoesItem)));
  });
  listaConcluidosEl.appendChild(fragmentoConcluidos);

  // --- mensagens de vazio e contagem ---
  var total = pendentes.length + concluidos.length;
  vazioEl.hidden = total > 0;
  vazioPendentesEl.hidden = !(total > 0 && pendentes.length === 0);

  if (total === 0) {
    contagemEl.textContent = 'Nada na sacola ainda';
  } else if (pendentes.length === 0) {
    contagemEl.textContent = 'Tudo comprado — ' + total + (total === 1 ? ' item' : ' itens');
  } else {
    contagemEl.textContent = pendentes.length + ' de ' + total + ' para comprar';
  }
}

function desenharPainelFinanceiro() {
  var estado = loja.obterEstado();
  var todosItens = estado.itens;
  var total = totalCarrinho(todosItens);
  var orcamento = estado.config.orcamento;

  renderPainelFinanceiro(painelFinanceiroEl, {
    total: total,
    orcamento: orcamento,
    saldo: saldoRestante(orcamento, total),
    status: statusOrcamento(total, orcamento)
  });

  // Não sobrescreve o campo enquanto o usuário está digitando nele
  if (document.activeElement !== campoOrcamentoEl) {
    campoOrcamentoEl.value = orcamento != null ? String(orcamento) : '';
  }
}

function desenharPainelCorredores() {
  var config = loja.obterEstado().config;
  renderPainelCorredores(painelCorredoresEl, config.layoutAtual, {
    aoMover: function (indice, direcao) {
      var atual = loja.obterEstado().config.layoutAtual;
      var nova = atual.slice();
      var alvo = indice + direcao;
      if (alvo < 0 || alvo >= nova.length) return;
      var temp = nova[indice];
      nova[indice] = nova[alvo];
      nova[alvo] = temp;
      loja.reordenarLayout(nova);
    }
  });
}

/* ---------- Toast / Snackbar ---------- */

function mostrarToastUndo() {
  clearTimeout(temporizadorToastErro);
  toastMensagemEl.textContent = 'Itens removidos da lista';
  toastDesfazerEl.hidden = false;
  toastEl.classList.remove('toast--erro');
  toastEl.hidden = false;
}

function esconderToast() {
  toastEl.hidden = true;
}

function mostrarToastErro(mensagem) {
  toastDesfazerEl.hidden = true;
  toastMensagemEl.textContent = mensagem;
  toastEl.classList.add('toast--erro');
  toastEl.hidden = false;

  clearTimeout(temporizadorToastErro);
  temporizadorToastErro = setTimeout(esconderToast, 4000);
}

/* ---------- Formulário de adição ---------- */

formularioEl.addEventListener('submit', function (evento) {
  evento.preventDefault();

  loja.adicionarItem({
    nome: campoNomeEl.value,
    quantidade: campoQuantidadeEl.value,
    unidade: campoUnidadeEl.value,
    categoriaChave: campoCategoriaEl.value,
    precoUnitario: valorNumericoMascarado(campoPrecoEl)
  });

  campoNomeEl.value = '';
  campoQuantidadeEl.value = '';
  definirValorMascarado(campoPrecoEl, null);
  campoUnidadeEl.value = 'un';
  // categoria permanece — comum adicionar vários itens do mesmo corredor seguidos
  campoNomeEl.focus();
});

/* ---------- Orçamento ---------- */

campoOrcamentoEl.addEventListener('change', function () {
  loja.definirOrcamento(campoOrcamentoEl.value);
});

/* ---------- Navegação entre a tela de lista e a de corredores ---------- */

function irParaCorredores() {
  telaAtual = 'corredores';
  telaCorredoresEl.hidden = false;
  telaListaEl.hidden = true;
  formularioEl.hidden = true;
  botaoCorredoresEl.textContent = 'Voltar para lista';
  botaoCorredoresEl.setAttribute('aria-expanded', 'true');
  desenharPainelCorredores();
}

function irParaLista() {
  telaAtual = 'lista';
  telaCorredoresEl.hidden = true;
  telaListaEl.hidden = false;
  formularioEl.hidden = false;
  botaoCorredoresEl.textContent = 'Corredores';
  botaoCorredoresEl.setAttribute('aria-expanded', 'false');
}

botaoCorredoresEl.addEventListener('click', function () {
  if (telaAtual === 'lista') irParaCorredores(); else irParaLista();
});

/* ---------- Acordeão de concluídos ---------- */

botaoAlternarConcluidosEl.addEventListener('click', function () {
  concluidosExpandido = !concluidosExpandido;
  desenharListas();
});

botaoLimparConcluidosEl.addEventListener('click', function () {
  loja.limparConcluidos();
});

/* ---------- Undo ---------- */

toastDesfazerEl.addEventListener('click', function () {
  loja.desfazerLimpeza();
});

/* ---------- Reage a eventos do store ---------- */

loja.inscrever(function (evento) {
  if (evento.tipo === 'itens' || evento.tipo === 'config') {
    desenhar();
  } else if (evento.tipo === 'undo-mostrar') {
    mostrarToastUndo();
  } else if (evento.tipo === 'undo-esconder') {
    esconderToast();
  } else if (evento.tipo === 'erro') {
    mostrarToastErro(evento.mensagem);
  }
});

desenhar();

/* ---------- Service Worker ---------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(
      function (registro) { console.log('Service Worker registrado:', registro.scope); },
      function (erro) { console.warn('Falha ao registrar o Service Worker:', erro); }
    );
  });
}
