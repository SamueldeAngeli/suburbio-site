CONTINUAÇÃO DO PROJETO SUBÚRBIO RP
SITE + DASHBOARD + API + COMÉRCIO + TICKETS + PREPARAÇÃO PARA BRIDGE

IMPORTANTE:

O projeto já possui:

- frontend público em Next.js 16.3.5;
- identidade visual definida;
- dashboard administrativa parcialmente implementada;
- login Discord;
- sessões;
- BFF;
- cliente HMAC para Subúrbio API;
- páginas administrativas;
- Subúrbio API existente;
- PostgreSQL;
- Redis/Memurai;
- estrutura de orders/payments/refunds/chargebacks;
- bot Discord;
- sistema de tickets existente no bot;
- allowlist;
- futura integração com suburbio_bridge.

NÃO reescrever o projeto do zero.

Antes de alterar:
1. analisar código existente;
2. identificar arquitetura atual;
3. reutilizar componentes existentes;
4. preservar frontend público;
5. preservar identidade visual;
6. preservar contratos existentes;
7. evitar duplicação de domínios/lógica.

A SUBÚRBIO API deve continuar sendo a fonte de verdade.

O site NÃO pode acessar PostgreSQL, MariaDB/QBCore ou Redis diretamente.

Arquitetura esperada:

Browser
→ Next.js
→ BFF server-side
→ HMAC
→ Subúrbio API
→ PostgreSQL / serviços / futuro bridge

==================================================
1. IDENTIDADE VISUAL
==================================================

Preservar identidade oficial da Subúrbio RP:

- preto;
- grafite;
- azul-marinho muito escuro;
- azul/ciano elétrico;
- branco.

Estilo:

- premium;
- urbano;
- moderno;
- GTA RP;
- limpo;
- administrativo;
- sem excesso de efeitos;
- responsivo.

Não usar rosa/roxo como cores principais.

Preservar frontend público existente.

==================================================
2. NOMENCLATURA DA ÁREA VIP
==================================================

NÃO tratar a área VIP como uma loja genérica.

Remover nomenclaturas visuais como:

- Loja oficial
- Loja VIP
- Store

Preferir:

Menu:
VIP

Título:
Área VIP

Conteúdo:
- Planos VIP
- Benefícios VIP
- Pacotes VIP
- vantagens exclusivas

Não precisa redesenhar toda a página.

Apenas corrigir posicionamento/nomenclatura.

Rotas antigas podem continuar tecnicamente por compatibilidade.

==================================================
3. CRYPTO ABAIXO DO VIP
==================================================

Crypto NÃO precisa obrigatoriamente virar item separado na navbar.

Na página comercial, estruturar:

ÁREA VIP
[ planos / benefícios ]

↓

CRYPTO
[ pacotes da moeda virtual ]

Crypto é um domínio separado do VIP.

==================================================
4. PREÇO DA CRYPTO
==================================================

Existem duas formas de comprar Crypto.

PACOTES FIXOS:

Pacotes possuem preço de:

R$ 1,20 por unidade.

Criar:

50 Crypto
R$ 60,00

100 Crypto
R$ 120,00

150 Crypto
R$ 180,00

200 Crypto
R$ 240,00

300 Crypto
R$ 360,00

400 Crypto
R$ 480,00

500 Crypto
R$ 600,00

700 Crypto
R$ 840,00

1000 Crypto
R$ 1.200,00

Armazenar preferencialmente:

quantity
unitPrice
totalPrice

e não somente o preço final.

==================================================
5. QUANTIDADE PERSONALIZADA DE CRYPTO
==================================================

Também permitir:

"Escolha sua quantidade"

O usuário informa qualquer quantidade válida.

Preço:

R$ 1,25 por Crypto.

Exemplo:

325 Crypto

325 × R$1,25
= R$406,25

Validar:

- somente inteiro;
- maior que zero;
- mínimo configurável;
- máximo configurável;
- impedir negativos;
- impedir NaN/valores inválidos.

O frontend pode exibir cálculo instantâneo.

MAS:

o backend/API deve recalcular tudo novamente.

Nunca confiar no total enviado pelo navegador.

==================================================
6. CARRINHO
==================================================

VIP, Crypto e futuramente outros produtos devem poder usar um carrinho
central.

O navegador NÃO deve ser fonte de verdade de:

- preço;
- desconto;
- quantidade efetivamente entregue;
- eligibility;
- fulfillment.

O client envia identificadores.

API recalcula o pedido.

