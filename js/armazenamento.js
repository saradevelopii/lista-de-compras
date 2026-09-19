/* =========================================================
   Armazenamento — única camada que toca o localStorage.
   Isola o resto do app de erros de quota, modo privado etc.
   ========================================================= */

import { UNIDADES, gerarId } from './modelos.js';
import { ORDEM_PADRAO, sanearLayout } from './categorias.js';

var CHAVE_ITENS = 'sacola:itens';
var CHAVE_CONFIG = 'sacola:config';

/**
 * Migra um item salvo em versões antigas do app (que só tinham
 * id/nome/feito) para o formato atual, preenchendo os campos
 * novos com os padrões definidos nas regras de negócio.
 */
function migrarItem(bruto) {
  if (!bruto || typeof bruto !== 'object' || !bruto.nome) return null;

  var quantidade = Number(bruto.quantidade);
  var preco = Number(bruto.precoUnitario);

  return {
    id: typeof bruto.id === 'string' && bruto.id ? bruto.id : gerarId(),
    nome: String(bruto.nome),
    quantidade: Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1,
    unidade: UNIDADES.indexOf(bruto.unidade) !== -1 ? bruto.unidade : 'un',
    categoriaChave: typeof bruto.categoriaChave === 'string' && bruto.categoriaChave ? bruto.categoriaChave : 'outros',
    precoUnitario: bruto.precoUnitario != null && Number.isFinite(preco) && preco >= 0 ? preco : null,
    feito: Boolean(bruto.feito),
    criadoEm: Number.isFinite(bruto.criadoEm) ? bruto.criadoEm : Date.now()
  };
}

/** @returns {Item[]} */
export function carregarItens() {
  try {
    var bruto = localStorage.getItem(CHAVE_ITENS);
    var dados = bruto ? JSON.parse(bruto) : [];
    if (!Array.isArray(dados)) return [];
    return dados.map(migrarItem).filter(Boolean);
  } catch (erro) {
    console.warn('Não foi possível ler a lista salva:', erro);
    return [];
  }
}

/**
 * @param {Item[]} itens
 * @returns {boolean} sucesso da gravação
 */
export function salvarItens(itens) {
  try {
    localStorage.setItem(CHAVE_ITENS, JSON.stringify(itens));
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar a lista:', erro);
    return false;
  }
}

/**
 * @typedef {Object} Config
 * @property {number|null} orcamento
 * @property {string[]} layoutAtual
 */

/** @returns {Config} */
export function carregarConfig() {
  try {
    var bruto = localStorage.getItem(CHAVE_CONFIG);
    var dados = bruto ? JSON.parse(bruto) : {};
    var orcamento = Number(dados.orcamento);

    return {
      orcamento: Number.isFinite(orcamento) && orcamento > 0 ? orcamento : null,
      layoutAtual: sanearLayout(dados.layoutAtual || ORDEM_PADRAO)
    };
  } catch (erro) {
    console.warn('Não foi possível ler as configurações salvas:', erro);
    return { orcamento: null, layoutAtual: ORDEM_PADRAO.slice() };
  }
}

/**
 * @param {Config} config
 * @returns {boolean} sucesso da gravação
 */
export function salvarConfig(config) {
  try {
    localStorage.setItem(CHAVE_CONFIG, JSON.stringify(config));
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar as configurações:', erro);
    return false;
  }
}
