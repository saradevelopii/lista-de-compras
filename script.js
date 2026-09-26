/* =========================================================
   Qlista — orquestração da aplicação.

   Único arquivo que conhece o DOM e o store ao mesmo tempo.
   Regra de negócio vive em modelos/categorias/calculo/loja;
   construção de elementos complexos vive em render.js.
   ========================================================= */

import { loja } from './js/loja.js';
import { totalCarrinho, statusOrcamento, saldoRestante } from './js/calculo.js';
import { aplicarMascaraMoeda, valorNumericoMascarado, definirValorMascarado } from './js/mascara.js';
import { criarConfirmador, criarPrompt } from './js/dialogo.js';
import { formatarTextoLista, compartilharTexto } from './js/compartilhar.js';
import { gerarLinkCompartilhavel, obterListaIdDaURL, limparListaIdDaURL } from './js/link.js';
import {
  criarLinhaItem,
  criarGrupoDeItens,
  renderPainelFinanceiro,
  renderPainelCorredores,
  renderListaDeListas,
  renderSugestoes
} from './js/render.js';
import { tornarOrdenavel } from './js/ordenacao.js';
import { NOME_APP, VERSAO_APP } from './js/identidade.js';

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

var botaoMenuEl = document.getElementById('botao-menu');
var menuInstitucionalEl = document.getElementById('menu-institucional');
var botaoFecharMenuEl = document.getElementById('fechar-menu');

var botaoCompartilharEl = document.getElementById('botao-compartilhar');
var menuCompartilharEl = document.getElementById('menu-compartilhar');
var botaoFecharMenuCompartilharEl = document.getElementById('fechar-menu-compartilhar');
var opcaoCompartilharTextoEl = document.getElementById('opcao-compartilhar-texto');
var opcaoLinkWhatsappEl = document.getElementById('opcao-link-whatsapp');
var opcaoLinkCopiarEl = document.getElementById('opcao-link-copiar');

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

