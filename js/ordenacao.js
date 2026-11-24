/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// arrastar e soltar em cima do SortableJS. só este arquivo conhece a biblioteca, então trocar
// ela mexe só aqui. no toque o arraste só começa depois de uns 200ms segurando (não briga com a
// rolagem); no mouse é na hora

var ATRASO_TOQUE_MS = 200;

export function ehSuportado() {
  return typeof window !== 'undefined' && typeof window.Sortable !== 'undefined';
}

// cria a reordenação num container. cada filho direto precisa de data-id, é ele que volta na
// nova ordem
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