==================================================
7. CUPONS DE DESCONTO
==================================================

Implementar arquitetura completa de cupons.

Campo no carrinho:

Cupom de desconto

[CUPOM15] [Aplicar]

Preparar suporte para:

- desconto percentual;
- desconto fixo;
- compra mínima;
- data inicial;
- data final;
- limite de usos total;
- limite de usos por usuário;
- VIP apenas;
- Crypto apenas;
- produto específico;
- categoria específica;
- primeira compra futuramente;
- ativo/inativo.

==================================================
8. PERMISSÃO DOS CUPONS
==================================================

REGRA IMPORTANTE:

SOMENTE OWNER pode:

- criar cupom;
- editar cupom;
- alterar regras;
- desativar cupom;
- arquivar/excluir logicamente cupom.

Não confiar somente no frontend.

A API deve obrigatoriamente validar a capability/permissão.

Pode existir modelo de capabilities:

coupons.read
coupons.create
coupons.update
coupons.disable

Porém:

create/update/disable devem permanecer exclusivos do OWNER,
salvo alteração futura explícita.

Outros cargos podem futuramente receber somente coupons.read.

Toda alteração de cupom gera ADMIN_AUDIT.

==================================================
9. MÉTRICAS DOS CUPONS
==================================================

Cada cupom deve medir seu desempenho comercial.

Armazenar/calcular:

couponId
code
discountType
discountValue
usesCount

grossSales
discountGranted
netSales

createdAt
startsAt
expiresAt
status

Exemplo:

CUPOM15

Desconto:
15%

Usos:
37

Valor bruto:
R$1.176,47

Descontos concedidos:
R$176,47

Vendas líquidas:
R$1.000,00

Isso deve permitir saber quanto cada cupom realmente vendeu.

==================================================
10. SNAPSHOT DO CUPOM NO PEDIDO
==================================================

Quando pedido utiliza cupom, registrar snapshot:

couponId
couponCodeSnapshot
discountTypeSnapshot
discountValueSnapshot

grossAmount
discountAmount
netAmount

Não depender do cupom atual para reconstruir pedido antigo.

Se o cupom for alterado/desativado posteriormente:

pedido antigo continua exatamente igual.

==================================================
11. DASHBOARD DE CUPONS
==================================================

Criar:

/admin/coupons

Listagem:

Código
Desconto
Usos
Valor bruto
Desconto concedido
Vendas líquidas
Status
Validade

Detalhe:

- pedidos associados;
- usuários;
- quantidade de usos;
- vendas;
- desconto total;
- período;
- produtos;
- categorias;
- performance.

==================================================
12. PEDIDO != PAGAMENTO != ENTREGA
==================================================

REGRA FUNDAMENTAL:

Pagamento aprovado NÃO significa produto entregue.

Separar:

order_status
payment_status
delivery_status

Exemplos payment_status:

pending
approved
rejected
cancelled
refunded
charged_back

delivery_status:

pending
processing
delivered
failed
revoked

Um pedido só deve aparecer como completamente concluído quando:

payment_status = approved

E

delivery_status = delivered

==================================================
13. FULFILLMENT
==================================================

Criar domínio formal de fulfillment.

Cada entrega precisa possuir algo equivalente a:

fulfillmentId
orderId
orderItemId
playerId
targetCharacterId
productId
productType
quantity
status
attempts
operationId
createdAt
updatedAt
deliveredAt
lastError

fulfillmentId precisa ser único.

==================================================
14. ENTREGA DE CRYPTO
==================================================

Uma compra de Crypto precisa entregar EXATAMENTE a quantidade adquirida.

Exemplo:

Pedido:
300 Crypto

Cupom:
15%

Preço pacote:
R$360

Desconto:
R$54

Pago:
R$306

Entrega:
300 Crypto

NUNCA:
255 Crypto

Cupom altera preço financeiro.

Não altera quantidade, salvo futura regra explícita de bônus.

==================================================
15. IDEMPOTÊNCIA DE ENTREGA
==================================================

O sistema PRECISA ser idempotente.

Se uma entrega sofrer:

- timeout;
- retry;
- restart da API;
- restart do bot;
- restart do bridge;
- reconnect;
- resposta perdida;

ela não pode ser aplicada novamente.

1 compra legítima
=
1 entrega legítima.

Usar IDs únicos como:

orderId
purchaseId
operationId
fulfillmentId
eventId

Persistir processamento onde necessário.

==================================================
16. PLAYER OFFLINE
==================================================

