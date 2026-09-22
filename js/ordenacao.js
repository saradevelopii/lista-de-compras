/* =========================================================
   Ordenação manual — adaptador fino sobre o SortableJS.

   Mantém o resto do app desacoplado da biblioteca específica:
   só este arquivo sabe que existe um "SortableJS" por trás.
   Se um dia a lib trocar, só este módulo muda.

   Comportamento por tipo de ponteiro (delay + delayOnTouchOnly
   é o próprio SortableJS que resolve isso corretamente):
   - Touch: só confirma o arraste depois de ~200ms segurando —
     evita conflito com a rolagem vertical nativa da página.
   - Mouse: clique-e-arrasto responde na hora, sem espera.
   ========================================================= */

var ATRASO_TOQUE_MS = 200;

/** @returns {boolean} se o SortableJS carregou com sucesso nesta sessão */
export function ehSuportado() {
  return typeof window !== 'undefined' && typeof window.Sortable !== 'undefined';
}

/**
 * Cria uma instância de reordenação num container. Cada filho
 * direto do elemento precisa ter um `data-id` — é ele que volta
 * na nova ordem passada para `aoFinalizar`.
 *
 * @param {HTMLElement} elemento
 * @param {{
 *   aoFinalizar: (novaOrdemDeIds: string[]) => void,
 *   handle?: string
 * }} opcoes
 * @returns {{destruir: () => void}|null} null se o SortableJS não estiver disponível
 */
export function tornarOrdenavel(elemento, opcoes) {
  if (!ehSuportado()) {
    console.warn('SortableJS indisponível nesta sessão — a reordenação manual fica desativada até a próxima carga da página.');
    return null;
  }

  var instancia = new window.Sortable(elemento, {
    animation: 150,
    delay: ATRASO_TOQUE_MS,
    delayOnTouchOnly: true,
    touchStartThreshold: 5,
    ghostClass: 'ordenavel__fantasma',
    chosenClass: 'ordenavel__escolhido',
    dragClass: 'ordenavel__arrastando',
    handle: opcoes.handle || undefined,
    onEnd: function () {
      var novaOrdem = Array.prototype.map.call(elemento.children, function (el) { return el.dataset.id; });
      opcoes.aoFinalizar(novaOrdem);
    }
  });

  return {
    destruir: function () { instancia.destroy(); }
  };
}
