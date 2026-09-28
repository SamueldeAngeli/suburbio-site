# Continuação comercial — 28/09/2026

API v0.5 e site evoluídos a partir do estado existente, sem reiniciar fases A–H ou reconstruir frontend público. Baselines: API `4002de1`, site `c73d94c`. .env, dependências, artefatos, logs, secrets e backups excluídos; dump QBCore preservado localmente. Nenhuma cobrança, mensagem externa, migration de produção ou alteração da cidade.

## 1. Migrations

Adicionada **009_commerce_cycle**, total **9**. Acrescenta payment_status/delivery_status, checkout_attempts, versão/status do provedor em payments, operação/tentativas/erro de fulfillment e commerce_notifications. Aplicada e reaplicação idempotente testada somente nos bancos PostgreSQL aleatórios de integração. History/FKs preservados; downgrade destrutivo recusado.

## 2. Endpoints

Novos: POST `/internal/site/orders/:id/checkout`, POST `/webhooks/mercadopago`, POST `/internal/fivem/fulfillments/:id/defer`. Ampliados: detalhe/lista de pedidos, cart/quote, pending/confirm de fulfillment e erro de DM do outbox. Site acrescenta BFF `/api/vip/orders/create` e `/api/vip/orders/checkout`, sessão/origem/intenção/idempotência, preço autoritativo e redirecionamento restrito ao Mercado Pago. Minha Conta mostra pagamentos, entregas, notificações e acesso a validade/benefícios.

## 3. Eventos

checkout.requested, checkout.ready, checkout.uncertain, payment.reconciled, payment.approved, payment.review_required, reservation.released, fulfillment.deferred, purchase.delivered. Mantidos fulfillment.created/completed e entitlement.activated/expired/revoked. Notificação única por pedido/tipo, com payload e estados separados por consumidor.

## 4. Estados

Pagamento pending/approved/rejected/cancelled/expired/review separado de entrega pending/delivered. Fulfillment PENDING/DELIVERED; offline mantém pendência. Entitlement PENDING/ACTIVE/EXPIRED/REVOKED. Validade começa só na confirmação real do efeito, renovação usa snapshot e preserva grants históricos. Pedido misto só conclui após todos os ACKs.

## 5. Ambiente

**Nenhuma variável nova.** API utiliza MERCADO_PAGO_ENABLED, ACCESS_TOKEN, WEBHOOK_SECRET, COLLECTOR_ID, LIVE_MODE, RETURN_URL, NOTIFICATION_URL, WORKER_INTERVAL_MS e API_READ_ONLY já existentes. .env local continua em `D:\api suburbio\.env`; site em `D:\suburbiorp\.env` quando configurado. Não sobrescrito nem versionado. Configure NOTIFICATION_URL para a rota de webhook em HTTPS. RETURN_URL deve apontar para o site; retorno do browser nunca confirma pagamento.

## 6–8. Testes executados

| Projeto/suíte | Aprovados |
|---|---:|
| Site unitários/componentes/servidor | 146 |
| Site HTTP com Next compilado e sessão criptografada de teste | 38 |
| API unitários/adapters | 85 |
| API integração PostgreSQL/Redis isolados | 153 |
| **Total** | **422** |

Nenhum teste removido. Adicionados 26 cenários comerciais API, 10 do site e 2 HTTP. Cobrem duplicidade/concorrência, checkout sem resposta recuperado sem novo POST, adulteração, assinatura, divergências de pagamento, reserva/expiração/aprovação tardia, Crypto exata com cupom, misto, offline/ACK repetido, perda de lease/novo worker, DM fechada/retry, reembolso e REVIEW. A suíte anterior de entitlements mantém permanente/30 dias/renovação/expiração/snapshot/histórico.

Uma expectativa antiga de oito migrations falhou nas execuções intermediárias; corrigida para nove e a suíte completa terminou com 153/153, zero falhas/skip. PostgreSQL/Redis existentes nas portas locais 15432/16379 foram usados apenas por bancos/prefixos isolados; nenhum serviço de produção foi criado ou encerrado. Tentativa inicial de iniciar serviços encontrou instâncias existentes; não houve reinicialização delas.

## 9. Verificações

Typecheck, lint e build aprovados nos dois projetos. `verify:client` passou: 21 arquivos públicos, nenhum segredo identificado. OpenAPI v0.5 regenerado. API compilada inicia/encerra HTTP no teste de runtime; frontend público preservado na verificação HTTP. Testes Mercado Pago usam transporte controlado, não sandbox remoto. Telas autenticadas foram testadas por contratos/renderização/HTTP; homologação OAuth externo e visual com conta real permanece externa.

## 10. READY_FOR_BRIDGE

Snapshots, leitura de pendências, payloads por unidade/Crypto, identificação durável, defer offline, ACK idempotente, grants de validade/renovação, eventos de expiração/revisões e reconciliação preparados. **Não houve entrega real FiveM.** Bridge precisa aplicar efeitos via resources oficiais e persistir ledger/receipt. Consumidor Discord precisa enviar e deduplicar; a API possui estado durável e retries, sem envio de DM real nesta execução.

## 11. Pendências reais

- Homologar Mercado Pago em HTTPS com credenciais/recebedor/assinatura e consumidores habilitados. Manter pagamento desabilitado até essa homologação.
- Implementar/validar efeito real e recibo durável do bridge e envio/ledger do bot. Outbox oferece pelo menos uma vez; deduplicação externa continua necessária.
- Operar casos REVIEW: aprovação tardia sem reserva, pagamentos duplicados, estornos e benefício incompatível. Não há resolução financeira automática/reembolso/compensação da cidade.
- Monitorar webhook e retries do provedor. Não há polling financeiro periódico. Checkout incerto sem preference única exige conferência; nunca recria POST automaticamente.
- Deploy/backup/infra real, painéis financeiros administrativos e módulos fora deste ciclo continuam pendentes.

## 12. Compatibilidade

Migration 009 obrigatória antes do boot. Campos adicionados aos pedidos e checkoutAvailable passa de literal false a boolean. Pending fulfillment agora inclui Crypto (entitlementId nulo), e confirm retorna união benefício/Crypto; consumidores devem suportar ambos. Novos tipos de evento precisam de roteamento explícito; não gerar DM para cada evento técnico. Sem remoção de endpoint ou modificação do schema QBCore. O contrato de validade introduzido na v0.4 permanece.

Detalhes: HTTP_CONTRACTS.md, openapi.json, COMMERCE_ARCHITECTURE.md, FULFILLMENT.md, ENTITLEMENTS.md e API_GAPS.md.
