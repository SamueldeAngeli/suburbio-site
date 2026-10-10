# Lacunas verificadas — Subúrbio API HTTP v0.3

Atualização comercial em 2026-09-27; inventário detalhado em CONTINUATION_REPORT.md. Verificação inicial em 2026-09-26, lendo `D:/api suburbio/docs/HTTP_CONTRACTS.md`, contratos de resposta e registro de rotas. Não há Git nessa pasta. **As rotas abaixo marcadas como proposta não existem na API v0.3 e não são chamadas pelo site.** Fundação de tabelas/services de commerce/admin não equivale a endpoint HTTP disponível.

## Disponível e implementado no adapter do site

| Método/rota real | Uso no site | Observação |
| --- | --- | --- |
| GET `/health` | Diagnóstico público | status/api/postgres/redis/uptime/version |
| GET `/internal/health` | Serviços | HMAC, mysql e bot/bridge unmonitored; 503 degradado pode conter health válido |
| GET `/internal/allowlist/:playerId` | Consulta individual | UUID; resposta snake_case com status active/revoked |
| POST `/internal/allowlist/revoke` | Revogação | HMAC + Idempotency-Key; motivo 3–500; actorDiscordId da sessão; API valida ALLOWLIST_REVOKE/SYSTEM_OWNER |
| GET `/internal/operations/:operationId` | Adapter de reconciliação | Apenas operações pertencentes ao serviço; não exposto livremente no BFF |

Também existem metrics/openapi e rotas exclusivas bot/bridge/outbox, mas elas não resolvem lacunas do painel e não são utilizadas indevidamente pelo site. Importação QBCore é exclusiva da bridge. O site não aprova/redeem allowlist fingindo ser bot.

Health/allowlist internos exigem autorização institucional pelo resolver v0.3. Integração com a VPS ainda não homologada.

## Convenções das propostas

Todos os endpoints `/internal/*` usam HMAC oficial v0.2. Ator humano é sempre derivado de sessão OAuth pelo BFF, enviado em corpo assinado ou query assinada e validado pela API. Na implementação futura, a API aplica autorização novamente; assinatura do serviço não substitui autorização humana.

`Page<T> = {items:T[], page:number, pageSize:number, total:number}`; page >= 1, pageSize 1–100, ordenação estável por createdAt/id; filtros server-side. Valores monetários em inteiros de centavos + currency. Datas ISO8601 UTC; métricas incluem timeZone/asOf. IDs UUID (Discord 17–20 dígitos). Respostas nunca incluem segredos, tokens, passwords, conexão ou detalhes de banco.

Mutações exigem Idempotency-Key, confirmação no site, motivo 3–500, capability revalidada na API, transação e ADMIN_AUDIT com ator humano/serviço separados. Devem respeitar API_READ_ONLY e proteger SYSTEM_OWNER. Erros seguem envelope v0.2 com IDs técnicos. Não implementar as propostas como endpoints fake no Next.js.

Capabilities confirmadas: catálogo central em D:/api suburbio/src/modules/admin/capabilities.ts. Os nomes das páginas já seguem esse catálogo. Endpoints abaixo continuam propostas onde indicado.

## P0 — desbloqueia todo o painel

### G01 — RESOLVIDO na v0.3
POST /internal/site/admin/resolve implementado. Contrato real em HTTP_CONTRACTS.md da API; AccountService integrado. Não existe a antiga rota proposta auth/resolve.

## P1 — listagens e visão geral

### G02 · GET `/internal/admin/dashboard` — proposta, ausente
- Capability: DASHBOARD_READ.
- Request/query: `{actorDiscordId,date?,timeZone?}`; API valida fuso permitido e período.
- Response: `DashboardProposal` com jogadores, allowlists ativas, pedidos/receita do dia, pendentes, refunds/chargebacks e asOf; definir se contagens são totais ou referentes ao período.
- Paginação: não; filtros de data/fuso, não fazer agregação de todas as linhas no browser.
- Segurança: não divulgar receita a capability insuficiente; números calculados na API.
- Motivo: sete cards hoje mostram “Dados ainda não integrados”.

