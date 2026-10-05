# Validade e entitlements — 27/09/2026

Nova implementação detalhada em [ENTITLEMENTS.md](ENTITLEMENTS.md). Produtos permanentes/temporários (1–3650 dias), renovação, snapshots, migration 008, ativação após confirmação de entrega, job idempotente de expiração, contratos de reconciliação do bridge e telas de benefícios. **384 testes aprovados**: 136 site, 36 HTTP, 85 unitários API e 127 integrações API. API/site com typecheck/lint/build; visual público conferido. Adapters reais do jogo, checkout e fluxo financeiro completo ainda pendentes. Nada aplicado à produção/QBCore.

## Marco anterior

# Continuação — 27/09/2026

O projeto completo ainda está em andamento. Referência: CONTINUATION_SPEC.md.

| Fase | Estado comprovado |
| --- | --- |
| 1. Auditoria/VIP | Nomenclatura revisada; design e #loja preservados |
| 2. AdminAccount | Resolver, capabilities, owner e leitura de admins implementados; OAuth/VPS não homologados |
| 3. Catálogo | Migration 005, API, painel, categorias/produtos, versão e eventos |
| 4. Crypto/carrinho | Nove pacotes, personalizado, catálogo real condicionado à configuração e quote calculada pela API |
| 5. Cupons | Migration 006, regras, painel owner-only, snapshot, reservas concorrentes e métricas; histórico detalhado por cliente pendente |
| 6. Pedidos/pagamento | Migration 007, criação idempotente, reserva, cancelamento e histórico privado. Adaptador Mercado Pago testado com transporte controlado. Checkout/webhook/reconciliação/fulfillment pendentes |
| 7. Discord | Outbox existente; consumidor comercial e confirmação persistente de envio pendentes |
| 8. Bridge | Catálogo/versionamento/eventos READY_FOR_BRIDGE; carteira, compra e entrega pendentes |
| 9. Tickets | Integração API/bot/dashboard pendente; bot em D:/suburbio bot |
| 10. Perfil | Histórico de pedidos integrado; perfil/personagens agregados pendentes |
| 11. Operação | Health existente; métricas comerciais e fila administrativa de falhas pendentes |

## Próxima implementação

1. Intenção de checkout durável e recuperação de resposta ambígua do provedor; não repetir criação de preferência cegamente.
2. Receptor webhook: assinatura da query, consulta oficial, conferência de pedido/valor/moeda/recebedor/ambiente, persistência idempotente e monotônica.
3. Estados separados payment/delivery/notification; fulfillment único por item, claim/ACK do bridge, offline/retry e order.fulfilled somente após confirmação efetiva.
4. Worker de expiração/reconciliação: expires_at está persistido, mas não há liberação automática. Não liberar estoque com pagamento potencialmente compensável.
5. Ligar checkout ao site após os itens anteriores e homologação sandbox; continuar fases 7–11.

## Ambiente

Nenhuma cobrança, entrega FiveM, DM, deploy ou migration em banco real. Owner configurado apenas no .env local autorizado, não provisionado na VPS. Mercado Pago false por padrão, exemplos sem credenciais. Adaptador ainda não chamado por rota/checkout.

Verificação visual bloqueada: revisão automática de aprovação falhou por limite de uso. Não houve tentativa de contornar. Verificações HTTP/código continuaram. Inventário e evidências em CONTINUATION_REPORT.md.
