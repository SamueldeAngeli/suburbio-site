# Catálogo institucional

Fonte de verdade: Subúrbio API, PostgreSQL institucional. O site acessa somente rotas HMAC pelo servidor.

Migration `005_product_catalog` adiciona `catalog_state`, `product_categories` e `catalog_products`. Campos de produto e categoria são validados por schemas Zod estritos antes da persistência; payloads por tipo são discriminados. Valores em reais são centavos inteiros, preço Crypto é inteiro. Não há seed de produtos fictícios no banco real.

Criação e edição exigem PRODUCTS_CREATE / PRODUCTS_UPDATE. Inativação/arquivamento também exige PRODUCTS_DISABLE. Leitura administrativa exige PRODUCTS_READ. Toda alteração gera ADMIN_AUDIT com antes/depois, operação e ator. O catálogo bloqueia sua linha de versão na transação e usa expectedRevision para evitar atualização perdida. Retry de Idempotency-Key não repete escrita, versão ou evento.

Categorias e produtos podem ficar inactive/archived, sem exclusão física. Produtos com categoria indisponível não aparecem no catálogo público. Canais SITE_VIP e INGAME_CRYPTO são filtrados na API. O cliente não recebe deliveryPayload no catálogo público.

`catalog.updated` incrementa uma versão monotônica representada como string decimal, evitando perda de precisão JavaScript. Eventos product.created / product.updated / product.disabled são institucionais e destinados ao bridge. O consumidor deve aceitar os novos tipos antes de habilitar seu consumo em produção.

## READY_FOR_BRIDGE

- GET /internal/fivem/catalog/version
- GET /internal/fivem/catalog
- Eventos catalog.updated e product.* por outbox existente.
- Sync de startup, reconnect e comparação periódica recupera eventos perdidos.

O endpoint de catálogo faz snapshot consistente por transação repeatable-read. A implementação do cache/NUI pertence ao futuro bridge. Este marco não implementa compra in-game, débito de saldo, reserva comercial de estoque ou fulfillment. A quantidade de estoque cadastrada ainda não é consumida por pedidos.

Backup deve incluir categorias, produtos, versão, auditoria e operações. Rollback da migration 005 recusa remover tabelas com dados; não destrói histórico para reverter código.

## Validade
Agora exige validityMode, durationDays (apenas DURATION, 1–3650 dias) e renewable. PROPERTY possui propertyCode; VIP não usa mais deliveryPayload.days. Snapshot e migration 008 em ENTITLEMENTS.md.
