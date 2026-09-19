/* =========================================================
   Store — única fonte de verdade do estado da aplicação.

   Padrão: toda ação aplica a mudança em memória e notifica os
   inscritos IMEDIATAMENTE (otimista); só depois tenta persistir.
   Se a gravação falhar, o estado é revertido para o snapshot
   anterior e um evento de erro é emitido — a UI nunca fica
   mostrando algo que não foi de fato salvo.
   ========================================================= */

import { criarItem, aplicarEdicao, ErroValidacao } from './modelos.js';
import { carregarItens, salvarItens, carregarConfig, salvarConfig } from './armazenamento.js';
import { ordenarPorCorredor, sanearLayout } from './categorias.js';

var DURACAO_UNDO_MS = 5000;

function criarLoja() {
  var itens = carregarItens();
  var config = carregarConfig();
  var itensRemovidosParaDesfazer = null;
  var temporizadorUndo = null;
  var ouvintes = [];

  function notificar(evento) {
    ouvintes.forEach(function (fn) { fn(evento); });
  }

  /**
   * Tenta persistir o array atual de itens. Se falhar, reverte
   * a memória para o estado anterior à ação e avisa a UI.
   * @param {Item[]} itensAntes
   * @returns {boolean}
   */
  function persistirItensOuReverter(itensAntes) {
    if (salvarItens(itens)) return true;
    itens = itensAntes;
    notificar({ tipo: 'itens' });
    notificar({ tipo: 'erro', mensagem: 'Não foi possível salvar a lista. A alteração foi desfeita.' });
    return false;
  }

  function persistirConfigOuReverter(configAntes) {
    if (salvarConfig(config)) return true;
    config = configAntes;
    notificar({ tipo: 'config' });
    notificar({ tipo: 'erro', mensagem: 'Não foi possível salvar as configurações. A alteração foi desfeita.' });
    return false;
  }

  return {
    /**
     * @param {(evento: {tipo: string, mensagem?: string}) => void} fn
     * @returns {() => void} função para cancelar a inscrição
     */
    inscrever: function (fn) {
      ouvintes.push(fn);
      return function () {
        ouvintes = ouvintes.filter(function (f) { return f !== fn; });
      };
    },

    obterEstado: function () {
      return { itens: itens, config: config, temItensParaDesfazer: itensRemovidosParaDesfazer !== null };
    },

    itensPendentesOrdenados: function () {
      return ordenarPorCorredor(itens.filter(function (i) { return !i.feito; }), config.layoutAtual);
    },

    itensConcluidos: function () {
      return itens.filter(function (i) { return i.feito; }).sort(function (a, b) { return a.criadoEm - b.criadoEm; });
    },

    /**
     * @param {{nome: unknown, quantidade?: unknown, unidade?: unknown, categoriaChave?: unknown, precoUnitario?: unknown}} dados
     */
    adicionarItem: function (dados) {
      var novoItem;
      try {
        novoItem = criarItem(dados);
      } catch (erro) {
        if (erro instanceof ErroValidacao) {
          notificar({ tipo: 'erro', mensagem: erro.message });
          return;
        }
        throw erro;
      }

      var antes = itens;
      itens = itens.concat([novoItem]);
      notificar({ tipo: 'itens' });
      persistirItensOuReverter(antes);
    },

    editarItem: function (id, alteracoes) {
      var antes = itens;
      var encontrado = false;
      itens = itens.map(function (item) {
        if (item.id !== id) return item;
        encontrado = true;
        return aplicarEdicao(item, alteracoes);
      });
      if (!encontrado) { itens = antes; return; }

      notificar({ tipo: 'itens' });
      persistirItensOuReverter(antes);
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

    /**
     * Remove os itens concluídos, guardando o snapshot completo
     * de antes para permitir desfazer com posição exata.
     */
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

    /**
     * Restaura os itens exatamente como estavam antes da limpeza.
     */
    desfazerLimpeza: function () {
      if (itensRemovidosParaDesfazer === null) return;

      clearTimeout(temporizadorUndo);
      var antes = itens;
      var restaurar = itensRemovidosParaDesfazer;
      itens = restaurar;
      itensRemovidosParaDesfazer = null;

      notificar({ tipo: 'itens' });
      notificar({ tipo: 'undo-esconder' });
      persistirItensOuReverter(antes);
    },

    definirOrcamento: function (valorBruto) {
      var antes = config;
      var numero = Number(String(valorBruto).replace(',', '.'));
      config = Object.assign({}, config, {
        orcamento: valorBruto === '' || !Number.isFinite(numero) || numero <= 0 ? null : numero
      });
      notificar({ tipo: 'config' });
      persistirConfigOuReverter(antes);
    },

    aplicarPresetLayout: function (nomePreset, layoutsPreset) {
      var chaves = layoutsPreset[nomePreset];
      if (!chaves) return;
      var antes = config;
      config = Object.assign({}, config, { layoutAtual: chaves.slice(), layoutPreset: nomePreset });
      notificar({ tipo: 'config' });
      persistirConfigOuReverter(antes);
    },

    reordenarLayout: function (novaOrdem) {
      var antes = config;
      config = Object.assign({}, config, { layoutAtual: sanearLayout(novaOrdem), layoutPreset: 'personalizado' });
      notificar({ tipo: 'config' });
      persistirConfigOuReverter(antes);
    }
  };
}

export var loja = criarLoja();
