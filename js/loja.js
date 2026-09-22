/* =========================================================
   Store — única fonte de verdade do estado da aplicação.

   Padrão: toda ação aplica a mudança em memória e notifica os
   inscritos IMEDIATAMENTE (otimista); só depois tenta persistir
   local e, se a sincronização estiver configurada, publicar no
   Firebase (com um pequeno atraso, para não disparar uma escrita
   remota a cada tecla). Se a gravação local falhar, o estado
   volta ao snapshot anterior e um evento de erro é emitido.
   ========================================================= */

import { criarItem, aplicarEdicao, ErroValidacao, gerarId } from './modelos.js';
import {
  carregarListas, salvarListas, carregarListaAtivaId, salvarListaAtivaId, excluirDadosDaLista,
  carregarItens, salvarItens, carregarConfig, salvarConfig,
  carregarCategoriasPersonalizadas, salvarCategoriasPersonalizadas,
  carregarHistorico, salvarHistorico
} from './armazenamento.js';
import { ordenarPorCorredor, sanearLayout, combinarCategorias, gerarChaveCategoria } from './categorias.js';
import { registrarUso, buscarSugestoes } from './historico.js';
import { assinarLista, publicarLista, disponivel as sincronizacaoDisponivel } from './firebaseSync.js';

var DURACAO_UNDO_MS = 5000;
var ATRASO_PUBLICACAO_MS = 400;

