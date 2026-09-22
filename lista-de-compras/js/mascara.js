/* =========================================================
   Máscara monetária — formata em tempo real, dígito a dígito,
   da direita para a esquerda (padrão de campo de valor em BRL).
   Não depende de DOM real além de .value/.addEventListener,
   o que a torna testável fora do navegador.
   ========================================================= */

import { formatarMoeda } from './calculo.js';

/**
 * Converte uma sequência de dígitos (string) no valor formatado
 * em reais, tratando o último dígito como centavos.
 * @param {string} digitos
 * @returns {string} - '' quando não há dígito nenhum
 */
function formatarDigitos(digitos) {
  var limpos = digitos.replace(/^0+(?=\d)/, '');
  if (!limpos) return '';
  var centavos = parseInt(limpos, 10);
  return formatarMoeda(centavos / 100);
}

/**
 * Liga a máscara a um campo de texto: a cada entrada do usuário,
 * reconstrói o valor a partir apenas dos dígitos presentes.
 * @param {HTMLInputElement} elemento
 */
export function aplicarMascaraMoeda(elemento) {
  elemento.addEventListener('input', function () {
    var digitos = elemento.value.replace(/\D/g, '');
    elemento.value = formatarDigitos(digitos);
    if (elemento.setSelectionRange) {
      elemento.setSelectionRange(elemento.value.length, elemento.value.length);
    }
  });
}

/**
 * Pré-preenche um campo mascarado a partir de um valor em reais
 * (usado ao abrir a edição de um item que já tem preço).
 * @param {HTMLInputElement} elemento
 * @param {number|null} valorReais
 */
export function definirValorMascarado(elemento, valorReais) {
  if (valorReais == null || !Number.isFinite(valorReais)) {
    elemento.value = '';
    return;
  }
  elemento.value = formatarDigitos(String(Math.round(valorReais * 100)));
}

/**
 * Extrai o valor numérico em reais a partir do texto mascarado.
 * @param {HTMLInputElement} elemento
 * @returns {number|null} - null quando o campo não tem nenhum dígito
 */
export function valorNumericoMascarado(elemento) {
  var digitos = elemento.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digitos) return null;
  return parseInt(digitos, 10) / 100;
}
