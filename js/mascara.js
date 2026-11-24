/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// máscara de valor em reais: formata dígito a dígito, da direita pra esquerda. só usa value e
// addEventListener, então dá pra testar sem navegador

import { formatarMoeda } from './calculo.js';

// sequência de dígitos vira reais, o último dígito são os centavos
function formatarDigitos(digitos) {
  var limpos = digitos.replace(/^0+(?=\d)/, '');
  if (!limpos) return '';
  var centavos = parseInt(limpos, 10);
  return formatarMoeda(centavos / 100);
}

// liga a máscara no campo, refazendo o valor só com os dígitos
export function aplicarMascaraMoeda(elemento) {
  elemento.addEventListener('input', function () {
    var digitos = elemento.value.replace(/\D/g, '');
    elemento.value = formatarDigitos(digitos);
    if (elemento.setSelectionRange) {
      elemento.setSelectionRange(elemento.value.length, elemento.value.length);
    }
  });
}

// preenche o campo a partir de um valor em reais (edição de item com preço)
export function definirValorMascarado(elemento, valorReais) {
  if (valorReais == null || !Number.isFinite(valorReais)) {
    elemento.value = '';
    return;
  }
  elemento.value = formatarDigitos(String(Math.round(valorReais * 100)));
}

// valor numérico a partir do texto mascarado
export function valorNumericoMascarado(elemento) {
  var digitos = elemento.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digitos) return null;
  return parseInt(digitos, 10) / 100;
}
