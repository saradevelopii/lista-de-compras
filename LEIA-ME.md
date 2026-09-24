# Qlista — lista de compras (PWA)

HTML, CSS e JavaScript puros. Sem build, sem frameworks.

```
lista-de-compras/
├── index.html
├── style.css
├── script.js            ← orquestração (DOM + store)
├── manifest.json
├── sw.js
├── package.json
├── js/
│   ├── modelos.js        ← entidades e validação (Item, normalização)
│   ├── categorias.js     ← categorias fixas + personalizadas, ordenação por corredor
│   ├── calculo.js        ← funções puras: total do carrinho, status de orçamento
│   ├── armazenamento.js  ← única camada que toca o localStorage (migração incluída)
│   ├── loja.js           ← store: estado, ações, UI otimista com rollback, undo, sync
│   ├── render.js         ← componentes de DOM reaproveitáveis
│   ├── mascara.js        ← máscara monetária (preço e orçamento)
│   ├── dialogo.js         ← diálogo de confirmação (Promise-based)
│   ├── historico.js      ← frequência de produtos (para o autocompletar)
│   ├── compartilhar.js   ← texto formatado + Web Share API / clipboard
│   ├── link.js           ← geração/leitura do link compartilhável
│   ├── ordenacao.js      ← adaptador sobre o SortableJS (reordenar por arrastar)
│   ├── identidade.js     ← nome e versão do app (fonte única — edite só aqui)
│   ├── firebaseSync.js   ← sincronização em tempo real (opcional)
│   └── firebase-config.js← suas credenciais do Firebase (edite este)
└── icons/
```

