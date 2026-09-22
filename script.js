/* =========================================================
   Sacola — orquestração da aplicação.

   Único arquivo que conhece o DOM e o store ao mesmo tempo.
   Regra de negócio vive em modelos/categorias/calculo/loja;
   construção de elementos complexos vive em render.js.
   ========================================================= */

import { loja } from './js/loja.js';
import { totalCarrinho, statusOrcamento, saldoRestante } from './js/calculo.js';
import { aplicarMascaraMoeda, valorNumericoMascarado, definirValorMascarado } from './js/mascara.js';
import { criarConfirmador } from './js/dialogo.js';
import { formatarTextoLista, compartilharTexto } from './js/compartilhar.js';
import { gerarLinkCompartilhavel, obterListaIdDaURL, limparListaIdDaURL } from './js/link.js';
import {
  criarLinhaItem,
  criarCabecalhoGrupo,
  renderPainelFinanceiro,
  renderPainelCorredores,
  renderListaDeListas,
  renderSugestoes
} from './js/render.js';

/* ---------- Referências de DOM ---------- */

var telaListaEl = document.getElementById('tela-lista');
var telaCorredoresEl = document.getElementById('tela-corredores');
var telaListasEl = document.getElementById('tela-listas');

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
var formNovoCorredorEl = document.getElementById('form-novo-corredor');
var campoNovoCorredorEl = document.getElementById('campo-novo-corredor');

var botaoListasEl = document.getElementById('botao-listas');
var nomeListaAtivaEl = document.getElementById('nome-lista-ativa');
var painelListasEl = document.getElementById('painel-listas');
var formNovaListaEl = document.getElementById('form-nova-lista');
var campoNovaListaEl = document.getElementById('campo-nova-lista');
var botaoCopiarLinkEl = document.getElementById('botao-copiar-link');

var botaoMenuEl = document.getElementById('botao-menu');
var menuInstitucionalEl = document.getElementById('menu-institucional');
var botaoFecharMenuEl = document.getElementById('fechar-menu');

var botaoCompartilharEl = document.getElementById('botao-compartilhar');

var formularioEl = document.getElementById('formulario');
var campoNomeEl = document.getElementById('campo-nome');
var campoQuantidadeEl = document.getElementById('campo-quantidade');
var campoUnidadeEl = document.getElementById('campo-unidade');
var campoCategoriaEl = document.getElementById('campo-categoria');
var campoPrecoEl = document.getElementById('campo-preco');
var sugestoesEl = document.getElementById('sugestoes');

var toastEl = document.getElementById('toast');
var toastMensagemEl = document.getElementById('toast-mensagem');
var toastDesfazerEl = document.getElementById('toast-desfazer');

/* ---------- Estado apenas de UI (não persistido) ---------- */

var itemEmEdicaoId = null;
var concluidosExpandido = false;
var telaAtual = 'lista'; // 'lista' | 'corredores' | 'listas'
var temporizadorToastErro = null;

/* ---------- Diálogo de confirmação de remoção ---------- */

var confirmarRemocao = criarConfirmador({
  overlay: document.getElementById('dialogo-remover'),
  mensagem: document.getElementById('dialogo-mensagem'),
  botaoCancelar: document.getElementById('dialogo-cancelar'),
  botaoConfirmar: document.getElementById('dialogo-remover-botao')
});

/* ---------- Máscaras de moeda ---------- */

aplicarMascaraMoeda(campoPrecoEl);
aplicarMascaraMoeda(campoOrcamentoEl);

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
  // precisa refletir "nenhum item em edição" nesse momento.
  aoSalvarEdicao: function (id, alteracoes) {
    itemEmEdicaoId = null;
    loja.editarItem(id, alteracoes);
  }
};

/* ---------- Renderização ---------- */

function desenhar() {
  desenharListas();
  desenharPainelFinanceiro();
  desenharCabecalhoLista();
  if (telaAtual === 'corredores') desenharPainelCorredores();
  if (telaAtual === 'listas') desenharTelaListas();
}

function desenharCabecalhoLista() {
  nomeListaAtivaEl.textContent = loja.obterEstado().nomeListaAtiva;
}