### G03 · GET `/internal/admin/players` — proposta, ausente
- Capability: PLAYERS_READ.
- Request/query: `{actorDiscordId,page,pageSize,q?,status?,name?,playerId?,discordId?,license?,citizenid?}`.
- Response: `Page<PlayerSummary & {status:string}>`.
- Paginação/filtros: server-side obrigatórios; busca por identidade pode exigir campo explícito para não expor dados além da finalidade.
- Segurança: rate limit por ator, escopo de dados pessoais, sem credenciais/identificadores irrelevantes.
- Motivo: busca de jogadores não existe. GET allowlist por UUID não é um diretório de jogadores.

### G04 · GET `/internal/admin/players/:playerId` — proposta, ausente
- Capability: PLAYERS_READ.
- Request: UUID e actorDiscordId assinado.
- Response: `{playerId,name,status,discordId,createdAt,updatedAt,identities:[{type,value,verified}]}` com allowlist de campos.
- Paginação: não para o resumo; coleções em endpoints separados.
- Segurança: sem lookup direto QBCore no site; minimize license/identidades por capability.
- Motivo: aba Visão geral/Identidade não pode confirmar existência do registro hoje.

### G05 — RESOLVIDO na v0.3
GET /internal/site/admins e /internal/site/admins/:id implementados com ADMINS_READ, ator assinado, paginação e filtros. Páginas integradas.

### G06 · GET `/internal/admin/capabilities` e GET `/internal/admin/permissions` — propostas, ausentes
- Capability: ADMIN_PERMISSIONS_MANAGE.
- Request/query: `{actorDiscordId,page,pageSize,q?,adminAccountId?,groupId?}`.
- Response: `Page<CapabilityProposal>` e `Page<PermissionOverrideProposal & {groupId?:string}>` respectivamente; a API define grupos caso suportados.
- Paginação/filtros: catálogo e concessões paginados, busca por conta/grupo/capability.
- Segurança: não inferir permissões de nomes de roles Discord; concessões temporárias calculadas na API.
- Motivo: preparar visual sem inventar catálogo ou duplicar RBAC.

### G07 · GET `/internal/admin/allowlists` — proposta, ausente
- Capability: ALLOWLIST_READ.
- Request/query: `{actorDiscordId,page,pageSize,playerId?,discordId?,status?,from?,to?}`.
- Response: `Page<AllowlistListProposal>`.
- Paginação/filtros: obrigatórios, status/data/identidade.
- Segurança: leitura autorizada por humano, sem tokens/challenges.
- Motivo: contrato atual só consulta um playerId, não oferece busca nem approvedAt/Discord na mesma resposta.

### G08 · GET `/internal/admin/punishments` — proposta, ausente
- Capability: PUNISHMENTS_READ.
- Request/query: `{actorDiscordId,page,pageSize,playerId?,discordId?,type?,status?,from?,to?}`.
- Response: `Page<PunishmentProposal>`.
- Paginação: obrigatória.
- Segurança: não tratar ban legado como punição canônica sem política/contrato da API.
- Motivo: listagem e aba de punições; nenhum comando de punir habilitado no site.

### G09 · GET `/internal/admin/orders` e GET `/internal/admin/orders/:orderId` — propostas, ausentes
- Capability: ORDERS_READ.
- Request/query listagem: `{actorDiscordId,page,pageSize,from?,to?,status?,playerId?,discordId?,orderId?,productId?}`; detalhe recebe UUID + ator.
- Response listagem: `Page<OrderSummary>`; detalhe: `{orderId,customer,items:[{productId,snapshot,quantity,unitAmountMinor,totalMinor}],totals,payment,delivery,createdAt,updatedAt,refunds,chargebacks,auditReferences}` com contratos financeiros definidos pela API.
- Paginação: listagem obrigatória; eventos/audit do detalhe paginados separadamente.
- Segurança: snapshots imutáveis, valores calculados na API, PII mínima; não confirmar entrega sem evento real.
- Motivo: fundação de commerce não tem HTTP de consulta.

