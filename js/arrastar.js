/* =========================================================
   Arrastar e soltar — reordenação genérica e reaproveitável,
   com suporte unificado a mouse e touch via Pointer Events.

   O gatilho de confirmação é DIFERENTE por tipo de ponteiro,
   de propósito:
   - Touch/caneta: pressão longa (segurar parado por um tempo).
     É o que distingue "quero arrastar" de "quero rolar a tela",
     já que os dois começam com o dedo se movendo na mesma
     direção — sem esperar um tempo parado, não dá pra saber
     a intenção antes que já seja tarde.
   - Mouse: um pequeno limiar de MOVIMENTO confirma na hora.
     No desktop não existe esse conflito com rolagem por
     arraste, e ninguém espera ter que segurar parado antes de
     arrastar com o mouse — o gesto natural é clicar e já mover.

   Em ambos os casos, soltar sem ter confirmado o arraste (por
   tempo ou por movimento, conforme o caso) é tratado como um
   toque/clique normal — o clique de sempre no botão/linha
   continua funcionando por baixo, sem interferência.

   Usado tanto para reordenar produtos dentro de um corredor
   quanto para reordenar a sequência de corredores.

   A decisão de "pra onde vai" é toda centralizada em moverId,
   uma função pura; o restante só aplica essa decisão no DOM
   para dar retorno visual imediato durante o arraste.
   ========================================================= */

var ATRASO_LONGA_PRESSAO_MS = 450; // touch/caneta
var LIMIAR_CANCELAMENTO_TOQUE_PX = 10; // mover mais que isso ANTES do tempo confirmar = é rolagem, não arraste
var LIMIAR_CONFIRMACAO_MOUSE_PX = 4; // mover mais que isso já confirma o arraste no mouse

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
 * Torna os filhos diretos de um container reordenáveis por
 * pressão longa (touch) ou clique-e-arrasto (mouse).
 * Cada filho precisa de um `dataset.id`.
 *
 * @param {HTMLElement} container
 * @param {{aoSoltar: (novaOrdemDeIds: string[]) => void, atrasoMs?: number}} opcoes
 * @returns {() => void} função para desligar os listeners (limpeza)
 */
export function tornarArrastavel(container, opcoes) {
  var atrasoMs = opcoes.atrasoMs || ATRASO_LONGA_PRESSAO_MS;

  var elementoCandidato = null; // aguardando confirmar (por tempo ou por movimento)
  var elementoArrastando = null; // arraste já confirmado, em andamento
  var idArrastando = null;
  var pointerIdAtivo = null;
  var timerLongaPressao = null;
  var ehMouse = false;
  var origemX = 0;
  var origemY = 0;
  var suprimirProximoClique = false; // evita que o "click" sintético dispare após um arraste de verdade

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

  function limparEsperaConfirmacao() {
    clearTimeout(timerLongaPressao);
    timerLongaPressao = null;
    elementoCandidato = null;
  }

  function confirmarArraste() {
    clearTimeout(timerLongaPressao);
    timerLongaPressao = null;
    elementoArrastando = elementoCandidato;
    idArrastando = elementoArrastando.dataset.id;
    elementoCandidato = null;
    if (elementoArrastando.setPointerCapture) {
      try { elementoArrastando.setPointerCapture(pointerIdAtivo); } catch (erro) { /* ponteiro já pode ter sido liberado */ }
    }
    elementoArrastando.classList.add('arrastando');
    if (!ehMouse && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15); // feedback tátil, quando disponível
  }

  function aplicarReordenacaoVisual(y) {
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

  function aoPointerDown(evento) {
    if (elementoArrastando) return; // já existe um arraste em andamento
    var linha = encontrarLinha(evento.target);
    if (!linha || linha.classList.contains('item--edicao')) return;

    elementoCandidato = linha;
    pointerIdAtivo = evento.pointerId;
    ehMouse = evento.pointerType === 'mouse';
    origemX = evento.clientX;
    origemY = evento.clientY;

    if (!ehMouse) {
      clearTimeout(timerLongaPressao);
      timerLongaPressao = setTimeout(confirmarArraste, atrasoMs);
    }
    // no mouse não agenda nada aqui — a confirmação acontece no primeiro
    // pointermove que passar do limiar de alguns pixels (ver aoPointerMove)
  }

  function aoPointerMove(evento) {
    if (evento.pointerId !== pointerIdAtivo) return;

    if (!elementoArrastando) {
      if (!elementoCandidato) return;

      var dx = evento.clientX - origemX;
      var dy = evento.clientY - origemY;
      var distancia = Math.sqrt(dx * dx + dy * dy);

      if (ehMouse) {
        if (distancia > LIMIAR_CONFIRMACAO_MOUSE_PX) confirmarArraste();
        else return;
      } else {
        if (timerLongaPressao && distancia > LIMIAR_CANCELAMENTO_TOQUE_PX) limparEsperaConfirmacao();
        return;
      }
    }

    if (!elementoArrastando) return;
    if (evento.cancelable) evento.preventDefault(); // arraste já confirmado: trava a rolagem/seleção durante o gesto
    aplicarReordenacaoVisual(evento.clientY);
  }

  function finalizar(evento) {
    if (evento.pointerId !== pointerIdAtivo) return;

    if (!elementoArrastando) {
      // nunca confirmou (nem por tempo no touch, nem por movimento no mouse) -> foi só um toque/clique normal
      limparEsperaConfirmacao();
      pointerIdAtivo = null;
      return;
    }

    elementoArrastando.classList.remove('arrastando');
    if (elementoArrastando.releasePointerCapture) {
      try { elementoArrastando.releasePointerCapture(pointerIdAtivo); } catch (erro) { /* já pode ter sido liberado */ }
    }
    var novaOrdem = idsAtuais();
    suprimirProximoClique = true;
    elementoArrastando = null;
    idArrastando = null;
    pointerIdAtivo = null;
    opcoes.aoSoltar(novaOrdem);
  }

  function aoClicar(evento) {
    if (!suprimirProximoClique) return;
    suprimirProximoClique = false;
    evento.preventDefault();
    evento.stopPropagation();
  }

  container.addEventListener('pointerdown', aoPointerDown);
  container.addEventListener('pointermove', aoPointerMove);
  container.addEventListener('pointerup', finalizar);
  container.addEventListener('pointercancel', function (evento) { limparEsperaConfirmacao(); finalizar(evento); });
  container.addEventListener('click', aoClicar, true); // fase de captura: roda antes do clique normal do item

  return function desligar() {
    clearTimeout(timerLongaPressao);
    container.removeEventListener('pointerdown', aoPointerDown);
    container.removeEventListener('pointermove', aoPointerMove);
    container.removeEventListener('pointerup', finalizar);
    container.removeEventListener('pointercancel', finalizar);
    container.removeEventListener('click', aoClicar, true);
  };
}
