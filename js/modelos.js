/* =========================================================
   Camada de domínio: entidades e regras de criação
   Sem dependências de DOM ou de armazenamento.
   ========================================================= */

import { calcularValorTotal, tipoPrecoEfetivo, TIPO_PRECO } from './calculo.js';

/**
 * @typedef {Object} Item
 * @property {string} id
 * @property {string} nome
 * @property {number} quantidade        - sempre > 0
 * @property {string} unidade           - uma de UNIDADES
 * @property {string} categoriaChave    - chave de uma Categoria
 * @property {'fechado'|'porKgL'} tipoPreco - como interpretar precoInput (ver calculo.js)
 * @property {number|null} precoInput    - exatamente o valor digitado (reabastece o campo na edição); null = sem preço
 * @property {number} valorTotalCalculado - valor final da linha; alimenta total e saldo
 * @property {boolean} feito
 * @property {number} criadoEm          - epoch ms, usado como desempate de ordenação
 */

/**
 * @typedef {Object} Categoria
 * @property {string} chave
 * @property {string} nome
 */

export const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'caixa', 'pacote'];
export const UNIDADE_PADRAO = 'un';
export const QUANTIDADE_PADRAO = 1;

/**
 * Erro de validação de domínio — nunca deixa a UI travar,
 * apenas sinaliza o que impediu a criação/edição do item.
 */
export class ErroValidacao extends Error {}

/**
 * Converte entrada de formulário (sempre string ou undefined)
 * em um número de quantidade válido, com o padrão de 1 caso vazio.
 * @param {unknown} valor
 * @returns {number}
 */
export function normalizarQuantidade(valor) {
  if (valor === '' || valor === undefined || valor === null) return QUANTIDADE_PADRAO;
  var numero = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(numero) || numero <= 0) return QUANTIDADE_PADRAO;
  return numero;
}

/**
 * Converte entrada de preço (string opcional) em número ou null.
 * @param {unknown} valor
 * @returns {number|null}
 */
export function normalizarPreco(valor) {
  if (valor === '' || valor === undefined || valor === null) return null;
  var numero = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(numero) || numero < 0) return null;
  return numero;
}

export function normalizarUnidade(valor) {
  return UNIDADES.indexOf(valor) !== -1 ? valor : UNIDADE_PADRAO;
}

/**
 * Monta o item completo a partir de campos já normalizados, sempre
 * recalculando valorTotalCalculado — nenhum caminho de criação/edição/
 * leitura consegue deixar o total dessincronizado do preço digitado.
 * @returns {Item}
 */
function montarItem(base) {
  var tipoPreco = tipoPrecoEfetivo(base.unidade, base.tipoPreco);
  var item = {
    id: base.id,
    nome: base.nome,
    quantidade: base.quantidade,
    unidade: base.unidade,
    categoriaChave: base.categoriaChave,
    tipoPreco: tipoPreco,
    precoInput: base.precoInput,
    valorTotalCalculado: 0,
    feito: base.feito,
    criadoEm: base.criadoEm
  };
  item.valorTotalCalculado = calcularValorTotal(item);
  return item;
}

/**
 * Cria um novo Item a partir dos dados brutos de formulário.
 * Lança ErroValidacao se o nome estiver vazio — único campo obrigatório.
 * @param {{nome: unknown, quantidade?: unknown, unidade?: unknown, categoriaChave?: unknown, tipoPreco?: unknown, precoInput?: unknown}} dados
 * @returns {Item}
 */
export function criarItem(dados) {
  var nome = String(dados && dados.nome != null ? dados.nome : '').trim();
  if (!nome) {
    throw new ErroValidacao('Informe o nome do item.');
  }

  return montarItem({
    id: gerarId(),
    nome: nome,
    quantidade: normalizarQuantidade(dados.quantidade),
    unidade: normalizarUnidade(dados.unidade),
    categoriaChave: typeof dados.categoriaChave === 'string' && dados.categoriaChave ? dados.categoriaChave : 'outros',
    tipoPreco: dados.tipoPreco,
    precoInput: normalizarPreco(dados.precoInput),
    feito: false,
    criadoEm: Date.now()
  });
}

/**
 * Aplica alterações parciais a um item existente, mantendo
 * imutabilidade (retorna um novo objeto) e recalculando o valor total.
 * @param {Item} item
 * @param {Partial<{nome: unknown, quantidade: unknown, unidade: unknown, categoriaChave: unknown, tipoPreco: unknown, precoInput: unknown}>} alteracoes
 * @returns {Item}
 */
