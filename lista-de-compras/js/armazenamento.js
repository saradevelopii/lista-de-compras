/* =========================================================
   Armazenamento — única camada que toca o localStorage.
   Isola o resto do app de erros de quota, modo privado etc.,
   e concentra a migração de versões antigas do formato salvo.
   ========================================================= */

import { UNIDADES, gerarId } from './modelos.js';
import { sanearLayout } from './categorias.js';

var CHAVE_LISTAS = 'sacola:listas';
var CHAVE_LISTA_ATIVA = 'sacola:lista-ativa';
var CHAVE_CATEGORIAS_PERSONALIZADAS = 'sacola:categorias-personalizadas';
var CHAVE_HISTORICO = 'sacola:historico';

function chaveItens(listaId) { return 'sacola:itens:' + listaId; }
function chaveConfig(listaId) { return 'sacola:config:' + listaId; }

/* ---------- Migração única: versão de lista única -> múltiplas listas ---------- */
// Quem já usava o app antes desta versão tinha os dados soltos em
// 'sacola:itens' e 'sacola:config'. Na primeira carga desta versão,
// criamos "Minha Lista" com esses dados dentro, sem que a pessoa
// perceba nada mudando.

function migrarParaMultiplasListasSeNecessario() {
  try {
    if (localStorage.getItem(CHAVE_LISTAS)) return; // já migrado

    var itensAntigos = localStorage.getItem('sacola:itens');
    var configAntiga = localStorage.getItem('sacola:config');
    var id = gerarId();

    localStorage.setItem(CHAVE_LISTAS, JSON.stringify([{ id: id, nome: 'Minha Lista', criadoEm: Date.now() }]));
    localStorage.setItem(CHAVE_LISTA_ATIVA, id);
    if (itensAntigos) localStorage.setItem(chaveItens(id), itensAntigos);
    if (configAntiga) localStorage.setItem(chaveConfig(id), configAntiga);
  } catch (erro) {
    console.warn('Não foi possível migrar para o formato de múltiplas listas:', erro);
  }
}
migrarParaMultiplasListasSeNecessario();

/* ---------- Listas (metadados: id, nome, data de criação) ---------- */

export function carregarListas() {
  try {
    var bruto = localStorage.getItem(CHAVE_LISTAS);
    var dados = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(dados) ? dados : [];
  } catch (erro) {
    console.warn('Não foi possível ler as listas salvas:', erro);
    return [];
  }
}

export function salvarListas(listas) {
  try {
    localStorage.setItem(CHAVE_LISTAS, JSON.stringify(listas));
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar as listas:', erro);
    return false;
  }
}

export function carregarListaAtivaId() {
  try {
    return localStorage.getItem(CHAVE_LISTA_ATIVA);
  } catch (erro) {
    return null;
  }
}

export function salvarListaAtivaId(id) {
  try {
    localStorage.setItem(CHAVE_LISTA_ATIVA, id);
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar a lista ativa:', erro);
    return false;
  }
}

export function excluirDadosDaLista(listaId) {
  try {
    localStorage.removeItem(chaveItens(listaId));
    localStorage.removeItem(chaveConfig(listaId));
    return true;
  } catch (erro) {
    console.warn('Não foi possível remover os dados da lista:', erro);
    return false;
  }
}

/* ---------- Itens e config de uma lista específica ---------- */

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

/** @param {string} listaId @returns {Item[]} */
export function carregarItens(listaId) {
  try {
    var bruto = localStorage.getItem(chaveItens(listaId));
    var dados = bruto ? JSON.parse(bruto) : [];
    if (!Array.isArray(dados)) return [];
    return dados.map(migrarItem).filter(Boolean);
  } catch (erro) {
    console.warn('Não foi possível ler os itens da lista:', erro);
    return [];
  }
}

/** @param {string} listaId @param {Item[]} itens @returns {boolean} */
export function salvarItens(listaId, itens) {
  try {
    localStorage.setItem(chaveItens(listaId), JSON.stringify(itens));
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar os itens da lista:', erro);
    return false;
  }
}

/**
 * @param {string} listaId
 * @param {string[]} chavesCategoriasValidas - fixas + personalizadas atuais
 * @returns {{orcamento: number|null, layoutAtual: string[]}}
 */
export function carregarConfig(listaId, chavesCategoriasValidas) {
  try {
    var bruto = localStorage.getItem(chaveConfig(listaId));
    var dados = bruto ? JSON.parse(bruto) : {};
    var orcamento = Number(dados.orcamento);
    return {
      orcamento: Number.isFinite(orcamento) && orcamento > 0 ? orcamento : null,
      layoutAtual: sanearLayout(Array.isArray(dados.layoutAtual) ? dados.layoutAtual : [], chavesCategoriasValidas)
    };
  } catch (erro) {
    console.warn('Não foi possível ler as configurações da lista:', erro);
    return { orcamento: null, layoutAtual: sanearLayout([], chavesCategoriasValidas) };
  }
}

export function salvarConfig(listaId, config) {
  try {
    localStorage.setItem(chaveConfig(listaId), JSON.stringify(config));
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar as configurações da lista:', erro);
    return false;
  }
}

/* ---------- Corredores personalizados (globais — valem para todas as listas) ---------- */

export function carregarCategoriasPersonalizadas() {
  try {
    var bruto = localStorage.getItem(CHAVE_CATEGORIAS_PERSONALIZADAS);
    var dados = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(dados) ? dados : [];
  } catch (erro) {
    console.warn('Não foi possível ler os corredores personalizados:', erro);
    return [];
  }
}

export function salvarCategoriasPersonalizadas(categorias) {
  try {
    localStorage.setItem(CHAVE_CATEGORIAS_PERSONALIZADAS, JSON.stringify(categorias));
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar os corredores personalizados:', erro);
    return false;
  }
}

/* ---------- Histórico de produtos (para o autocompletar) ---------- */

export function carregarHistorico() {
  try {
    var bruto = localStorage.getItem(CHAVE_HISTORICO);
    var dados = bruto ? JSON.parse(bruto) : {};
    return dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
  } catch (erro) {
    console.warn('Não foi possível ler o histórico de produtos:', erro);
    return {};
  }
}

export function salvarHistorico(historico) {
  try {
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico));
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar o histórico de produtos:', erro);
    return false;
  }
}
