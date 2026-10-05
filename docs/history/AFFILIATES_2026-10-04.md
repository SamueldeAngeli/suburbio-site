# Sistema de afiliados — 04/10/2026

Implementação no site e na Subúrbio API. OAuth base, Bot Discord, bridge e QBCore não foram alterados nesta etapa. Homepage e ordem desktop carrinho → Crypto → perfil preservadas.

## Modelagem e migration

Arquivo: D:/api suburbio/src/database/migrations/012_affiliates.ts.

- affiliate_accounts: conta Discord explicitamente cadastrada, cupom existente vinculado, nome, tipo, status, percentuais independentes, validade, janela de segurança, observações e revisão concorrente.
- affiliate_attributions: uma atribuição imutável por pedido; snapshots de código, desconto, comissão, base líquida, comissão original, comprador, janela e data. Trigger impede UPDATE/DELETE.
- affiliate_commissions: vínculo com pagamento confirmado, comissão original/atual, devolução acumulada, valor liquidado, compensações, datas de aprovação/liberação e repasse.
- affiliate_payouts: registro imutável do repasse manual, valor bruto, compensação, valor externo líquido, executor, observação, operação e data.
- Cupons continuam em coupons/coupon_redemptions. Não há segundo motor de desconto. Cupom vinculado é editado somente pelo cadastro do afiliado.

Migration aplicada exclusivamente em bancos descartáveis dos testes. **Pendente no ambiente real.** Nenhum cadastro, pagamento ou dado real foi modificado. Rollback destrutivo é bloqueado para preservar histórico; evolução por migration corretiva.

## Cadastro e permissões

/admin/affiliates lista; /admin/affiliates/new cadastra; /admin/affiliates/[id] mostra relatório, editor e repasses conforme acesso.

Informe Discord ID, nome do afiliado, nome/código do cupom, desconto (0–99%, inteiro), comissão (0–100%, inteiro), janela (0–365 dias), tipo, status, validade UTC opcional e observações. Motivo e confirmação obrigatórios. O Discord ID é imutável; outra identidade exige novo cadastro. Código único em todo o motor de cupons. Não existe cadastro automático por cargo.

Capabilities novas: AFFILIATES_READ, AFFILIATES_MANAGE, AFFILIATES_PAYOUT_READ, AFFILIATES_PAYOUT_MANAGE. A última registra liquidação financeira manual; não executa PIX ou refund de comprador. SYSTEM_OWNER mantém autoridade institucional. **Discord OWNER não recebe estas quatro automaticamente**: sua lista fixa da migration 011 é preservada. Conceder explicitamente via mecanismo administrativo existente, conforme necessidade. Staff e Suporte continuam desativados.

Todas as escritas usam sessão → BFF → HMAC, guard de capability, origem/intenção, confirmação, motivo/observação e chave idempotente. API revalida autorização inclusive em replay. Auditoria e outbox transacionais. Observações administrativas e identidade dos compradores não são retornadas no painel público.

## Cálculo e ciclo financeiro

Comissão = piso(valor líquido efetivamente pago em centavos × percentual / 100), calculado com BigInt na API. R$100 menos 5% = R$95; comissão de 8% = R$7,60. Sem float na comissão. Desconto e comissão são independentes.

Pedido criado apenas salva atribuição; não gera saldo. Confirmação válida do provedor gera comissão. PENDING até availableAt; AVAILABLE a partir desse instante, calculado pelo relógio da API nas consultas e nos repasses, sem depender de frontend ou cron. Repasse marca PAID. Comissão zerada por reversão é REVERSED. Liberação usa a janela preservada na venda, não a configuração atual.

Compra do próprio Discord afiliado pode receber desconto, mas não gera comissão nem entra nas métricas remuneradas. A atribuição usa sempre customerDiscordId do pedido. Futuro destinatário de presente não muda o comprador; o checkout atual não foi expandido para criar presentes fictícios.

Refund parcial confirmado recalcula comissão sobre a base restante. O valor acumulado estornado só cresce: evento atrasado/duplicado não restaura ganhos. Refund integral, chargeback ou cancelamento de pagamento anteriormente aprovado zeram comissão. A API mantém a análise de entrega já existente para pedidos em revisão.

Após repasse, o registro pago permanece intacto. Diferença entre valor liquidado e ganho atual gera débito, descontado em repasses futuros. Cada compensação é persistida. Não há saldo negativo oculto nem exclusão de histórico. Repasse com compensação integral pode ter transferência externa zero. Concorrência serializada por afiliado impede pagamento duplo.

Admin recebe prévia calculada pela API (até 100 comissões por lote), confere valor externo, realiza pagamento fora do site e registra com observação/comprovante. A API compara o valor esperado com o saldo atual; mudança exige nova confirmação. Resumos do painel seguem a data de aprovação no período escolhido; “comissões liquidadas” inclui compensações. Débito aparece separado. Prévia de repasse considera todos os débitos, independentemente do filtro.

## Contratos criados

