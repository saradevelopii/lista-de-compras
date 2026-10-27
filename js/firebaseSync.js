/* =========================================================
   Sincronização em tempo real via Firebase Realtime Database.

   Módulo isolado e opcional: se js/firebase-config.js ainda
   tiver os valores de exemplo, nada aqui é executado — o app
   inteiro continua funcionando só com o localStorage (o
   "Fallback Local" pedido). O SDK do Firebase só é baixado
   (via import dinâmico do CDN oficial) se a configuração
   parecer válida, então quem não configurou nada não paga
   nenhum custo de rede por isso.

   Estratégia de conflito: "o último a publicar vence", sobre
   o documento inteiro da lista (itens + config). Não há mesclagem
   campo a campo — é a abordagem mais simples que cobre bem o caso
   de uso (poucas pessoas editando a mesma lista de compras),
   mas é bom saber que dois dispositivos editando ao mesmo
   milissegundo podem fazer um deles "vencer" por inteiro.
   ========================================================= */

import { FIREBASE_CONFIG } from './firebase-config.js';

var VERSAO_SDK = '10.14.1';

var appFirebase = null;
var bancoFirebase = null;
var carregamentoEmAndamento = null;
// O navegador guarda o resultado de um import() que falhou: repetir a
// MESMA URL continua falhando até a página ser recarregada. Por isso, uma
// falha de carregamento do SDK marca esta flag e o app pede um recarregamento
// seguro (ver loja.js/script.js) em vez de ficar tentando em vão.
var carregamentoFalhouNestaPagina = false;

/** @returns {boolean} true se o SDK não carregou e só um recarregamento resolve */
export function precisaRecarregar() {
  return carregamentoFalhouNestaPagina;
}

function configuracaoValida() {
  return !!(FIREBASE_CONFIG &&
    FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.indexOf('COLE_AQUI') === -1 &&
    FIREBASE_CONFIG.databaseURL && FIREBASE_CONFIG.databaseURL.indexOf('COLE_AQUI') === -1 &&
    FIREBASE_CONFIG.databaseURL.indexOf('SEU-PROJETO') === -1 &&
    /^https:\/\//.test(FIREBASE_CONFIG.databaseURL));
}

/** @returns {boolean} se a sincronização está configurada e pronta para uso */
export function disponivel() {
  return configuracaoValida();
}

function carregarSdk() {
  if (carregamentoEmAndamento) return carregamentoEmAndamento;
  if (carregamentoFalhouNestaPagina) return Promise.reject(new Error('SDK do Firebase indisponível nesta página (recarregar)'));

  carregamentoEmAndamento = Promise.all([
    import(/* webpackIgnore: true */ 'https://www.gstatic.com/firebasejs/' + VERSAO_SDK + '/firebase-app.js'),
    import(/* webpackIgnore: true */ 'https://www.gstatic.com/firebasejs/' + VERSAO_SDK + '/firebase-database.js')
  ]).then(function (modulos) {
    var appMod = modulos[0];
    var dbMod = modulos[1];
    appFirebase = appMod.initializeApp(FIREBASE_CONFIG);
    bancoFirebase = dbMod.getDatabase(appFirebase);
    return dbMod;
  }).catch(function (erro) {
    carregamentoEmAndamento = null;
    carregamentoFalhouNestaPagina = true;
    throw erro;
  });

  return carregamentoEmAndamento;
}

/**
 * Assina as mudanças remotas de uma lista específica.
 * `aoFalhar` é chamado quando a assinatura não pôde ser criada (SDK
 * indisponível/sem rede) ou foi cancelada pelo servidor — quem chama
 * decide quando tentar de novo (ver ressincronizar em loja.js).
 * @param {string} listaId
 * @param {(dados: object|null) => void} aoReceber
 * @param {(erro: any) => void} [aoFalhar]
 * @returns {Promise<() => void>} função para cancelar a assinatura
 */
export function assinarLista(listaId, aoReceber, aoFalhar) {
  if (!configuracaoValida()) return Promise.resolve(function () {});

  return carregarSdk().then(function (dbMod) {
    var referencia = dbMod.ref(bancoFirebase, 'listas/' + listaId);
    return dbMod.onValue(referencia, function (snapshot) {
      aoReceber(snapshot.val());
    }, function (erro) {
      console.warn('Sincronização em tempo real interrompida:', erro);
      if (aoFalhar) aoFalhar(erro);
    });
  }).catch(function (erro) {
    console.warn('Não foi possível conectar ao Firebase — o app continua funcionando localmente:', erro);
    if (aoFalhar) aoFalhar(erro);
    return function () {};
  });
}

/**
 * Força a conexão (WebSocket) a ser refeita. Depois de dias em segundo
 * plano, o navegador pode ter congelado/derrubado o socket sem o SDK
 * perceber de imediato; ciclar offline→online obriga a reconectar e a
 * baixar o valor atual. Sem efeito se o SDK ainda não foi carregado.
 */
export function reconectar() {
  if (!configuracaoValida() || !bancoFirebase || !carregamentoEmAndamento) return Promise.resolve(false);
  return carregamentoEmAndamento.then(function (dbMod) {
    dbMod.goOffline(bancoFirebase);
    dbMod.goOnline(bancoFirebase);
    return true;
  }).catch(function () { return false; });
}

/**
 * Publica o estado completo de uma lista no Firebase.
 * @param {string} listaId
 * @param {object} dados
 * @returns {Promise<boolean>} sucesso
 */
export function publicarLista(listaId, dados) {
  if (!configuracaoValida()) return Promise.resolve(false);

  return carregarSdk().then(function (dbMod) {
    var referencia = dbMod.ref(bancoFirebase, 'listas/' + listaId);
    return dbMod.set(referencia, dados).then(function () { return true; });
  }).catch(function (erro) {
    console.warn('Não foi possível sincronizar com o Firebase — os dados continuam salvos localmente:', erro);
    return false;
  });
}
