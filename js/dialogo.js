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

/**
 * Substituto estilizado do window.prompt() nativo — o navegador
 * sempre exibe o domínio do site num prompt nativo ("meusite.com
 * diz"), o que não dá pra remover nem estilizar; este componente
 * evita isso por completo, usando um formulário próprio do app.
 *
 * @param {{overlay: HTMLElement, form: HTMLElement, mensagem: HTMLElement, campo: HTMLElement, botaoCancelar: HTMLElement}} elementos
 * @returns {(mensagem: string, valorInicial?: string) => Promise<string|null>} null quando cancelado
 */
export function criarPrompt(elementos) {
  var resolver = null;

  function fechar(resultado) {
    elementos.overlay.hidden = true;
    var resolverAtual = resolver;
    resolver = null;
    if (resolverAtual) resolverAtual(resultado);
  }

  elementos.form.addEventListener('submit', function (evento) {
    evento.preventDefault();
    fechar(elementos.campo.value);
  });

  elementos.botaoCancelar.addEventListener('click', function () { fechar(null); });

  elementos.overlay.addEventListener('click', function (evento) {
    if (evento.target === elementos.overlay) fechar(null);
  });

  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape' && !elementos.overlay.hidden) fechar(null);
  });

  return function perguntar(mensagem, valorInicial) {
    elementos.mensagem.textContent = mensagem;
    elementos.campo.value = valorInicial || '';
    elementos.overlay.hidden = false;
    elementos.campo.focus();
    elementos.campo.select();
    return new Promise(function (resolve) { resolver = resolve; });
  };
}
