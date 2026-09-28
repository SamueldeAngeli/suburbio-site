# Auditoria da loja existente

O frontend original foi preservado. Fonte atual: `lib/site.ts`, explicitamente demonstrativa. Não existe API de produtos, checkout ou histórico no site original nem no contrato HTTP v0.2 da Subúrbio API.

| ID | Produto | Categoria | Preço demo |
| --- | --- | --- | --- |
| cria | VIP Cria | VIPs | R$ 29,90 / 30 dias |
| patrao | VIP Patrão | VIPs | R$ 59,90 / 30 dias |
| lenda | VIP Lenda | VIPs | R$ 99,90 / 30 dias |
| comet | Comet RS | Carros | R$ 149,90 |
| sultan | Sultan Street | Carros | R$ 89,90 |
| loft | Loft Urbano | Casas | R$ 199,90 |
| cobertura | Cobertura Skyline | Casas | R$ 349,90 |
| identidade | Nova identidade | Itens VIP | R$ 19,90 |

Todos os benefícios, disponibilidade e preços são fictícios. Nenhum veículo, imóvel ou VIP é entregue. Imagem `public/logo.png` é a arte fornecida; banners/frases são conteúdo editorial fixo, não métricas da cidade. `site.discordUrl` e `site.connectUrl` estão vazios, sem links inventados.

Carrinho usa localStorage `suburbio-cart`, valida IDs existentes, limita 1–10 unidades por item e totaliza apenas no navegador. É uma demonstração; nunca utilizar esses valores como autoridade financeira. O botão Continuar informa indisponibilidade, não emite pedido nem cobra. Histórico de compras, pedidos, VIP real e personagens não existiam; novas áreas mostram integração pendente.

`StoreService.listProducts` é server-only e lança API_GAP. **Não importa os produtos demo como fallback real.** O tipo Product é reutilizado apenas como contrato de apresentação. Proposta de catálogo real usa preços inteiros em centavos, moeda, versionamento e benefícios; requer adapter explícito. A API deve validar disponibilidade/quantidade/preço no checkout, criar snapshot e controlar pagamento/entrega. Não implementar Mercado Pago no site para contornar ausência da API.
