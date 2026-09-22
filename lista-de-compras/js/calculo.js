/* =========================================================
   Cálculo do carrinho — funções puras, sem efeitos colaterais.
   ========================================================= */

/**
 * @param {Item} item
 * @returns {number}
 */
export function totalItem(item) {
  if (item.precoUnitario == null) return 0;
  return item.quantidade * item.precoUnitario;
}

/**
 * @param {Item[]} itens
 * @returns {number}
 */
export function totalCarrinho(itens) {
  return itens.reduce(function (soma, item) { return soma + totalItem(item); }, 0);
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
