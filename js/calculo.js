/* =========================================================
   Cálculo do carrinho — funções puras, sem efeitos colaterais.
   ========================================================= */

/* ---------- Regras de preço do item ---------- */

/** Tipos de preço aceitos. */
export const TIPO_PRECO = { FECHADO: 'fechado', POR_KG_L: 'porKgL' };

/** Unidades de peso/volume — as únicas que permitem escolher o tipo de preço. */
const FATOR_PARA_BASE = { g: 0.001, kg: 1, ml: 0.001, L: 1 };

/** @param {string} unidade @returns {boolean} */
export function ehUnidadeDeMedida(unidade) {
  return Object.prototype.hasOwnProperty.call(FATOR_PARA_BASE, unidade);
}

/**
 * Tipo de preço efetivo: só g/ml/kg/L admitem "por kg/L"; as demais
 * unidades (un, caixa, pacote) são sempre embalagem fechada.
 * @param {string} unidade
 * @param {string} tipoPreco
 * @returns {'fechado'|'porKgL'}
 */
export function tipoPrecoEfetivo(unidade, tipoPreco) {
  return ehUnidadeDeMedida(unidade) && tipoPreco === TIPO_PRECO.POR_KG_L ? TIPO_PRECO.POR_KG_L : TIPO_PRECO.FECHADO;
}

function arredondarCentavos(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Valor final da linha — é o que alimenta o total da lista e o saldo.
 *  - un/caixa/pacote:            quantidade × preço da embalagem
 *  - g/ml/kg/L + preço fechado:  o valor digitado já é o total da etiqueta
 *  - g/ml/kg/L + preço por kg/L: quantidade convertida (g→kg, ml→L) × preço
 * @param {{quantidade: number, unidade: string, tipoPreco: string, precoInput: number|null}} dados
 * @returns {number} sempre finito e >= 0
 */
export function calcularValorTotal(dados) {
  var preco = dados.precoInput;
  if (preco == null || !Number.isFinite(preco) || preco < 0) return 0;

  var tipo = tipoPrecoEfetivo(dados.unidade, dados.tipoPreco);
  if (!ehUnidadeDeMedida(dados.unidade)) return arredondarCentavos(dados.quantidade * preco);
  if (tipo === TIPO_PRECO.FECHADO) return arredondarCentavos(preco);
  return arredondarCentavos(dados.quantidade * FATOR_PARA_BASE[dados.unidade] * preco);
}

/**
 * Texto de apoio do campo de preço, conforme unidade e tipo.
 * @param {string} unidade
 * @param {string} tipoPreco
 * @returns {string}
 */
export function rotuloDoPreco(unidade, tipoPreco) {
  if (!ehUnidadeDeMedida(unidade)) return 'Preço un.';
  if (tipoPrecoEfetivo(unidade, tipoPreco) === TIPO_PRECO.FECHADO) return 'Preço da embalagem';
  return unidade === 'kg' || unidade === 'g' ? 'Preço por kg' : 'Preço por L';
}

/** Sufixo do rótulo "por kg"/"por L" para a unidade informada. */
export function baseDaUnidade(unidade) {
  return unidade === 'kg' || unidade === 'g' ? 'kg' : 'L';
}

/**
 * Valor da linha de um item (já calculado no próprio item).
 * @param {{valorTotalCalculado?: number}} item
 * @returns {number}
 */
export function totalItem(item) {
  return Number.isFinite(item.valorTotalCalculado) ? item.valorTotalCalculado : 0;
}

/**
 * @param {Item[]} itens
 * @returns {number}
 */
export function totalCarrinho(itens) {
  return arredondarCentavos(itens.reduce(function (soma, item) { return soma + totalItem(item); }, 0));
}

/**
 * @typedef {'neutro'|'ok'|'alerta'|'estourado'} StatusOrcamento
 */

/**
 * Regra de negócio: alerta a partir de 90% do orçamento,
 * estourado a partir de 100%. Sem orçamento definido, é neutro.
 * @param {number} total
 * @param {number|null} orcamento
 * @returns {StatusOrcamento}
 */
export function statusOrcamento(total, orcamento) {
  if (orcamento == null || orcamento <= 0) return 'neutro';
  var proporcao = total / orcamento;
  if (proporcao >= 1) return 'estourado';
  if (proporcao >= 0.9) return 'alerta';
  return 'ok';
}

/**
 * @param {number|null} orcamento
 * @param {number} total
 * @returns {number|null}
 */
export function saldoRestante(orcamento, total) {
  return orcamento == null ? null : orcamento - total;
}

/**
 * @param {number} valor
 * @returns {string}
 */
export function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * @param {number} quantidade
 * @returns {string}
 */
export function formatarQuantidade(quantidade) {
  return Number.isInteger(quantidade) ? String(quantidade) : quantidade.toLocaleString('pt-BR');
}

/**
 * Nome da unidade por extenso, no singular/plural conforme a quantidade.
 * Plural quando a quantidade é maior que 1 ("1 litro", "0,5 litro",
 * "1,5 litros", "2 litros"). Unidades-símbolo (kg, g, ml) não flexionam.
 * @param {number} quantidade
 * @param {string} unidade - chave interna: un, kg, g, L, ml, caixa, pacote
 * @returns {string}
 */
export function rotuloDaUnidade(quantidade, unidade) {
  var formas = {
    un: ['unidade', 'unidades'],
    L: ['litro', 'litros'],
    caixa: ['caixa', 'caixas'],
    pacote: ['pacote', 'pacotes']
  };
  var par = formas[unidade];
  if (!par) return unidade; // kg, g, ml e qualquer valor inesperado ficam como estão
  return quantidade > 1 ? par[1] : par[0];
}

/**
 * "5 unidades", "1 litro", "400 g" — quantidade formatada + unidade flexionada.
 * @param {number} quantidade
 * @param {string} unidade
 * @returns {string}
 */
export function formatarQuantidadeComUnidade(quantidade, unidade) {
  return formatarQuantidade(quantidade) + ' ' + rotuloDaUnidade(quantidade, unidade);
}
