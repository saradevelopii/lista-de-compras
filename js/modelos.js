/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// entidades e regras de criação. sem DOM e sem armazenamento

import { calcularValorTotal, tipoPrecoEfetivo, TIPO_PRECO } from './calculo.js';

// item: id, nome, quantidade (>0), unidade, categoriaChave, tipoPreco (fechado ou porKgL),
// precoInput (o que foi digitado, null se não tem preço), valorTotalCalculado (o que entra no
// total e no saldo), feito e criadoEm (também desempata a ordem)

export const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'caixa', 'pacote'];
export const UNIDADE_PADRAO = 'un';
export const QUANTIDADE_PADRAO = 1;

// erro de validação do domínio, a tela só mostra a mensagem
export class ErroValidacao extends Error {}

// quantidade vazia vira 1
export function normalizarQuantidade(valor) {
  if (valor === '' || valor === undefined || valor === null) return QUANTIDADE_PADRAO;
  var numero = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(numero) || numero <= 0) return QUANTIDADE_PADRAO;
  return numero;
}

// preço opcional: número ou null
export function normalizarPreco(valor) {
  if (valor === '' || valor === undefined || valor === null) return null;
  var numero = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(numero) || numero < 0) return null;
  return numero;
}

export function normalizarUnidade(valor) {
  return UNIDADES.indexOf(valor) !== -1 ? valor : UNIDADE_PADRAO;
}

// sempre recalcula o valorTotalCalculado, assim nenhum caminho (criar, editar, ler) deixa o
// total fora de sincronia com o preço digitado
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

// só o nome é obrigatório
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

// edição parcial, devolve um objeto novo e recalcula o total
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

// aceita qualquer formato salvo (localStorage antigo ou atual, firebase) e nunca confia no
// valorTotalCalculado que veio, recalcula. itens antigos só tinham precoUnitario (total =
// quantidade x preço): em un/caixa/pacote/kg/L o total se reproduz com os tipos novos; em g/ml
// o total antigo vira preço fechado, pra nenhum valor mudar entre versões
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

// formato gravado no firebase. id, categoriaChave e criadoEm vão junto pra lista voltar igual
// do outro lado; categoria é o nome do corredor
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

// junta por id: os locais vencem em conflito e entram os remotos que o aparelho não conhecia.
// usado uma vez por lista (ver loja.js)
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
