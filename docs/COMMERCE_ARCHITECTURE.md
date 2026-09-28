# Comércio — estado implementado

O site envia identificadores/quantidades; a API recalcula preços, disponibilidade e desconto. Quote não reserva recursos. Criação interna exige Discord verificado, valida propriedade do personagem opcional e limita três reservas simultâneas por cliente.

A transação serializa cliente, catálogo e cupom, reduz estoque limitado e grava pedido, itens, snapshots financeiro/de entrega, uso reservado do cupom, ADMIN_AUDIT e outbox. Retry da mesma chave devolve o mesmo pedido; outra carga com a mesma chave falha. Erros de domínio revertem a reserva antes de registrar a operação falha.

Cancelamento exige propriedade, status pending e ausência de referência/pagamento no provedor. Restaura estoque e libera cupom uma única vez. expires_at está persistido; worker de expiração/reconciliação ainda não existe. Não liberar estoque automaticamente com risco de compensação tardia.

Histórico institucional preserva nome, quantidade, preço, entrega e desconto depois de mudanças no catálogo. Remoção de gameplay pode desvincular Player/Character sem apagar o financeiro. Resposta ao cidadão omite payload interno de entrega.

Mercado Pago: adaptador com origem fixa, timeout, sem redirects, valida recebedor/checkout e confere pagamento oficial por valor/moeda/referência/ambiente. Assinatura exige data.id numérico da query, x-request-id, x-signature, HMAC-SHA256 e janela de cinco minutos. Faltam receptor HTTP, persistência de notificações, reconciliação, intenção de checkout durável e fulfillment. Configurar .env não conclui essas etapas.
