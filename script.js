/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// liga a tela ao estado: único arquivo que conhece o DOM e a loja ao mesmo tempo. regra de
// negócio fica em modelos, categorias, calculo e loja; elementos mais elaborados em render.js

import { loja } from './js/loja.js';
import { totalCarrinho, statusOrcamento, saldoRestante, rotuloDoPreco, tipoPrecoEfetivo, TIPO_PRECO } from './js/calculo.js';
import { aplicarMascaraMoeda, valorNumericoMascarado, definirValorMascarado } from './js/mascara.js';
import { criarConfirmador, criarPrompt } from './js/dialogo.js';
import { formatarTextoLista, compartilharTexto } from './js/compartilhar.js';
import { gerarLinkCompartilhavel, obterListaIdDaURL, limparListaIdDaURL } from './js/link.js';
import {
  criarLinhaItem,
  criarGrupoDeItens,
  renderPainelFinanceiro,
  renderPainelCorredores,
  renderPainelPastas,
  renderAbasDeListas,
  renderSugestoes,
  criarSeletorTipoPreco
} from './js/render.js';
import { tornarOrdenavel } from './js/ordenacao.js';
import { NOME_APP, VERSAO_APP, AUTORIA, ANO_COPYRIGHT, CONTATO_URL } from './js/identidade.js';

// --- elementos do DOM ---

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
var formNovoCorredorEl = document.getElementById('form-novo-corredor');
var campoNovoCorredorEl = document.getElementById('campo-novo-corredor');

var abasListasEl = document.getElementById('abas-listas');
var menuOpcoesListaEl = document.getElementById('menu-opcoes-lista');
var menuOpcoesListaTituloEl = document.getElementById('menu-opcoes-lista-titulo');
var botaoFecharMenuOpcoesListaEl = document.getElementById('fechar-menu-opcoes-lista');
var opcaoRenomearListaEl = document.getElementById('opcao-renomear-lista');
var opcaoExcluirListaEl = document.getElementById('opcao-excluir-lista');

var telaPastasEl = document.getElementById('tela-pastas');
var botaoPastasEl = document.getElementById('botao-pastas');
var nomePastaAtivaEl = document.getElementById('nome-pasta-ativa');
var painelPastasEl = document.getElementById('painel-pastas');
var formNovaPastaEl = document.getElementById('form-nova-pasta');
var campoNovaPastaEl = document.getElementById('campo-nova-pasta');

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

// --- estado só da tela (não salva) ---

var itemEmEdicaoId = null;
var concluidosExpandido = false;
var telaAtual = 'lista'; // lista, corredores ou pastas
var temporizadorToastErro = null;

// --- confirmação de remoção ---

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

// --- máscaras de moeda ---

aplicarMascaraMoeda(campoPrecoEl);
aplicarMascaraMoeda(campoOrcamentoEl);

// --- ações de item ---

var acoesItem = {
  aoAlternar: function (id) { loja.alternarItem(id); },

  aoExcluir: function (id, nome) {
    confirmarRemocao('Tem certeza que deseja remover “' + nome + '” da lista?', 'Remover').then(function (confirmado) {
      if (confirmado) loja.excluirItem(id);
    });
  },

  aoIniciarEdicao: function (id) { itemEmEdicaoId = id; desenhar(); },
  aoCancelarEdicao: function () { itemEmEdicaoId = null; desenhar(); },

  // fecha a edição antes de chamar a loja: a notificação dela chama desenhar() na hora, e o
  // itemEmEdicaoId já tem que estar limpo
  aoSalvarEdicao: function (id, alteracoes) {
    itemEmEdicaoId = null;
    loja.editarItem(id, alteracoes);
  }
};

// --- desenho da tela ---

function desenhar() {
  desenharListas();
  desenharPainelFinanceiro();
  desenharNomePasta();
  desenharAbasDeListas();
  atualizarVisibilidadeDoFormulario();
  if (telaAtual === 'corredores') desenharPainelCorredores();
  if (telaAtual === 'pastas') desenharPainelPastas();
}

// decide se o formulário de adicionar aparece: só na tela da lista e só sem item em edição, pra
// não ficar formulário em cima de formulário
function atualizarVisibilidadeDoFormulario() {
  formularioEl.hidden = telaAtual !== 'lista' || itemEmEdicaoId !== null;
}

