/* =========================================================
   Camada de domínio: entidades e regras de criação
   Sem dependências de DOM ou de armazenamento.
   ========================================================= */

/**
 * @typedef {Object} Item
 * @property {string} id
 * @property {string} nome
 * @property {number} quantidade        - sempre > 0
 * @property {string} unidade           - uma de UNIDADES
 * @property {string} categoriaChave    - chave de uma Categoria
 * @property {number|null} precoUnitario - preço estimado ou real; null = não informado
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
 * Cria um novo Item a partir dos dados brutos de formulário.
 * Lança ErroValidacao se o nome estiver vazio — único campo obrigatório.
 * @param {{nome: unknown, quantidade?: unknown, unidade?: unknown, categoriaChave?: unknown, precoUnitario?: unknown}} dados
 * @returns {Item}
 */
export function criarItem(dados) {
  var nome = String(dados && dados.nome != null ? dados.nome : '').trim();
  if (!nome) {
    throw new ErroValidacao('Informe o nome do item.');
  }

  return {
    id: gerarId(),
    nome: nome,
    quantidade: normalizarQuantidade(dados.quantidade),
    unidade: normalizarUnidade(dados.unidade),
    categoriaChave: typeof dados.categoriaChave === 'string' && dados.categoriaChave ? dados.categoriaChave : 'outros',
    precoUnitario: normalizarPreco(dados.precoUnitario),
    feito: false,
    criadoEm: Date.now()
  };
}

/**
 * Aplica alterações parciais a um item existente, mantendo
 * imutabilidade (retorna um novo objeto).
 * @param {Item} item
 * @param {Partial<{nome: unknown, quantidade: unknown, unidade: unknown, categoriaChave: unknown, precoUnitario: unknown}>} alteracoes
 * @returns {Item}
 */
export function aplicarEdicao(item, alteracoes) {
  var nome = alteracoes.nome !== undefined ? String(alteracoes.nome).trim() : item.nome;
  return {
    id: item.id,
    nome: nome || item.nome,
    quantidade: alteracoes.quantidade !== undefined ? normalizarQuantidade(alteracoes.quantidade) : item.quantidade,
    unidade: alteracoes.unidade !== undefined ? normalizarUnidade(alteracoes.unidade) : item.unidade,
    categoriaChave: alteracoes.categoriaChave !== undefined && alteracoes.categoriaChave ? alteracoes.categoriaChave : item.categoriaChave,
    precoUnitario: alteracoes.precoUnitario !== undefined ? normalizarPreco(alteracoes.precoUnitario) : item.precoUnitario,
    feito: item.feito,
    criadoEm: item.criadoEm
  };
}

export function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
