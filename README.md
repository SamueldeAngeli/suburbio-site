# Subúrbio RP

Portal e loja demonstrativa feitos com Next.js App Router, React e TypeScript.

## Rodar

```sh
npm install
npm run dev
```

Use `npm run dev -- --port 3001` quando a API estiver na porta 3000. A porta pode ser escolhida no ambiente/serviço. A versão com autenticação e painel exige Node.js: `npm run build` e `npm run start -- --port 3001`. Não use o antigo `out/` para esta versão.

## Administração e integração

Next.js 16.3.5 preservado, com Auth.js/Discord, BFF HMAC v0.3 e telas administrativas. Consulte [arquitetura](docs/SITE_ARCHITECTURE.md), [lacunas da API](docs/API_GAPS.md), [permissões](docs/ADMIN_PERMISSIONS.md), [deploy Windows](docs/DEPLOYMENT.md) e [auditoria de produção](PRODUCTION_AUDIT.md).

Copie `.env.example` para `.env.local` e configure os grupos de variáveis antes de habilitá-los. O login Discord está implementado, mas não homologado com credenciais reais. A API v0.3 expõe resolução institucional e catálogo. `/admin` exige configuração OAuth/HMAC e autorização efetiva da API. Nunca conceda owner no frontend para contornar isso.

Verificação: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run verify:client`. Testes não usam banco, contas reais nem pagamentos.

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

Continuação: [estado por fase](docs/CONTINUATION_PROGRESS.md), [catálogo](docs/PRODUCT_CATALOG.md) e [relatório do marco](docs/CONTINUATION_REPORT.md). Mercado Pago escolhido; checkout real ainda não habilitado.