function desenharListas() {
  var todasCategorias = loja.todasCategorias();
  var pendentes = loja.itensPendentesOrdenados();
  var concluidos = loja.itensConcluidos();

  listaEl.textContent = '';
  var categoriaAnterior = null;
  var fragmentoPendentes = document.createDocumentFragment();

  pendentes.forEach(function (item) {
    if (item.categoriaChave !== categoriaAnterior) {
      fragmentoPendentes.appendChild(criarCabecalhoGrupo(item.categoriaChave, todasCategorias));
      categoriaAnterior = item.categoriaChave;
    }
    fragmentoPendentes.appendChild(criarLinhaItem(item, todasCategorias, Object.assign({ emEdicao: item.id === itemEmEdicaoId }, acoesItem)));
  });
  listaEl.appendChild(fragmentoPendentes);

  secaoConcluidosEl.hidden = concluidos.length === 0;
  concluidosTituloEl.textContent = 'Concluídos (' + concluidos.length + ')';
  botaoAlternarConcluidosEl.setAttribute('aria-expanded', String(concluidosExpandido));
  listaConcluidosEl.hidden = !concluidosExpandido;

  listaConcluidosEl.textContent = '';
  var fragmentoConcluidos = document.createDocumentFragment();
  concluidos.forEach(function (item) {
    fragmentoConcluidos.appendChild(criarLinhaItem(item, todasCategorias, Object.assign({ emEdicao: item.id === itemEmEdicaoId }, acoesItem)));
  });
  listaConcluidosEl.appendChild(fragmentoConcluidos);

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
  var total = totalCarrinho(estado.itens);
  var orcamento = estado.config.orcamento;

  renderPainelFinanceiro(painelFinanceiroEl, {
    total: total,
    orcamento: orcamento,
    saldo: saldoRestante(orcamento, total),
    status: statusOrcamento(total, orcamento)
  });

  if (document.activeElement !== campoOrcamentoEl) {
    definirValorMascarado(campoOrcamentoEl, orcamento);
  }
}

function desenharPainelCorredores() {
  var config = loja.obterEstado().config;
  renderPainelCorredores(painelCorredoresEl, config.layoutAtual, loja.todasCategorias(), {
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

function desenharTelaListas() {
  var estado = loja.obterEstado();
  renderListaDeListas(painelListasEl, estado.listas, estado.listaAtivaId, {
    aoAlternar: function (id) { loja.alternarLista(id); irParaLista(); },
    aoRenomear: function (id, nomeAtual) {
      var novoNome = window.prompt('Novo nome da lista:', nomeAtual);
      if (novoNome !== null) loja.renomearLista(id, novoNome);
    },
    aoExcluir: function (id, nome) {
      confirmarRemocao('Excluir a lista “' + nome + '” e todos os seus itens?', 'Excluir').then(function (confirmado) {
        if (confirmado) loja.excluirLista(id);
      });
    }
  });
}

function desenharOpcoesCategoria() {
  var selecaoAnterior = campoCategoriaEl.value;
  campoCategoriaEl.textContent = '';
  loja.todasCategorias().forEach(function (categoria) {
    var opcao = document.createElement('option');
    opcao.value = categoria.chave;
    opcao.textContent = categoria.nome;
    campoCategoriaEl.appendChild(opcao);
  });
  // preserva a seleção do usuário quando a categoria continua existindo
  if (Array.prototype.some.call(campoCategoriaEl.options, function (o) { return o.value === selecaoAnterior; })) {
    campoCategoriaEl.value = selecaoAnterior;
  } else {
    campoCategoriaEl.value = 'mercearia';
  }
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

function mostrarToastInfo(mensagem) {
  toastDesfazerEl.hidden = true;
  toastMensagemEl.textContent = mensagem;
  toastEl.classList.remove('toast--erro');
  toastEl.hidden = false;
  clearTimeout(temporizadorToastErro);
  temporizadorToastErro = setTimeout(esconderToast, 3000);
}

/* ---------- Formulário de adição + autocompletar ---------- */

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
  sugestoesEl.hidden = true;
  campoNomeEl.focus();
});

campoNomeEl.addEventListener('input', function () {
  var sugestoes = loja.buscarSugestoesDeProduto(campoNomeEl.value);
  renderSugestoes(sugestoesEl, sugestoes, function (sugestao) {
    campoNomeEl.value = sugestao.nome;
    campoUnidadeEl.value = sugestao.unidade;
    if (Array.prototype.some.call(campoCategoriaEl.options, function (o) { return o.value === sugestao.categoriaChave; })) {
      campoCategoriaEl.value = sugestao.categoriaChave;
    }
    sugestoesEl.hidden = true;
    campoQuantidadeEl.focus();
  });
});

campoNomeEl.addEventListener('blur', function () {
  // pequeno atraso: o mousedown da sugestão precisa disparar antes de sumir
  setTimeout(function () { sugestoesEl.hidden = true; }, 120);
});

/* ---------- Orçamento ---------- */

campoOrcamentoEl.addEventListener('change', function () {
  loja.definirOrcamento(valorNumericoMascarado(campoOrcamentoEl));
});

/* ---------- Navegação entre telas ---------- */

function irParaLista() {
  telaAtual = 'lista';
  telaCorredoresEl.hidden = true;
  telaListasEl.hidden = true;
  telaListaEl.hidden = false;
  formularioEl.hidden = false;
  botaoCorredoresEl.setAttribute('aria-expanded', 'false');
}

function irParaCorredores() {
  telaAtual = 'corredores';
  telaCorredoresEl.hidden = false;
  telaListasEl.hidden = true;
  telaListaEl.hidden = true;
  formularioEl.hidden = true;
  botaoCorredoresEl.setAttribute('aria-expanded', 'true');
  desenharPainelCorredores();
}

function irParaListas() {
  telaAtual = 'listas';
  telaListasEl.hidden = false;
  telaCorredoresEl.hidden = true;
  telaListaEl.hidden = true;
  formularioEl.hidden = true;
  desenharTelaListas();
}

botaoCorredoresEl.addEventListener('click', function () {
  if (telaAtual === 'corredores') irParaLista(); else irParaCorredores();
});

botaoListasEl.addEventListener('click', function () {
  if (telaAtual === 'listas') irParaLista(); else irParaListas();
});

/* ---------- Novo corredor personalizado ---------- */

formNovoCorredorEl.addEventListener('submit', function (evento) {
  evento.preventDefault();
  var chave = loja.criarCategoriaPersonalizada(campoNovoCorredorEl.value);
  if (chave) {
    campoNovoCorredorEl.value = '';
    desenharPainelCorredores();
  }
});

/* ---------- Múltiplas listas ---------- */

formNovaListaEl.addEventListener('submit', function (evento) {
  evento.preventDefault();
  var id = loja.criarLista(campoNovaListaEl.value);
  if (id) {
    campoNovaListaEl.value = '';
    irParaLista();
  }
});

botaoCopiarLinkEl.addEventListener('click', function () {
  var link = gerarLinkCompartilhavel(loja.obterEstado().listaAtivaId);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(function () {
      mostrarToastInfo('Link copiado! Envie para quem vai editar junto com você.');
    }, function () {
      mostrarToastErro('Não foi possível copiar o link.');
    });
  } else {
    mostrarToastErro('Cópia automática indisponível neste navegador.');
  }
});

/* ---------- Compartilhar texto ---------- */

botaoCompartilharEl.addEventListener('click', function () {
  var estado = loja.obterEstado();
  var texto = formatarTextoLista(estado.nomeListaAtiva, loja.itensPendentesOrdenados(), loja.itensConcluidos(), loja.todasCategorias());

  compartilharTexto(texto, estado.nomeListaAtiva).then(function (resultado) {
    if (resultado === 'copiado') mostrarToastInfo('Texto copiado! Cole no WhatsApp ou e-mail.');
    if (resultado === 'falhou') mostrarToastErro('Não foi possível compartilhar nem copiar o texto.');
  });
});

/* ---------- Menu institucional ---------- */

botaoMenuEl.addEventListener('click', function () { menuInstitucionalEl.hidden = false; });
botaoFecharMenuEl.addEventListener('click', function () { menuInstitucionalEl.hidden = true; });
menuInstitucionalEl.addEventListener('click', function (evento) {
  if (evento.target === menuInstitucionalEl) menuInstitucionalEl.hidden = true;
});
document.addEventListener('keydown', function (evento) {
  if (evento.key === 'Escape' && !menuInstitucionalEl.hidden) menuInstitucionalEl.hidden = true;
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
  } else if (evento.tipo === 'categorias') {
    desenharOpcoesCategoria();
    desenhar();
  } else if (evento.tipo === 'listas' || evento.tipo === 'lista-alternada') {
    desenharCabecalhoLista();
    if (telaAtual === 'listas') desenharTelaListas();
  } else if (evento.tipo === 'undo-mostrar') {
    mostrarToastUndo();
  } else if (evento.tipo === 'undo-esconder') {
    esconderToast();
  } else if (evento.tipo === 'erro') {
    mostrarToastErro(evento.mensagem);
  }
});