Se o jogador estiver offline:

não considerar falha permanente.

delivery_status deve poder continuar:

pending

Quando jogador entrar:

bridge identifica fulfillments pendentes
→ aplica
→ confirma API
→ API marca delivered.

==================================================
17. BRIDGE NÃO USA UPDATE SQL DIRETO
==================================================

O suburbio_bridge deve usar:

- QBCore functions;
- exports;
- APIs oficiais dos resources;
- adapters.

NÃO entregar benefícios usando UPDATE SQL direto.

API também não deve atualizar diretamente estado online do player.

==================================================
18. NOTIFICAÇÃO DISCORD DE COMPRA
==================================================

Quando pagamento for aprovado, opcionalmente enviar DM:

PAGAMENTO APROVADO

Recebemos seu pagamento.

Produto:
300 Crypto

Status:
Aguardando entrega

Você será avisado quando o produto for entregue.

==================================================
19. NOTIFICAÇÃO FINAL DO DISCORD
==================================================

Após fulfillment REALMENTE confirmado:

API gera evento:

order.fulfilled

Bot Discord consome.

Enviar DM ao Discord vinculado:

COMPRA ENTREGUE

Seu pedido foi concluído com sucesso.

Pedido:
#SUB-XXXX

Produto:
300 Crypto

Valor pago:
R$360,00

Status:
Entregue

Data:
...

Obrigado por apoiar a Subúrbio RP.

Usar identidade visual da Subúrbio.

==================================================
20. FALHA NA DM
==================================================

Se Discord DM falhar:

NÃO desfazer entrega.

Registrar:

notification_status = failed

e motivo, exemplo:

DM_CLOSED
MEMBER_NOT_FOUND
DISCORD_UNAVAILABLE

Permitir retry controlado.

==================================================
21. IDEMPOTÊNCIA DAS NOTIFICAÇÕES
==================================================

Uma mesma notificação não pode ser enviada várias vezes por retry.

Persistir:

notificationId
eventId
orderId
notificationType

ACK somente depois do efeito real.

==================================================
22. HISTÓRICO NO SITE
==================================================

Na área do usuário:

Minhas Compras

mostrar separadamente:

Pedido
Pagamento
Entrega
Notificação

Exemplo:

Pagamento:
Aprovado

Entrega:
Entregue

Discord:
Notificação enviada

Ou:

Pagamento:
Aprovado

Entrega:
Aguardando entrega

Nunca mostrar "Concluído" antes da entrega real.

==================================================
23. REEMBOLSO / CHARGEBACK
==================================================

Preparar arquitetura.

Ainda NÃO remover automaticamente Crypto, VIP ou produto já entregue sem
regra explícita.

Registrar:

refund
chargeback

e criar estados para revisão/revogação futura.

==================================================
24. CADASTRO CENTRAL DE PRODUTOS
==================================================

Precisamos de catálogo central de produtos.

A Subúrbio API é a fonte de verdade.

Criar domínio:

Product

Campos mínimos:

id
slug
name
description
categoryId
imageUrl
status
displayOrder

salesChannels

priceCrypto

deliveryType
deliveryPayload

stockMode
stockQuantity

createdAt
updatedAt

Pode adicionar campos necessários seguindo arquitetura existente.

==================================================
25. CANAIS DE VENDA
==================================================

Preparar produtos para canais distintos.

Exemplo:

SITE_VIP
INGAME_CRYPTO

Produto pode existir em:

- somente SITE_VIP;
- somente INGAME_CRYPTO;
- ambos.

A API valida canal.

FiveM NÃO decide.

==================================================
26. DASHBOARD DE PRODUTOS
==================================================

Criar:

/admin/products

Permitir:

- listar;
- pesquisar;
- criar;
- editar;
- ativar;
- desativar;
- arquivar;
- definir imagem;
- definir categoria;
- definir preço Crypto;
- definir canal;
- definir ordem;
- definir estoque;
- definir tipo de entrega;
- definir payload de entrega.

Não excluir fisicamente produtos que possuam histórico financeiro.

Preferir:

inactive
archived

Toda alteração gera ADMIN_AUDIT.

==================================================
27. CATEGORIAS DE PRODUTOS
==================================================

Categorias devem ser administráveis.

Não hardcodar somente na NUI.

Campos:

id
name
slug
displayOrder
status

Exemplos possíveis:

Veículos
Utilidades
Consumíveis
Cosméticos
Serviços
Itens exclusivos
Eventos
Outros

==================================================
28. TIPO DE ENTREGA
==================================================

