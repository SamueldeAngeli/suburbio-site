const fs=require('node:fs');const root='D:/api suburbio/';
const file=root+'docs/HTTP_CONTRACTS.md';let s=fs.readFileSync(file,'utf8').replace('# Contratos HTTP — v0.2','# Contratos HTTP — v0.3').replace('- Nenhum endpoint de wipe, CRUD de AdminAccount, RBAC, pedidos ou pagamentos foi exposto. Bootstrap owner opera somente pela configuração do processo; serviços internos de permissão precisam de transação/operação institucional.','- v0.2 não expunha leitura de administradores ou catálogo. v0.3 acrescenta os contratos abaixo. Wipe, mutações de AdminAccount/RBAC, pedidos e pagamentos continuam sem endpoints. Bootstrap owner opera somente pela configuração do processo.');
s+=`

## v0.3 — resolução administrativa e catálogo

Extensão aditiva; HMAC e rotas v0.2 preservados. Novas rotas /internal/site/* são exclusivas do serviço site, /internal/fivem/* exclusivas do bridge. Ator humano vem do OAuth no BFF, no corpo ou query **assinados**, nunca em header extra não assinado.

| Método | Rota | Entrada | Permissão |
| --- | --- | --- | --- |
| POST | /internal/site/admin/resolve | {discordId} estrito | site; AdminAccount ativo |
| GET | /internal/site/admins | actorDiscordId, page=1, pageSize=25 (1–100), q? ID exato, status? active/disabled | ADMINS_READ |
| GET | /internal/site/admins/:id | actorDiscordId; id UUID | ADMINS_READ |
| GET | /internal/site/products | actorDiscordId, page, pageSize, q? substring de slug | PRODUCTS_READ |
| GET | /internal/site/products/:id | actorDiscordId; id UUID | PRODUCTS_READ |
| POST | /internal/site/products | {actorDiscordId,product} | PRODUCTS_CREATE |
| POST | /internal/site/products/:id | {actorDiscordId,product,expectedRevision} | PRODUCTS_UPDATE |
| GET | /internal/site/categories | actorDiscordId | PRODUCTS_READ |
| POST | /internal/site/categories | {actorDiscordId,category} | PRODUCTS_CREATE |
| POST | /internal/site/categories/:id | {actorDiscordId,category,expectedRevision} | PRODUCTS_UPDATE |
| GET | /internal/site/catalog | — | site; canal SITE_VIP |
| GET | /internal/fivem/catalog | — | bridge; canal INGAME_CRYPTO |
| GET | /internal/fivem/catalog/version | — | bridge |

POSTs de produto/categoria exigem Idempotency-Key. Status diferente de active também exige PRODUCTS_DISABLE. A API nunca exclui fisicamente esses registros. Alteração concorrente com revisão antiga retorna REVISION_CONFLICT (409), slug duplicado SLUG_CONFLICT (409). CATEGORY_NOT_ACTIVE (409), CATEGORY_NOT_FOUND/PRODUCT_NOT_FOUND/ADMIN_NOT_FOUND (404), ADMIN_CAPABILITY_REQUIRED/ADMIN_ACCESS_DENIED (403). Validação estrita rejeita campos arbitrários.

Resolver: {adminAccountId,discordId,status:"active",isSystemOwner,capabilities:string[],readOnly}. Não cria administradores comuns. Bootstrap do owner é executado no boot do processo, idempotente e independente de PlayerAccount. Resolver é leitura e funciona em API_READ_ONLY. Owner recebe catálogo completo; STANDARD não tem grants implícitos. Overrides concedidos conhecidos são resolvidos, revokes prevalecem; poderes COUPONS_CREATE/UPDATE/DISABLE nunca são efetivos para STANDARD, nem por override legado. A alteração RBAC comum também recusa esses grants. Expiração de overrides e grupos ainda não implementados.

Resumo admin: {adminAccountId,discordId:null|string,status,isSystemOwner,createdAt,updatedAt}. Lista: {items,page,pageSize,total}. Não expõe license, Steam, token ou detalhes de gameplay.

Product: {id,slug,name,description,categoryId,imageUrl,status,displayOrder,salesChannels,priceCrypto,priceMinor,stockMode,stockQuantity,delivery,revision,createdAt,updatedAt}. Valores financeiros são centavos inteiros; priceCrypto e stockQuantity inteiros não negativos. salesChannels: SITE_VIP e/ou INGAME_CRYPTO. Status active/inactive/archived; stockMode UNLIMITED/LIMITED. Categoria: {id,name,slug,displayOrder,status,revision,createdAt,updatedAt}. Schemas exatos e limites: src/contracts/catalog.ts e OpenAPI.

delivery é união estrita {deliveryType,deliveryPayload}: INVENTORY_ITEM {itemName,amount}, VEHICLE {vehicleModel}, VIP {plan,days}, SERVICE {service}, CUSTOM {adapter}. Não aceita SQL, scripts ou payload livre. Adapters ainda dependem do futuro bridge. Catálogos públicos omitem delivery por completo; dados de entrega devem vir de fulfillment autorizado, nunca da NUI.

Resposta de mutação: {product|category,catalogVersion,operationId}; catálogo: {catalogVersion,products,categories}; versão: {catalogVersion}. catalogVersion é string decimal bigint monotônica. Leitura do catálogo é snapshot repeatable-read, filtra categoria/produto ativos e canal. Eventos catalog.updated e product.created/updated/disabled publicados transacionalmente, com eventId persistente, catalogVersion e operationId; destinados somente ao bridge. Eventos product.* também incluem productId. Startup/reconnect/full resync deve consultar o snapshot atual, sem depender de entrega perfeita de eventos.

Migration 005_product_catalog institucional. Backup antes de produção. Estoque é cadastro, ainda não reserva comercial; compra, saldo, cupons, pagamentos, fulfillment, notificações e tickets permanecem pendentes. Mercado Pago escolhido, sem credenciais ou cobrança habilitada. Nenhum endpoint de compra é fingido.
`;
fs.writeFileSync(file,s);
for(const p of ['package.json','package-lock.json']){const f=root+p,j=JSON.parse(fs.readFileSync(f,'utf8'));j.version='0.3.0';if(j.packages?.[''])j.packages[''].version='0.3.0';fs.writeFileSync(f,JSON.stringify(j,null,2)+'\n');}
const health=root+'src/http/health.ts';fs.writeFileSync(health,fs.readFileSync(health,'utf8').replace('version: "0.2.0"','version: "0.3.0"'));
fs.appendFileSync(root+'IMPLEMENTATION_PLAN.md','\n## v0.3 — continuação institucional\nAdmin resolve/leitura, catálogo e categorias implementados; migration 005, ADMIN_AUDIT/outbox transacionais e revisão otimista. Bootstrap .env local autorizado para owner; não executado no banco real. Fases de Crypto, cupons, Mercado Pago, fulfillment, notificações e tickets pendentes. Site acompanha status em D:/suburbiorp/docs/CONTINUATION_PROGRESS.md.\n');
fs.appendFileSync(root+'PRODUCTION_AUDIT.md','\n## Marco v0.3 — 2026-09-26\n40 testes unitários e 91 integrações passaram em PostgreSQL/Redis isolados. Migration 005 aplicada somente em bancos temporários. Catálogo tem 11 testes novos, resolução administrativa 10 integrações e catálogo de capabilities 4 unitários novos. Sem migração, bootstrap ou deploy na VPS. Typecheck/build aprovados; lint final e OpenAPI devem acompanhar evidência do site.\n');
console.log('API v0.3 contract and release metadata documented.');
