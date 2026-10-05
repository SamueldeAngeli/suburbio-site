# Cargos Discord — implementação aprovada

Em 2026-10-03, o usuário autorizou expressamente a proposta DISCORD_ROLE_APPROVAL.md, incluindo administração e capacidades financeiras. A implementação em D:/api suburbio está concluída no código; ativação em ambiente real permanece pendente da migration e configuração de conexão. Nenhuma migration de banco real foi aplicada.

## Mapeamentos

- OWNER: 876948888114839626, habilitado pela migration 011_discord_roles, isOwner=true, STANDARD (nunca SYSTEM_OWNER).
- Staff: 876948888085467204, desativado, zero capabilities.
- Suporte: 876948888085467202, desativado, zero capabilities.
- Financeiro: nenhum mapping criado.
- Guild: 876948887695405066.

## Exatamente 33 capabilities do OWNER

DASHBOARD_READ, PLAYERS_READ, PLAYERS_MANAGE, ADMINS_READ, ADMINS_MANAGE,
PERMISSIONS_READ, ADMIN_PERMISSIONS_MANAGE, ALLOWLIST_READ, ALLOWLIST_REVOKE,
PUNISHMENTS_READ, PUNISHMENTS_WRITE, TICKETS_READ, TICKETS_MANAGE, TICKETS_TRANSCRIPT_INTERNAL,
ORDERS_READ, ORDERS_MANAGE, PAYMENTS_READ, REFUNDS_READ, REFUNDS_MANAGE, CHARGEBACKS_READ,
PRODUCTS_READ, PRODUCTS_CREATE, PRODUCTS_UPDATE, PRODUCTS_DISABLE,
COUPONS_READ, COUPONS_CREATE, COUPONS_UPDATE, COUPONS_DISABLE,
AUDIT_READ, SERVICES_READ, DISCORD_READ, SETTINGS_READ, SETTINGS_WRITE.

REFUNDS_READ permite consulta; REFUNDS_MANAGE autoriza gestão de reembolsos nos fluxos que exijam essa capability. Esta alteração não cria um endpoint de estorno nem executa reembolsos. Validações e auditoria dos fluxos existentes permanecem obrigatórias. O catálogo está fixado na migration para que capacidades futuras não sejam concedidas implicitamente.

## Proteções

SYSTEM_OWNER é institucional, independente de cargos e disponibilidade do Discord. O OWNER Discord não pode removê-lo/rebaixá-lo/substituí-lo, editar seus identificadores ou editar mappings. Mappings só podem ser alterados pelo SYSTEM_OWNER com motivo, confirmação, idempotência, auditoria e outbox na mesma transação.

O site verifica roles no Discord com token OAuth exclusivamente server-side e transmite prova via HMAC. O browser não fornece roles confiáveis. Refresh do site: 30s; escritas sensíveis forçam consulta. Lease da API: 60s a partir de verifiedAt, com rejeição de prova velha/futura e proteção contra respostas fora de ordem. Replays recalculam autorização atual. Revokes explícitos prevalecem; owner-only requer OWNER válido ou SYSTEM_OWNER. Administração manual mantém grants comuns existentes.

Remoção de cargo ou NO_MEMBER retira acesso derivado sem apagar conta/auditoria. UNAVAILABLE mantém roles anteriores como histórico, invalida autorização derivada e permite nova validação quando Discord voltar. Reinício do processo do site exige novo login para recuperar token em memória; não há vault distribuído ou refresh token nesta etapa.

## Homologação real

1. Em ambiente escolhido e autorizado, aplicar migration 011_discord_roles com o procedimento normal da API; não foi aplicada em banco real nesta tarefa.
2. Configurar no .env.local do site SUBURBIO_API_ENABLED=true, SUBURBIO_API_URL e SITE_SERVICE_ID/SITE_SERVICE_SECRET correspondentes à API. Habilitar DISCORD_ROLE_AUTH_ENABLED=true somente com migration/contrato disponíveis. Atualmente ambos os flags de integração permanecem false.
3. Callback cadastrada na aplicação correta: http://localhost:3002/api/auth/callback/discord. Em produção, domínio definitivo HTTPS em AUTH_URL e na callback.
4. Servidor local deve ter acesso de saída HTTPS ao Discord. O erro Configuration observado foi associado a EACCES no processo restrito. Servidor reiniciado com rede autorizada; diagnóstico chegou ao endpoint OAuth e retornou invalid_grant para código fictício, sem invalid_client. Isso não equivale a login completo.
5. Abrir http://localhost:3002/login, iniciar novo login e autorizar a aplicação. Conferir Minha Conta. Evitar reutilizar callback antiga/código OAuth.
6. Usar conta de teste com OWNER e conferir dashboard/mappings. Conta SYSTEM_OWNER não serve para testar remoção de OWNER, pois seu acesso institucional é independente.
7. Na conta de teste, remover OWNER, esperar até 30s ou tentar operação sensível para forçar revalidação; conferir bloqueio e histórico preservado. Adicionar novamente e revalidar. Testar Staff/Suporte/comum sem acesso.
8. Simular falha Discord apenas em homologação: bloquear novas autorizações derivadas sem exclusão de conta; restabelecer e revalidar. Não realizar estorno real para testar capabilities.

## Verificações

Site: 219 unitários (20 arquivos), 43 HTTP, total 262; typecheck, lint, build e verify:client aprovados. Build com AUTH_ENABLED=false somente no processo de compilação, pois HTTP local usa desenvolvimento e produção exige HTTPS. Nenhum teste removido.

API: resultados finais registrados após regressão completa. Migration aplicada exclusivamente em bancos temporários suburbio_test_UUID criados e removidos pelas fixtures, em PostgreSQL 15432 e Redis isolado 16379.

2026-10-04: regressão completa da API aprovada na etapa de dados do cidadão (85 unitários + 211 integração). Expectativa de 10 migrations corrigida para as 11 existentes. Sem alterações de regras administrativas e sem aplicar migration em banco real.
