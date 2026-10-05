# Subúrbio RP

Portal e loja demonstrativa feitos com Next.js App Router, React e TypeScript.

## Rodar

```sh
npm install
npm run dev
```

Em desenvolvimento o site usa a porta 3002 e a API a 3000. Produção: `npm run build`, depois `pm2 start ecosystem.config.cjs` (127.0.0.1:3002 atrás do proxy HTTPS); veja [deploy](docs/DEPLOYMENT.md).

## Administração e integração

Next.js 16.3.5 preservado, com Auth.js/Discord, BFF HMAC v0.3 e telas administrativas. Consulte [arquitetura](docs/ARCHITECTURE.md), [ambiente](docs/ENVIRONMENT.md), [segurança](docs/SECURITY.md), [deploy](docs/DEPLOYMENT.md), [operação](docs/OPERATIONS.md), [testes](docs/TESTING.md), [checklist de produção](docs/PRODUCTION_CHECKLIST.md), [lacunas da API](docs/API_GAPS.md) e [permissões](docs/ADMIN_PERMISSIONS.md).

Copie `.env.example` para `.env.local` e configure os grupos de variáveis antes de habilitá-los. O login Discord está implementado, mas não homologado com credenciais reais. A API v0.3 expõe resolução institucional e catálogo. `/admin` exige configuração OAuth/HMAC e autorização efetiva da API. Nunca conceda owner no frontend para contornar isso.

Verificação: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run verify:client`, `npm run test:http` (detalhes em [testes](docs/TESTING.md)). Testes não usam banco, contas reais nem pagamentos.

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

Catálogo: [PRODUCT_CATALOG.md](docs/PRODUCT_CATALOG.md). Relatórios de fases anteriores: `docs/history/` (não normativos). O checkout com Mercado Pago está implementado na API e só é habilitado depois da homologação descrita no [checklist](docs/PRODUCTION_CHECKLIST.md).
