/* =========================================================
   Arrastar e soltar — reordenação genérica e reaproveitável,
   com suporte unificado a mouse e touch via Pointer Events
   (a API antiga de Drag and Drop do HTML5 não tem suporte
   confiável a touch nos navegadores móveis).

   Usado tanto para reordenar produtos dentro de um corredor
   quanto para reordenar a sequência de corredores — o mesmo
   motor serve pros dois, cada um passando seu próprio container.

   A decisão de "pra onde vai" é toda centralizada em moverId,
   uma função pura; o restante só aplica essa decisão no DOM
   para dar retorno visual imediato durante o arraste.
   ========================================================= */

/**
 * Move um id de uma lista para a posição de outro id (insere
 * imediatamente ANTES do id de destino). Função pura, sem DOM.
 * @param {string[]} ids
 * @param {string} idMovido
 * @param {string|null} idAlvo - id que hoje ocupa a posição de destino;
 *   null ou um id inexistente joga o item movido para o final
 * @returns {string[]}
 */
export function moverId(ids, idMovido, idAlvo) {
  var lista = ids.slice();
  var indiceOrigem = lista.indexOf(idMovido);
  if (indiceOrigem === -1 || idMovido === idAlvo) return lista;

  lista.splice(indiceOrigem, 1);
  var indiceAlvo = idAlvo == null ? -1 : lista.indexOf(idAlvo);
  if (indiceAlvo === -1) { lista.push(idMovido); return lista; }
  lista.splice(indiceAlvo, 0, idMovido);
  return lista;
}

/**
 * Torna os filhos diretos de um container arrastáveis para reordenar.
 * Cada filho precisa de um `dataset.id`. O arraste só começa a partir
 * de um elemento que combine com `seletorAlca` — assim o resto da
 * linha (botões, texto) continua funcionando normalmente por baixo,
 * sem o toque ser sequestrado pelo sistema de arraste.
 *
 * @param {HTMLElement} container
 * @param {{seletorAlca: string, aoSoltar: (novaOrdemDeIds: string[]) => void}} opcoes
 * @returns {() => void} função para desligar os listeners (limpeza)
 */
export function tornarArrastavel(container, opcoes) {
  var elementoArrastando = null;
  var idArrastando = null;
  var pointerIdAtivo = null;

  function idsAtuais() {
    return Array.prototype.map.call(container.children, function (el) { return el.dataset.id; });
  }

  function elementoPorId(id) {
    for (var i = 0; i < container.children.length; i++) {
      if (container.children[i].dataset.id === id) return container.children[i];
    }
    return null;
  }

  function encontrarLinha(elemento) {
    while (elemento && elemento !== container) {
      if (elemento.parentElement === container) return elemento;
      elemento = elemento.parentElement;
    }
    return null;
  }

  function aoPointerDown(evento) {
    if (!evento.target.closest(opcoes.seletorAlca)) return;
    var linha = encontrarLinha(evento.target);
    if (!linha) return;

    elementoArrastando = linha;
    idArrastando = linha.dataset.id;
    pointerIdAtivo = evento.pointerId;
    if (linha.setPointerCapture) linha.setPointerCapture(pointerIdAtivo);
    linha.classList.add('arrastando');
    evento.preventDefault();
  }

  function aoPointerMove(evento) {
    if (!elementoArrastando || evento.pointerId !== pointerIdAtivo) return;
    var y = evento.clientY;
    var irmaos = Array.prototype.slice.call(container.children);

    for (var i = 0; i < irmaos.length; i++) {
      var irmao = irmaos[i];
      if (irmao === elementoArrastando) continue;

      var caixa = irmao.getBoundingClientRect();
      var meio = caixa.top + caixa.height / 2;
      var alvoId;

      if (y < meio && irmao.previousElementSibling !== elementoArrastando) {
        alvoId = irmao.dataset.id;
      } else if (y >= meio && irmao.nextElementSibling !== elementoArrastando) {
        alvoId = irmao.nextElementSibling ? irmao.nextElementSibling.dataset.id : null;
      } else {
        continue;
      }

      var novaOrdem = moverId(idsAtuais(), idArrastando, alvoId);
      novaOrdem.forEach(function (id) {
        var el = elementoPorId(id);
        if (el) container.appendChild(el);
      });
      break; // uma reordenação por evento de movimento já basta
    }
  }

  function finalizar(evento) {
    if (!elementoArrastando || evento.pointerId !== pointerIdAtivo) return;
    elementoArrastando.classList.remove('arrastando');
    if (elementoArrastando.releasePointerCapture) elementoArrastando.releasePointerCapture(pointerIdAtivo);
    var novaOrdem = idsAtuais();
    elementoArrastando = null;
    idArrastando = null;
    pointerIdAtivo = null;
    opcoes.aoSoltar(novaOrdem);
  }

  container.addEventListener('pointerdown', aoPointerDown);
  container.addEventListener('pointermove', aoPointerMove);
  container.addEventListener('pointerup', finalizar);
  container.addEventListener('pointercancel', finalizar);

  return function desligar() {
    container.removeEventListener('pointerdown', aoPointerDown);
    container.removeEventListener('pointermove', aoPointerMove);
    container.removeEventListener('pointerup', finalizar);
    container.removeEventListener('pointercancel', finalizar);
  };
}
