# Sacola — lista de compras (PWA)

HTML, CSS e JavaScript puros. Sem build, sem frameworks.

```
lista-de-compras/
├── index.html
├── style.css
├── script.js          ← orquestração (DOM + store)
├── manifest.json
├── sw.js
├── package.json
├── js/
│   ├── modelos.js      ← entidades e validação (Item, normalização)
│   ├── categorias.js   ← categorias, presets de rota de loja, ordenação por corredor
│   ├── calculo.js      ← funções puras: total do carrinho, status de orçamento
│   ├── armazenamento.js← única camada que toca o localStorage (com migração)
│   ├── loja.js         ← store: estado, ações, UI otimista com rollback, undo
│   └── render.js        ← componentes de DOM reaproveitáveis
└── icons/
```

## Arquitetura

Cada módulo tem uma única responsabilidade e só conhece a camada abaixo dele:

`script.js` (DOM) → `render.js` (fábricas de elemento) → `loja.js` (estado/ações) → `armazenamento.js` (persistência) → `modelos.js` / `categorias.js` / `calculo.js` (regras puras, sem efeito colateral)

**UI otimista com rollback:** toda ação do usuário (adicionar, marcar, editar, limpar) atualiza a tela imediatamente e só depois tenta gravar no `localStorage`. Se a gravação falhar — por exemplo, quota excedida ou modo privado do navegador —, o estado é revertido automaticamente e um toast avisa o que aconteceu. Nunca fica algo na tela que não foi de fato salvo.

## Funcionalidades

- **Quantidade e unidade**: campos separados no formulário (`un`, `kg`, `g`, `L`, `ml`, `caixa`, `pacote`). Se a quantidade não for informada, assume `1 un`.
- **Corredores**: cada item tem uma categoria; o botão "Corredores" no topo abre um painel com dois layouts prontos (Padrão / Expresso) e reordenação manual por categoria — a lista de pendentes se reagrupa na hora.
- **Painel financeiro**: total do carrinho (quantidade × preço de cada item), campo de orçamento e saldo restante, sempre visíveis no topo. Aviso visual a partir de 90% do orçamento e outro, mais forte, ao ultrapassar 100% — reaproveitando o próprio vermelho da paleta, sem cor nova.
- **Concluídos**: itens marcados não somem — vão para uma seção expansível no rodapé, com texto tachado e opacidade reduzida. "Limpar concluídos" remove todos de uma vez.
- **Desfazer**: ao limpar, um snackbar aparece por 5 segundos com o botão "DESFAZER", que restaura os itens exatamente na posição e no estado em que estavam.

## Rodando localmente

```bash
cd lista-de-compras
npm install
npm start
```

Abre em `http://localhost:8000`. Sendo `localhost`, o Service Worker registra normalmente (não funciona em `file://`).

## Testando o offline

1. Carregue a página uma vez.
2. DevTools → Application → Service Workers, marque *Offline*.
3. Recarregue: a lista, o orçamento e os corredores continuam lá.

## Ao alterar qualquer arquivo

Troque a versão no topo do `sw.js` (já está em `sacola-v2`; na próxima mudança, use `sacola-v3`):

```js
var VERSAO = 'sacola-v3';
```

Sem isso o navegador continua servindo a versão antiga do cache.

## Onde ficam os dados

Tudo no `localStorage`, em duas chaves — `sacola:itens` e `sacola:config` (orçamento e layout de corredores) —, só no aparelho. Não há servidor nem sincronização entre dispositivos.