**Dependência externa:** o `index.html` carrega o [SortableJS](https://github.com/SortableJS/Sortable) via CDN (`cdn.jsdelivr.net`), usado só pela reordenação manual (arrastar produtos/corredores). É pré-cacheado pelo Service Worker em "melhor esforço" — se o CDN estiver fora do ar bem na primeira instalação, o resto do app funciona normalmente, só a reordenação fica temporariamente indisponível até o CDN responder.

**Versão do app:** `js/identidade.js` tem `NOME_APP` e `VERSAO_APP` — a única fonte de verdade dos dois. O modal "Sobre" lê esses valores em vez de ter o texto duplicado. Bump a cada mudança publicada (PATCH pra correção, MINOR pra funcionalidade nova) — junto com o `VERSAO` do `sw.js`, que é um identificador técnico de cache à parte, com esquema próprio (`qlista-vN`), não a versão que aparece pro usuário.

**Nota sobre o rebrand (Sacola → Qlista):** o nome trocou em todo lugar visível ao usuário (título, manifest, modal Sobre). As CHAVES do `localStorage` (`sacola:itens`, `sacola:listas` etc.) continuam com o prefixo antigo de propósito — são só identificadores técnicos internos, invisíveis ao usuário, e trocar isso quebraria os dados de quem já usa o app (as listas dele ficariam "perdidas" sob a chave nova). O prefixo do cache do Service Worker (`qlista-vN`), por outro lado, já foi renomeado — esse é seguro de mudar, porque se autolimpa a cada versão de qualquer forma.

## Arquitetura

Cada módulo tem uma única responsabilidade e só conhece a camada abaixo dele:

`script.js` (DOM) → `render.js` (fábricas de elemento) → `loja.js` (estado/ações) → `armazenamento.js` (persistência) + `firebaseSync.js` (sincronização opcional) → `modelos.js` / `categorias.js` / `calculo.js` / `historico.js` (regras puras, sem efeito colateral)

**UI otimista com rollback:** toda ação do usuário atualiza a tela imediatamente e só depois tenta gravar no `localStorage`. Se a gravação falhar, o estado é revertido automaticamente e um toast avisa o que aconteceu.

**Sincronização em tempo real:** cada lista publica seu estado completo (itens + config) no Firebase Realtime Database uns 400ms depois de cada mudança (para não disparar uma escrita a cada tecla). A estratégia de conflito é "o último a publicar vence" sobre o documento inteiro — simples e adequada para poucas pessoas editando a mesma lista; não há mesclagem campo a campo.

## Funcionalidades

- **Múltiplas listas**: crie, renomeie, alterne e exclua quantas listas quiser (botão com o nome da lista, no topo). Itens, orçamento e ordenação de corredores são isolados por lista.
- **Link compartilhável**: dentro de "Minhas Listas", o botão "Copiar link da lista atual" gera uma URL com o id da lista no hash (`#lista=...`). Quem abre esse link — com o Firebase configurado — vê e edita a mesma lista em tempo real.
- **Sincronização em tempo real**: qualquer alteração (adicionar, editar, marcar, excluir) aparece nos outros aparelhos conectados à mesma lista, sem precisar recarregar.
- **Fallback local**: sem Firebase configurado (ou sem internet), tudo continua funcionando normalmente, só local.
- **Quantidade e unidade**: campos separados (`un`, `kg`, `g`, `L`, `ml`, `caixa`, `pacote`). Sem quantidade informada, assume `1 un`.
- **Corredores personalizados**: crie corredores próprios (ex: "Açougue do Bairro") na tela de Ordenação de Corredores — ficam disponíveis na hora, no cadastro e na edição de itens. Também dá pra renomear e excluir, igual às listas (os 9 corredores fixos do sistema não têm essas ações — são o padrão compartilhado).
- **Edição completa**: toca no item para editar nome, quantidade, unidade, categoria e preço; salva no primeiro clique.
- **Autocompletar por frequência**: ao digitar o nome de um produto, sugestões dos itens mais usados aparecem (ordenadas por frequência); escolher uma preenche nome, categoria e unidade habituais.
- **Compartilhar como texto**: botão "Compartilhar" monta um texto formatado (🛒 nome da lista, itens por corredor) e usa a Web Share API, com cópia para a área de transferência como alternativa.
- **Painel financeiro**: total do carrinho, orçamento (com a mesma máscara monetária do preço) e saldo restante, atualizados a cada tecla digitada — inclusive ao apagar o orçamento por completo, o saldo reseta na hora (some, sem deixar valor antigo preso na tela). Sem orçamento definido, o campo mostra "Sem limite". Alerta visual a partir de 90% do orçamento, mais forte ao ultrapassar 100%.
- **Concluídos**: itens marcados vão para uma seção expansível no rodapé, tachados e com opacidade reduzida. "Limpar concluídos" remove todos de uma vez, com "DESFAZER" por 5 segundos.
- **Confirmação antes de remover**: excluir um item (ou uma lista inteira) pede confirmação antes de apagar de vez.
- **Menu institucional** (ícone "⋮"): Sobre, Licença e Suporte.
- **Reordenar arrastando ([SortableJS](https://github.com/SortableJS/Sortable))**: no celular, segure ~200ms antes de mover (evita brigar com a rolagem da tela); no computador, clique e arraste responde na hora. Produtos usam a alça "⠿" como ponto de arraste (o resto da linha continua clicável normalmente); corredores arrastam pela linha inteira. Não existem mais botões de subir/descer. Se o CDN do SortableJS não carregar por algum motivo, o app inteiro continua funcionando normalmente — só a reordenação manual fica temporariamente indisponível.
- **Compartilhar (botão único)**: um só botão "Compartilhar" abre um menu com três opções — texto formatado (WhatsApp/e-mail/clipboard), link editável pelo WhatsApp, ou copiar o link.
- **Atualização automática do PWA**: o app checa se há uma versão nova assim que abre, e depois a cada 15 segundos enquanto fica aberto (mais quando a aba volta a ficar visível). Quando encontra, ativa sozinho — sem precisar de clique nenhum — e mostra uma faixa breve "Atualizando para a versão mais nova…" no topo do fluxo da página (nunca sobrepõe o campo de adicionar produto nem qualquer outro botão) antes de recarregar automaticamente. A única perda possível é o texto que estava sendo digitado num campo naquele instante exato — itens já adicionados não são afetados.

## Configurando o Firebase (opcional, mas necessário para sincronizar)

O app funciona 100% sem isso — é só para ligar a sincronização em tempo real e os links compartilháveis entre aparelhos.

**1. Crie o Realtime Database** (o snippet de configuração padrão do Firebase não inclui isso — é um produto à parte do Analytics):
   - No [console do Firebase](https://console.firebase.google.com/), abra seu projeto.
   - Menu lateral → **Build** → **Realtime Database** → **Create Database**.
   - Escolha a região (qualquer uma serve) e comece em **modo de teste** (regras abertas por 30 dias) — depois troque pelas regras abaixo, que não expiram.
   - Copie a **URL** mostrada no topo da página de dados (algo como `https://SEU-PROJETO-default-rtdb.SUA-REGIAO.firebasedatabase.app` ou `.firebaseio.com`).

**2. `js/firebase-config.js` já está preenchido** com as credenciais deste projeto (`lista-de-compras-qlista`), `databaseURL` incluso:

```js
export var FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBSh9U4ScbPAvJae1NrnDj1TYu34TB5HIM',
  authDomain: 'lista-de-compras-qlista.firebaseapp.com',
  databaseURL: 'https://lista-de-compras-qlista-default-rtdb.firebaseio.com',
  projectId: 'lista-de-compras-qlista'
};
```

**3. Configure as Regras** (Realtime Database → aba **Regras**), para o app funcionar sem exigir login:

```json
{
  "rules": {
    "listas": {
      "$listaId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

⚠️ **Importante saber**: essas regras deixam qualquer pessoa com o link ler e editar aquela lista — não há login. É a troca clássica de simplicidade por segurança para um app desse tipo (uma lista de compras não costuma ter dado sensível), mas não é o ideal para outros usos. Não coloque nada sensível no nome das listas ou dos itens.

**4. Publique e teste**: depois de configurado, abra o app em dois aparelhos (ou duas abas), adicione um item em um e veja aparecer no outro em tempo real.

✅ As credenciais já estão preenchidas — `disponivel()` (em `firebaseSync.js`) já retorna `true`. Falta só o passo 3 (Regras) para a sincronização funcionar de fato: sem regras abertas, o Firebase recusa a leitura/escrita e o app registra o aviso no console, mas continua funcionando 100% local (nada quebra).

## Rodando localmente

```bash
cd lista-de-compras
npm install
npm start
```

Abre em `http://localhost:8000`. Sendo `localhost`, o Service Worker registra normalmente (não funciona em `file://`).

## Testando o offline

⚠️ **"Desinstalar" o atalho da tela inicial NÃO limpa o Service Worker nem o cache.** Os dois ficam presos à origem (o domínio) dentro do navegador, não ao atalho — reinstalar reabre a mesma origem, com o mesmo Service Worker de antes. Pra um teste de verdade "do zero": aba anônima/privada, ou DevTools → Application → Storage → **Clear site data**.

1. Carregue a página uma vez.
2. DevTools → Application → Service Workers, marque *Offline*.
3. Recarregue: listas, itens, orçamento e corredores continuam lá.

## Ao alterar qualquer arquivo

Troque a versão no topo do `sw.js` (já está em `qlista-v21`; na próxima mudança, use `qlista-v22`):

```js
var VERSAO = 'qlista-v22';
```

Sem isso o navegador continua servindo a versão antiga do cache.

## Onde ficam os dados

**Local:** `localStorage`, chaveado por lista (`sacola:itens:<id>`, `sacola:config:<id>`), mais `sacola:listas` (metadados), `sacola:categorias-personalizadas` e `sacola:historico`. Sempre no aparelho, mesmo com o Firebase configurado — é o que garante o funcionamento offline.

**Remoto (se configurado):** Firebase Realtime Database, em `listas/<id>` — nome, itens e config de cada lista, espelhando o que está salvo localmente.

Quem já usava a versão anterior (lista única) é migrado automaticamente na primeira abertura desta versão — os itens e o orçamento viram a primeira lista, chamada "Minha Lista".