/* ---------- Entrar em lista compartilhada via link ---------- */

var listaIdDaURL = obterListaIdDaURL();
if (listaIdDaURL) {
  loja.entrarEmListaCompartilhada(listaIdDaURL);
  limparListaIdDaURL();
}

desenharOpcoesCategoria();
desenhar();

/* ---------- Service Worker + atualização sem fechar o app ---------- */

var bannerAtualizacaoEl = document.getElementById('banner-atualizacao');
var botaoAtualizarEl = document.getElementById('botao-atualizar');

if ('serviceWorker' in navigator) {
  var atualizacaoPendente = false;
  var recarregandoPorAtualizacao = false;

  function mostrarBannerAtualizacao(registro) {
    if (atualizacaoPendente) return;
    atualizacaoPendente = true;

    bannerAtualizacaoEl.hidden = false;
    document.body.style.paddingTop = bannerAtualizacaoEl.offsetHeight + 'px';

    botaoAtualizarEl.addEventListener('click', function () {
      botaoAtualizarEl.disabled = true;
      botaoAtualizarEl.textContent = 'Atualizando…';
      if (registro.waiting) {
        registro.waiting.postMessage({ tipo: 'ativar-agora' });
      } else {
        window.location.reload();
      }
    });
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (registro) {
      console.log('Service Worker registrado:', registro.scope);

      if (registro.waiting && navigator.serviceWorker.controller) {
        mostrarBannerAtualizacao(registro);
      }

      registro.addEventListener('updatefound', function () {
        var novoWorker = registro.installing;
        if (!novoWorker) return;
        novoWorker.addEventListener('statechange', function () {
          if (novoWorker.state === 'installed' && navigator.serviceWorker.controller) {
            mostrarBannerAtualizacao(registro);
          }
        });
      });
    }, function (erro) {
      console.warn('Falha ao registrar o Service Worker:', erro);
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!atualizacaoPendente || recarregandoPorAtualizacao) return;
    recarregandoPorAtualizacao = true;
    window.location.reload();
  });
}
