/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// diálogo de confirmação reaproveitável: recebe os elementos do DOM e devolve uma função que
// resolve true ou false

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

// no lugar do window.prompt, que sempre mostra o domínio do site (tipo meusite.com diz) e não
// dá pra mudar. aqui é um formulário do próprio app; devolve null se cancelar
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