function desenharAbasDeListas() {
  var estado = loja.obterEstado();
  renderAbasDeListas(abasListasEl, estado.listasDaPastaAtiva, estado.listaAtivaId, {
    // trocar de lista pelas abas sempre leva pra tela principal dela, mesmo se a pessoa estava
    // em Corredores ou Pastas
    aoAlternar: function (id) { loja.alternarLista(id); irParaLista(); },
    aoAbrirOpcoes: function (id, nome) { abrirMenuOpcoesLista(id, nome); },
    aoCriarNova: function () {
      perguntarNovoNome('Nome da nova lista:', '').then(function (novoNome) {
        if (novoNome !== null) loja.criarLista(novoNome);
      });
    }
  });
}

function desenharNomePasta() {
  nomePastaAtivaEl.textContent = loja.obterEstado().nomePastaAtiva;
}

function desenharPainelPastas() {
  var estado = loja.obterEstado();
  renderPainelPastas(painelPastasEl, estado.pastas, estado.pastaAtivaId, {
    aoAlternar: function (id) { loja.alternarPasta(id); irParaLista(); },
    aoRenomear: function (id, nomeAtual) {
      perguntarNovoNome('Novo nome da pasta:', nomeAtual).then(function (novoNome) {
        if (novoNome !== null) loja.renomearPasta(id, novoNome);
      });
    },
    aoExcluir: function (id, nome) {
      confirmarRemocao('Excluir a pasta “' + nome + '” e todas as suas listas?', 'Excluir').then(function (confirmado) {
        if (confirmado) loja.excluirPasta(id);
      });
    }
  });
}

