/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// único lugar que mexe no localStorage. protege o resto do app de erro de cota, modo privado
// etc. e guarda as migrações de formato

import { gerarId, normalizarItemBruto } from './modelos.js';
import { sanearLayout } from './categorias.js';

var CHAVE_LISTAS = 'sacola:listas';
var CHAVE_LISTA_ATIVA = 'sacola:lista-ativa';
var CHAVE_PASTAS = 'sacola:pastas';
var CHAVE_PASTA_ATIVA = 'sacola:pasta-ativa';
var CHAVE_CATEGORIAS_PERSONALIZADAS = 'sacola:categorias-personalizadas';
var CHAVE_HISTORICO = 'sacola:historico';
var CHAVE_LISTAS_SEMEADAS = 'sacola:sync-semeadas';
var CHAVE_PUBLICACOES_PENDENTES = 'sacola:publicacoes-pendentes';

function chaveItens(listaId) { return 'sacola:itens:' + listaId; }
function chaveConfig(listaId) { return 'sacola:config:' + listaId; }

// --- migração: lista única para várias listas ---
// quem já usava tinha tudo solto em sacola:itens e sacola:config; na primeira carga vira a
// Minha Lista

function migrarParaMultiplasListasSeNecessario() {
  try {
    if (localStorage.getItem(CHAVE_LISTAS)) return; // já migrado

    var itensAntigos = localStorage.getItem('sacola:itens');
    var configAntiga = localStorage.getItem('sacola:config');
    var id = gerarId();

    localStorage.setItem(CHAVE_LISTAS, JSON.stringify([{ id: id, nome: 'Minha Lista', criadoEm: Date.now() }]));
    localStorage.setItem(CHAVE_LISTA_ATIVA, id);
    if (itensAntigos) localStorage.setItem(chaveItens(id), itensAntigos);
    if (configAntiga) localStorage.setItem(chaveConfig(id), configAntiga);
  } catch (erro) {
    console.warn('Não foi possível migrar para o formato de múltiplas listas:', erro);
  }
}
migrarParaMultiplasListasSeNecessario();

// --- migração: listas soltas para pastas ---
// antes não existia pasta. na primeira carga cria a pasta padrão e coloca todas as listas nela

function migrarParaPastasSeNecessario() {
  try {
    if (localStorage.getItem(CHAVE_PASTAS)) return; // já migrado

    var pastaId = gerarId();
    localStorage.setItem(CHAVE_PASTAS, JSON.stringify([{ id: pastaId, nome: 'Minhas pastas', criadoEm: Date.now() }]));
    localStorage.setItem(CHAVE_PASTA_ATIVA, pastaId);

    var listasBrutas = localStorage.getItem(CHAVE_LISTAS);
    if (listasBrutas) {
      var listas = JSON.parse(listasBrutas);
      if (Array.isArray(listas)) {
        listas = listas.map(function (l) { return Object.assign({}, l, { pastaId: pastaId }); });
        localStorage.setItem(CHAVE_LISTAS, JSON.stringify(listas));
      }
    }
  } catch (erro) {
    console.warn('Não foi possível migrar para o formato de pastas:', erro);
  }
}
migrarParaPastasSeNecessario();

// --- listas ---

export function carregarListas() {
  try {
    var bruto = localStorage.getItem(CHAVE_LISTAS);
    var dados = bruto ? JSON.parse(bruto) : [];
    if (!Array.isArray(dados)) return [];
    // lista sem pastaId (dado corrompido ou anterior à migração) vai pra primeira pasta, senão
    // fica invisível
    var pastaPadrao = (function () {
      try {
        var brutoPastas = localStorage.getItem(CHAVE_PASTAS);
        var pastas = brutoPastas ? JSON.parse(brutoPastas) : [];
        return Array.isArray(pastas) && pastas[0] ? pastas[0].id : null;
      } catch (erro) { return null; }
    })();
    return dados.map(function (l) {
      return l && !l.pastaId && pastaPadrao ? Object.assign({}, l, { pastaId: pastaPadrao }) : l;
    });
  } catch (erro) {
    console.warn('Não foi possível ler as listas salvas:', erro);
    return [];
  }
}

export function salvarListas(listas) {
  try {
    localStorage.setItem(CHAVE_LISTAS, JSON.stringify(listas));
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar as listas:', erro);
    return false;
  }
}

export function carregarListaAtivaId() {
  try {
    return localStorage.getItem(CHAVE_LISTA_ATIVA);
  } catch (erro) {
    return null;
  }
}

export function salvarListaAtivaId(id) {
  try {
    localStorage.setItem(CHAVE_LISTA_ATIVA, id);
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar a lista ativa:', erro);
    return false;
  }
}

export function excluirDadosDaLista(listaId) {
  try {
    localStorage.removeItem(chaveItens(listaId));
    localStorage.removeItem(chaveConfig(listaId));
    return true;
  } catch (erro) {
    console.warn('Não foi possível remover os dados da lista:', erro);
    return false;
  }
}

// --- pastas ---

