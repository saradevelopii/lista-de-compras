/* =========================================================
   Compartilhamento — monta o texto formatado da lista e usa
   a Web Share API, com cópia para a área de transferência
   como alternativa quando ela não existe (a maioria dos
   navegadores de desktop, por exemplo).
   ========================================================= */

import { totalItem, formatarMoeda, formatarQuantidade } from './calculo.js';
import { nomeCategoria } from './categorias.js';

/**
 * @param {string} nomeLista
 * @param {Item[]} pendentes
 * @param {Item[]} concluidos
 * @param {Categoria[]} todasCategorias
 * @returns {string}
 */
export function formatarTextoLista(nomeLista, pendentes, concluidos, todasCategorias) {
  var linhas = ['🛒 Minha Lista de Compras: ' + nomeLista, ''];

  if (pendentes.length === 0 && concluidos.length === 0) {
    linhas.push('(lista vazia)');
    return linhas.join('\n');
  }

  var categoriaAnterior = null;
  pendentes.forEach(function (item) {
    if (item.categoriaChave !== categoriaAnterior) {
      linhas.push('— ' + nomeCategoria(item.categoriaChave, todasCategorias) + ' —');
      categoriaAnterior = item.categoriaChave;
    }
    linhas.push(linhaDoItem(item));
  });

  if (concluidos.length > 0) {
    linhas.push('');
    linhas.push('Já no carrinho:');
    concluidos.forEach(function (item) { linhas.push('✓ ' + linhaDoItem(item)); });
  }

  return linhas.join('\n');
}

function linhaDoItem(item) {
  var texto = '- ' + formatarQuantidade(item.quantidade) + item.unidade + ' ' + item.nome;
  if (item.precoUnitario != null) texto += ' (' + formatarMoeda(totalItem(item)) + ')';
  return texto;
}

/**
 * Compartilha o texto via Web Share API; se indisponível (ou se
 * falhar por outro motivo que não o cancelamento do usuário),
 * cai para a cópia na área de transferência.
 * @param {string} texto
 * @param {string} titulo
 * @returns {Promise<'compartilhado'|'copiado'|'falhou'>}
 */
export function compartilharTexto(texto, titulo) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    return navigator.share({ title: titulo, text: texto })
      .then(function () { return 'compartilhado'; })
      .catch(function (erro) {
        if (erro && erro.name === 'AbortError') return 'compartilhado'; // usuário cancelou, não é falha
        return copiarParaAreaDeTransferencia(texto);
      });
  }
  return copiarParaAreaDeTransferencia(texto);
}

function copiarParaAreaDeTransferencia(texto) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(texto)
      .then(function () { return 'copiado'; })
      .catch(function () { return 'falhou'; });
  }
  return Promise.resolve('falhou');
}