function desenharListas() {
  var todasCategorias = loja.todasCategorias();
  var pendentes = loja.itensPendentesOrdenados();
  var concluidos = loja.itensConcluidos();

  // agrupa os pendentes (já ordenados) em blocos por categoria, cada um com sua sublista
  // arrastável
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

  // liga o SortableJS em cada sublista nova. só a alça arrasta; o resto da linha (marcar,
  // editar, excluir) responde ao clique normal
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

// menu de renomear e excluir da lista ativa (o ⋮ da aba). excluir fica desabilitado quando só
// sobra uma lista
function abrirMenuOpcoesLista(id, nome) {
  menuOpcoesListaTituloEl.textContent = nome;
  opcaoExcluirListaEl.disabled = loja.obterEstado().listas.length <= 1;
  menuOpcoesListaEl.hidden = false;

  opcaoRenomearListaEl.onclick = function () {
    fecharMenuOpcoesLista();
    perguntarNovoNome('Novo nome da lista:', nome).then(function (novoNome) {
      if (novoNome !== null) loja.renomearLista(id, novoNome);
    });
  };

  opcaoExcluirListaEl.onclick = function () {
    fecharMenuOpcoesLista();
    confirmarRemocao('Excluir a lista “' + nome + '” e todos os seus itens?', 'Excluir').then(function (confirmado) {
      if (confirmado) loja.excluirLista(id);
    });
  };
}

function fecharMenuOpcoesLista() {
  menuOpcoesListaEl.hidden = true;
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
  // mantém a seleção do usuário se a categoria ainda existe
  if (Array.prototype.some.call(campoCategoriaEl.options, function (o) { return o.value === selecaoAnterior; })) {
    campoCategoriaEl.value = selecaoAnterior;
  } else {
    campoCategoriaEl.value = 'mercearia';
  }
}

// --- toast ---

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

// --- formulário de adicionar e autocompletar ---

// tipo de preço (fechado ou por kg/L): só aparece pra g, ml, kg e L
var linhaTipoPrecoEl = document.getElementById('linha-tipo-preco');
var seletorTipoPreco = criarSeletorTipoPreco(TIPO_PRECO.FECHADO, campoUnidadeEl.value, atualizarCampoPrecoDoFormulario);
seletorTipoPreco.el.id = 'seletor-tipo-preco';
linhaTipoPrecoEl.appendChild(seletorTipoPreco.el);

function atualizarCampoPrecoDoFormulario() {
  var rotulo = rotuloDoPreco(campoUnidadeEl.value, seletorTipoPreco.obter());
  campoPrecoEl.placeholder = rotulo;
  campoPrecoEl.setAttribute('aria-label', rotulo);
  seletorTipoPreco.definirUnidade(campoUnidadeEl.value);
  linhaTipoPrecoEl.hidden = seletorTipoPreco.el.hidden;
}
campoUnidadeEl.addEventListener('change', atualizarCampoPrecoDoFormulario);
atualizarCampoPrecoDoFormulario();

formularioEl.addEventListener('submit', function (evento) {
  evento.preventDefault();

  loja.adicionarItem({
    nome: campoNomeEl.value,
    quantidade: campoQuantidadeEl.value,
    unidade: campoUnidadeEl.value,
    categoriaChave: campoCategoriaEl.value,
    tipoPreco: tipoPrecoEfetivo(campoUnidadeEl.value, seletorTipoPreco.obter()),
    precoInput: valorNumericoMascarado(campoPrecoEl)
  });

  campoNomeEl.value = '';
  campoQuantidadeEl.value = '';
  definirValorMascarado(campoPrecoEl, null);
  campoUnidadeEl.value = 'un';
  seletorTipoPreco.definir(TIPO_PRECO.FECHADO);
  atualizarCampoPrecoDoFormulario();
  sugestoesEl.hidden = true;
  campoNomeEl.focus();
});

campoNomeEl.addEventListener('input', function () {
  var sugestoes = loja.buscarSugestoesDeProduto(campoNomeEl.value);
  renderSugestoes(sugestoesEl, sugestoes, function (sugestao) {
    campoNomeEl.value = sugestao.nome;
    campoUnidadeEl.value = sugestao.unidade;
    atualizarCampoPrecoDoFormulario();
    if (Array.prototype.some.call(campoCategoriaEl.options, function (o) { return o.value === sugestao.categoriaChave; })) {
      campoCategoriaEl.value = sugestao.categoriaChave;
    }
    sugestoesEl.hidden = true;
    campoQuantidadeEl.focus();
  });
});

campoNomeEl.addEventListener('blur', function () {
  // pequeno atraso: o mousedown da sugestão precisa disparar antes dela sumir
  setTimeout(function () { sugestoesEl.hidden = true; }, 120);
});

// --- orçamento ---

campoOrcamentoEl.addEventListener('input', function () {
  loja.definirOrcamento(valorNumericoMascarado(campoOrcamentoEl));
});

// --- navegação entre telas ---

function irParaLista() {
  telaAtual = 'lista';
  telaCorredoresEl.hidden = true;
  telaPastasEl.hidden = true;
  telaListaEl.hidden = false;
  abasListasEl.hidden = false;
  contagemEl.hidden = false;
  painelFinanceiroEl.hidden = false;
  atualizarVisibilidadeDoFormulario();
  botaoCompartilharEl.hidden = false;
  botaoCorredoresEl.textContent = 'Corredores';
  botaoCorredoresEl.removeAttribute('aria-label');
  botaoCorredoresEl.setAttribute('aria-expanded', 'false');
}

function irParaCorredores() {
  telaAtual = 'corredores';
  telaCorredoresEl.hidden = false;
  telaPastasEl.hidden = true;
  telaListaEl.hidden = true;
  atualizarVisibilidadeDoFormulario();
  botaoCompartilharEl.hidden = true;
  botaoCorredoresEl.textContent = 'Voltar';
  botaoCorredoresEl.setAttribute('aria-label', 'Voltar para a lista de compras');
  botaoCorredoresEl.setAttribute('aria-expanded', 'true');
  desenharPainelCorredores();
}

// tela de pastas fica acima de qualquer lista, então esconde o que só faz sentido dentro de uma
// lista (abas, contagem, painel financeiro)
function irParaPastas() {
  telaAtual = 'pastas';
  telaPastasEl.hidden = false;
  telaCorredoresEl.hidden = true;
  telaListaEl.hidden = true;
  abasListasEl.hidden = true;
  contagemEl.hidden = true;
  painelFinanceiroEl.hidden = true;
  atualizarVisibilidadeDoFormulario();
  botaoCompartilharEl.hidden = true;
  botaoCorredoresEl.textContent = 'Voltar';
  botaoCorredoresEl.setAttribute('aria-label', 'Voltar para a lista de compras');
  botaoCorredoresEl.setAttribute('aria-expanded', 'true');
  desenharPainelPastas();
}

botaoCorredoresEl.addEventListener('click', function () {
  if (telaAtual === 'lista') irParaCorredores(); else irParaLista();
});

botaoPastasEl.addEventListener('click', function () {
  if (telaAtual === 'pastas') irParaLista(); else irParaPastas();
});

formNovaPastaEl.addEventListener('submit', function (evento) {
  evento.preventDefault();
  var id = loja.criarPasta(campoNovaPastaEl.value);
  if (id) { campoNovaPastaEl.value = ''; irParaLista(); }
});

// --- novo corredor ---

formNovoCorredorEl.addEventListener('submit', function (evento) {
  evento.preventDefault();
  var chave = loja.criarCategoriaPersonalizada(campoNovoCorredorEl.value);
  if (chave) {
    campoNovoCorredorEl.value = '';
    desenharPainelCorredores();
  }
});

// --- listas (abas) ---

botaoFecharMenuOpcoesListaEl.addEventListener('click', fecharMenuOpcoesLista);

menuOpcoesListaEl.addEventListener('click', function (evento) {
  if (evento.target === menuOpcoesListaEl) fecharMenuOpcoesLista();
});

document.addEventListener('keydown', function (evento) {
  if (evento.key === 'Escape' && !menuOpcoesListaEl.hidden) fecharMenuOpcoesLista();
});

// --- compartilhar ---

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
  loja.publicarListaAtiva(); // manda a lista completa pro servidor antes de alguém abrir o link
  var estado = loja.obterEstado();
  var link = gerarLinkCompartilhavel(estado.listaAtivaId);
  var mensagem = 'Edite comigo a lista "' + estado.nomeListaAtiva + '": ' + link;
  window.open('https://wa.me/?text=' + encodeURIComponent(mensagem), '_blank', 'noopener');
});

