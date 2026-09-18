# Subúrbio RP

Portal e loja demonstrativa feitos com Next.js App Router, React e TypeScript.

## Rodar

```sh
npm install
npm run dev
```

Abra http://localhost:3000. Para gerar a versão estática de produção, use `npm run build`; os arquivos finais ficam em `out/`.

## Personalizar

- `lib/site.ts`: catálogo, preços, benefícios, Discord e conexão FiveM. O catálogo é fictício, autorizado para demonstração.
- `app/page.tsx`: apresentação, loja, detalhes, carrinho persistido neste navegador e orientações de acesso.
- `app/globals.css`: identidade visual, animações e adaptação para celular.
- `public/logo.png`: arte original fornecida pelo proprietário.

O carrinho permite adicionar, remover e alterar quantidades (até 10 de cada item). O botão Continuar informa que a loja é demonstrativa; não cria pedidos, cobra pagamentos nem entrega itens. A operação real exige checkout com validação de preços no servidor, provedor de pagamento, confirmação por webhook e integração com a cidade. Não coloque segredos no código cliente.

## Identidade visual

Conceito: cultura urbana noturna, pertencimento e conquista. A arte original é o centro da abertura. Uma assinatura tipográfica com coroa simplifica a marca nos elementos de navegação sem substituir o arquivo original.

| Uso | Cor |
| --- | --- |
| Azul principal | `#47CEFF` |
| Fundo | `#090C11` |
| Superfície | `#10151D` |
| Texto | `#F5F7FA` |
| Texto secundário | `#A0A9B7` |

Títulos: Barlow Condensed. Corpo: Barlow. As fontes são carregadas pelo Google Fonts, com alternativas locais caso a rede esteja indisponível.

Animações: movimento sutil na arte, faixa contínua, entrada de seções, feedback em botões e cards. A preferência `prefers-reduced-motion` é respeitada; o visitante também pode pausar os movimentos pelo botão na abertura.

## Acessibilidade e comportamento

HTML semântico, controles com nomes acessíveis, foco visível e diálogos nativos com fechamento por Escape. Filtros indicam a seleção com `aria-pressed`. Carrinho tolera dados locais inválidos e indisponibilidade de armazenamento. Não são coletados dados pessoais.

Em navegadores compatíveis, a ferramenta WebMCP `filter_store_catalog` altera o mesmo filtro visível da loja e valida as categorias recebidas.
