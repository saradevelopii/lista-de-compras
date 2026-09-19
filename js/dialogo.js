/* =========================================================
   Diálogo de confirmação — componente reaproveitável.
   Não sabe nada sobre "item" ou "lista": recebe elementos de
   DOM já existentes e devolve uma função confirmar(mensagem)
   que resolve true/false conforme a escolha do usuário.
   ========================================================= */

/**
 * @param {{overlay: HTMLElement, mensagem: HTMLElement, botaoCancelar: HTMLElement, botaoConfirmar: HTMLElement}} elementos
 * @returns {(mensagem: string, textoConfirmar?: string) => Promise<boolean>}
 */
export function criarConfirmador(elementos) {
  var resolver = null;
  var textoConfirmarPadrao = elementos.botaoConfirmar.textContent;

  function fechar(resultado) {
    elementos.overlay.hidden = true;
    var resolverAtual = resolver;
    resolver = null;
    if (resolverAtual) resolverAtual(resultado);
  }

  elementos.botaoCancelar.addEventListener('click', function () { fechar(false); });
  elementos.botaoConfirmar.addEventListener('click', function () { fechar(true); });

  elementos.overlay.addEventListener('click', function (evento) {
    if (evento.target === elementos.overlay) fechar(false);
  });

  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape' && !elementos.overlay.hidden) fechar(false);
  });

  return function confirmar(mensagem, textoConfirmar) {
    elementos.mensagem.textContent = mensagem;
    elementos.botaoConfirmar.textContent = textoConfirmar || textoConfirmarPadrao;
    elementos.overlay.hidden = false;
    elementos.botaoConfirmar.focus();
    return new Promise(function (resolve) { resolver = resolve; });
  };
}