function criarLoja() {
  var listas = carregarListas();
  var listaAtivaId = carregarListaAtivaId();
  if (!listas.some(function (l) { return l.id === listaAtivaId; })) {
    listaAtivaId = listas.length ? listas[0].id : null;
  }

  var categoriasPersonalizadas = carregarCategoriasPersonalizadas();
  var historico = carregarHistorico();

  var itens = [];
  var config = { orcamento: null, layoutAtual: [] };
  var itensRemovidosParaDesfazer = null;
  var temporizadorUndo = null;
  var ouvintes = [];
  var cancelarAssinaturaRemota = null;
  var temporizadorPublicacao = null;
  var aplicandoRemoto = false; // evita re-publicar de volta o que acabou de chegar do Firebase

  function chavesCategoriasValidas() {
    return combinarCategorias(categoriasPersonalizadas).map(function (c) { return c.chave; });
  }

  function notificar(evento) { ouvintes.forEach(function (fn) { fn(evento); }); }

  function nomeListaAtiva() {
    var encontrada = listas.filter(function (l) { return l.id === listaAtivaId; })[0];
    return encontrada ? encontrada.nome : 'Minha Lista';
  }

  function carregarDadosDaListaAtiva() {
    if (!listaAtivaId) { itens = []; config = { orcamento: null, layoutAtual: [] }; return; }
    itens = carregarItens(listaAtivaId);
    config = carregarConfig(listaAtivaId, chavesCategoriasValidas());
  }

  function registrarUsoDoItem(item) {
    historico = registrarUso(historico, item);
    salvarHistorico(historico);
  }

  function agendarPublicacaoRemota() {
    if (aplicandoRemoto || !sincronizacaoDisponivel() || !listaAtivaId) return;
    clearTimeout(temporizadorPublicacao);
    var idNoMomento = listaAtivaId;
    temporizadorPublicacao = setTimeout(function () {
      publicarLista(idNoMomento, { nome: nomeListaAtiva(), itens: itens, config: config });
    }, ATRASO_PUBLICACAO_MS);
  }

  function sanearConfigRemota(configRemota) {
    var bruta = configRemota || {};
    var orcamento = Number(bruta.orcamento);
    return {
      orcamento: Number.isFinite(orcamento) && orcamento > 0 ? orcamento : null,
      layoutAtual: sanearLayout(Array.isArray(bruta.layoutAtual) ? bruta.layoutAtual : [], chavesCategoriasValidas())
    };
  }

  function assinarListaAtivaNoFirebase() {
    if (cancelarAssinaturaRemota) { cancelarAssinaturaRemota(); cancelarAssinaturaRemota = null; }
    if (!listaAtivaId) return;
    var idNoMomento = listaAtivaId;

    assinarLista(idNoMomento, function (dadosRemotos) {
      if (idNoMomento !== listaAtivaId) return; // a pessoa já trocou de lista antes disso chegar
      if (!dadosRemotos) return; // nada publicado remotamente ainda — mantém o que já temos localmente

      aplicandoRemoto = true;
      itens = Array.isArray(dadosRemotos.itens) ? dadosRemotos.itens : Object.values(dadosRemotos.itens || {});
      config = sanearConfigRemota(dadosRemotos.config);
      salvarItens(idNoMomento, itens);
      salvarConfig(idNoMomento, config);

      if (dadosRemotos.nome) {
        var nomeAtualLocal = nomeListaAtiva();
        if (dadosRemotos.nome !== nomeAtualLocal) {
          listas = listas.map(function (l) { return l.id === idNoMomento ? Object.assign({}, l, { nome: dadosRemotos.nome }) : l; });
          salvarListas(listas);
          notificar({ tipo: 'listas' });
        }
      }

      notificar({ tipo: 'itens' });
      notificar({ tipo: 'config' });
      aplicandoRemoto = false;
    }).then(function (cancelar) {
      if (idNoMomento === listaAtivaId) cancelarAssinaturaRemota = cancelar;
      else cancelar(); // já trocou de lista enquanto a assinatura carregava
    });
  }

  function persistirItensOuReverter(itensAntes) {
    if (!listaAtivaId) return false;
    if (salvarItens(listaAtivaId, itens)) { agendarPublicacaoRemota(); return true; }
    itens = itensAntes;
    notificar({ tipo: 'itens' });
    notificar({ tipo: 'erro', mensagem: 'Não foi possível salvar a lista. A alteração foi desfeita.' });
    return false;
  }

  function persistirConfigOuReverter(configAntes) {
    if (!listaAtivaId) return false;
    if (salvarConfig(listaAtivaId, config)) { agendarPublicacaoRemota(); return true; }
    config = configAntes;
    notificar({ tipo: 'config' });
    notificar({ tipo: 'erro', mensagem: 'Não foi possível salvar as configurações. A alteração foi desfeita.' });
    return false;
  }

  carregarDadosDaListaAtiva();
  if (listaAtivaId) salvarListaAtivaId(listaAtivaId);
  assinarListaAtivaNoFirebase();

  var api = {
    inscrever: function (fn) {
      ouvintes.push(fn);
      return function () { ouvintes = ouvintes.filter(function (f) { return f !== fn; }); };
    },

    obterEstado: function () {
      return {
        itens: itens,
        config: config,
        temItensParaDesfazer: itensRemovidosParaDesfazer !== null,
        listas: listas,
        listaAtivaId: listaAtivaId,
        nomeListaAtiva: nomeListaAtiva(),
        categoriasPersonalizadas: categoriasPersonalizadas,
        sincronizando: sincronizacaoDisponivel()
      };
    },

    todasCategorias: function () { return combinarCategorias(categoriasPersonalizadas); },

    itensPendentesOrdenados: function () {
      return ordenarPorCorredor(itens.filter(function (i) { return !i.feito; }), config.layoutAtual);
    },
    itensConcluidos: function () {
      return itens.filter(function (i) { return i.feito; }).sort(function (a, b) { return a.criadoEm - b.criadoEm; });
    },

    /* ---------- Itens ---------- */

    adicionarItem: function (dados) {
      var novoItem;
      try {
        novoItem = criarItem(dados);
      } catch (erro) {
        if (erro instanceof ErroValidacao) { notificar({ tipo: 'erro', mensagem: erro.message }); return; }
        throw erro;
      }
      var antes = itens;
      itens = itens.concat([novoItem]);
      notificar({ tipo: 'itens' });
      if (persistirItensOuReverter(antes)) registrarUsoDoItem(novoItem);
    },

    editarItem: function (id, alteracoes) {
      var antes = itens;
      var itemEditado = null;
      itens = itens.map(function (item) {
        if (item.id !== id) return item;
        itemEditado = aplicarEdicao(item, alteracoes);
        return itemEditado;
      });
      if (!itemEditado) { itens = antes; return; }
      notificar({ tipo: 'itens' });
      if (persistirItensOuReverter(antes)) registrarUsoDoItem(itemEditado);
    },

    alternarItem: function (id) {
      var antes = itens;
      itens = itens.map(function (item) {
        return item.id === id ? Object.assign({}, item, { feito: !item.feito }) : item;
      });
      notificar({ tipo: 'itens' });
      persistirItensOuReverter(antes);
    },

    excluirItem: function (id) {
      var antes = itens;
      itens = itens.filter(function (item) { return item.id !== id; });
      notificar({ tipo: 'itens' });
      persistirItensOuReverter(antes);
    },

    limparConcluidos: function () {
      var haConcluidos = itens.some(function (i) { return i.feito; });
      if (!haConcluidos) return;

      var antes = itens;
      itens = itens.filter(function (item) { return !item.feito; });
      notificar({ tipo: 'itens' });
      if (!persistirItensOuReverter(antes)) return;

      itensRemovidosParaDesfazer = antes;
      clearTimeout(temporizadorUndo);
      notificar({ tipo: 'undo-mostrar' });
      temporizadorUndo = setTimeout(function () {
        itensRemovidosParaDesfazer = null;
        notificar({ tipo: 'undo-esconder' });
      }, DURACAO_UNDO_MS);
    },

    desfazerLimpeza: function () {
      if (itensRemovidosParaDesfazer === null) return;
      clearTimeout(temporizadorUndo);
      var antes = itens;
      itens = itensRemovidosParaDesfazer;
      itensRemovidosParaDesfazer = null;
      notificar({ tipo: 'itens' });
      notificar({ tipo: 'undo-esconder' });
      persistirItensOuReverter(antes);
    },

    /* ---------- Orçamento e corredores ---------- */

    definirOrcamento: function (valorReais) {
      var antes = config;
      config = Object.assign({}, config, {
        orcamento: valorReais == null || !(valorReais > 0) ? null : valorReais
      });
      notificar({ tipo: 'config' });
      persistirConfigOuReverter(antes);
    },

    reordenarLayout: function (novaOrdem) {
      var antes = config;
      config = Object.assign({}, config, { layoutAtual: sanearLayout(novaOrdem, chavesCategoriasValidas()) });
      notificar({ tipo: 'config' });
      persistirConfigOuReverter(antes);
    },

    criarCategoriaPersonalizada: function (nome) {
      var nomeLimpo = String(nome || '').trim();
      if (!nomeLimpo) { notificar({ tipo: 'erro', mensagem: 'Informe o nome do corredor.' }); return null; }

      var chave = gerarChaveCategoria(nomeLimpo, chavesCategoriasValidas());
      var antesCategorias = categoriasPersonalizadas;
      categoriasPersonalizadas = categoriasPersonalizadas.concat([{ chave: chave, nome: nomeLimpo, criadoEm: Date.now() }]);

      if (!salvarCategoriasPersonalizadas(categoriasPersonalizadas)) {
        categoriasPersonalizadas = antesCategorias;
        notificar({ tipo: 'erro', mensagem: 'Não foi possível salvar o novo corredor.' });
        return null;
      }

      var antesConfig = config;
      config = Object.assign({}, config, { layoutAtual: config.layoutAtual.concat([chave]) });
      persistirConfigOuReverter(antesConfig);

      notificar({ tipo: 'categorias' });
      return chave;
    },

    /* ---------- Histórico / autocompletar ---------- */

    buscarSugestoesDeProduto: function (texto) {
      return buscarSugestoes(historico, texto, 6);
    },

    /* ---------- Múltiplas listas ---------- */

    criarLista: function (nome) {
      var nomeLimpo = String(nome || '').trim();
      if (!nomeLimpo) { notificar({ tipo: 'erro', mensagem: 'Informe um nome para a lista.' }); return null; }

      var nova = { id: gerarId(), nome: nomeLimpo, criadoEm: Date.now() };
      var antes = listas;
      listas = listas.concat([nova]);

      if (!salvarListas(listas)) {
        listas = antes;
        notificar({ tipo: 'erro', mensagem: 'Não foi possível criar a lista.' });
        return null;
      }

      notificar({ tipo: 'listas' });
      api.alternarLista(nova.id);
      return nova.id;
    },

    renomearLista: function (id, novoNome) {
      var nomeLimpo = String(novoNome || '').trim();
      if (!nomeLimpo) return;

      var antes = listas;
      listas = listas.map(function (l) { return l.id === id ? Object.assign({}, l, { nome: nomeLimpo }) : l; });

      if (!salvarListas(listas)) {
        listas = antes;
        notificar({ tipo: 'erro', mensagem: 'Não foi possível renomear a lista.' });
        return;
      }
      notificar({ tipo: 'listas' });
      if (id === listaAtivaId) agendarPublicacaoRemota();
    },

    excluirLista: function (id) {
      if (listas.length <= 1) { notificar({ tipo: 'erro', mensagem: 'Não é possível excluir a única lista que resta.' }); return; }

      var antes = listas;
      var novaListaDeListas = listas.filter(function (l) { return l.id !== id; });

      if (!salvarListas(novaListaDeListas)) {
        notificar({ tipo: 'erro', mensagem: 'Não foi possível excluir a lista.' });
        return;
      }
      listas = novaListaDeListas;
      excluirDadosDaLista(id);
      notificar({ tipo: 'listas' });

      if (id === listaAtivaId) api.alternarLista(listas[0].id);
    },

    alternarLista: function (id) {
      if (id === listaAtivaId) return;
      if (!listas.some(function (l) { return l.id === id; })) return;

      listaAtivaId = id;
      salvarListaAtivaId(id);
      carregarDadosDaListaAtiva();
      assinarListaAtivaNoFirebase();

      notificar({ tipo: 'itens' });
      notificar({ tipo: 'config' });
      notificar({ tipo: 'lista-alternada' });
    },

    /**
     * Entra em uma lista recebida por link compartilhado. Se o
     * aparelho nunca ouviu falar dela, cria um registro local
     * provisório (o nome de verdade chega pela sincronização
     * assim que o Firebase responder).
     */
    entrarEmListaCompartilhada: function (id) {
      if (!listas.some(function (l) { return l.id === id; })) {
        listas = listas.concat([{ id: id, nome: 'Lista compartilhada', criadoEm: Date.now() }]);
        salvarListas(listas);
        notificar({ tipo: 'listas' });
      }
      if (id === listaAtivaId) { assinarListaAtivaNoFirebase(); return; }
      listaAtivaId = id;
      salvarListaAtivaId(id);
      carregarDadosDaListaAtiva();
      assinarListaAtivaNoFirebase();
      notificar({ tipo: 'itens' });
      notificar({ tipo: 'config' });
      notificar({ tipo: 'lista-alternada' });
    }
  };

  return api;
}

export var loja = criarLoja();
