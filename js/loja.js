/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// estado central do app. cada ação muda a memória e avisa a tela na hora; salvar e publicar no
// firebase vem depois. se salvar no localStorage falhar, volta pro estado anterior

import { criarItem, aplicarEdicao, normalizarItemBruto, itemParaRemoto, mesclarItensPorId, ErroValidacao, gerarId } from './modelos.js';
import { totalCarrinho, saldoRestante } from './calculo.js';
import {
  carregarListas, salvarListas, carregarListaAtivaId, salvarListaAtivaId, excluirDadosDaLista,
  carregarPastas, salvarPastas, carregarPastaAtivaId, salvarPastaAtivaId,
  carregarItens, salvarItens, carregarConfig, salvarConfig,
  carregarCategoriasPersonalizadas, salvarCategoriasPersonalizadas,
  carregarHistorico, salvarHistorico,
  carregarPublicacoesPendentes, salvarPublicacoesPendentes,
  carregarListasSemeadas, salvarListasSemeadas
} from './armazenamento.js';
import { ordenarPorCorredor, sanearLayout, combinarCategorias, gerarChaveCategoria, nomeCategoria } from './categorias.js';
import { registrarUso, buscarSugestoes } from './historico.js';
import { VERSAO_APP } from './identidade.js';
import { assinarLista, publicarLista, reconectar, precisaRecarregar, obterStatusSync, aoMudarStatusSync, disponivel as sincronizacaoDisponivel } from './firebaseSync.js';

var DURACAO_UNDO_MS = 5000;
var ATRASO_PUBLICACAO_MS = 400;
var ESPERAS_REASSINATURA_MS = [2000, 5000, 15000, 30000];