Preparar deliveryType.

Inicialmente:

INVENTORY_ITEM
VEHICLE
VIP
SERVICE
CUSTOM

Exemplo INVENTORY_ITEM:

{
  "itemName": "radio",
  "amount": 1
}

Exemplo VEHICLE:

{
  "vehicleModel": "sultan"
}

Exemplo SERVICE:

{
  "service": "CHANGE_PLATE"
}

deliveryPayload precisa ser validado server-side conforme deliveryType.

==================================================
29. ESTOQUE
==================================================

Preparar:

UNLIMITED
LIMITED

Se LIMITED:

stockQuantity

Atualização/reserva de estoque precisa ser concorrente/transacional.

Nunca permitir venda acima do estoque por race condition.

==================================================
30. PREÇO PROMOCIONAL FUTURO
==================================================

Preparar estrutura para produtos com promoção futura, exemplo:

Preço normal:
500 Crypto

Promo:
400 Crypto

Válido até:
...

A API continua sendo a fonte de verdade.

==================================================
31. LOJA CRYPTO DENTRO DO JOGO
==================================================

Haverá uma loja dentro do FiveM onde jogadores comprarão produtos usando
Crypto.

NÃO criar catálogo separado dentro do resource.

Fluxo esperado:

Dashboard Admin
↓
Subúrbio API
↓
Catálogo oficial
↓
suburbio_bridge
↓
NUI da loja Crypto

==================================================
32. SINCRONIZAÇÃO DO CATÁLOGO
==================================================

O catálogo precisa possuir versionamento.

Exemplo:

catalogVersion = 153

Mudanças relevantes incrementam versão:

- produto;
- preço;
- status;
- estoque;
- categoria;
- canal;
- ordem.

==================================================
33. BOOTSTRAP DO BRIDGE
==================================================

Quando suburbio_bridge iniciar:

1. autenticar com API;
2. consultar catalogVersion;
3. baixar catálogo ativo;
4. armazenar cache em memória;
5. disponibilizar à NUI.

==================================================
34. CATALOG UPDATED
==================================================

Quando admin alterar catálogo:

API salva
↓
incrementa catalogVersion
↓
gera evento catalog.updated
↓
bridge recebe
↓
busca nova versão
↓
atualiza cache
↓
atualiza loja

Não precisar reiniciar resource.

==================================================
35. FULL RESYNC
==================================================

Não depender apenas de evento.

Bridge também deve realizar:

- sync no startup;
- sync após reconnect;
- sync após falha;
- comparação periódica/controlada de versão se necessário.

Se um evento for perdido, catálogo deve se recuperar.

==================================================
36. SEGURANÇA DA NUI
==================================================

NUI deve enviar para compra apenas algo como:

productId
quantity
clientRequestId

NUNCA confiar em:

price
discount
balance
deliveryPayload
deliveryType
stock

vindos do client.

==================================================
37. COMPRA CRYPTO IN-GAME
==================================================

Fluxo:

NUI
↓
bridge server
↓
Subúrbio API

API valida:

- player;
- produto;
- canal INGAME_CRYPTO;
- produto ativo;
- preço atual;
- quantidade;
- saldo;
- estoque;
- limites;
- idempotência.

Só depois cria operação.

==================================================
38. SALDO CRYPTO
==================================================

Débito de Crypto precisa ser atômico.

Exemplo:

saldo:
600

produto:
500

resultado:
100

Nunca permitir:

- saldo negativo;
- double spend;
- duas compras simultâneas consumindo o mesmo saldo indevidamente.

Usar transação/lock/controle concorrente adequado.

==================================================
39. SNAPSHOT DE PRODUTO
==================================================

Pedidos/compras precisam registrar snapshot:

productId
productName
category
price
priceCrypto
quantity
deliveryType
deliveryPayloadSnapshot

Alteração futura do catálogo não pode alterar compra antiga.

==================================================
40. EVENTOS COMERCIAIS
==================================================

Preparar eventos equivalentes a:

catalog.updated
product.created
product.updated
product.disabled

crypto.purchase.created
crypto.purchase.completed
crypto.purchase.failed

payment.approved
payment.rejected

fulfillment.created
fulfillment.completed
fulfillment.failed

order.fulfilled

notification.sent
notification.failed

Todos com eventId persistente.

==================================================
41. TICKETS NA DASHBOARD
==================================================

Precisamos visualizar os tickets Discord na dashboard administrativa.

Criar módulo:

/admin/tickets