export function aplicarEdicao(item, alteracoes) {
  var nome = alteracoes.nome !== undefined ? String(alteracoes.nome).trim() : item.nome;
  return montarItem({
    id: item.id,
    nome: nome || item.nome,
    quantidade: alteracoes.quantidade !== undefined ? normalizarQuantidade(alteracoes.quantidade) : item.quantidade,
    unidade: alteracoes.unidade !== undefined ? normalizarUnidade(alteracoes.unidade) : item.unidade,
    categoriaChave: alteracoes.categoriaChave !== undefined && alteracoes.categoriaChave ? alteracoes.categoriaChave : item.categoriaChave,
    tipoPreco: alteracoes.tipoPreco !== undefined ? alteracoes.tipoPreco : item.tipoPreco,
    precoInput: alteracoes.precoInput !== undefined ? normalizarPreco(alteracoes.precoInput) : item.precoInput,
    feito: item.feito,
    criadoEm: item.criadoEm
  });
}

/**
 * Reconstrói um Item a partir de QUALQUER formato salvo — localStorage
 * antigo, localStorage atual ou documento do Firebase (nomes em
 * português: comprado, categoriaChave...). Nunca confia no
 * valorTotalCalculado recebido: recalcula, então dado corrompido ou de
 * versão anterior se auto-corrige.
 *
 * Itens legados (só tinham precoUnitario, total = quantidade × preço):
 *  - un/caixa/pacote/kg/L: o mesmo total é reproduzido com os tipos novos;
 *  - g/ml: o total antigo é preservado como "preço fechado" do item, para
 *    nenhum valor mudar de uma versão para outra.
 * @param {any} bruto
 * @returns {Item|null} null se o registro for inutilizável
 */
export function normalizarItemBruto(bruto) {
  if (!bruto || typeof bruto !== 'object' || !bruto.nome) return null;

  var quantidade = Number(bruto.quantidade);
  quantidade = Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1;
  var unidade = normalizarUnidade(bruto.unidade);

  var tipoPreco = bruto.tipoPreco;
  var precoInput;
  if (bruto.precoInput !== undefined || bruto.tipoPreco !== undefined) {
    precoInput = normalizarPreco(bruto.precoInput);
  } else {
    var legado = normalizarPreco(bruto.precoUnitario);
    if (legado == null) {
      precoInput = null;
    } else if (unidade === 'g' || unidade === 'ml') {
      tipoPreco = TIPO_PRECO.FECHADO;
      precoInput = Math.round(quantidade * legado * 100) / 100;
    } else if (unidade === 'kg' || unidade === 'L') {
      tipoPreco = TIPO_PRECO.POR_KG_L;
      precoInput = legado;
    } else {
      precoInput = legado;
    }
  }

  var feito = bruto.feito !== undefined ? bruto.feito : bruto.comprado;

  return montarItem({
    id: typeof bruto.id === 'string' && bruto.id ? bruto.id : gerarId(),
    nome: String(bruto.nome),
    quantidade: quantidade,
    unidade: unidade,
    categoriaChave: typeof bruto.categoriaChave === 'string' && bruto.categoriaChave ? bruto.categoriaChave : 'outros',
    tipoPreco: tipoPreco,
    precoInput: precoInput,
    feito: Boolean(feito),
    criadoEm: Number.isFinite(bruto.criadoEm) ? bruto.criadoEm : Date.now()
  });
}

/**
 * Formato gravado no Firebase (contrato obrigatório do produto), com id,
 * categoriaChave e criadoEm extras para a lista voltar idêntica do outro
 * lado. `categoria` é o nome legível do corredor.
 * @param {Item} item
 * @param {string} nomeDaCategoria
 */
export function itemParaRemoto(item, nomeDaCategoria) {
  return {
    id: item.id,
    nome: item.nome,
    quantidade: item.quantidade,
    unidade: item.unidade,
    categoria: nomeDaCategoria,
    categoriaChave: item.categoriaChave,
    tipoPreco: item.tipoPreco,
    precoInput: item.precoInput,
    valorTotalCalculado: item.valorTotalCalculado,
    comprado: item.feito,
    criadoEm: item.criadoEm
  };
}

/**
 * União por id: itens locais primeiro (vencem em caso de conflito) e, depois,
 * os remotos que o aparelho ainda não conhecia. Usada uma única vez por
 * lista, na "semeadura" (ver loja.js), para nunca perder itens de nenhum lado.
 * @param {Item[]} locais
 * @param {Item[]} remotos
 * @returns {Item[]}
 */
export function mesclarItensPorId(locais, remotos) {
  var vistos = {};
  var resultado = [];
  locais.concat(remotos).forEach(function (item) {
    if (!item || vistos[item.id]) return;
    vistos[item.id] = true;
    resultado.push(item);
  });
  return resultado;
}

export function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