export function carregarPastas() {
  try {
    var bruto = localStorage.getItem(CHAVE_PASTAS);
    var dados = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(dados) ? dados : [];
  } catch (erro) {
    console.warn('Não foi possível ler as pastas salvas:', erro);
    return [];
  }
}

export function salvarPastas(pastas) {
  try {
    localStorage.setItem(CHAVE_PASTAS, JSON.stringify(pastas));
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar as pastas:', erro);
    return false;
  }
}

export function carregarPastaAtivaId() {
  try {
    return localStorage.getItem(CHAVE_PASTA_ATIVA);
  } catch (erro) {
    return null;
  }
}

export function salvarPastaAtivaId(id) {
  try {
    localStorage.setItem(CHAVE_PASTA_ATIVA, id);
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar a pasta ativa:', erro);
    return false;
  }
}

// --- itens e config de cada lista ---

export function carregarItens(listaId) {
  try {
    var bruto = localStorage.getItem(chaveItens(listaId));
    var dados = bruto ? JSON.parse(bruto) : [];
    if (!Array.isArray(dados)) return [];
    return dados.map(normalizarItemBruto).filter(Boolean);
  } catch (erro) {
    console.warn('Não foi possível ler os itens da lista:', erro);
    return [];
  }
}

export function salvarItens(listaId, itens) {
  try {
    localStorage.setItem(chaveItens(listaId), JSON.stringify(itens));
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar os itens da lista:', erro);
    return false;
  }
}

export function carregarConfig(listaId, chavesCategoriasValidas) {
  try {
    var bruto = localStorage.getItem(chaveConfig(listaId));
    var dados = bruto ? JSON.parse(bruto) : {};
    var orcamento = Number(dados.orcamento);
    return {
      orcamento: Number.isFinite(orcamento) && orcamento > 0 ? orcamento : null,
      layoutAtual: sanearLayout(Array.isArray(dados.layoutAtual) ? dados.layoutAtual : [], chavesCategoriasValidas)
    };
  } catch (erro) {
    console.warn('Não foi possível ler as configurações da lista:', erro);
    return { orcamento: null, layoutAtual: sanearLayout([], chavesCategoriasValidas) };
  }
}

export function salvarConfig(listaId, config) {
  try {
    localStorage.setItem(chaveConfig(listaId), JSON.stringify(config));
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar as configurações da lista:', erro);
    return false;
  }
}

// --- corredores personalizados (valem pra todas as listas) ---

export function carregarCategoriasPersonalizadas() {
  try {
    var bruto = localStorage.getItem(CHAVE_CATEGORIAS_PERSONALIZADAS);
    var dados = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(dados) ? dados : [];
  } catch (erro) {
    console.warn('Não foi possível ler os corredores personalizados:', erro);
    return [];
  }
}

export function salvarCategoriasPersonalizadas(categorias) {
  try {
    localStorage.setItem(CHAVE_CATEGORIAS_PERSONALIZADAS, JSON.stringify(categorias));
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar os corredores personalizados:', erro);
    return false;
  }
}

// --- histórico (autocompletar) ---

export function carregarHistorico() {
  try {
    var bruto = localStorage.getItem(CHAVE_HISTORICO);
    var dados = bruto ? JSON.parse(bruto) : {};
    return dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
  } catch (erro) {
    console.warn('Não foi possível ler o histórico de produtos:', erro);
    return {};
  }
}

export function salvarHistorico(historico) {
  try {
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico));
    return true;
  } catch (erro) {
    console.warn('Não foi possível salvar o histórico de produtos:', erro);
    return false;
  }
}

// --- publicações pendentes ---
// ids das listas com alteração que ainda não chegou no firebase. o dado já está salvo; aqui só
// fica o falta enviar, pra reenviar depois (mesmo reabrindo o app)

export function carregarPublicacoesPendentes() {
  try {
    var bruto = localStorage.getItem(CHAVE_PUBLICACOES_PENDENTES);
    var dados = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(dados) ? dados.filter(function (id) { return typeof id === 'string'; }) : [];
  } catch (erro) {
    return [];
  }
}

export function salvarPublicacoesPendentes(ids) {
  try {
    localStorage.setItem(CHAVE_PUBLICACOES_PENDENTES, JSON.stringify(ids));
    return true;
  } catch (erro) {
    console.warn('Não foi possível registrar as publicações pendentes:', erro);
    return false;
  }
}

// --- listas já conciliadas com o firebase ---
// ids das listas cuja primeira conciliação com o servidor já rolou neste aparelho. antes disso
// o conteúdo local (que pode estar na frente) é mesclado com o remoto, não sobrescrito

export function carregarListasSemeadas() {
  try {
    var bruto = localStorage.getItem(CHAVE_LISTAS_SEMEADAS);
    var dados = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(dados) ? dados.filter(function (id) { return typeof id === 'string'; }) : [];
  } catch (erro) {
    return [];
  }
}

export function salvarListasSemeadas(ids) {
  try {
    localStorage.setItem(CHAVE_LISTAS_SEMEADAS, JSON.stringify(ids));
    return true;
  } catch (erro) {
    return false;
  }
}