/admin/tickets/[ticketId]

IMPORTANTE:

site NÃO consulta Discord Bot diretamente.

Fonte de verdade futura:
Subúrbio API.

==================================================
42. MIGRAÇÃO DOS TICKETS
==================================================

Atualmente o bot ainda pode estar usando:

TICKET_STORAGE_MODE=local

Preparar arquitetura para:

TICKET_STORAGE_MODE=api

Não migrar de forma destrutiva.

Precisamos preservar tickets existentes sempre que possível.

==================================================
43. LISTAGEM DE TICKETS
==================================================

Mostrar:

ticketId
status
categoria
usuário
Discord
responsável
tags
createdAt
closedAt
reopenCount

Filtros:

- ID;
- nome;
- Discord;
- responsável;
- categoria;
- status;
- tag;
- período.

==================================================
44. DETALHE DO TICKET
==================================================

Página de ticket com:

Visão Geral
Participantes
Histórico
Transcripts
Auditoria

Mostrar:

- responsáveis;
- transferências;
- participantes adicionados/removidos;
- tags;
- observação de fechamento;
- reaberturas;
- fechamentos;
- timestamps.

==================================================
45. TRANSCRIPTS
==================================================

Preservar sistema existente de transcript no Discord.

Além disso, armazenar referências/metadata suficientes na API.

Precisamos de:

TRANSCRIPT INTERNO

com:

- conteúdo completo;
- manifest;
- hashes;
- SHA-256;
- hashes de anexos;
- integridade;
- dados administrativos.

TRANSCRIPT PÚBLICO

sanitizado para player.

Não pode conter:

- license;
- IP;
- FiveM identifiers internos;
- operation IDs internos;
- notas privadas;
- ADMIN_AUDIT;
- metadata restrita.

Não esconder com CSS.

Os campos precisam realmente não existir na versão pública.

==================================================
46. TRANSCRIPT NA DASHBOARD
==================================================

OWNER/admin autorizado pode visualizar:

Transcript interno
Hash SHA-256
Manifest
Anexos
Integridade

Exemplo:

Integridade:
VERIFICADA

Controlar por capability.

==================================================
47. PERFIL UNIFICADO DO PLAYER
==================================================

Criar/preparar uma página central de player.

Algo como:

/admin/players/[id]

Com abas:

Identidade
Discord
Allowlist
Personagens
Punições
Tickets
Compras
VIP
Crypto
Veículos
Propriedades
Timeline
Auditoria

Nem tudo precisa estar integrado imediatamente.

Onde endpoint não existir:

- criar estado vazio apropriado;
- documentar em API_GAPS.md;
- não inventar dados de produção.

==================================================
48. VISÃO DE COMPRAS NO PLAYER
==================================================

Exemplo que precisamos conseguir visualizar:

Pedido:
#1234

Produto:
500 Crypto

Pagamento:
Aprovado

Cupom:
CUPOM15

Valor bruto:
R$600

Desconto:
R$90

Valor pago:
R$510

Fulfillment:
Entregue

Bridge:
Confirmou +500 Crypto

Discord:
DM enviada

Data:
...

==================================================
49. DASHBOARD INICIAL
==================================================

Preparar dashboard útil com métricas reais quando endpoints existirem:

- faturamento;
- pedidos;
- pagamentos pendentes;
- entregas pendentes;
- entregas com erro;
- tickets abertos;
- allowlists;
- players online;
- estado dos serviços;
- alertas relevantes.

Não gerar métricas falsas.

==================================================
50. BUSCA GLOBAL
==================================================

Preparar busca administrativa global.

Possíveis buscas:

- nome;
- Discord ID;
- citizenid;
- license;
- pedido;
- ticket;
- placa.

Os endpoints devem usar paginação/índices adequados.

==================================================
51. ADMIN ACCOUNT
==================================================

A autenticação administrativa deve ser baseada na Subúrbio API.

Discord OAuth autentica identidade.

A API autoriza.

O frontend NÃO determina privilégios.

==================================================
52. SYSTEM OWNER
==================================================

Já existe conceito de SYSTEM_OWNER/bootstrap.

Não hardcodar proprietário no frontend.

Usar configurações server-side/API.

SYSTEM_OWNER deve existir independentemente de:

- PlayerAccount;
- citizenid;
- personagem;
- QBCore;
- job;
- wipe.

==================================================
53. CAPABILITIES
==================================================

API deve resolver capabilities.

Preparar/reforçar catálogo central.

Exemplos:

