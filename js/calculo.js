/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// contas do carrinho: só funções puras

// --- preço do item ---

export const TIPO_PRECO = { FECHADO: 'fechado', POR_KG_L: 'porKgL' };

// unidades de peso/volume: só elas deixam escolher o tipo de preço
const FATOR_PARA_BASE = { g: 0.001, kg: 1, ml: 0.001, L: 1 };

export function ehUnidadeDeMedida(unidade) {
  return Object.prototype.hasOwnProperty.call(FATOR_PARA_BASE, unidade);
}

// só g/ml/kg/L aceitam preço por kg/L; un, caixa e pacote são sempre embalagem fechada
export function tipoPrecoEfetivo(unidade, tipoPreco) {
  return ehUnidadeDeMedida(unidade) && tipoPreco === TIPO_PRECO.POR_KG_L ? TIPO_PRECO.POR_KG_L : TIPO_PRECO.FECHADO;
}

function arredondarCentavos(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

// valor final da linha, o que entra no total e no saldo. un/caixa/pacote: quantidade x preço da
// embalagem. g/ml/kg/L com preço fechado: o valor digitado já é o total da etiqueta. com preço
// por kg/L: converte g pra kg e ml pra L e multiplica
export function calcularValorTotal(dados) {
  var preco = dados.precoInput;
  if (preco == null || !Number.isFinite(preco) || preco < 0) return 0;

  var tipo = tipoPrecoEfetivo(dados.unidade, dados.tipoPreco);
  if (!ehUnidadeDeMedida(dados.unidade)) return arredondarCentavos(dados.quantidade * preco);
  if (tipo === TIPO_PRECO.FECHADO) return arredondarCentavos(preco);
  return arredondarCentavos(dados.quantidade * FATOR_PARA_BASE[dados.unidade] * preco);
}

// texto do campo de preço conforme a unidade e o tipo
export function rotuloDoPreco(unidade, tipoPreco) {
  if (!ehUnidadeDeMedida(unidade)) return 'Preço un.';
  if (tipoPrecoEfetivo(unidade, tipoPreco) === TIPO_PRECO.FECHADO) return 'Preço da embalagem';
  return unidade === 'kg' || unidade === 'g' ? 'Preço por kg' : 'Preço por L';
}

export function baseDaUnidade(unidade) {
  return unidade === 'kg' || unidade === 'g' ? 'kg' : 'L';
}

// valor da linha (já vem calculado no item)
export function totalItem(item) {
  return Number.isFinite(item.valorTotalCalculado) ? item.valorTotalCalculado : 0;
}

export function totalCarrinho(itens) {
  return arredondarCentavos(itens.reduce(function (soma, item) { return soma + totalItem(item); }, 0));
}

// alerta a partir de 90% do orçamento, estourado a partir de 100%. sem orçamento é neutro
export function statusOrcamento(total, orcamento) {
  if (orcamento == null || orcamento <= 0) return 'neutro';
  var proporcao = total / orcamento;
  if (proporcao >= 1) return 'estourado';
  if (proporcao >= 0.9) return 'alerta';
  return 'ok';
}

export function saldoRestante(orcamento, total) {
  return orcamento == null ? null : orcamento - total;
}

export function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarQuantidade(quantidade) {
  return Number.isInteger(quantidade) ? String(quantidade) : quantidade.toLocaleString('pt-BR');
}

// nome da unidade por extenso, no plural quando a quantidade é maior que 1 (0,5 litro, 1,5
// litros). kg, g e ml não flexionam
export function rotuloDaUnidade(quantidade, unidade) {
  var formas = {
    un: ['unidade', 'unidades'],
    L: ['litro', 'litros'],
    caixa: ['caixa', 'caixas'],
    pacote: ['pacote', 'pacotes']
  };
  var par = formas[unidade];
  if (!par) return unidade; // kg, g, ml e qualquer outra coisa ficam como estão
  return quantidade > 1 ? par[1] : par[0];
}

export function formatarQuantidadeComUnidade(quantidade, unidade) {
  return formatarQuantidade(quantidade) + ' ' + rotuloDaUnidade(quantidade, unidade);
}
