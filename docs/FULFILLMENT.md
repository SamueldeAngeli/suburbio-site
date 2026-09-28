# Entrega e confirmação — READY_FOR_BRIDGE

Não há UPDATE/INSERT/DELETE no QBCore. A API prepara comandos e recebe confirmação; aplicar efeitos e persistir recibos na cidade depende do suburbio_bridge. Nenhuma entrega FiveM real foi executada nesta etapa.

## Contrato do consumidor

- Consumir fulfillment.created pelo outbox, ou reconciliar GET /internal/fivem/fulfillments/pending?playerId=UUID&page=1&pageSize=25 no startup/playerLoaded. Ler todas as páginas antes de executar mutações que reduzam a lista, evitando deslocamento de paginação.
- Campos: fulfillmentId, orderId, orderItemId, productId, playerId, quantity, status, operationId, attempts, lastError, createdAt, deliveredAt, entitlementId, targetCharacterId, validityMode, durationDays, renewable e delivery.
- Benefício tem um fulfillment por unidade: UNIQUE(order_item_id,unit_index). quantity=1 e payload por unidade. Crypto tem um fulfillment por linha, com deliveryPayload.amount total exato do snapshot. Nunca recalcular Crypto usando preço líquido ou porcentagem de cupom.
- Validar estado atual antes de aplicar. Pedido em REVIEW não aparece na lista nem aceita ACK. Não usar evento antigo como autorização permanente.
- Adaptador deve persistir fulfillmentId/efeito/receipt atomicamente com a aplicação quando o resource permitir, ou implementar reconciliação durável. Evitar aplicar duas vezes após crash/ACK perdido. Reusar recibo estável no retry.
- POST /internal/fivem/fulfillments/:id/confirm com playerId/receipt, HMAC e Idempotency-Key somente depois do efeito real. Retry, inclusive com outra chave, não reaplica validade; recibo diferente causa conflito.
- POST /internal/fivem/fulfillments/:id/defer com playerId/errorCode PLAYER_OFFLINE, BRIDGE_UNAVAILABLE ou ADAPTER_FAILED registra tentativa sem falha definitiva. Offline permanece PENDING e não inicia validade. Uma nova tentativa usa outra chave; retry da mesma tentativa preserva a chave.
- ACK do outbox confirma consumo do evento, não entrega do produto. A confirmação de fulfillment é separada.

## Adaptadores e validade

VIP, VEHICLE, PROPERTY, INVENTORY_ITEM, SERVICE e CUSTOM usam snapshots de payload, política de validade e expiryPolicy da API. Crypto usa crédito exato confirmado pelo adaptador; não cria entitlement de tempo. A API não cria saldo fictício.

Permanente mantém expiresAt=null. Temporário soma durationDaysSnapshot × 24 horas somente na confirmação. Renovação ativa soma à expiração existente; vencida começa na nova ativação. Cada compra mantém grant com duração, ativação e vencimentos anterior/resultante.

Worker marca ACTIVE vencidos como EXPIRED e emite entitlement.expired. Eventos duráveis/revision e GET /internal/fivem/entitlements permitem remover acesso após jogador voltar, sem apagar histórico. Antes de remover, consultar revisão atual para não desfazer renovação mais recente. VIP remove benefícios; veículo/propriedade removem acesso temporário pelos recursos oficiais. A execução desses handlers permanece READY_FOR_BRIDGE.

## Discord — contrato preparado

notificationId é chave de deduplicação. payment.approved: “Pagamento aprovado / aguardando entrega”. purchase.delivered: “Compra entregue”, apenas após todos os ACKs. Ler produtos/quantidades/valor/data e activations com startsAt/expiresAt para validade. Consumidor usa claim/ack/fail do outbox; registrar DISCORD_DM_CLOSED se usuário bloquear DM. Tratar falha e retry sem desfazer entrega. O envio real e ledger do bot permanecem dependentes do consumidor Discord; testes usam consumidor controlado.
