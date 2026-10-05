# Site e contratos da API — 28/09/2026

Fonte conferida: `D:/api suburbio/src/contracts/{catalog,entitlements,orders}.ts` e `src/http/{orders,entitlements}.ts`.

- Cadastro/edição: PERMANENT/DURATION, durationDays e renewable; seis tipos de entrega, incluindo PROPERTY. Validação de formato acompanha o contrato; decisões de ativação, renovação e expiração continuam exclusivamente na API.
- Detalhe administrativo do produto: validade, duração, renovação, canais e tipo de entrega retornados pela API.
- Minha Conta: consulta autenticada de `/internal/site/me/entitlements`; ativos são identificados pelo status ACTIVE retornado, sem inferir status pela data. Separação por status se aplica à página carregada, preservando paginação da API.
- Perfil administrativo: consulta `/internal/site/players/:id/entitlements` com ator autenticado e permissão PLAYERS_READ. Exibe produto, status, startsAt, expiresAt, pedido de origem e fulfillment.
- Tempo restante é apenas apresentação de expiresAt em relação a asOf, ambos retornados pela API. Não grava datas nem executa renovação/expiração.

## Lacunas do contrato local

O detalhe `/internal/site/orders/:id` é restrito ao customerDiscordId e retorna resumo e snapshots de itens. Não fornece pagamentos, fulfillment, entitlements relacionados ou notificações Discord. Não existe consulta administrativa de detalhe de pedido neste contrato.

As etapas aparecem separadas e indicam dados indisponíveis. Não são derivados estados financeiros/de entrega a partir de order.status; nenhuma rota foi inventada e a identidade do administrador não é usada como identidade do cliente. Para integrar essas etapas, a API precisa fornecer leituras autorizadas e schemas dos respectivos registros por pedido.

O catálogo público omite delivery; o tipo técnico de entrega é exibido somente no detalhe administrativo autorizado.

Atualização 03/10/2026: storefronts e canais WEB/INGAME integrados no cadastro. Novas interfaces de presentes/slots/fila/renovação e /tela têm limitações descritas em SITE_CONTINUATION_2026-10-03.md e G40–G49 de API_GAPS.md. As lacunas abaixo são históricas; pagamento/entrega/notificação já têm leitura no contrato v0.5 consumida por PurchaseStages.