### G10 · GET `/internal/admin/payments` — proposta, ausente
- Capability: PAYMENTS_READ.
- Request/query: `{actorDiscordId,page,pageSize,provider?,paymentId?,orderId?,playerId?,status?,from?,to?}`.
- Response: `Page<PaymentSummary & {customer,chargeback}>`.
- Paginação: obrigatória, incluindo datas de criação/aprovação/reembolso.
- Segurança: nenhum token de gateway/dado de cartão; integração do provedor permanece na API.
- Motivo: tabela de pagamentos, sem implementação paralela de Mercado Pago no site.

### G11 · GET `/internal/admin/refunds` — proposta, ausente
- Capability: REFUNDS_MANAGE (ou futura REFUNDS_READ se definida).
- Request/query: `{actorDiscordId,page,pageSize,orderId?,paymentId?,playerId?,status?,from?,to?}`.
- Response: `Page<RefundProposal>`.
- Paginação: obrigatória.
- Segurança: valores/estado oficiais, motivo limitado ao operador autorizado.
- Motivo: leitura de reembolsos sem inventar dados ou executar devoluções.

### G12 · GET `/internal/admin/chargebacks` — proposta, ausente
- Capability: CHARGEBACKS_READ.
- Request/query: `{actorDiscordId,page,pageSize,paymentId?,orderId?,status?,from?,to?}`.
- Response: `Page<ChargebackProposal>`.
- Paginação: obrigatória.
- Segurança: não aceitar status de disputa fornecido pelo browser.
- Motivo: acompanhamento de contestações.

### G13 · GET `/internal/admin/audit` — proposta, ausente
- Capability: AUDIT_READ.
- Request/query: `{actorDiscordId,page,pageSize,executor?,action?,target?,module?,from?,to?,operationId?}`.
- Response: `Page<AuditEntry & {serviceId,adminAccountId,humanActorDiscordId}>`, detalhes técnicos opcionais redigidos.
- Paginação: obrigatória, ordenação estável/append-only.
- Segurança: exclusivamente ADMIN_AUDIT institucional, sem payloads/HMAC/secrets. Audit gameplay não substitui isso.
- Motivo: histórico humano legível; GET operação isolada não é listagem de auditoria.

### G14 · GET `/internal/admin/discord/status` — proposta, ausente
- Capability: DISCORD_READ.
- Request/query: `{actorDiscordId}`.
- Response: `DiscordStatusProposal` e contadores de sync somente se medidos pela API.
- Paginação: não; futura lista de falhas usa Page.
- Segurança: heartbeat vindo do contrato bot→API, sem chamadas diretas do site ao bot.
- Motivo: health atual só retorna `unmonitored`, não prova status operacional do bot.

### G15 · GET `/internal/admin/settings` — proposta, ausente
- Capability: SETTINGS_READ.
- Request/query: `{actorDiscordId,group?}`.
- Response: `{items:SettingProposal[],revision:string}`; se secret=true, **omitir value**, retornar apenas configured.
- Paginação: não para conjunto limitado; definir limite da API.
- Segurança: nunca retornar secrets nem mascaramento derivado do valor real.
- Motivo: tela estrutural de configurações, sem salvamento local.

## P2 — catálogo, área do player e futuras escritas

### G16 — catálogo integrado; homepage usa API quando configurada
GET /internal/site/catalog implementado para SITE_VIP. SuburbioApiClient.catalog usa contrato real sem fallback fictício; wrapper StoreService sem consumidores foi removido. Administração completa em /internal/site/products e /internal/site/categories. A homepage demonstrativa ainda não foi substituída por um fluxo comercial de produção porque pedidos/pagamento não estão implementados.

