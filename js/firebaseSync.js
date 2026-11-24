/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// sincronização em tempo real com o firebase realtime database. módulo opcional: se o firebase-
// config.js ainda estiver com os valores de exemplo nada aqui roda e o app funciona só com
// localStorage. o sdk só é baixado se a config parecer válida. conflito: o último a publicar
// vence, no documento inteiro da lista. serve pra poucas pessoas editando a mesma lista, mas
// dois aparelhos editando no mesmo instante podem sobrescrever um ao outro

import { FIREBASE_CONFIG } from './firebase-config.js';

var VERSAO_SDK = '10.14.1';

var appFirebase = null;
var bancoFirebase = null;
var carregamentoEmAndamento = null;
// o navegador guarda o resultado de um import() que falhou, então repetir a mesma url continua
// falhando até recarregar a página. por isso a falha marca essa flag e o app pede um
// recarregamento (ver loja.js e script.js)
var carregamentoFalhouNestaPagina = false;

// --- estado da sincronização (aparece no Sobre) ---

var statusSync = {
  conectado: null,          // vem do próprio firebase (.info/connected), null = ainda não sei
  ultimaConfirmacao: null,  // hora da última gravação confirmada pelo servidor
  ultimoErro: null          // texto do último erro de gravação ou assinatura
};
var ouvintesStatus = [];

function atualizarStatus(parcial) {
  statusSync = Object.assign({}, statusSync, parcial);
  ouvintesStatus.forEach(function (fn) { fn(statusSync); });
}

export function obterStatusSync() { return statusSync; }

export function aoMudarStatusSync(fn) { ouvintesStatus.push(fn); }

function descreverErro(erro) {
  return String((erro && (erro.code || erro.message)) || erro || 'erro desconhecido').slice(0, 140);
}

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
    // o firebase avisa se o websocket está de pé
    dbMod.onValue(dbMod.ref(bancoFirebase, '.info/connected'), function (snap) {
      atualizarStatus({ conectado: snap.val() === true });
    });
    return dbMod;
  }).catch(function (erro) {
    carregamentoEmAndamento = null;
    carregamentoFalhouNestaPagina = true;
    throw erro;
  });

  return carregamentoEmAndamento;
}

// assina uma lista. aoFalhar roda quando a assinatura não sobe (sem rede, sdk fora) ou o
// servidor cancela; quem chama decide quando tentar de novo
export function assinarLista(listaId, aoReceber, aoFalhar) {
  if (!configuracaoValida()) return Promise.resolve(function () {});

  return carregarSdk().then(function (dbMod) {
    var referencia = dbMod.ref(bancoFirebase, 'listas/' + listaId);
    return dbMod.onValue(referencia, function (snapshot) {
      aoReceber(snapshot.val());
    }, function (erro) {
      console.warn('Sincronização em tempo real interrompida:', erro);
      atualizarStatus({ ultimoErro: 'Leitura: ' + descreverErro(erro) });
      if (aoFalhar) aoFalhar(erro);
    });
  }).catch(function (erro) {
    console.warn('Não foi possível conectar ao Firebase — o app continua funcionando localmente:', erro);
    atualizarStatus({ ultimoErro: 'Conexão: ' + descreverErro(erro) });
    if (aoFalhar) aoFalhar(erro);
    return function () {};
  });
}

// refaz o websocket. depois de dias em segundo plano o navegador pode ter derrubado o socket
// sem o sdk perceber; ciclar offline e online força reconectar e baixar o valor atual
export function reconectar() {
  if (!configuracaoValida() || !bancoFirebase || !carregamentoEmAndamento) return Promise.resolve(false);
  return carregamentoEmAndamento.then(function (dbMod) {
    dbMod.goOffline(bancoFirebase);
    dbMod.goOnline(bancoFirebase);
    return true;
  }).catch(function () { return false; });
}

// publica a lista inteira
export function publicarLista(listaId, dados) {
  if (!configuracaoValida()) return Promise.resolve(false);

  return carregarSdk().then(function (dbMod) {
    var referencia = dbMod.ref(bancoFirebase, 'listas/' + listaId);
    return dbMod.set(referencia, dados).then(function () {
      atualizarStatus({ ultimaConfirmacao: Date.now(), ultimoErro: null });
      return true;
    });
  }).catch(function (erro) {
    console.warn('Não foi possível sincronizar com o Firebase — os dados continuam salvos localmente:', erro);
    atualizarStatus({ ultimoErro: 'Gravação: ' + descreverErro(erro) });
    return false;
  });
}
