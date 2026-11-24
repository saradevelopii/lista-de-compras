/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// monta o texto da lista e compartilha com a Web Share API; sem ela, copia pra área de
// transferência

import { totalItem, formatarMoeda, formatarQuantidadeComUnidade } from './calculo.js';
import { nomeCategoria } from './categorias.js';

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
  var texto = '- ' + formatarQuantidadeComUnidade(item.quantidade, item.unidade) + ' ' + item.nome;
  if (item.precoInput != null) texto += ' (' + formatarMoeda(totalItem(item)) + ')';
  return texto;
}

// tenta compartilhar; se não der (e não foi o usuário cancelando), copia
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
