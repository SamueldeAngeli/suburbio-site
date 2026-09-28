ADICIONAR VALIDADE / DURAÇÃO AOS PRODUTOS

Precisamos permitir que cada produto cadastrado tenha ou não validade.

Não hardcodar 30 dias por tipo.

==================================================
1. VALIDADE DO PRODUTO
==================================================

Adicionar configuração equivalente a:

validityMode

Valores:

PERMANENT
DURATION

Se validityMode=DURATION:

durationDays

Exemplo:

{
  "validityMode": "DURATION",
  "durationDays": 30
}

Produtos permanentes:

{
  "validityMode": "PERMANENT"
}

==================================================
2. ADMIN
==================================================

No cadastro/edição de produto:

Validade:

- Permanente
- Temporária

Se Temporária:

Duração:
[ 30 ] dias

Validar:

- inteiro positivo;
- limite razoável;
- obrigatório somente para DURATION.

Exemplos:

VIP:
30 dias

Veículo:
30 dias

Casa:
30 dias

Item de inventário:
permanente

==================================================
3. NÃO INICIAR NO PAGAMENTO
==================================================

A validade NÃO começa em payment.approved.

A validade começa somente quando o benefício for realmente ativado/entregue.

Fluxo:

payment approved
→ fulfillment
→ bridge confirma entrega
→ entitlement ativado
→ startsAt
→ expiresAt calculado

==================================================
4. ENTITLEMENT
==================================================

Criar domínio/tabela equivalente a Entitlement.

Campos mínimos:

id
playerId
productId
orderId
orderItemId
fulfillmentId

type
status

startsAt
expiresAt

createdAt
activatedAt
expiredAt
revokedAt

metadata

Status:

PENDING
ACTIVE
EXPIRED
REVOKED

==================================================
5. CÁLCULO DE EXPIRAÇÃO
==================================================

Para DURATION:

expiresAt =
startsAt + durationDays

Usar datas UTC internamente.

==================================================
6. RENOVAÇÃO
==================================================

Produtos temporários podem ser renováveis.

Adicionar:

renewable

Se benefício ainda estiver ACTIVE:

novo expiresAt =
expiresAt atual + duração adquirida

Exemplo:

vence 20/10
+30 dias
→ novo vencimento 19/11

Se já estiver EXPIRED:

nova validade começa na nova ativação.

==================================================
7. NÃO APAGAR HISTÓRICO
==================================================

Expiração NÃO apaga:

- order;
- payment;
- fulfillment;
- entitlement;
- histórico.

Somente altera status.

==================================================
8. POLÍTICA POR TIPO
==================================================

Preparar handlers específicos.

VIP:
ao expirar:
- remover benefícios VIP;
- sincronizar Discord se aplicável.

VEHICLE:
ao expirar:
- retirar acesso ao veículo temporário;
- preservar histórico.

PROPERTY:
ao expirar:
- retirar acesso à propriedade temporária;
- preservar histórico.

INVENTORY_ITEM:
normalmente permanente.

SERVICE:
depende do produto.

==================================================
9. BRIDGE
==================================================

suburbio_bridge deve receber/reconciliar:

entitlement.activated
entitlement.expired
entitlement.revoked

No startup/playerLoaded:

verificar benefícios relevantes.

Se algo expirou enquanto player estava offline:

aplicar política de expiração de forma idempotente.

==================================================
10. JOB DE EXPIRAÇÃO
==================================================

API deve possuir processo seguro para detectar:

expiresAt <= now
AND status=ACTIVE

e mudar para EXPIRED.

Gerar evento:

entitlement.expired

Processamento deve ser idempotente.

==================================================
11. SITE / MINHA CONTA
==================================================

Mostrar:

Produto
Status
Data de ativação
Data de vencimento
Tempo restante

Exemplo:

VIP Elite
Ativo
Expira em 18 dias

==================================================
12. ADMIN PLAYER
==================================================

No perfil administrativo do player:

aba Benefícios / Entitlements

Mostrar:

produto
tipo
pedido
status
startsAt
expiresAt
tempo restante
fulfillment
origem

==================================================
13. ADMIN PRODUTOS
==================================================

Na listagem de produtos mostrar:

Nome
Tipo
Preço
Canal
Validade
Status

Exemplo:

VIP Elite
VIP
R$...
SITE_VIP
30 dias
Ativo

==================================================
14. SNAPSHOT NO PEDIDO
==================================================

Guardar no order item:

validityModeSnapshot
durationDaysSnapshot

Se o produto for alterado de 30 para 60 dias depois:

compras antigas continuam com a duração adquirida originalmente.

==================================================
15. TESTES
==================================================

Adicionar testes para:

- produto permanente;
- produto 30 dias;
- startsAt somente após entrega;
- expiresAt correto;
- atraso de fulfillment não consome validade;
- renovação antes de vencer;
- renovação após vencimento;
- expiração offline;
- retry de expiração não duplica efeito;
- VIP expira;
- veículo expira;
- propriedade expira;
- snapshot preservado após alteração do produto;
- histórico permanece após expiração.

==================================================
16. IMPORTANTE
==================================================

Não implementar expiração removendo registros diretamente do banco QBCore.

API decide estado institucional.

Bridge executa alteração no jogo através de APIs/exports/adapters oficiais.