# Pré-VPS — checkpoint 2026-10-04

## Bridge: READY_FOR_LOCAL_HOMOLOGATION

81 testes originais corrigidos, nenhum removido/ignorado; 2 testes financeiros novos. Resultado: **83/83**, zero falhas/skips. `npm run check`: 40 arquivos JavaScript/Lua válidos. Não representa homologação FiveM real.

| Falha original | Classificação | Causa e correção |
|---|---|---|
| storefront sem contrato | TEST_OUTDATED | Contrato atual contém storefronts explícitos. Teste verifica associação e rejeição de nome inválido. |
| produto válido aguarda contrato | TEST_OUTDATED | Endpoint financeiro existe. Verifica bloqueio padrão PURCHASES_DISABLED, sem chamada financeira. |
| preço/identidade manipulados | TEST_OUTDATED | Fixture antiga sem ledger/UUID. Verifica whitelist e identidade obtida no servidor. |
| produto inexistente | CONTRACT_MISMATCH | Decisão pertence à API, não catálogo local. Teste verifica resposta oficial PRODUCT_NOT_FOUND. |
| quantidade inválida | TEST_OUTDATED | Construtor incompleto impedia validação. Fixture durável atualizada; mantém todas as quantidades inválidas. |
| duplo clique | TEST_OUTDATED | Contrato agora aceita compra explicitamente habilitada. Verifica uma única chamada concorrente. |
| API/cache indisponível | CONTRACT_MISMATCH | Compra não usa preço do cache; API é autoridade. Timeout persiste intenção e bloqueia novo ID. |
| runtime | RUNTIME_MISMATCH / FINANCIAL_RISK | Inicializava Purchase sem api/ledger. Injeta dependências, enqueue e flag explícita; padrão false também no construtor. |

Runtime agora reconcilia compras pendentes no ciclo existente e disponibiliza exports de preparação, pendências e saldo. Status não anuncia mais contrato ausente. PurchasesEnabled=false permanece; nenhum pagamento real. Novos testes: resposta perdida + reinício resolve via lookup sem segundo POST; lookup inconclusivo não repete POST. Handlers de efeitos/receipts não foram alterados neste checkpoint. VIP ainda usa fluxo antigo, pendente da etapa própria.

Logs: D:/suburbio_bridge/.local/pre-vps-tests.log.

## Slots: BLOCKED — falta identificar base em uso

Auditado somente D:/qb-multicharacter.zip, sem alterar/extrair o resource:
- config.lua: DefaultNumberOfCharacters=5; PlayersNumberOfCharacters sobrescreve por license.
- server.lua: GetNumberOfCharacters consulta config por license; createCharacter revalida cid <= math.min(limit,5).
- Não há comando de concessão de slots nessa cópia. Não há armazenamento durável de concessões nem contrato que reúna eventos/staff/compensações.
- Quantidade de linhas em players é personagens ocupados, não limite efetivo.
- Padrão dessa cópia já permite cinco: não presumir espaço comprável ou reduzir limite para vender slots.
- É necessário confirmar pasta do resource em uso e qb-vipfunc. Pergunta enviada ao usuário. Não inventar effectiveSlots, não oferecer compra nem refund fictício.

## Demais etapas

VIP/fila, presentes, auditoria admin, LiveKit e migrations: não concluídos nesta continuação. Mantida prioridade solicitada; falta de fonte autoritativa de slots impede fechar a etapa seguinte. Nenhuma migration aplicada, dependência instalada, domínio configurado ou serviço exposto. Testes de Site/API/Bot não foram reexecutados neste checkpoint: nenhum arquivo de execução desses projetos foi alterado. Totais anteriores não representam nova validação.