var perguntarNovoNome = criarPrompt({
  overlay: document.getElementById('dialogo-prompt'),
  form: document.getElementById('dialogo-prompt-form'),
  mensagem: document.getElementById('dialogo-prompt-mensagem'),
  campo: document.getElementById('dialogo-prompt-campo'),
  botaoCancelar: document.getElementById('dialogo-prompt-cancelar')
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
  atualizarVisibilidadeDoFormulario();
  if (telaAtual === 'corredores') desenharPainelCorredores();
  if (telaAtual === 'listas') desenharTelaListas();
}

/**
 * Única fonte de verdade de quando o formulário de adicionar produto
 * aparece: só na tela de lista E só quando nenhum item está sendo
 * editado no momento — evita os dois formulários (adicionar + editar)
 * ficarem visíveis ao mesmo tempo, sobrepostos ou empilhados na tela.
 */
function atualizarVisibilidadeDoFormulario() {
  formularioEl.hidden = telaAtual !== 'lista' || itemEmEdicaoId !== null;
}

function desenharCabecalhoLista() {
  nomeListaAtivaEl.textContent = loja.obterEstado().nomeListaAtiva;
}

function desenharListas() {
  var todasCategorias = loja.todasCategorias();
  var pendentes = loja.itensPendentesOrdenados();
  var concluidos = loja.itensConcluidos();

  // Agrupa os pendentes (já ordenados por corredor) em blocos
  // contíguos por categoria — cada bloco vira sua própria sublista
  // arrastável, sem misturar itens de corredores diferentes.
  var grupos = [];
  pendentes.forEach(function (item) {
    var ultimoGrupo = grupos[grupos.length - 1];
    if (!ultimoGrupo || ultimoGrupo.categoriaChave !== item.categoriaChave) {
      grupos.push({ categoriaChave: item.categoriaChave, itens: [item] });
    } else {
      ultimoGrupo.itens.push(item);
    }
  });

  listaEl.textContent = '';
  var fragmentoPendentes = document.createDocumentFragment();
  grupos.forEach(function (grupo) {
    fragmentoPendentes.appendChild(criarGrupoDeItens(grupo.categoriaChave, grupo.itens, todasCategorias, itemEmEdicaoId, acoesItem));
  });
  listaEl.appendChild(fragmentoPendentes);

  // Liga a reordenação (SortableJS) em cada sublista de corredor recém-criada.
  // Handle = a alça: o resto da linha (marcar, editar, excluir) continua
  // respondendo a clique normal, sem risco de ser interpretado como arraste.
  Array.prototype.forEach.call(listaEl.querySelectorAll('.item-grupo-lista'), function (sublista) {
    tornarOrdenavel(sublista, {
      handle: '.item__alca',
      aoFinalizar: function (novaOrdemDeIds) {
        loja.reordenarItensDaCategoria(sublista.dataset.categoria, novaOrdemDeIds);
      }
    });
  });

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
    contagemEl.textContent = 'Nenhum item na sacola';
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
  var estado = loja.obterEstado();
  var chavesPersonalizadas = new Set(estado.categoriasPersonalizadas.map(function (c) { return c.chave; }));

  renderPainelCorredores(painelCorredoresEl, estado.config.layoutAtual, loja.todasCategorias(), chavesPersonalizadas, {
    aoRenomear: function (chave, nomeAtual) {
      perguntarNovoNome('Novo nome do corredor:', nomeAtual).then(function (novoNome) {
        if (novoNome !== null) loja.renomearCategoriaPersonalizada(chave, novoNome);
      });
    },
    aoExcluir: function (chave, nome) {
      confirmarRemocao('Excluir o corredor “' + nome + '”? Os itens que estavam nele passam a aparecer em "Outros".', 'Excluir').then(function (confirmado) {
        if (confirmado) loja.excluirCategoriaPersonalizada(chave);
      });
    }
  });

  var listaCorredoresEl = painelCorredoresEl.querySelector('.corredores__lista');
  if (listaCorredoresEl) {
    tornarOrdenavel(listaCorredoresEl, {
      handle: '.corredores__alca',
      aoFinalizar: function (novaOrdemDeIds) { loja.reordenarLayout(novaOrdemDeIds); }
    });
  }
}

function desenharTelaListas() {
  var estado = loja.obterEstado();
  renderListaDeListas(painelListasEl, estado.listas, estado.listaAtivaId, {
    aoAlternar: function (id) { loja.alternarLista(id); irParaLista(); },
    aoRenomear: function (id, nomeAtual) {
      perguntarNovoNome('Novo nome da lista:', nomeAtual).then(function (novoNome) {
        if (novoNome !== null) loja.renomearLista(id, novoNome);
      });
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

campoOrcamentoEl.addEventListener('input', function () {
  loja.definirOrcamento(valorNumericoMascarado(campoOrcamentoEl));
});

/* ---------- Navegação entre telas ---------- */

function irParaLista() {
  telaAtual = 'lista';
  telaCorredoresEl.hidden = true;
  telaListasEl.hidden = true;
  telaListaEl.hidden = false;
  atualizarVisibilidadeDoFormulario();
  botaoCompartilharEl.hidden = false;
  botaoCorredoresEl.textContent = 'Corredores';
  botaoCorredoresEl.removeAttribute('aria-label');
  botaoCorredoresEl.setAttribute('aria-expanded', 'false');
}

function irParaCorredores() {
  telaAtual = 'corredores';
  telaCorredoresEl.hidden = false;
  telaListasEl.hidden = true;
  telaListaEl.hidden = true;
  atualizarVisibilidadeDoFormulario();
  botaoCompartilharEl.hidden = true;
  botaoCorredoresEl.textContent = 'Voltar';
  botaoCorredoresEl.setAttribute('aria-label', 'Voltar para a lista de compras');
  botaoCorredoresEl.setAttribute('aria-expanded', 'true');
  desenharPainelCorredores();
}

function irParaListas() {
  telaAtual = 'listas';
  telaListasEl.hidden = false;
  telaCorredoresEl.hidden = true;
  telaListaEl.hidden = true;
  atualizarVisibilidadeDoFormulario();
  botaoCompartilharEl.hidden = true;
  botaoCorredoresEl.textContent = 'Voltar';
  botaoCorredoresEl.setAttribute('aria-label', 'Voltar para a lista de compras');
  desenharTelaListas();
}

botaoCorredoresEl.addEventListener('click', function () {
  if (telaAtual === 'lista') irParaCorredores(); else irParaLista();
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
  // Fica em "Minhas Listas" depois de criar — entrar numa lista pra
  // adicionar produto é uma ação separada e deliberada (tocar nela).
  if (id) campoNovaListaEl.value = '';
});

/* ---------- Compartilhar (botão único, com menu de opções) ---------- */

function abrirMenuCompartilhar() { menuCompartilharEl.hidden = false; }
function fecharMenuCompartilhar() { menuCompartilharEl.hidden = true; }

botaoCompartilharEl.addEventListener('click', abrirMenuCompartilhar);
botaoFecharMenuCompartilharEl.addEventListener('click', fecharMenuCompartilhar);
menuCompartilharEl.addEventListener('click', function (evento) {
  if (evento.target === menuCompartilharEl) fecharMenuCompartilhar();
});

opcaoCompartilharTextoEl.addEventListener('click', function () {
  fecharMenuCompartilhar();
  var estado = loja.obterEstado();
  var texto = formatarTextoLista(estado.nomeListaAtiva, loja.itensPendentesOrdenados(), loja.itensConcluidos(), loja.todasCategorias());

  compartilharTexto(texto, estado.nomeListaAtiva).then(function (resultado) {
    if (resultado === 'copiado') mostrarToastInfo('Texto copiado! Cole no WhatsApp ou e-mail.');
    if (resultado === 'falhou') mostrarToastErro('Não foi possível compartilhar nem copiar o texto.');
  });
});

opcaoLinkWhatsappEl.addEventListener('click', function () {
  fecharMenuCompartilhar();
  var estado = loja.obterEstado();
  var link = gerarLinkCompartilhavel(estado.listaAtivaId);
  var mensagem = 'Edite comigo a lista "' + estado.nomeListaAtiva + '": ' + link;
  window.open('https://wa.me/?text=' + encodeURIComponent(mensagem), '_blank', 'noopener');
});

opcaoLinkCopiarEl.addEventListener('click', function () {
  fecharMenuCompartilhar();
  var link = gerarLinkCompartilhavel(loja.obterEstado().listaAtivaId);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(function () {
      mostrarToastInfo('Link copiado! Quem abrir edita esta lista com você, em tempo real.');
    }, function () {
      mostrarToastErro('Não foi possível copiar o link.');
    });
  } else {
    mostrarToastErro('Cópia automática indisponível neste navegador.');
  }
});

/* ---------- Identidade do app (nome + versão, de fonte única) ---------- */

document.title = NOME_APP + ' — lista de compras';
document.getElementById('menu-titulo-sobre').textContent = 'Sobre o ' + NOME_APP;
document.getElementById('menu-versao-app').textContent = VERSAO_APP;
menuInstitucionalEl.setAttribute('aria-label', 'Sobre o ' + NOME_APP);

/* ---------- Menu institucional ---------- */

botaoMenuEl.addEventListener('click', function () { menuInstitucionalEl.hidden = false; });
botaoFecharMenuEl.addEventListener('click', function () { menuInstitucionalEl.hidden = true; });
menuInstitucionalEl.addEventListener('click', function (evento) {
  if (evento.target === menuInstitucionalEl) menuInstitucionalEl.hidden = true;
});
document.addEventListener('keydown', function (evento) {
  if (evento.key === 'Escape' && !menuInstitucionalEl.hidden) menuInstitucionalEl.hidden = true;
  if (evento.key === 'Escape' && !menuCompartilharEl.hidden) fecharMenuCompartilhar();
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

/* ---------- Service Worker + atualização 100% automática ---------- */

var bannerAtualizacaoEl = document.getElementById('banner-atualizacao');

if ('serviceWorker' in navigator) {
  var recarregandoPorAtualizacao = false;
  // Captura ANTES do registro: se já havia um Service Worker controlando
  // esta aba (de uma visita anterior), uma futura troca de controlador é
  // uma atualização de verdade. Na primeira instalação, não há controlador
  // nenhum ainda — nesse caso não precisamos recarregar nada.
  var haviaControladorAntes = !!navigator.serviceWorker.controller;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (registro) {
      console.log('Service Worker registrado:', registro.scope);

      // Checagem imediata (não espera o primeiro tick do intervalo) +
      // intervalo curto de 15s: cobre tanto quem acabou de abrir o app
      // logo após um deploy quanto quem deixa a aba aberta por muito
      // tempo — nos dois casos, a detecção fica na casa de segundos,
      // não minutos. updateViaCache: 'none' (acima) garante que essa
      // checagem busca o sw.js de verdade na rede, sem cair numa cópia
      // velha do cache HTTP do CDN do GitHub Pages.
      registro.update();
      setInterval(function () { registro.update(); }, 15000);

      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') registro.update();
      });
    }, function (erro) {
      console.warn('Falha ao registrar o Service Worker:', erro);
    });
  });

  // O próprio sw.js já ativa a versão nova sozinho (skipWaiting automático
  // no install) — aqui só reagimos à troca de controlador, recarregando a
  // página pra aplicar a atualização de fato. Sem isso, o código novo já
  // estaria "no comando" nos bastidores, mas a aba continuaria rodando o
  // JavaScript antigo, já carregado em memória, até um reload de qualquer
  // natureza acontecer.
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!haviaControladorAntes || recarregandoPorAtualizacao) return;
    recarregandoPorAtualizacao = true;
    bannerAtualizacaoEl.hidden = false;
    setTimeout(function () { window.location.reload(); }, 600);
  });
}