dashboard.read

players.read
players.manage

admins.read
admins.manage

permissions.read
permissions.manage

allowlist.read
allowlist.write

punishments.read
punishments.write

tickets.read
tickets.manage
tickets.transcript.internal

orders.read
orders.manage

payments.read

refunds.read
refunds.manage

chargebacks.read

products.read
products.create
products.update
products.disable

coupons.read
coupons.create
coupons.update
coupons.disable

audit.read

services.read

settings.read
settings.write

Ajustar nomes ao padrão existente.

==================================================
54. OWNER E CUPONS
==================================================

Mesmo existindo capabilities:

somente OWNER pode possuir efetivamente:

coupons.create
coupons.update
coupons.disable

Não permitir grant desses poderes para outro cargo por interface comum,
salvo futura decisão explícita.

==================================================
55. AUDITORIA ADMINISTRATIVA
==================================================

Toda ação crítica deve gerar ADMIN_AUDIT.

Exemplos:

- criar produto;
- alterar produto;
- alterar preço;
- alterar estoque;
- criar cupom;
- editar cupom;
- desativar cupom;
- alterar permissões;
- alterar AdminAccount;
- reembolso;
- revogar allowlist;
- ações em ticket;
- reprocessar fulfillment;
- mudança de configuração.

Registrar:

actor
action
target
before
after
reason
requestId
operationId
createdAt

SYSTEM_OWNER também é auditado.

==================================================
56. MOTIVO PARA AÇÕES CRÍTICAS
==================================================

Preparar campo de justificativa obrigatório em operações sensíveis:

- banimento;
- revogação de allowlist;
- alteração manual de saldo;
- reembolso;
- alteração de permissão;
- reprocessamento manual;
- cancelamentos críticos.

==================================================
57. FILA DE FALHAS
==================================================

Preparar dashboard para operações que falharam:

- fulfillment;
- Discord notification;
- outbox;
- integrações.

OWNER/admin autorizado pode:

- visualizar;
- inspecionar;
- reprocessar com segurança.

Retry NÃO pode duplicar efeito.

==================================================
58. SERVIÇOS
==================================================

Página:

/admin/services

Mostrar estado de:

API
PostgreSQL
Redis/Memurai
Discord Bot
futuro Bridge
MariaDB reader quando habilitado

Estados:

ONLINE
DEGRADED
OFFLINE

Não expor:

- senha;
- token;
- HMAC secret;
- connection strings sensíveis.

==================================================
59. CONFIGURAÇÕES
==================================================

Preparar arquitetura para configurações administrativas como:

- manutenção da área comercial;
- limites Crypto;
- disponibilidade;
- preços base;
- limites de compra;
- parâmetros operacionais.

Configuração não deve exigir alteração de código quando não for necessário.

==================================================
60. WIPE
==================================================

Manter separação já estabelecida.

DADOS WIPEABLE:

- personagens;
- economia;
- inventário;
- veículos;
- propriedades;
- gameplay;
- dados dependentes da cidade.

DADOS INSTITUCIONAIS PERSISTENTES:

- AdminAccount;
- SYSTEM_OWNER;
- capabilities;
- ADMIN_AUDIT;
- orders;
- payments;
- refunds;
- chargebacks;
- cupons;
- métricas comerciais;
- configurações institucionais;
- histórico financeiro.

Um wipe da cidade NÃO pode apagar histórico comercial/institucional.

==================================================
61. BACKUP
==================================================

Documentar necessidade de backup de:

- PostgreSQL institucional;
- pedidos;
- pagamentos;
- auditoria;
- produtos;
- cupons;
- tickets após migração.

Não implementar destruição automática de histórico.

==================================================
62. SITE LOCAL E API REMOTA
==================================================

O site atualmente pode rodar localmente no PC.

A API roda na VPS.

Não assumir que:

127.0.0.1:3000

no PC é a API da VPS.

Preparar configuração:

SUBURBIO_API_URL=https://api.suburbioroleplay.com

O secret HMAC fica SOMENTE server-side no Next.js.

Nunca usar:

NEXT_PUBLIC_SITE_SERVICE_SECRET

==================================================
63. API REVERSE PROXY
==================================================

Arquitetura futura esperada:

suburbioroleplay.com
→ site

api.suburbioroleplay.com
→ Apache
→ reverse proxy
→ 127.0.0.1:3000
→ Subúrbio API

Banco de dados não deve ser exposto publicamente.

==================================================
64. RESPONSIVIDADE
==================================================