### G17 · POST `/internal/site/store/orders` — proposta, ausente
- Capability: jogador autenticado resolvido pela API; ator derivado da sessão.
- Request: `OrderCreateProposal`, Idempotency-Key. Nunca aceitar preço/total do navegador como verdade.
- Response: `{orderId,status,amountMinor,currency,payment:{status,checkoutUrl?},createdAt}`; URL de provedor validada/definida pela API.
- Paginação/filtros: não aplicáveis.
- Segurança: disponibilidade/preço/quantidade/snapshot/entrega/webhooks na API, rate limit e proteção idempotente. Definir autorização para propriedade do pedido.
- Motivo: checkout demo não pode cobrar sem domínio de commerce exposto.

### G18 · GET `/internal/site/me` e GET `/internal/site/me/orders` — propostas, ausentes
- Capability: sessão Discord autenticada, propriedade de conta validada pela API.
- Request/query: `{actorDiscordId}` para perfil e `{actorDiscordId,page,pageSize,status?}` para pedidos.
- Response: perfil `{playerId,displayName,vip,charactersSummary}` com dados disponíveis; pedidos `Page<OrderSummary>` limitados ao titular.
- Paginação: pedidos obrigatória, coleções de personagens separadas.
- Segurança: não aceitar playerId alheio como autoridade, nenhum dado administrativo exposto.
- Motivo: /minha-conta hoje só conhece identidade básica Discord.

### G19 · PATCH `/internal/admin/admins/:adminAccountId/permissions` — proposta futura, ausente
- Capability: ADMIN_PERMISSIONS_MANAGE (confirmada no domínio, não no HTTP).
- Request: `{actorDiscordId,reason,capability,allowed,expiresAt?}`, Idempotency-Key; ID alvo em path.
- Response: `{adminAccountId,capability,allowed,expiresAt,operationId}`.
- Paginação: não; listagem por G06.
- Segurança: impedir escalada e alteração de SYSTEM_OWNER, concessões temporárias e precedência na API, ADMIN_AUDIT. UI só habilitar após confirmação/motivo e contrato homologado.
- Motivo: operações de concessão/revogação de acesso sem duplicar regra institucional.

### G20 · POST `/internal/admin/refunds` — proposta futura, ausente
- Capability: REFUNDS_MANAGE.
- Request: `{actorDiscordId,paymentId,amountMinor,reason}`, Idempotency-Key.
- Response: `{refundId,status,operationId}`.
- Paginação: não; listagem G11.
- Segurança: confirmação forte, elegibilidade/limites/provider na API, auditoria/transação, nenhuma ação financeira no site enquanto ausente.
- Motivo: futura execução de reembolso.

### G21 · PATCH `/internal/admin/settings` — proposta futura, ausente
- Capability: SETTINGS_WRITE.
- Request: `{actorDiscordId,reason,revision,changes:[{key,value}]}`, apenas chaves explicitamente editáveis.
- Response: `{revision,operationId,updatedKeys:string[]}`.
- Paginação: não.
- Segurança: concorrência otimista, audit, rejeitar configuração de owner/secrets sem contrato específico; nunca ecoar valores secretos.
- Motivo: configurações estão em leitura estrutural; não salvar no navegador.

## FiveM e operações não prometidas

Inventário, veículos, economia, propriedades e timeline precisam de contratos paginados específicos na **API**, sustentados pela bridge e pelas políticas institucionais. Não propor SQL nem ler MariaDB no site. Tabs exibem “Disponível após integração FiveM”. CRUD de admins, suspensão, comandos de punição, contestação de chargeback, monitoramento de heartbeat e revogação central de sessões também exigem desenho/contrato próprios antes de expor ações.

## Ordem recomendada

