# Ciclo comercial — API v0.5

O site usa Browser → BFF Next.js → HMAC → API. Somente a API acessa PostgreSQL, Redis e Mercado Pago. O preço vem do catálogo/quote da API; o browser envia IDs, quantidades e cupom. Não existem secrets Mercado Pago no site.

## Transações e estados

1. Criar pedido revalida identidade, catálogo, estoque e cupom. Reserva estoque e uso de cupom; salva valores, entrega, validade e renovação como snapshots.
2. Checkout grava intenção durável antes da chamada externa. Uma tentativa por orderId; concorrentes não repetem POST. A preference usa external_reference=orderId e total líquido em BRL.
3. Webhook verifica assinatura oficial com data.id da query, x-request-id e ts. Corpo/query devem concordar. Consulta GET /v1/payments/{id}; não usa valor/status/referência enviados no corpo do webhook.
4. Reconciliação confere ID, recebedor, ambiente, valor, moeda, referência e versão temporal. UNIQUE(provider,provider_reference) impede reaproveitamento de paymentId. Operação, pagamento, pedido, reserva, audit e outbox são confirmados na mesma transação.
5. Aprovação consome reserva/cupom e prepara fulfillments. Entitlements ficam PENDING, sem validade em curso. Crypto usa o snapshot exato de amount; cupom altera somente preço.
6. Somente ACK autenticado após efeito real marca entrega e ativa/renova benefício. Pedido misto exige todos os fulfillments DELIVERED antes de purchase.delivered.

| Registro | Estados |
|---|---|
| orders.payment_status | pending, approved, rejected, cancelled, expired, review |
| orders.delivery_status | pending, delivered |
| checkout_attempts.status | CREATING, READY, UNCERTAIN |
| orders.reservation_status | none, reserved, consumed, released |
| payments.status | pending, approved, failed, cancelled; provider_status preserva status reconciliado |
| benefit_fulfillments.status | PENDING, DELIVERED |
| entitlements.status | PENDING, ACTIVE, EXPIRED, REVOKED |
| outbox_deliveries.status | pending, processing, processed, failed |

O order.status anterior permanece por compatibilidade. Use paymentStatus/deliveryStatus para apresentar as duas etapas. REVIEW exige análise financeira; não autoriza aplicação de benefício.

## Respostas perdidas, pagamentos tardios e falhas

Preferences API não é tratada como se garantisse idempotência de POST. CREATING sobrevive ao crash; falha observada vira UNCERTAIN. Após 30 segundos, retry do checkout pesquisa a preference por external_reference e consulta seu detalhe, validando recebedor, referência, moeda e soma dos itens antes de recuperar a URL. Não cria outra preference se a consulta retornar zero ou múltiplas correspondências. Ausência persistente exige conferência operacional; a reserva expira normalmente.

Worker libera reservas vencidas; rejeição/cancelamento reconciliados também liberam uma única vez. Catálogo e pedido são travados na mesma ordem das mutações de reserva. Uma aprovação depois da liberação é registrada como pagamento real e pedido REVIEW, sem fulfillment automático. Isso evita vender a mesma unidade duas vezes. Cancelamento pelo cliente é recusado depois de iniciar checkout; a conclusão financeira deve vir do provedor/expiração.

Snapshots antigos fora de ordem não regridem aprovação; um pagamento revertido não é reativado por aprovação antiga. Segundo pagamento aprovado do mesmo pedido gera REVIEW. Reembolso/chargeback/estorno parcial recebido pelo pagamento também gera REVIEW e bloqueia novos ACKs. Compensação de benefício já aplicado, reembolso automático e resolução administrativa de REVIEW não estão implementados. Eventos payment.review_required avisam bot/bridge para reconciliação; não executam alteração no QBCore.

Falha de domínio ao preparar benefícios não apaga a aprovação: savepoint reverte somente preparo, conserva pagamento e sinaliza REVIEW. Erros de infraestrutura revertem a transação; Mercado Pago deve repetir o webhook. Não existe polling financeiro periódico; mantenha retries do webhook habilitados e monitore falhas. O retry da rota de checkout recupera preferências incertas.

## Notificações

commerce_notifications possui UNIQUE(order_id,kind), referenciando evento institucional. payment.approved informa pagamento e espera; purchase.delivered informa conclusão. Payload contém pedido, produtos, quantidades, valores, datas e ativações/vencimentos de cada grant. Renovação mantém histórico de grants.

Status/tentativas/erro ficam em outbox_deliveries do consumidor discord-bot. ACK/fail com lease e retry/backoff já existentes; DISCORD_DM_CLOSED é erro permitido. Falha de DM não altera compra, pagamento, fulfillment ou entitlement. Bot deve deduplicar por notificationId/eventId em ledger durável: outbox é entrega pelo menos uma vez, não garantia de mensagem externa exatamente uma vez. Eventos técnicos checkout.* e payment.reconciled não devem virar DMs extras.

## Infraestrutura e referências

Migration 009_commerce_cycle é somente PostgreSQL institucional. O dump docs/2409sql.sql continua local, ignorado pelo Git; não foi alterado. API .env permanece na raiz, ignorado; exemplo versionado .env.example. Nenhuma variável nova nesta etapa; reutiliza MERCADO_PAGO_*, WORKER_INTERVAL_MS e API_READ_ONLY. Configure HTTPS e credenciais na API antes de habilitar pagamento. Não foi realizada cobrança ou homologação externa.

Referências oficiais consultadas: [criar preference](https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro-preferences/create-preference/post), [pesquisar preferences](https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro-preferences/search-preferences/get), [assinatura de notificações](https://www.mercadopago.com.br/developers/en/docs/checkout-pro-preferences/additional-settings/optional-notifications). A integração implementada usa Preferences API e payments, não Orders API do provedor.
