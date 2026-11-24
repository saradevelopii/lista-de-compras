/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// importa as listas que vêm do endereço antigo. o endereço antigo empacota o que tem no
// localStorage e manda no hash da URL (#migrar=...). como esse hash pode ser montado por qualquer
// pessoa, nada é gravado sem confirmação e tudo passa por validação antes de entrar

import {
  carregarListas, salvarListas, carregarPastas, salvarPastas, carregarItens, salvarItens,
  salvarConfig, excluirDadosDaLista, salvarListaAtivaId, salvarPastaAtivaId, carregarCategoriasPersonalizadas,
  salvarCategoriasPersonalizadas, carregarHistorico, salvarHistorico
} from './armazenamento.js';
import { normalizarItemBruto, mesclarItensPorId } from './modelos.js';

var PADRAO_HASH = /[#&]migrar=([gj])\.([A-Za-z0-9_-]+)/;
var LIMITE_BYTES = 2 * 1024 * 1024;
var ID_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;

function base64urlParaBytes(texto) {
  var b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function descomprimir(bytes) {
  var fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(fluxo).arrayBuffer().then(function (buf) {
    if (buf.byteLength > LIMITE_BYTES) throw new Error('pacote grande demais');
    return new TextDecoder().decode(buf);
  });
}

function texto(valor, max) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}

function lerJson(dados, chave, padrao) {
  try {
    var bruto = dados && typeof dados[chave] === 'string' ? JSON.parse(dados[chave]) : padrao;
    return bruto == null ? padrao : bruto;
  } catch (erro) {
    return padrao;
  }
}

// só devolve o que dá pra usar: listas com id e nome válidos, itens normalizados
function sanear(pacote) {
  if (!pacote || pacote.v !== 1 || !pacote.dados || typeof pacote.dados !== 'object') return null;
  var dados = pacote.dados;

  var pastas = [];
  var brutasPastas = lerJson(dados, 'sacola:pastas', []);
  (Array.isArray(brutasPastas) ? brutasPastas : []).forEach(function (p) {
    if (p && ID_VALIDO.test(String(p.id)) && texto(p.nome, 200)) {
      pastas.push({ id: String(p.id), nome: texto(p.nome, 200), criadoEm: Number(p.criadoEm) || Date.now() });
    }
  });

  var listas = [];
  var brutasListas = lerJson(dados, 'sacola:listas', []);
  (Array.isArray(brutasListas) ? brutasListas : []).forEach(function (l) {
    if (!l || !ID_VALIDO.test(String(l.id)) || !texto(l.nome, 200)) return;
    var id = String(l.id);
    var brutosItens = lerJson(dados, 'sacola:itens:' + id, []);
    var itens = (Array.isArray(brutosItens) ? brutosItens : []).slice(0, 1000).map(normalizarItemBruto).filter(Boolean);
    var cfg = lerJson(dados, 'sacola:config:' + id, {});
    var orcamento = Number(cfg && cfg.orcamento);
    listas.push({
      id: id,
      nome: texto(l.nome, 200),
      pastaId: ID_VALIDO.test(String(l.pastaId)) ? String(l.pastaId) : null,
      criadoEm: Number(l.criadoEm) || Date.now(),
      itens: itens,
      config: {
        orcamento: Number.isFinite(orcamento) && orcamento > 0 ? orcamento : null,
        layoutAtual: Array.isArray(cfg && cfg.layoutAtual) ? cfg.layoutAtual.filter(function (c) { return typeof c === 'string'; }).slice(0, 100) : []
      }
    });
  });

  var categorias = [];
  var brutasCategorias = lerJson(dados, 'sacola:categorias-personalizadas', []);
  (Array.isArray(brutasCategorias) ? brutasCategorias : []).forEach(function (c) {
    if (c && ID_VALIDO.test(String(c.chave)) && texto(c.nome, 60)) {
      categorias.push({ chave: String(c.chave), nome: texto(c.nome, 60), criadoEm: Number(c.criadoEm) || Date.now() });
    }
  });

  var historico = {};
  var brutoHistorico = lerJson(dados, 'sacola:historico', {});
  if (brutoHistorico && typeof brutoHistorico === 'object' && !Array.isArray(brutoHistorico)) {
    Object.keys(brutoHistorico).slice(0, 2000).forEach(function (nome) {
      if (nome.length <= 100) historico[nome] = brutoHistorico[nome];
    });
  }

  if (!listas.length) return null;
  return { pastas: pastas, listas: listas, categorias: categorias, historico: historico };
}

export function temPacoteNaURL() {
  return typeof location !== 'undefined' && PADRAO_HASH.test(location.hash);
}

export function limparPacoteDaURL() {
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (erro) { /* sem history.replaceState, o hash fica na barra e só */ }
}

// devolve o pacote saneado ou null se não tem nada aproveitável
export function lerPacoteDaURL() {
  if (!temPacoteNaURL()) return Promise.resolve(null);
  var achado = location.hash.match(PADRAO_HASH);
  var tipo = achado[1] + '.';
  var dadosB64 = achado[2];
  if (dadosB64.length > LIMITE_BYTES) return Promise.resolve(null);
  return Promise.resolve().then(function () {
    var bytes = base64urlParaBytes(dadosB64);
    if (tipo === 'g.') return descomprimir(bytes);
    if (tipo === 'j.') return new TextDecoder().decode(bytes);
    throw new Error('formato desconhecido');
  }).then(function (json) {
    return sanear(JSON.parse(json));
  }).catch(function (erro) {
    console.warn('Não foi possível ler as listas do endereço antigo:', erro);
    return null;
  });
}

export function resumirPacote(pacote) {
  return {
    listas: pacote.listas.length,
    itens: pacote.listas.reduce(function (soma, l) { return soma + l.itens.length; }, 0)
  };
}

// soma ao que já existe e nunca sobrescreve. lista com o mesmo id (compartilhada que já está
// aqui) mescla os itens por id
export function aplicarPacote(pacote) {
  var listas = carregarListas();
  var pastas = carregarPastas();

  var padraoVazio = listas.length === 1 && listas[0].nome === 'Minha Lista' && carregarItens(listas[0].id).length === 0;
  var idPadraoVazio = padraoVazio ? listas[0].id : null;
  if (padraoVazio) listas = [];

  pacote.pastas.forEach(function (p) {
    if (!pastas.some(function (x) { return x.id === p.id; })) pastas.push(p);
  });
  var pastaPadrao = pastas[0] ? pastas[0].id : null;

  var primeiraNova = null;
  var pastaDaPrimeiraNova = null;
  var adicionadas = 0;
  pacote.listas.forEach(function (l) {
    var existente = listas.filter(function (x) { return x.id === l.id; })[0];
    if (existente) {
      salvarItens(l.id, mesclarItensPorId(carregarItens(l.id), l.itens));
      return;
    }
    var pastaId = pastas.some(function (p) { return p.id === l.pastaId; }) ? l.pastaId : pastaPadrao;
    listas.push({ id: l.id, nome: l.nome, pastaId: pastaId, criadoEm: l.criadoEm });
    salvarItens(l.id, l.itens);
    salvarConfig(l.id, l.config);
    adicionadas++;
    if (!primeiraNova) { primeiraNova = l.id; pastaDaPrimeiraNova = pastaId; }
  });

  var categorias = carregarCategoriasPersonalizadas();
  pacote.categorias.forEach(function (c) {
    if (!categorias.some(function (x) { return x.chave === c.chave; })) categorias.push(c);
  });
  salvarCategoriasPersonalizadas(categorias);

  var historico = carregarHistorico();
  Object.keys(pacote.historico).forEach(function (nome) {
    if (!(nome in historico)) historico[nome] = pacote.historico[nome];
  });
  salvarHistorico(historico);

  salvarPastas(pastas);
  salvarListas(listas);
  if (idPadraoVazio) excluirDadosDaLista(idPadraoVazio);
  // numa instalação vazia, abre já na primeira lista importada (e na pasta dela, senão a aba some)
  if (primeiraNova && padraoVazio) {
    salvarListaAtivaId(primeiraNova);
    if (pastaDaPrimeiraNova) salvarPastaAtivaId(pastaDaPrimeiraNova);
  }
  return { listasAdicionadas: adicionadas };
}