Dashboard precisa funcionar bem em:

1920x1080
1366x768
notebook
tablet
mobile

Principal atenção para 1366x768.

Tabelas devem ter solução responsiva adequada.

==================================================
65. ESTADOS DE UI
==================================================

Todas as páginas precisam possuir:

loading
empty
error
success quando aplicável

Não mostrar dados mockados como se fossem reais.

==================================================
66. API GAPS
==================================================

Se algum recurso necessário ainda não existir na API:

atualizar:

docs/API_GAPS.md

Documentar:

- endpoint;
- método;
- request;
- response;
- capability;
- motivo;
- consumidor.

NÃO contornar conectando diretamente ao banco.

==================================================
67. CONTRATOS
==================================================

Atualizar:

HTTP_CONTRACTS.md
OpenAPI

sempre que forem criados novos endpoints.

Seguir arquitetura oficial HMAC.

==================================================
68. ENDPOINTS DE CATÁLOGO
==================================================

Criar/adaptar endpoints equivalentes a:

GET /internal/fivem/catalog

GET /internal/fivem/catalog/version

POST /internal/fivem/crypto/purchase

Rotas reais podem ser ajustadas ao padrão arquitetural atual.

Somente não criar redundância desnecessária.

==================================================
69. ENDPOINTS ADMIN DE PRODUTOS
==================================================

Criar contratos equivalentes para:

listar produtos
detalhe
criar
editar
ativar/desativar
categorias
estoque

Todos protegidos com capability.

==================================================
70. ENDPOINTS DE CUPOM
==================================================

Criar contratos para:

listar
detalhe
validar no carrinho
criar
editar
desativar
métricas

Criação/edição/desativação:
OWNER only.

==================================================
71. ENDPOINTS DE TICKETS
==================================================

Planejar/criar contratos para:

listar tickets
buscar ticket
detalhe
histórico
transcripts
tags
participantes

Bot e site devem consumir API.

Não fazer site falar diretamente com Discord para buscar histórico.

==================================================
72. SEGURANÇA
==================================================

Não confiar em browser ou FiveM client para:

- preço;
- saldo;
- permissão;
- capabilities;
- produto;
- estoque;
- desconto;
- fulfillment;
- deliveryPayload.

Toda validação sensível ocorre server-side.

Proteger também contra:

- CSRF;
- XSS;
- SSRF;
- replay;
- HMAC inválido;
- mass assignment;
- IDOR;
- race conditions;
- double spend;
- double fulfillment.

==================================================
73. OBSERVABILIDADE
==================================================

Manter:

requestId
operationId
correlationId
eventId

Logs estruturados.

Não registrar secrets.

Permitir rastrear fluxo:

pedido
→ pagamento
→ fulfillment
→ bridge
→ entrega
→ Discord.

==================================================
74. TESTES DE CUPONS
==================================================

Adicionar testes:

- OWNER cria cupom;
- admin comum não cria;
- admin comum não edita;
- cupom percentual;
- cupom fixo;
- expirado;
- inativo;
- limite global;
- limite por usuário;
- mínimo de compra;
- categoria errada;
- produto errado;
- snapshot preservado;
- métricas corretas.

==================================================
75. TESTES DE CRYPTO
==================================================

Testar:

- pacote de 50 = R$60;
- pacote de 100 = R$120;
- pacote de 150 = R$180;
- pacote de 200 = R$240;
- pacote de 300 = R$360;
- pacote de 400 = R$480;
- pacote de 500 = R$600;
- pacote de 700 = R$840;
- pacote de 1000 = R$1.200;

- quantidade personalizada × R$1,25;
- quantidade inválida;
- manipulação de preço no client;
- cupom não altera quantidade entregue.

==================================================
76. TESTES DA LOJA CRYPTO IN-GAME
==================================================

Testar:

- catálogo baixa no startup;
- versionamento;
- produto desativado desaparece;
- canal errado não aparece;
- update do catálogo;
- full resync;
- preço do client ignorado;
- saldo insuficiente;
- saldo correto;
- saldo nunca negativo;
- compras concorrentes;
- estoque limitado;
- retry;
- double-click;
- mesma operationId não duplica compra;
- fulfillment não duplica.

==================================================
77. TESTES DE FULFILLMENT
==================================================

Testar:

- payment approved cria fulfillment;
- fulfillment pending não marca order como entregue;
- player offline;
- entrega após login;
- retry não duplica;
- restart não duplica;
- bridge ACK;
- erro temporário;
- erro permanente;
- delivered somente após confirmação real.