G01 → homologar health/consulta/revoke já existentes → G03/G04/G07 → G02/G05/G06/G13 → G09–G12 → G16–G18 → escritas críticas G19–G21. Preservar compatibilidade v0.2, publicar nova versão dos contratos/OpenAPI e testes de autorização na API antes de habilitar adapters no site.

## Continuação comercial ainda pendente
Crypto/custom quote, carrinho, cupons/métricas/snapshots e criação/leitura/cancelamento de pedidos agora possuem endpoints reais em /internal/site. Listagens administrativas de pedidos continuam ausentes. Mercado Pago possui adaptador sem receptor webhook/checkout; fulfillment/ACK, saldo/compra in-game, notificações e tickets continuam pendentes. Requisitos integrais em history/CONTINUATION_SPEC.md (histórico); não usar os DTOs propostos como integração pronta. Leitura/versionamento do catálogo é READY_FOR_BRIDGE.

## Atualização de validade
Entitlements próprios/admin, preparo e confirmação de benefícios pelo bridge, reconciliação, revogação e job de expiração implementados. Rotas e limites em ENTITLEMENTS.md. Não confundem implementação de entitlement com checkout ou crédito de Crypto, que permanecem pendentes.

## Estado atual v0.5 — 28/09/2026 (substitui pendências comerciais anteriores)

Checkout durável, webhook autenticado/reconciliação, reserva/expiração, preparo automático, Crypto/benefícios, ACK/defer, notificações e leitura de etapas implementados na API. BFF create/checkout e Minha Conta integrados. Reporte e contratos em CONTINUATION_REPORT.md, COMMERCE_ARCHITECTURE.md e FULFILLMENT.md.

Continuam reais: homologação Mercado Pago/HTTPS, aplicação e ledger do bridge, envio/ledger do bot, operação de REVIEW, reembolso/compensação e implantação. Sem polling financeiro periódico; monitorar retries do webhook. Painéis administrativos financeiros continuam lacunas. READY_FOR_BRIDGE não significa benefício aplicado.

## Continuação de 03/10/2026 — catálogo, presentes, renovação e tela

Auditados HTTP_CONTRACTS.md e src/contracts + src/http da API local (incluindo v0.5/v0.6). Apenas arquivos do SITE foram alterados. Propostas abaixo não representam rotas disponíveis e não são chamadas pelo BFF.

| ID | Situação | Contrato necessário / comportamento preparado |
| --- | --- | --- |
| G40 Storefronts | API_READY / UI_READY | Catálogo real aceita VIP_STORE, VIP_DEALERSHIP, VIP_REAL_ESTATE, CRYPTO_STORE, WEB/INGAME e aliases legados. Cadastro único, preços separados; storefronts agora preservadas na edição. |
| G41 Benefícios e fila VIP | WAITING_FOR_API | Entitlements paginados existem, mas faltam VIP principal, ordem explícita da fila, duração adquirida, imagem, elegibilidade, assetInstanceId e filtros por tipo. Não inferir fila por PENDING nem somar datas no site. |
| G42 Renovação por asset | WAITING_FOR_API | Leitura de opções por entitlementId/assetInstanceId (dias, preço real, currency, quoteId, expiração) e mutação idempotente autenticada. Mesmo asset precisa ser validado pela API, sem criar cópia. UI sem opções/preços fictícios; pagamento bloqueado. |
| G43 Presentes/recipient lookup | WAITING_FOR_API | Busca com campos permitidos, rate limit, identidade resolvida/token opaco e confirmação; criação idempotente com comprador da sessão separado do beneficiário. Validar vínculo e elegibilidade no servidor. Nunca aceitar texto de busca como identidade. |
| G44 Anonimato/histórico | WAITING_FOR_API | Enviados/recebidos paginados, produto/status/data/validade, identidade redigida para destinatário anônimo; comprador real somente onde autorizado. Preparação visual, sem registros falsos. |
| G45 CHARACTER_SLOT | WAITING_FOR_API | Tipo não aceito pelo catálogo atual. Estado efetivo (inclui comandos no jogo), máximo, allowedQuantity e decisão de elegibilidade para comprador OU destinatário. Revalidar no fulfillment; jamais calcular estado por pedidos. Cadastro/compra desabilitados. CRYPTO existe como item de carrinho, mas não como tipo de entrega cadastrável de Product. |
| G46 Estorno por limite | WAITING_FOR_API | API precisa expor status iniciado/processando/estornado/revisão e motivo de limite de slot por pedido. View model de apresentação preparado, não é extensão do schema real. Nada inicia refund no site. |
| G47 Salas | WAITING_FOR_SITE_ROOMS | Criar/consultar/entrar/sair, código opaco, participante estável, host, limite configurável (~10), expiração vazia, encerramento e reconexão idempotente. Site autoriza pela sessão, aplica rate limit/quotas e mantém estado temporário em Redis próprio; API central não participa. Não existem handlers fictícios /api/rooms. |
| G48 Tokens e moderação | WAITING_FOR_SITE_SFU | Grant curto e limitado à sala/identidade/ações; revalidar sessão e autorização. Operações host (remover, bloquear, transferir, política de publicação, encerrar) precisam de contratos e revogação no SFU. Não gerar token/roomId no browser. |
| G49 Mídia | WAITING_FOR_SFU | Nenhum SDK/conexão SFU ativo. Interface especulativa RoomMediaAdapter removida; integração futura pertence ao site + LiveKit. Simulcast/adaptiveStream/dynacast, reconexão sem duplicação, track replacement, múltiplas publicações, volume por source e métricas dependem do adapter/homologação. |