function criarLoja() {
  var listas = carregarListas();
  var listaAtivaId = carregarListaAtivaId();
  if (!listas.some(function (l) { return l.id === listaAtivaId; })) {
    listaAtivaId = listas.length ? listas[0].id : null;
  }

  var pastas = carregarPastas();
  var pastaAtivaId = carregarPastaAtivaId();
  if (!pastas.some(function (p) { return p.id === pastaAtivaId; })) {
    pastaAtivaId = pastas.length ? pastas[0].id : null;
  }
  // lista ativa fora da pasta ativa (dado antigo): fica a pasta e abre a primeira lista dela
  if (listaAtivaId && pastaAtivaId) {
    var listaAtivaAtual = listas.filter(function (l) { return l.id === listaAtivaId; })[0];
    if (listaAtivaAtual && listaAtivaAtual.pastaId !== pastaAtivaId) {
      var primeiraDaPasta = listas.filter(function (l) { return l.pastaId === pastaAtivaId; })[0];
      listaAtivaId = primeiraDaPasta ? primeiraDaPasta.id : listaAtivaId;
    }
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
  var geracaoAssinatura = 0;
  var temporizadorReassinatura = null;
  var tentativasReassinatura = 0;
  var ultimaRessincronizacao = 0;
  var aplicandoRemoto = false; // não republica o que acabou de chegar do firebase

  function chavesCategoriasValidas() {
    return combinarCategorias(categoriasPersonalizadas).map(function (c) { return c.chave; });
  }

  function notificar(evento) { ouvintes.forEach(function (fn) { fn(evento); }); }

  function nomeListaAtiva() {
    var encontrada = listas.filter(function (l) { return l.id === listaAtivaId; })[0];
    return encontrada ? encontrada.nome : 'Minha Lista';
  }

  function nomePastaAtiva() {
    var encontrada = pastas.filter(function (p) { return p.id === pastaAtivaId; })[0];
    return encontrada ? encontrada.nome : 'Minhas pastas';
  }

  function listasDaPastaAtiva() {
    return listas.filter(function (l) { return l.pastaId === pastaAtivaId; });
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

  // formato que vai pro firebase: itens + resumo de total e saldo
  function montarDocumentoRemoto(nome, itensDaLista, configDaLista) {
    var todas = combinarCategorias(categoriasPersonalizadas);
    var total = totalCarrinho(itensDaLista);
    return {
      nome: nome,
      atualizadoEm: Date.now(),   // pra saber depois quando e por qual versão foi gravado
      versaoApp: VERSAO_APP,
      itens: itensDaLista.map(function (item) { return itemParaRemoto(item, nomeCategoria(item.categoriaChave, todas)); }),
      config: configDaLista,
      resumo: {
        total: total,
        orcamento: configDaLista.orcamento,
        saldo: saldoRestante(configDaLista.orcamento, total)
      }
    };
  }

  // publica e mantém a lista como pendente até o servidor confirmar
  function publicarComRegistro(idDaLista, documento) {
    // marca antes de enviar: offline o set() não falha, só fica esperando conexão, e se o app
    // fechar nesse meio tempo a pendência se perderia
    var pendentes = carregarPublicacoesPendentes();
    if (pendentes.indexOf(idDaLista) === -1) salvarPublicacoesPendentes(pendentes.concat([idDaLista]));
    return publicarLista(idDaLista, documento).then(function (ok) {
      if (ok) salvarPublicacoesPendentes(carregarPublicacoesPendentes().filter(function (id) { return id !== idDaLista; }));
      return ok;
    });
  }

  // reenvia o que ficou sem publicar
  function reenviarPublicacoesPendentes() {
    if (!sincronizacaoDisponivel()) return;
    carregarPublicacoesPendentes().forEach(function (id) {
      var lista = listas.filter(function (l) { return l.id === id; })[0];
      if (!lista) { // lista apagada enquanto estava pendente
        salvarPublicacoesPendentes(carregarPublicacoesPendentes().filter(function (x) { return x !== id; }));
        return;
      }
      var itensDaLista = id === listaAtivaId ? itens : carregarItens(id);
      var configDaLista = id === listaAtivaId ? config : carregarConfig(id, chavesCategoriasValidas());
      publicarComRegistro(id, montarDocumentoRemoto(lista.nome, itensDaLista, configDaLista));
    });
  }

  function agendarPublicacaoRemota() {
    if (aplicandoRemoto || !sincronizacaoDisponivel() || !listaAtivaId) return;
    clearTimeout(temporizadorPublicacao);
    var idNoMomento = listaAtivaId;
    temporizadorPublicacao = setTimeout(function () {
      temporizadorPublicacao = null;
      publicarComRegistro(idNoMomento, montarDocumentoRemoto(nomeListaAtiva(), itens, config));
    }, ATRASO_PUBLICACAO_MS);
  }

  // manda já o que ainda estava esperando o debounce. usado ao fechar ou trocar de app, senão a
  // última edição não chega nos outros aparelhos
  function flushPublicacaoPendente() {
    if (!temporizadorPublicacao) return;
    clearTimeout(temporizadorPublicacao);
    temporizadorPublicacao = null;
    if (aplicandoRemoto || !sincronizacaoDisponivel() || !listaAtivaId) return;
    publicarComRegistro(listaAtivaId, montarDocumentoRemoto(nomeListaAtiva(), itens, config));
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushPublicacaoPendente();
      else ressincronizar(true); // voltou pro app, pode ter ficado dias fora
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushPublicacaoPendente);
    window.addEventListener('online', function () { ressincronizar(true); });
    window.addEventListener('focus', function () { ressincronizar(false); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) ressincronizar(true); }); // voltou do bfcache
  }

  function sanearConfigRemota(configRemota) {
    var bruta = configRemota || {};
    var orcamento = Number(bruta.orcamento);
    return {
      orcamento: Number.isFinite(orcamento) && orcamento > 0 ? orcamento : null,
      layoutAtual: sanearLayout(Array.isArray(bruta.layoutAtual) ? bruta.layoutAtual : [], chavesCategoriasValidas())
    };
  }

  function listaEstaPendente(id) {
    return carregarPublicacoesPendentes().indexOf(id) !== -1;
  }

  function listaJaSemeada(id) {
    return carregarListasSemeadas().indexOf(id) !== -1;
  }

  function marcarListaSemeada(id) {
    var ids = carregarListasSemeadas();
    if (ids.indexOf(id) === -1) salvarListasSemeadas(ids.concat([id]));
  }

  function agendarNovaTentativaDeAssinatura() {
    if (temporizadorReassinatura || !sincronizacaoDisponivel()) return;
    var espera = Math.min(ESPERAS_REASSINATURA_MS[tentativasReassinatura] || 60000, 60000);
    tentativasReassinatura++;
    temporizadorReassinatura = setTimeout(function () {
      temporizadorReassinatura = null;
      ressincronizar();
    }, espera);
  }

  // refaz a ligação: reenvia pendências, reconecta e reassina a lista aberta (isso baixa o
  // valor atual). roda no foco, quando a rede volta e quando a assinatura cai
  function ressincronizar(forcarConexao) {
    if (!sincronizacaoDisponivel() || !listaAtivaId) return;
    if (precisaRecarregar()) {
      // o sdk não carregou (abriu sem rede) e o navegador não repete o mesmo import, então com
      // rede só recarregando
      if (typeof navigator === 'undefined' || navigator.onLine !== false) notificar({ tipo: 'recarregar-necessario' });
      return;
    }
    var agora = Date.now();
    if (!forcarConexao && agora - ultimaRessincronizacao < 1500) return;
    ultimaRessincronizacao = agora;
    clearTimeout(temporizadorReassinatura);
    temporizadorReassinatura = null;

    reenviarPublicacoesPendentes();   // antes de assinar, pra escrita local ficar por cima do remoto
    if (forcarConexao) reconectar();
    assinarListaAtivaNoFirebase();
  }

  function assinarListaAtivaNoFirebase() {
    if (cancelarAssinaturaRemota) { cancelarAssinaturaRemota(); cancelarAssinaturaRemota = null; }
    if (!listaAtivaId) return;
    var idNoMomento = listaAtivaId;
    var geracao = ++geracaoAssinatura; // ignora resposta de assinatura antiga

    assinarLista(idNoMomento, function (dadosRemotos) {
      if (idNoMomento !== listaAtivaId || geracao !== geracaoAssinatura) return;
      tentativasReassinatura = 0; // chegou dado, a conexão está ok

      // o que só existe aqui e ainda não foi confirmado nunca é sobrescrito por um remoto
      // defasado
      if (listaEstaPendente(idNoMomento)) { reenviarPublicacoesPendentes(); return; }
      // edição local ainda esperando o debounce: aplicar o remoto agora apagaria ela. ela sai
      // em instantes e o eco do servidor traz tudo
      if (temporizadorPublicacao) return;

      // servidor vazio e itens aqui: a lista nasceu neste aparelho e nunca subiu, então envia
      if (!dadosRemotos) {
        if (itens.length > 0) publicarComRegistro(idNoMomento, montarDocumentoRemoto(nomeListaAtiva(), itens, config));
        marcarListaSemeada(idNoMomento);
        return;
      }

      // primeira vez que esta lista fala com o servidor neste aparelho: junta por id o que tem
      // aqui e lá e publica o resultado
      if (!listaJaSemeada(idNoMomento)) {
        marcarListaSemeada(idNoMomento);
        if (itens.length > 0) {
          var remotosParaMesclar = (Array.isArray(dadosRemotos.itens) ? dadosRemotos.itens : Object.values(dadosRemotos.itens || {}))
            .map(normalizarItemBruto).filter(Boolean);
          itens = mesclarItensPorId(itens, remotosParaMesclar);
          salvarItens(idNoMomento, itens);
          notificar({ tipo: 'itens' });
          publicarComRegistro(idNoMomento, montarDocumentoRemoto(nomeListaAtiva(), itens, config));
          return;
        }
      }

      aplicandoRemoto = true;
      try {
        var itensRemotos = Array.isArray(dadosRemotos.itens) ? dadosRemotos.itens : Object.values(dadosRemotos.itens || {});
        // o normalizar recalcula o total e entende tanto o formato novo quanto o de versões
        // antigas
        itens = itensRemotos.map(normalizarItemBruto).filter(Boolean);
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
      } catch (erro) {
        console.error('Falha ao aplicar a atualização remota da lista:', erro);
      } finally {
        // sempre solta a trava, senão o aparelho para de publicar
        aplicandoRemoto = false;
      }
    }, function () {
      if (geracao === geracaoAssinatura) agendarNovaTentativaDeAssinatura();
    }).then(function (cancelar) {
      if (idNoMomento === listaAtivaId && geracao === geracaoAssinatura) cancelarAssinaturaRemota = cancelar;
      else cancelar(); // trocou de lista (ou reassinou) enquanto carregava
    });
  }

  // pede pro navegador não apagar os dados do app quando faltar espaço
  function pedirArmazenamentoPersistente() {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        navigator.storage.persist();
      }
    } catch (erro) { /* sem suporte, segue normal */ }
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
  aoMudarStatusSync(function () { notificar({ tipo: 'sync-status' }); });
  reenviarPublicacoesPendentes(); // antes de assinar, pra pendência local ganhar do remoto
  assinarListaAtivaNoFirebase();
  pedirArmazenamentoPersistente();

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
        pastas: pastas,
        pastaAtivaId: pastaAtivaId,
        nomePastaAtiva: nomePastaAtiva(),
        listasDaPastaAtiva: listasDaPastaAtiva(),
        categoriasPersonalizadas: categoriasPersonalizadas,
        sincronizando: sincronizacaoDisponivel()
      };
    },

    obterStatusSincronizacao: function () {
      return Object.assign({ habilitada: sincronizacaoDisponivel(), listaId: listaAtivaId }, obterStatusSync());
    },

    // publica agora, sem esperar o debounce. usado ao compartilhar, pro link já abrir a lista
    // completa
    publicarListaAtiva: function () {
      if (!sincronizacaoDisponivel() || !listaAtivaId) return Promise.resolve(false);
      clearTimeout(temporizadorPublicacao);
      temporizadorPublicacao = null;
      return publicarComRegistro(listaAtivaId, montarDocumentoRemoto(nomeListaAtiva(), itens, config));
    },

    todasCategorias: function () { return combinarCategorias(categoriasPersonalizadas); },

    itensPendentesOrdenados: function () {
      return ordenarPorCorredor(itens.filter(function (i) { return !i.feito; }), config.layoutAtual);
    },
    itensConcluidos: function () {
      return itens.filter(function (i) { return i.feito; }).sort(function (a, b) { return a.criadoEm - b.criadoEm; });
    },

    // --- itens ---

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

    // --- orçamento e corredores ---

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

    // reordena (arrastar e soltar) os itens pendentes de uma categoria. reaproveita o criadoEm
    // como ordem: os itens da categoria recebem valores em sequência a partir do menor criadoEm
    // que já tinham. outras categorias e concluídos não mudam
    reordenarItensDaCategoria: function (categoriaChave, novaOrdemDeIds) {
      var antes = itens;
      var posicao = {};
      novaOrdemDeIds.forEach(function (id, indice) { posicao[id] = indice; });

      var criadosNaCategoria = itens
        .filter(function (i) { return i.categoriaChave === categoriaChave && !i.feito; })
        .map(function (i) { return i.criadoEm; });
      var baseSequencia = criadosNaCategoria.length ? Math.min.apply(null, criadosNaCategoria) : Date.now();

      itens = itens.map(function (item) {
        if (item.categoriaChave !== categoriaChave || item.feito) return item;
        if (!posicao.hasOwnProperty(item.id)) return item;
        return Object.assign({}, item, { criadoEm: baseSequencia + posicao[item.id] });
      });

      notificar({ tipo: 'itens' });
      persistirItensOuReverter(antes);
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

    renomearCategoriaPersonalizada: function (chave, novoNome) {
      var nomeLimpo = String(novoNome || '').trim();
      if (!nomeLimpo) return;

      var antes = categoriasPersonalizadas;
      var encontrada = false;
      categoriasPersonalizadas = categoriasPersonalizadas.map(function (c) {
        if (c.chave !== chave) return c;
        encontrada = true;
        return Object.assign({}, c, { nome: nomeLimpo });
      });
      if (!encontrada) { categoriasPersonalizadas = antes; return; }

      if (!salvarCategoriasPersonalizadas(categoriasPersonalizadas)) {
        categoriasPersonalizadas = antes;
        notificar({ tipo: 'erro', mensagem: 'Não foi possível renomear o corredor.' });
        return;
      }
      notificar({ tipo: 'categorias' });
    },

    // só corredor personalizado pode ser excluído. itens que usavam ele continuam existindo e
    // aparecem em Outros, no fim da lista
    excluirCategoriaPersonalizada: function (chave) {
      var antes = categoriasPersonalizadas;
      var nova = categoriasPersonalizadas.filter(function (c) { return c.chave !== chave; });
      if (nova.length === antes.length) return; // não é personalizado, nada a fazer

      if (!salvarCategoriasPersonalizadas(nova)) {
        notificar({ tipo: 'erro', mensagem: 'Não foi possível excluir o corredor.' });
        return;
      }
      categoriasPersonalizadas = nova;

      var antesConfig = config;
      config = Object.assign({}, config, { layoutAtual: config.layoutAtual.filter(function (c) { return c !== chave; }) });
      persistirConfigOuReverter(antesConfig);

      notificar({ tipo: 'categorias' });
    },

    // --- histórico e autocompletar ---

    buscarSugestoesDeProduto: function (texto) {
      return buscarSugestoes(historico, texto, 6);
    },

    // --- listas ---

    criarLista: function (nome) {
      var nomeLimpo = String(nome || '').trim();
      if (!nomeLimpo) { notificar({ tipo: 'erro', mensagem: 'Informe um nome para a lista.' }); return null; }
      if (!pastaAtivaId) { notificar({ tipo: 'erro', mensagem: 'Nenhuma pasta selecionada.' }); return null; }

      var nova = { id: gerarId(), nome: nomeLimpo, pastaId: pastaAtivaId, criadoEm: Date.now() };
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

      if (id === listaAtivaId) {
        agendarPublicacaoRemota();
      } else if (sincronizacaoDisponivel()) {
        // a lista renomeada não é a aberta, então itens e config vêm do que está salvo (não
        // estão em memória)
        publicarComRegistro(id, montarDocumentoRemoto(nomeLimpo, carregarItens(id), carregarConfig(id, chavesCategoriasValidas())));
      }
    },

    excluirLista: function (id) {
      var listaAlvo = listas.filter(function (l) { return l.id === id; })[0];
      if (!listaAlvo) return;

      var listasNaMesmaPasta = listas.filter(function (l) { return l.pastaId === listaAlvo.pastaId; });
      if (listasNaMesmaPasta.length <= 1) { notificar({ tipo: 'erro', mensagem: 'Não é possível excluir a única lista desta pasta.' }); return; }

      var novaListaDeListas = listas.filter(function (l) { return l.id !== id; });

      if (!salvarListas(novaListaDeListas)) {
        notificar({ tipo: 'erro', mensagem: 'Não foi possível excluir a lista.' });
        return;
      }
      listas = novaListaDeListas;
      excluirDadosDaLista(id);
      notificar({ tipo: 'listas' });

      if (id === listaAtivaId) {
        var restantesNaPasta = listas.filter(function (l) { return l.pastaId === listaAlvo.pastaId; });
        api.alternarLista(restantesNaPasta[0].id);
      }
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

    // --- pastas ---

    criarPasta: function (nome) {
      var nomeLimpo = String(nome || '').trim();
      if (!nomeLimpo) { notificar({ tipo: 'erro', mensagem: 'Informe um nome para a pasta.' }); return null; }

      var nova = { id: gerarId(), nome: nomeLimpo, criadoEm: Date.now() };
      var antesPastas = pastas;
      pastas = pastas.concat([nova]);

      if (!salvarPastas(pastas)) {
        pastas = antesPastas;
        notificar({ tipo: 'erro', mensagem: 'Não foi possível criar a pasta.' });
        return null;
      }

      // toda pasta nasce com uma lista, nunca fica vazia
      var novaLista = { id: gerarId(), nome: 'Minha Lista', pastaId: nova.id, criadoEm: Date.now() };
      var antesListas = listas;
      listas = listas.concat([novaLista]);

      if (!salvarListas(listas)) {
        listas = antesListas;
        pastas = antesPastas;
        salvarPastas(antesPastas);
        notificar({ tipo: 'erro', mensagem: 'Não foi possível criar a pasta.' });
        return null;
      }

      notificar({ tipo: 'pastas' });
      api.alternarPasta(nova.id);
      return nova.id;
    },

    renomearPasta: function (id, novoNome) {
      var nomeLimpo = String(novoNome || '').trim();
      if (!nomeLimpo) return;

      var antes = pastas;
      pastas = pastas.map(function (p) { return p.id === id ? Object.assign({}, p, { nome: nomeLimpo }) : p; });

      if (!salvarPastas(pastas)) {
        pastas = antes;
        notificar({ tipo: 'erro', mensagem: 'Não foi possível renomear a pasta.' });
        return;
      }
      notificar({ tipo: 'pastas' });
    },

    // apaga a pasta e as listas dela (itens e config junto). a última pasta não pode ser
    // apagada
    excluirPasta: function (id) {
      if (pastas.length <= 1) { notificar({ tipo: 'erro', mensagem: 'Não é possível excluir a única pasta que resta.' }); return; }

      var novaListaDePastas = pastas.filter(function (p) { return p.id !== id; });
      if (!salvarPastas(novaListaDePastas)) {
        notificar({ tipo: 'erro', mensagem: 'Não foi possível excluir a pasta.' });
        return;
      }
      pastas = novaListaDePastas;

      var listasDaPasta = listas.filter(function (l) { return l.pastaId === id; });
      listas = listas.filter(function (l) { return l.pastaId !== id; });
      salvarListas(listas);
      listasDaPasta.forEach(function (l) { excluirDadosDaLista(l.id); });

      notificar({ tipo: 'pastas' });

      if (id === pastaAtivaId) api.alternarPasta(pastas[0].id);
    },

    alternarPasta: function (id) {
      if (id === pastaAtivaId) return;
      if (!pastas.some(function (p) { return p.id === id; })) return;

      pastaAtivaId = id;
      salvarPastaAtivaId(id);
      notificar({ tipo: 'pastas' });

      var primeiraListaDaPasta = listas.filter(function (l) { return l.pastaId === id; })[0];
      if (primeiraListaDaPasta) api.alternarLista(primeiraListaDaPasta.id);
    },

    // entra numa lista recebida por link. se o aparelho não conhece, cria um registro
    // provisório (o nome real chega pela sincronização)
    entrarEmListaCompartilhada: function (id) {
      if (!listas.some(function (l) { return l.id === id; })) {
        listas = listas.concat([{ id: id, nome: 'Lista compartilhada', pastaId: pastaAtivaId, criadoEm: Date.now() }]);
        marcarListaSemeada(id); // o conteúdo vem do servidor, nada local pra semear
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
