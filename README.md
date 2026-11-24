# Qlista

Lista de compras em formato de app (PWA), feita só com HTML, CSS e JavaScript, sem framework. Funciona sem internet e, quando o Firebase está configurado, sincroniza listas compartilhadas em tempo real entre aparelhos.

> Projeto autoral de Sara Brito. Todos os direitos reservados, veja [LICENSE](LICENSE).

Repositório privado do app. A vitrine pública (case, prints e redirecionamento) fica em outro repositório.

## O que faz

- **Pastas e listas**: várias listas organizadas em pastas, com abas deslizantes para trocar de lista.
- **Corredores**: os itens são agrupados pelo trajeto da loja; a ordem dos corredores é por lista e dá para criar, renomear e excluir corredores próprios.
- **Preço e total**: embalagem fechada (un, caixa, pacote) multiplica pela quantidade; para g, ml, kg e L dá para escolher entre preço fechado da etiqueta ou preço por kg/L, com conversão automática de g para kg e de ml para L.
- **Orçamento e saldo**: total, saldo restante e alerta a partir de 90% do orçamento, atualizados na hora ao adicionar, editar ou excluir.
- **Compartilhar por link**: quem abre o link edita a mesma lista em tempo real.
- **Offline**: tudo fica no `localStorage` e o service worker guarda o app; as alterações feitas sem rede são enviadas quando a conexão volta.
- **Atualização automática**: o app detecta uma versão nova e se atualiza sozinho.

## Como rodar

```bash
npm install
npm start        # abre em http://localhost:8000
```

Também funciona servindo a pasta com qualquer servidor estático. O service worker exige `localhost` ou HTTPS.

## Sincronização (opcional)

Sem configurar nada o app funciona só com o armazenamento local. Para ligar a sincronização:

1. Crie um projeto no Firebase e um Realtime Database.
2. Preencha `js/firebase-config.js` com a configuração web do projeto.
3. Aplique as regras e a restrição de chave descritas em [SEGURANCA.md](SEGURANCA.md).

## Versão de demonstração

```bash
node demo/build.mjs
```

Gera `dist-demo/` com o app sem Firebase, lista de exemplo, faixa "Demo · dados fictícios", JS e CSS minificados (mantendo o aviso de copyright) e as tags de prévia do LinkedIn. Precisa do `esbuild` no PATH (ou `ESBUILD=/caminho/esbuild`). `DEMO_URL` muda o endereço das tags. Em `demo/` ficam a semente de dados, a faixa e a `capa.png` (1200x627). A pasta `dist-demo/` não vai para o git: o zip dela é enviado direto ao Cloudflare Pages.

## Checklist antes de cada release

- Nenhuma chave secreta no código nem no histórico (a `apiKey` do Firebase web é pública, as regras do banco é que protegem).
- Regras do Realtime Database conferidas (ver SEGURANCA.md) e sem `.read`/`.write` abertos na raiz.
- Versão em `js/identidade.js` e `package.json`, e cache `qlista-vN` em `sw.js`.
- Demo regenerada e testada.

## Estrutura

```
index.html, style.css   tela e estilos
script.js               liga a tela ao estado
sw.js                   service worker (cache e atualização)
js/loja.js              estado e ações (atualização otimista, desfazer, sincronização)
js/modelos.js           item e regras de criação
js/calculo.js           preço, total, saldo e plural das unidades
js/armazenamento.js     localStorage e migrações de formato
js/firebaseSync.js      conexão com o Realtime Database
js/render.js            componentes de interface
```

## Testes

Os testes do projeto são mantidos à parte e não fazem parte deste repositório.

## Versões

A versão exibida em "Sobre" vem de `js/identidade.js` e segue SemVer. O número de cache do `sw.js` (`qlista-vN`) é outro e sobe junto a cada mudança publicada.

## Direitos

© 2026 Sara Brito. Código e conteúdo sob licença proprietária, sem permissão de cópia, modificação ou redistribuição. Bibliotecas de terceiros em [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
