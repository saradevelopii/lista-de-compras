/* =========================================================
   Store — única fonte de verdade do estado da aplicação.

   Padrão: toda ação aplica a mudança em memória e notifica os
   inscritos IMEDIATAMENTE (otimista); só depois tenta persistir
   local e, se a sincronização estiver configurada, publicar no
   Firebase (com um pequeno atraso, para não disparar uma escrita
   remota a cada tecla). Se a gravação local falhar, o estado
   volta ao snapshot anterior e um evento de erro é emitido.
   ========================================================= */

import { criarItem, aplicarEdicao, normalizarItemBruto, itemParaRemoto, ErroValidacao, gerarId } from './modelos.js';
import { totalCarrinho, saldoRestante } from './calculo.js';
import {
  carregarListas, salvarListas, carregarListaAtivaId, salvarListaAtivaId, excluirDadosDaLista,
  carregarPastas, salvarPastas, carregarPastaAtivaId, salvarPastaAtivaId,
  carregarItens, salvarItens, carregarConfig, salvarConfig,
  carregarCategoriasPersonalizadas, salvarCategoriasPersonalizadas,
  carregarHistorico, salvarHistorico,
  carregarPublicacoesPendentes, salvarPublicacoesPendentes
} from './armazenamento.js';
import { ordenarPorCorredor, sanearLayout, combinarCategorias, gerarChaveCategoria, nomeCategoria } from './categorias.js';
import { registrarUso, buscarSugestoes } from './historico.js';
import { assinarLista, publicarLista, reconectar, precisaRecarregar, disponivel as sincronizacaoDisponivel } from './firebaseSync.js';

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
  // se a lista ativa não pertencer à pasta ativa (ex: dado antigo
  // inconsistente), prioriza a pasta — troca pra primeira lista dela
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
  var aplicandoRemoto = false; // evita re-publicar de volta o que acabou de chegar do Firebase

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

  /**
   * Documento publicado no Firebase. Itens no contrato do produto
   * (nome, quantidade, unidade, categoria, tipoPreco, precoInput,
   * valorTotalCalculado, comprado) e um resumo financeiro já calculado.
   */
  function montarDocumentoRemoto(nome, itensDaLista, configDaLista) {
    var todas = combinarCategorias(categoriasPersonalizadas);
    var total = totalCarrinho(itensDaLista);
    return {
      nome: nome,
      itens: itensDaLista.map(function (item) { return itemParaRemoto(item, nomeCategoria(item.categoriaChave, todas)); }),
      config: configDaLista,
      resumo: {
        total: total,
        orcamento: configDaLista.orcamento,
        saldo: saldoRestante(configDaLista.orcamento, total)
      }
    };
  }

  /**
   * Publica deixando a lista marcada como pendente até o servidor
   * confirmar. O dado nunca se perde: ele já está no localStorage
   * antes de qualquer tentativa remota.
   */
  function publicarComRegistro(idDaLista, documento) {
    // Marca ANTES de enviar: offline, o set() do Realtime Database não falha —
    // fica esperando a conexão — e se o app fosse fechado nesse meio-tempo a
    // pendência se perderia. A marca só sai quando o servidor confirma.
    var pendentes = carregarPublicacoesPendentes();
    if (pendentes.indexOf(idDaLista) === -1) salvarPublicacoesPendentes(pendentes.concat([idDaLista]));
    return publicarLista(idDaLista, documento).then(function (ok) {
      if (ok) salvarPublicacoesPendentes(carregarPublicacoesPendentes().filter(function (id) { return id !== idDaLista; }));
      return ok;
    });
  }

  /** Reenvia, do que está salvo localmente, as listas que ficaram sem publicar. */
  function reenviarPublicacoesPendentes() {
    if (!sincronizacaoDisponivel()) return;
    carregarPublicacoesPendentes().forEach(function (id) {
      var lista = listas.filter(function (l) { return l.id === id; })[0];
      if (!lista) { // lista foi excluída enquanto estava pendente
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

  /**
   * Publica imediatamente uma alteração que ainda estava esperando o
   * debounce de ATRASO_PUBLICACAO_MS — chamado quando a aba está
   * prestes a sumir (trocar de app, fechar, ir pra segundo plano).
   * Sem isso, uma edição feita e seguida de fechar a aba rápido demais
   * nunca chegaria a ser publicada pros outros colaboradores (o
   * dispositivo que editou continua com o dado certo no localStorage,
   * só a sincronização remota que ficaria pra trás).
   */
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
      else ressincronizar(true); // voltou ao app (possivelmente após dias): refaz conexão + assinatura
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushPublicacaoPendente);
    window.addEventListener('online', function () { ressincronizar(true); });
    window.addEventListener('focus', function () { ressincronizar(false); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) ressincronizar(true); }); // volta do bfcache
  }

  function sanearConfigRemota(configRemota) {
    var bruta = configRemota || {};
    var orcamento = Number(bruta.orcamento);
    return {
      orcamento: Number.isFinite(orcamento) && orcamento > 0 ? orcamento : null,
      layoutAtual: sanearLayout(Array.isArray(bruta.layoutAtual) ? bruta.layoutAtual : [], chavesCategoriasValidas())
    };
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

  /**
   * Refaz a ligação com o Firebase do zero: reenvia o que ficou pendente,
   * recria a conexão e a assinatura da lista aberta (o que também baixa o
   * valor atual do servidor). Chamado ao voltar para o app, quando a rede
   * volta e quando uma assinatura falha. Idempotente e com trava curta
   * para não disparar várias vezes em sequência (focus + visibilitychange).
   */
  function ressincronizar(forcarConexao) {
    if (!sincronizacaoDisponivel() || !listaAtivaId) return;
    if (precisaRecarregar()) {
      // SDK não carregou (ex: app aberto sem rede) e o navegador não tenta
      // de novo a mesma URL: com a rede de volta, só recarregar resolve.
      if (typeof navigator === 'undefined' || navigator.onLine !== false) notificar({ tipo: 'recarregar-necessario' });
      return;
    }
    var agora = Date.now();
    if (!forcarConexao && agora - ultimaRessincronizacao < 1500) return;
    ultimaRessincronizacao = agora;
    clearTimeout(temporizadorReassinatura);
    temporizadorReassinatura = null;

    reenviarPublicacoesPendentes();   // antes de assinar: o SDK aplica a escrita local por cima do remoto
    if (forcarConexao) reconectar();
    assinarListaAtivaNoFirebase();
  }

  function assinarListaAtivaNoFirebase() {
    if (cancelarAssinaturaRemota) { cancelarAssinaturaRemota(); cancelarAssinaturaRemota = null; }
    if (!listaAtivaId) return;
    var idNoMomento = listaAtivaId;
    var geracao = ++geracaoAssinatura; // descarta respostas de assinaturas já substituídas

    assinarLista(idNoMomento, function (dadosRemotos) {
      if (idNoMomento !== listaAtivaId || geracao !== geracaoAssinatura) return;
      tentativasReassinatura = 0; // chegou dado: a ligação está saudável // a pessoa já trocou de lista antes disso chegar
      if (!dadosRemotos) return; // nada publicado remotamente ainda — mantém o que já temos localmente

      aplicandoRemoto = true;
      var itensRemotos = Array.isArray(dadosRemotos.itens) ? dadosRemotos.itens : Object.values(dadosRemotos.itens || {});
      // normalizar recalcula valorTotalCalculado e aceita tanto o formato
      // novo (comprado...) quanto listas publicadas por versões antigas
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
      aplicandoRemoto = false;
    }, function () {
      if (geracao === geracaoAssinatura) agendarNovaTentativaDeAssinatura();
    }).then(function (cancelar) {
      if (idNoMomento === listaAtivaId && geracao === geracaoAssinatura) cancelarAssinaturaRemota = cancelar;
      else cancelar(); // já trocou de lista (ou foi reassinada) enquanto a assinatura carregava
    });
  }

  /**
   * Pede ao navegador para NÃO apagar os dados do app por falta de espaço
   * (o PWA instalado costuma receber, mas a permissão evita limpezas
   * automáticas do localStorage). Best-effort e silencioso.
   */
  function pedirArmazenamentoPersistente() {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        navigator.storage.persist();
      }
    } catch (erro) { /* sem suporte: segue só com o armazenamento padrão */ }
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
  reenviarPublicacoesPendentes(); // antes de assinar: a escrita local pendente vence um remoto defasado
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

    /**
     * Aplica a nova ordem manual dos itens PENDENTES de uma mesma
     * categoria (arrastar e soltar). Reaproveita o próprio campo
     * criadoEm como número de ordem — não precisa de um campo novo:
     * os itens dessa categoria recebem valores sequenciais a partir
     * do menor criadoEm que já existia entre eles, então a ordenação
     * por corredor (que já desempata por criadoEm) passa a refletir
     * a posição escolhida a dedo. Itens de outras categorias, e os
     * já concluídos, não são tocados.
     * @param {string} categoriaChave
     * @param {string[]} novaOrdemDeIds
     */
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

    /**
     * Só corredores personalizados podem ser excluídos — os fixos são
     * o padrão compartilhado do sistema. Itens que já usavam o corredor
     * excluído não são reclassificados à força: continuam existindo
     * normalmente e, como a chave deles deixa de aparecer na lista de
     * categorias válidas, passam a ser exibidos como "Outros" e ordenados
     * ao final — o mesmo tratamento que qualquer categoria desconhecida
     * já recebe em ordenarPorCorredor/nomeCategoria.
     */
    excluirCategoriaPersonalizada: function (chave) {
      var antes = categoriasPersonalizadas;
      var nova = categoriasPersonalizadas.filter(function (c) { return c.chave !== chave; });
      if (nova.length === antes.length) return; // não é um corredor personalizado — nada a fazer

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

    /* ---------- Histórico / autocompletar ---------- */

    buscarSugestoesDeProduto: function (texto) {
      return buscarSugestoes(historico, texto, 6);
    },

    /* ---------- Múltiplas listas ---------- */

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
        // a lista renomeada não é a que está aberta agora — os itens/config
        // dela não estão em memória, então lemos do que já está salvo
        // localmente pra montar a publicação sem sobrescrever nada
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

    /* ---------- Pastas ---------- */

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

      // toda pasta nasce com uma lista dentro — nunca fica vazia,
      // mesma garantia que "sempre existe ao menos uma lista" já tinha
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

    /**
     * Exclui a pasta e, em cascata, todas as listas que pertenciam só
     * a ela (e os itens/config de cada uma). Não dá pra excluir a
     * última pasta que resta — sempre precisa sobrar pelo menos uma,
     * mesma lógica de "última lista" aplicada um nível acima.
     */
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

    /**
     * Entra em uma lista recebida por link compartilhado. Se o
     * aparelho nunca ouviu falar dela, cria um registro local
     * provisório (o nome de verdade chega pela sincronização
     * assim que o Firebase responder).
     */
    entrarEmListaCompartilhada: function (id) {
      if (!listas.some(function (l) { return l.id === id; })) {
        listas = listas.concat([{ id: id, nome: 'Lista compartilhada', pastaId: pastaAtivaId, criadoEm: Date.now() }]);
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