==================================================
78. TESTES DO DISCORD
==================================================

Testar:

- pagamento aprovado gera evento esperado;
- entrega confirmada gera evento;
- DM enviada;
- DM fechada;
- Discord indisponível;
- retry;
- mesma notificação não é duplicada;
- erro Discord não desfaz fulfillment.

==================================================
79. TESTES DOS TICKETS
==================================================

Testar:

- listagem;
- filtros;
- responsáveis;
- tags;
- reaberturas;
- múltiplos fechamentos;
- transcript;
- permissão de transcript interno;
- usuário sem capability bloqueado;
- integridade/hash;
- sanitização de transcript público.

==================================================
80. HOMOLOGAÇÃO ADMIN
==================================================

Criar em desenvolvimento, se fizer sentido:

/admin/debug/auth

Apenas dev/SYSTEM_OWNER.

Mostrar SEM secrets:

Discord ID
AdminAccount ID
status
isSystemOwner
capabilities
API connectivity
session expiry

Nunca mostrar:

OAuth token
SITE_SERVICE_SECRET
HMAC secret

==================================================
81. DOCUMENTAÇÃO
==================================================

Atualizar/criar conforme necessário:

docs/API_GAPS.md
docs/HTTP_CONTRACTS.md
docs/ADMIN_PERMISSIONS.md
docs/SITE_ARCHITECTURE.md
docs/COMMERCE_ARCHITECTURE.md
docs/FULFILLMENT.md
docs/PRODUCT_CATALOG.md
docs/CRYPTO_STORE.md
docs/TICKET_ARCHITECTURE.md
docs/PRODUCTION_AUDIT.md

Não criar documentação duplicada se já houver arquivo equivalente.

==================================================
82. IMPLEMENTAÇÃO EM FASES
==================================================

Não tentar destruir/refazer tudo de uma vez.

Prioridade:

FASE 1
Auditar código atual.

FASE 2
Fechar AdminAccount/capabilities.

FASE 3
Catálogo Product + categorias.

FASE 4
Crypto/site/carrinho.

FASE 5
Cupons.

FASE 6
Orders/payment/delivery/fulfillment.

FASE 7
Notificações Discord.

FASE 8
Loja Crypto + contratos do bridge.

FASE 9
Tickets na API/dashboard.

FASE 10
Perfil unificado do player.

FASE 11
Métricas/health/fila de falhas.

Ajustar ordem somente se dependências técnicas exigirem.

==================================================
83. IMPORTANTE SOBRE O BRIDGE
==================================================

O bridge ainda será desenvolvido posteriormente.

Portanto:

- preparar contratos;
- preparar eventos;
- preparar adapters/interfaces;
- preparar endpoints;
- documentar protocolo.

Não inventar uma implementação fake de FiveM somente para dizer que está pronto.

Tudo que depender do bridge deve ser claramente marcado como:

READY_FOR_BRIDGE

ou equivalente.

==================================================
84. COMPATIBILIDADE
==================================================

Não quebrar:

- allowlist existente;
- outbox;
- autenticação HMAC;
- login Discord;
- frontend público;
- pedidos existentes;
- migrations existentes;
- estrutura do bot.

Qualquer breaking change precisa ser informado explicitamente.

==================================================
85. MIGRATIONS
==================================================

Criar novas migrations sem alterar migrations já aplicadas.

Não editar migrations antigas de produção.

As migrations devem possuir rollback seguro quando possível.

==================================================
86. RESULTADO FINAL
==================================================

Ao finalizar, responder obrigatoriamente com:

1. resumo do que foi implementado;

2. arquivos principais alterados;

3. migrations adicionadas;

4. endpoints adicionados;

5. eventos adicionados;

6. capabilities adicionadas;

7. páginas adicionadas/alteradas;

8. integrações que já funcionam;

9. partes READY_FOR_BRIDGE;

10. itens ainda presentes em API_GAPS.md;

11. número total de testes;

12. resultado de:
   npm test
   npm run typecheck
   npm run lint
   npm run build

13. breaking changes;

14. variáveis .env novas;

15. passos exatos para homologação.

==================================================
87. REGRA FINAL
==================================================

Não considerar uma funcionalidade "pronta" apenas porque a interface existe.

Distinguir claramente:

UI pronta
API pronta
persistência pronta
integração pronta
bridge pendente
homologação pendente

O objetivo é construir um sistema institucional confiável para a Subúrbio
RP, e não somente telas visuais.