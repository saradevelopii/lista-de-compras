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
│   ├── categorias.js   ← categorias e ordenação por corredor
│   ├── calculo.js      ← funções puras: total do carrinho, status de orçamento
│   ├── armazenamento.js← única camada que toca o localStorage (com migração)
│   ├── loja.js         ← store: estado, ações, UI otimista com rollback, undo
│   ├── render.js       ← componentes de DOM reaproveitáveis
│   ├── mascara.js      ← máscara monetária do campo de preço
│   └── dialogo.js      ← diálogo de confirmação (Promise-based)
└── icons/
```

## Arquitetura

Cada módulo tem uma única responsabilidade e só conhece a camada abaixo dele:

`script.js` (DOM) → `render.js` (fábricas de elemento) → `loja.js` (estado/ações) → `armazenamento.js` (persistência) → `modelos.js` / `categorias.js` / `calculo.js` (regras puras, sem efeito colateral)

**UI otimista com rollback:** toda ação do usuário (adicionar, marcar, editar, limpar) atualiza a tela imediatamente e só depois tenta gravar no `localStorage`. Se a gravação falhar — por exemplo, quota excedida ou modo privado do navegador —, o estado é revertido automaticamente e um toast avisa o que aconteceu. Nunca fica algo na tela que não foi de fato salvo.

## Funcionalidades

- **Quantidade e unidade**: campos separados no formulário (`un`, `kg`, `g`, `L`, `ml`, `caixa`, `pacote`). Se a quantidade não for informada, assume `1 un`.
- **Ordenação de Corredores**: tela própria (botão "Corredores" no topo, que vira "Voltar para lista"), com reordenação manual por categoria — a lista de pendentes se reagrupa na hora.
- **Painel financeiro**: total do carrinho (quantidade × preço de cada item), campo de orçamento e saldo restante, sempre visíveis no topo. Aviso visual a partir de 90% do orçamento e outro, mais forte, ao ultrapassar 100% — reaproveitando o próprio vermelho da paleta, sem cor nova.
- **Campo de preço com máscara monetária**: digitação só com números, formatando da direita para a esquerda (`1` → `R$ 0,01`, `1000` → `R$ 10,00`) — tanto ao adicionar quanto ao editar um item.
- **Concluídos**: itens marcados não somem — vão para uma seção expansível no rodapé, com texto tachado e opacidade reduzida. "Limpar concluídos" remove todos de uma vez.
- **Desfazer**: ao limpar, um snackbar aparece por 5 segundos com o botão "DESFAZER", que restaura os itens exatamente na posição e no estado em que estavam.
- **Edição inline**: toca no item para editar quantidade/unidade/categoria/preço, com o nome do produto no cabeçalho ("Editando: [nome]"); salva no primeiro clique.
- **Confirmação antes de remover**: excluir um item abre um diálogo com o nome do produto — só apaga de fato ao confirmar.

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

Troque a versão no topo do `sw.js` (já está em `sacola-v3`; na próxima mudança, use `sacola-v4`):

```js
var VERSAO = 'sacola-v4';
```

Sem isso o navegador continua servindo a versão antiga do cache.

## Onde ficam os dados

Tudo no `localStorage`, em duas chaves — `sacola:itens` e `sacola:config` (orçamento e layout de corredores) —, só no aparelho. Não há servidor nem sincronização entre dispositivos.
