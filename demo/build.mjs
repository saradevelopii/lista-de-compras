/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */
// gera dist-demo/: cópia do app sem firebase, com lista de exemplo, faixa de aviso, código
// minificado (mantendo o aviso de copyright) e tags de prévia pro linkedin.
// uso: node demo/build.mjs   (variável DEMO_URL muda o endereço das tags)

import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

var raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
var aqui = join(raiz, 'demo');
var saida = join(raiz, 'dist-demo');
var url = process.env.DEMO_URL || 'https://qlista-demo.pages.dev/';
var esbuild = process.env.ESBUILD || 'esbuild';

rmSync(saida, { recursive: true, force: true });
mkdirSync(saida, { recursive: true });
['index.html', 'style.css', 'script.js', 'sw.js', 'manifest.json', 'js', 'icons', 'LICENSE', 'THIRD-PARTY-NOTICES.md']
  .forEach(function (c) { cpSync(join(raiz, c), join(saida, c), { recursive: true }); });
if (existsSync(join(aqui, 'capa.png'))) cpSync(join(aqui, 'capa.png'), join(saida, 'capa.png'));

// sem credenciais o app roda só com o armazenamento local
writeFileSync(join(saida, 'js', 'firebase-config.js'), '/*! Qlista | Copyright (c) 2026 Sara Brito. Todos os direitos reservados. */\nexport var FIREBASE_CONFIG = null;\n');

// o cache da demo não pode colidir com o do app real se ficarem no mesmo domínio
var sw = readFileSync(join(saida, 'sw.js'), 'utf8').replace(/qlista-v(\d+)/, 'qlista-demo-v$1');
writeFileSync(join(saida, 'sw.js'), sw);

var arquivosJs = ['script.js', 'sw.js'].concat(readdirSync(join(saida, 'js')).map(function (f) { return 'js/' + f; }));
arquivosJs.forEach(function (f) {
  var caminho = join(saida, f);
  var min = execFileSync(esbuild, [caminho, '--minify', '--legal-comments=inline', '--format=esm'], { encoding: 'utf8' });
  writeFileSync(caminho, min);
});
var css = execFileSync(esbuild, [join(saida, 'style.css'), '--minify', '--legal-comments=inline'], { encoding: 'utf8' });
writeFileSync(join(saida, 'style.css'), css);

var tags = [
  '<meta name="description" content="Lista de compras em PWA, organizada por corredores, com preço, saldo e sincronização. Demonstração com dados fictícios.">',
  '<meta property="og:type" content="website">',
  '<meta property="og:url" content="' + url + '">',
  '<meta property="og:title" content="Qlista · lista de compras que soma enquanto você adiciona">',
  '<meta property="og:description" content="PWA em HTML, CSS e JavaScript puros. Demonstração com dados fictícios.">',
  '<meta property="og:image" content="' + url + 'capa.png">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="627">',
  '<meta name="twitter:card" content="summary_large_image">'
].join('\n  ') + '\n';

var html = readFileSync(join(saida, 'index.html'), 'utf8');
var semente = readFileSync(join(aqui, 'semente.html'), 'utf8');
var faixa = readFileSync(join(aqui, 'faixa.html'), 'utf8');
html = html.replace('</head>', '  ' + tags + '</head>');
html = html.replace(/<body([^>]*)>/, function (m) { return m + '\n' + faixa; });
html = html.replace('<script type="module" src="script.js">', semente + '  <script type="module" src="script.js">');
writeFileSync(join(saida, 'index.html'), html);

console.log('demo gerada em', saida);