Todos os contratos abaixo são HMAC, serviço site. OpenAPI regenerado em D:/api suburbio/docs/openapi.json.

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | /internal/site/me/affiliate/access | Cadastro ativo do usuário |
| GET | /internal/site/me/affiliate | Painel, resumo, gráfico e vendas paginadas; period=7/30/90/all |
| GET | /internal/site/affiliates/referral | Validar código ativo de referência |
| GET / POST | /internal/site/affiliates | Listar / cadastrar |
| GET / POST | /internal/site/affiliates/:id | Detalhar / editar com revisão |
| GET | /internal/site/affiliates/:id/dashboard | Relatório administrativo |
| GET | /internal/site/affiliates/:id/payout-preview | Prévia financeira calculada na API |
| GET / POST | /internal/site/affiliates/:id/payouts | Histórico / registro manual |

Detalhes de comissão por venda são fornecidos em sales: pedido, produtos/quantidades, base após devolução, comissão original/atual/revertida, débito, status, código/rates aplicados e liberação. Não há endpoint fictício separado.

BFF: GET /api/me/access (somente flags confirmadas, fail closed independente), GET /api/affiliate/referral e POST /api/admin/affiliates. Páginas consultam API no servidor, com guards próprios. Usuário comum recebe 404 ao abrir a área restrita diretamente.

## Site, navegação e referência

/minha-conta/afiliado: cupom em destaque, desconto e comissão distintos, cards, gráfico diário UTC, filtros, tabela de vendas, detalhes de snapshot e estado vazio com zeros reais. Tema escuro/ciano existente. Tabela com rolagem horizontal no mobile e valores acessíveis do gráfico.

Dropdown desktop e mobile: Ver perfil → Afiliado (cadastro ativo confirmado) → Admin (autorização confirmada pela API) → Sair. Não basta estado local, cargo ou autenticação Discord. Cada destino possui proteção própria. Sem mudanças no OAuth base.

/?ref=CODIGO valida o código na API e armazena por 7 dias no navegador, limitado à validade do cupom. Último link explícito válido substitui a referência; visitas normais não renovam TTL. Pré-preenche campo vazio, sem substituir cupom digitado nem efetuar compra. Checkout e criação de pedido validam novamente. Referência local não concede desconto nem comissão por si só.

Principais componentes: AffiliateDashboard, AffiliateEditor, AffiliatePayout; UserMenu/CitizenProvider ampliados. Estilo em app/affiliate.css; contratos tipados em lib/api/affiliate-contracts.ts.

## Verificação

| Projeto / suíte | Aprovados |
|---|---:|
| Site — npm test | 278 |
| Site — HTTP | 43 |
| Site — navegador existente | 20 |
| Site — navegador afiliados | 15 |
| **Site total** | **356** |
| API — npm test | 91 |
| API — integração | 234 |
| **API total** | **325** |
| **Total geral** | **681** |

Nenhuma suíte ou arquivo de teste foi removido. As expectativas de migrations (11→12) e do catálogo fixo Discord OWNER foram atualizadas de forma explícita. Testes de API usam PostgreSQL/Redis isolados e fixtures; testes visuais usam outro processo Next, sessão assinada de teste e servidor de contratos simulado, sem conexão com produção.

Checks: site typecheck, lint, build e verify:client; API typecheck, lint, build e exportação OpenAPI. Testes adicionais cobrem cálculo inteiro, snapshots, cupons únicos/editáveis, compra própria, permissões, estornos parciais/integrais, chargeback pago, compensação, concorrência/idempotência, BFF e dropdown condicional.

## Homologação pendente

1. Aplicar migration 012 no ambiente da API com backup e procedimento normal de deploy.
2. Configurar conexão BFF→API/HMAC no ambiente de homologação. A conexão real deste site continua desativada; não foi declarada integração live.
3. Com SYSTEM_OWNER ou permissões concedidas explicitamente, cadastrar um afiliado real e conferir os quatro estados de acesso.
4. Homologar checkout Mercado Pago, aprovação, estorno parcial/integral e chargeback em ambiente de teste do provedor. Integração automatizada atual valida reconciliação com payloads de fixture, não movimentação real.
5. Homologar um registro manual de repasse e conferir auditoria, compensações e consulta com conta Discord real.

Nenhuma variável .env nova específica é necessária; janela, percentuais e validade pertencem ao cadastro da API. Não houve publicação externa.

## Evidências visuais

Capturas em docs/screenshots/affiliates, todas com faixa “AMBIENTE DE TESTE · DADOS SIMULADOS”. Não representam saldo ou cadastro real.

- [Painel desktop](screenshots/affiliates/painel-desktop.png)
- [Painel mobile](screenshots/affiliates/painel-mobile.png)
- [Painel vazio mobile](screenshots/affiliates/painel-vazio-mobile.png)

| Dropdown | Desktop | Mobile |
|---|---|---|
| Comum | [Captura](screenshots/affiliates/dropdown-comum-desktop.png) | [Captura](screenshots/affiliates/dropdown-comum-mobile.png) |
| Afiliado | [Captura](screenshots/affiliates/dropdown-afiliado-desktop.png) | [Captura](screenshots/affiliates/dropdown-afiliado-mobile.png) |
| Admin | [Captura](screenshots/affiliates/dropdown-admin-desktop.png) | [Captura](screenshots/affiliates/dropdown-admin-mobile.png) |
| Ambos | [Captura](screenshots/affiliates/dropdown-afiliado-admin-desktop.png) | [Captura](screenshots/affiliates/dropdown-afiliado-admin-mobile.png) |
