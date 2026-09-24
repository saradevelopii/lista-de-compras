/* =========================================================
   Identidade do app — nome e versão (SemVer), numa única
   fonte de verdade. O modal "Sobre" e qualquer outro lugar que
   precise exibir essa informação leem daqui, em vez de ter o
   texto duplicado e solto pelo código.

   REGRA: bump a cada mudança publicada, sem exceção — senão o
   número fica sem sentido (foi exatamente o que aconteceu antes
   desta atualização: ficou parado em 1.0.10 por várias rodadas
   de mudanças reais). PATCH (x.x.N) pra correção de bug, MINOR
   (x.N.0) pra funcionalidade nova, MAJOR (N.0.0) só se algo
   quebrar compatibilidade de verdade.

   Não confundir com o identificador de cache do sw.js — aquele
   é técnico/interno e usa outro esquema (qlista-vN); este é a
   versão SemVer voltada ao usuário.
   ========================================================= */

export var NOME_APP = 'Qlista';
export var VERSAO_APP = '1.1.0';
