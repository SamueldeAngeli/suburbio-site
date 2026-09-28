# Validade e benefícios — implementação de 27/09/2026

## Cadastro e compras

Todo produto declara `validityMode: PERMANENT | DURATION`, `durationDays: null | inteiro de 1 a 3650` e `renewable`. Permanente não aceita duração nem renovação. A regra independe do tipo; PROPERTY agora possui payload próprio `propertyCode`. VIP usa somente `plan`; o antigo `deliveryPayload.days` foi substituído pela validade comum.

O editor permite Permanente/Temporária e exibe dias/renovável somente para temporários. Listagem administrativa mostra tipo e validade. Cards e detalhes públicos usam configuração, sem duração inferida da categoria. Itens do pedido preservam `validity_mode_snapshot`, `duration_days_snapshot`, `renewable_snapshot`; a resposta exibe `validityModeSnapshot`, `durationDaysSnapshot`, `renewableSnapshot`.

Migration **008_entitlements** acrescenta snapshots e tabelas `benefit_fulfillments`, `entitlements`, `entitlement_grants`. Catálogo legado extrai a duração do próprio VIP antigo; demais produtos ficam permanentes. Snapshot antigo usa apenas o payload já gravado no pedido, nunca a configuração atual do produto. A migration incrementa a versão do catálogo e recusa downgrade destrutivo. Aplicada apenas em bancos de teste.

## Ativação e renovação

`prepare` exige pedido confirmado do jogador e pagamento aprovado com moeda/valor exatos. Reembolso processado e chargeback aberto/perdido bloqueiam ativação. Cada unidade recebe fulfillment persistente único por item/índice e um grant. Crypto não passa por este domínio de benefícios: seu crédito continua pendente na integração financeira/bridge.

Entitlement começa PENDING, sem startsAt/expiresAt. Somente confirmação autenticada da entrega define ACTIVE, startsAt e activatedAt no relógio UTC da API. O cliente/bridge não envia datas. DURATION soma dias × 86400000ms; permanente mantém expiresAt nulo. Pagamento e espera offline não consomem a duração.

Produtos renováveis usam um entitlement estável por jogador/produto/personagem. Compra nova gera um grant separado que referencia pedido, item e fulfillment. Se ACTIVE e ainda não vencido, soma ao expiresAt atual e mantém startsAt. Se vencido, começa na nova ativação, mesmo se o job ainda não atualizou o status. O ledger de grants preserva ativação, vencimento anterior e resultante de cada compra. Entitlement revogado não pode ser reativado automaticamente por renovação. Alterar o tipo ou payload do adapter de um produto também bloqueia renovação automática do benefício anterior; a duração pode ser alterada e continua baseada no snapshot de cada compra. Produtos não renováveis geram benefícios independentes.

## Expiração, revogação e histórico

Job iniciado com API e processo worker, respeitando API_READ_ONLY e WORKER_INTERVAL_MS. Processa até 100 ACTIVE com expiresAt <= now por ciclo. Revalida após lock, registra operação idempotente, ADMIN_AUDIT e outbox na mesma transação. Múltiplos workers/retries não duplicam eventos. EXPIRED/REVOKED não apagam compras, pagamentos, fulfillments, grants ou entitlement.

Eventos institucionais: `entitlement.activated`, `entitlement.expired`, `entitlement.revoked`; revisões permitem reconciliação. VIP também é enviado ao consumidor Discord para futura sincronização de cargos. Isso não envia DM automaticamente nem afirma conclusão do pedido inteiro.

## Contrato HTTP e bridge

Todas as rotas usam HMAC; mutações exigem Idempotency-Key. Rotas `/internal/fivem/*` são exclusivas do bridge, `/internal/site/*` exclusivas do site.

- GET `/internal/site/me/entitlements`: customerDiscordId da sessão, page/pageSize; resolve vínculo verificado e retorna somente benefícios próprios, sem deliveryPayload.
- GET `/internal/site/players/:id/entitlements`: actorDiscordId, page/pageSize; exige PLAYERS_READ.
- POST `/internal/site/entitlements/:id/revoke`: actorDiscordId/reason; exige PLAYERS_MANAGE e auditoria.
- POST `/internal/fivem/fulfillments/prepare`: orderId/playerId. Cria pendências de benefícios de pedido já pago.
- GET `/internal/fivem/fulfillments/pending`: playerId/page/pageSize, payload por unidade, validade comprada e entitlementId.
- POST `/internal/fivem/fulfillments/:id/confirm`: playerId/receipt. Receipt estável de 8–128 caracteres `[a-zA-Z0-9:_-]`; retry não reaplica duração. Outro comprovante para entrega já concluída retorna conflito.
- GET `/internal/fivem/entitlements`: playerId/page/pageSize. Inclui ativos/pendentes/expirados/revogados, revision, metadata/targetCharacterId e expiryPolicy para reconciliação no startup/playerLoaded.

Bridge deve registrar **fulfillmentId e efeito aplicado de forma durável** antes de confirmar e reutilizar o receipt após reinício. A API não executa nem garante atomicidade de efeitos externos do jogo. Não usar a confirmação antes do efeito real. A listagem de pendências não concede exclusão mútua: adapters concorrentes devem usar o mesmo ledger idempotente. Mudanças de estado podem chegar fora de ordem; ler o estado atual/revision antes de remover acesso.

Políticas preparadas: VIP `REMOVE_VIP_AND_SYNC_DISCORD`; VEHICLE `REMOVE_TEMPORARY_VEHICLE_ACCESS`; PROPERTY `REMOVE_TEMPORARY_PROPERTY_ACCESS`; INVENTORY_ITEM/SERVICE/CUSTOM possuem políticas de reconciliação específicas. **A execução dessas políticas nos resources reais permanece dependente do bridge**, exclusivamente por APIs/exports oficiais. Nenhum UPDATE/DELETE QBCore foi criado.

## Telas, testes e implantação

`/minha-conta/beneficios`: produto, status, ativação, vencimento e tempo restante. Perfil administrativo: aba Benefícios com tipo, pedido original, fulfillment original e origem; renovações ficam registradas separadamente no ledger/audit. Datas exibidas em Brasília, persistidas em UTC. O histórico de pedidos mostra validade adquirida.

17 cenários de integração cobrem permanentes, temporários, ativação tardia, renovação ativa/vencida, expiração offline VIP/veículo/propriedade, retries, snapshot, histórico, ACL, read-only, migração legada, reembolso e não renováveis. Seis testes novos do site cobrem validação e apresentação.

Regressão: **136 site + 36 HTTP + 85 unitários API + 127 integrações API = 384 aprovados** (124 integrações em suíte completa e os 17 do módulo reexecutados após adicionar três cenários). Typecheck/lint/build e fronteira client/server aprovados. Visual público verificado; telas autenticadas dependem da configuração OAuth/API para homologação real.

Nenhuma variável nova: job reutiliza WORKER_INTERVAL_MS/API_READ_ONLY. Aplicar 008 no PostgreSQL institucional de staging após backup e atualizar API/site juntos: novo contrato exige validityMode e remove days do payload VIP. Nenhuma migration real, cobrança, concessão ou revogação in-game realizada. Checkout Mercado Pago, crédito Crypto e entrega completa/notificação final do pedido ainda seguem pendentes do projeto maior.

## Ciclo v0.5
Pagamento reconciliado prepara benefícios automaticamente. Pedido mostra pagamento, entrega e notificação separadamente; validade continua iniciando só no ACK real do bridge. Crypto por snapshot/linha, sem entitlement temporal. Pendências e evidências atualizadas em CONTINUATION_REPORT.md e FULFILLMENT.md.