opcaoLinkCopiarEl.addEventListener('click', function () {
  fecharMenuCompartilhar();
  loja.publicarListaAtiva(); // idem
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

// --- nome e versão do app ---

document.title = NOME_APP + ' — lista de compras';
document.getElementById('menu-titulo-sobre').textContent = 'Sobre o ' + NOME_APP;
document.getElementById('menu-versao-app').textContent = VERSAO_APP;
document.getElementById('menu-direitos').textContent =
  '© ' + ANO_COPYRIGHT + ' ' + AUTORIA + '. Todos os direitos reservados. Não é permitido copiar, modificar ou redistribuir este aplicativo ou o código dele sem autorização por escrito.';
if (CONTATO_URL) {
  document.getElementById('menu-contato-link').href = CONTATO_URL;
  document.getElementById('menu-contato').hidden = false;
}

// --- estado da sincronização (menu Sobre) ---

var menuSyncEstadoEl = document.getElementById('menu-sync-estado');
var menuSyncIdEl = document.getElementById('menu-sync-id');

function desenharStatusSync() {
  var st = loja.obterStatusSincronizacao();
  menuSyncIdEl.textContent = st.listaId || '—';
  if (!st.habilitada) {
    menuSyncEstadoEl.textContent = 'Desligada: o Firebase não está configurado — a lista só existe neste aparelho.';
    return;
  }
  var partes = [];
  partes.push(st.conectado === true ? '🟢 Conectado ao servidor' : st.conectado === false ? '🔴 Sem conexão com o servidor' : '⚪ Conectando…');
  partes.push(st.ultimaConfirmacao
    ? 'Última gravação confirmada às ' + new Date(st.ultimaConfirmacao).toLocaleTimeString('pt-BR')
    : 'Nenhuma gravação confirmada nesta sessão');
  if (st.ultimoErro) partes.push('⚠️ Último erro: ' + st.ultimoErro);
  menuSyncEstadoEl.textContent = partes.join('\n');
}
desenharStatusSync();
menuInstitucionalEl.setAttribute('aria-label', 'Sobre o ' + NOME_APP);

// --- menu Sobre ---

botaoMenuEl.addEventListener('click', function () { menuInstitucionalEl.hidden = false; });
botaoFecharMenuEl.addEventListener('click', function () { menuInstitucionalEl.hidden = true; });
menuInstitucionalEl.addEventListener('click', function (evento) {
  if (evento.target === menuInstitucionalEl) menuInstitucionalEl.hidden = true;
});
document.addEventListener('keydown', function (evento) {
  if (evento.key === 'Escape' && !menuInstitucionalEl.hidden) menuInstitucionalEl.hidden = true;
  if (evento.key === 'Escape' && !menuCompartilharEl.hidden) fecharMenuCompartilhar();
});

// --- acordeão de concluídos ---

botaoAlternarConcluidosEl.addEventListener('click', function () {
  concluidosExpandido = !concluidosExpandido;
  desenharListas();
});

botaoLimparConcluidosEl.addEventListener('click', function () {
  loja.limparConcluidos();
});

// --- desfazer ---

toastDesfazerEl.addEventListener('click', function () {
  loja.desfazerLimpeza();
});

// --- eventos da loja ---

// recarrega pra religar a sincronização (sdk que não carregou). só se a pessoa não estiver
// digitando nem editando, e no máximo a cada 2 minutos, pra não entrar em loop sem rede
// estável. os dados estão no localStorage, nada se perde
function recarregarParaReligarSincronizacao() {
  if (campoNomeEl.value !== '' || itemEmEdicaoId !== null || document.visibilityState !== 'visible') return;
  try {
    var ultimo = Number(sessionStorage.getItem('qlista:ultimo-recarregamento-sync') || 0);
    if (Date.now() - ultimo < 120000) return;
    sessionStorage.setItem('qlista:ultimo-recarregamento-sync', String(Date.now()));
  } catch (erro) { return; }
  location.reload();
}

loja.inscrever(function (evento) {
  if (evento.tipo === 'recarregar-necessario') {
    recarregarParaReligarSincronizacao();
  } else if (evento.tipo === 'sync-status' || evento.tipo === 'lista-alternada') {
    desenharStatusSync();
    if (evento.tipo === 'lista-alternada') desenharAbasDeListas();
  } else if (evento.tipo === 'itens' || evento.tipo === 'config') {
    desenhar();
  } else if (evento.tipo === 'categorias') {
    desenharOpcoesCategoria();
    desenhar();
  } else if (evento.tipo === 'listas' || evento.tipo === 'lista-alternada') {
    desenharAbasDeListas();
  } else if (evento.tipo === 'pastas') {
    desenharNomePasta();
    desenharAbasDeListas();
    if (telaAtual === 'pastas') desenharPainelPastas();
  } else if (evento.tipo === 'undo-mostrar') {
    mostrarToastUndo();
  } else if (evento.tipo === 'undo-esconder') {
    esconderToast();
  } else if (evento.tipo === 'erro') {
    mostrarToastErro(evento.mensagem);
  }
});

// --- entrar em lista por link ---

// entra na lista do link (#lista=ID). roda ao abrir e também com o app já aberto (hashchange e
// volta do bfcache); antes só rodava no carregamento e o link não fazia nada com o PWA aberto
function processarLinkDaLista() {
  var id = obterListaIdDaURL();
  if (!id) return;
  loja.entrarEmListaCompartilhada(id);
  limparListaIdDaURL();
  irParaLista();
  mostrarToastInfo('Você entrou na lista compartilhada.');
}
processarLinkDaLista();
window.addEventListener('hashchange', processarLinkDaLista);
window.addEventListener('pageshow', function (e) { if (e.persisted) processarLinkDaLista(); });

desenharOpcoesCategoria();
desenhar();

// --- service worker e atualização automática ---

var bannerAtualizacaoEl = document.getElementById('banner-atualizacao');

if ('serviceWorker' in navigator) {
  var recarregandoPorAtualizacao = false;
  // guarda antes de registrar: se já havia um service worker controlando a aba, uma troca de
  // controlador depois é atualização de verdade. na primeira instalação não precisa recarregar
  var haviaControladorAntes = !!navigator.serviceWorker.controller;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (registro) {
      console.log('Service Worker registrado:', registro.scope);

      // checa na hora e a cada 15s, cobre quem abriu logo depois de um deploy e quem deixa a
      // aba aberta. o updateViaCache none faz buscar o sw.js de verdade na rede, sem pegar
      // cópia velha do cache do github pages
      registro.update();
      setInterval(function () { registro.update(); }, 15000);

      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') registro.update();
      });
    }, function (erro) {
      console.warn('Falha ao registrar o Service Worker:', erro);
    });
  });

  // o sw.js já ativa a versão nova sozinho (skipWaiting); aqui só recarrega a página na troca
  // de controlador, senão a aba seguiria rodando o javascript antigo que já estava em memória
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!haviaControladorAntes || recarregandoPorAtualizacao) return;
    recarregandoPorAtualizacao = true;
    bannerAtualizacaoEl.hidden = false;
    setTimeout(function () { window.location.reload(); }, 600);
  });
}