Os detalhes reais de pagamento/entrega/notificação do pedido já disponíveis na API v0.5 são consumidos pelo componente PurchaseStages existente. A consulta administrativa de pedido por ID e o relacionamento direto de entitlements por pedido continuam sem contrato; não usar a identidade de admin como comprador.

Cargos Discord (2026-10-03): implementação aprovada no código da API, migration 011 e testes isolados. Ativação real depende de migration e conexão HMAC. Estado e homologação: docs/DISCORD_ROLES_IMPLEMENTED.md. SYSTEM_OWNER independente; Staff/Suporte desativados.

## Conta e transmissão — atualização 2026-10-04

Resolvidos no código da API: leitura de saldo da carteira autoritativa por conta (/internal/site/me/crypto) e perfil real do QBCore (/internal/site/me/characters, fonte QBCORE: personagens, emprego/cargo, gang, dinheiro/banco, telefone de charinfo, veículos, casas/apartamentos e slots de qb_character_slots), via HMAC/BFF. Dono = Discord verificado → player → license (identidade central); o site nunca envia citizenid e nunca acessa a MariaDB. Formato JSON inesperado = indisponível. Contrato: D:/api suburbio/docs/HTTP_CONTRACTS.md. Pendente de validação nos recursos instalados na VPS: semântica de telefone (charinfo.phone vs ry_phone), state dos veículos (qb-garages 0/1/2) e slots (qb_character_slots). Grupos/VIP do jogo (qb_character_groups) ainda não integrados.

WAITING_FOR_API: slots efetivos e sua elegibilidade/compensação; fila VIP; presentes. WAITING_FOR_SITE_ROOMS/SFU: CreateRoom/JoinRoom/RoomToken/LeaveRoom, mídia e participantes; não dependem da API central. Auditoria do arquivo qb-multicharacter.zip encontrou default 5 + overrides por license, insuficientes para declarar estado efetivo implantado. Ver CRYPTO_SCREEN_2026-10-04.md.


## Afiliados — 2026-10-04
Contratos reais implementados na API e OpenAPI: painel/access/referral, CRUD administrativo, relatório e payouts/preview. Não são propostas. Migration 012 e configuração BFF→API ainda pendentes fora dos testes isolados. Homologação Mercado Pago/Discord real pendente. Detalhes em AFFILIATES_2026-10-04.md.
