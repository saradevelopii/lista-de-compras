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

  carregamentoEmAndamento = Promise.all([
    import(/* webpackIgnore: true */ 'https://www.gstatic.com/firebasejs/' + VERSAO_SDK + '/firebase-app.js'),
    import(/* webpackIgnore: true */ 'https://www.gstatic.com/firebasejs/' + VERSAO_SDK + '/firebase-database.js')
  ]).then(function (modulos) {
    var appMod = modulos[0];
    var dbMod = modulos[1];
    appFirebase = appMod.initializeApp(FIREBASE_CONFIG);
    bancoFirebase = dbMod.getDatabase(appFirebase);
    return dbMod;
  });

  return carregamentoEmAndamento;
}

/**
 * Assina as mudanças remotas de uma lista específica.
 * @param {string} listaId
 * @param {(dados: object|null) => void} aoReceber
 * @returns {Promise<() => void>} função para cancelar a assinatura
 */
export function assinarLista(listaId, aoReceber) {
  if (!configuracaoValida()) return Promise.resolve(function () {});

  return carregarSdk().then(function (dbMod) {
    var referencia = dbMod.ref(bancoFirebase, 'listas/' + listaId);
    return dbMod.onValue(referencia, function (snapshot) {
      aoReceber(snapshot.val());
    }, function (erro) {
      console.warn('Sincronização em tempo real indisponível no momento:', erro);
    });
  }).catch(function (erro) {
    console.warn('Não foi possível conectar ao Firebase — o app continua funcionando localmente:', erro);
    return function () {};
  });
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
