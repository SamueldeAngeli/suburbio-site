# Aprovação necessária — cargos administrativos Discord

Proposta explicitamente aprovada pelo usuário em 2026-10-03. Implementada e testada em ambiente isolado; aplicação em banco real pendente. Ver DISCORD_ROLES_IMPLEMENTED.md. A recusa automática anterior foi resolvida pela autorização explícita.

## Configuração solicitada para aprovação

Guild: 876948887695405066.

| Cargo | Role ID | Ativação proposta | Poderes |
|---|---|---|---|
| OWNER | 876948888114839626 | Ativo após migration/configuração autorizada | Catálogo administrativo completo listado abaixo, sem SYSTEM_OWNER |
| Staff | 876948888085467204 | Desativado | Nenhum até definir capabilities |
| Suporte | 876948888085467202 | Desativado | Nenhum até definir capabilities |
| Financeiro | — | Não criar | Não solicitado |

Capabilities propostas para OWNER, extraídas do catálogo atual da API:

DASHBOARD_READ, PLAYERS_READ, PLAYERS_MANAGE, ADMINS_READ, ADMINS_MANAGE,
PERMISSIONS_READ, ADMIN_PERMISSIONS_MANAGE, ALLOWLIST_READ, ALLOWLIST_REVOKE,
PUNISHMENTS_READ, PUNISHMENTS_WRITE, TICKETS_READ, TICKETS_MANAGE, TICKETS_TRANSCRIPT_INTERNAL,
ORDERS_READ, ORDERS_MANAGE, PAYMENTS_READ, REFUNDS_READ, REFUNDS_MANAGE, CHARGEBACKS_READ,
PRODUCTS_READ, PRODUCTS_CREATE, PRODUCTS_UPDATE, PRODUCTS_DISABLE,
COUPONS_READ, COUPONS_CREATE, COUPONS_UPDATE, COUPONS_DISABLE,
AUDIT_READ, SERVICES_READ, DISCORD_READ, SETTINGS_READ, SETTINGS_WRITE.

Isso inclui poderes financeiros de leitura/gestão previstos no catálogo (inclusive refunds), cupons e administração comum. Não concede a capacidade de remover/rebaixar SYSTEM_OWNER, alterar bootstrap, ignorar validações ou assumir sua identidade. Se esse conjunto for amplo demais, aprovar uma lista menor antes de ativar.

## Alterações propostas

- Migration 011: discord_role_mappings (guild/role ID, label, enabled, isOwner, capabilities) e snapshot admin_discord_access (admin ID, guild, roles, status, verifiedAt, expiresAt, origem Discord). Preservar AdminAccount e auditoria após remoção de cargo.
- Resolver existente POST /internal/site/admin/resolve: corpo legado {discordId} preservado para SYSTEM_OWNER/manual; extensão opcional membership verificada exclusivamente pelo site HMAC. Asserção: guildId, status VERIFIED/NO_MEMBER/UNAVAILABLE, verifiedRoleIds e verifiedAt; sem tokens. Exigir idempotência na sincronização que cria/atualiza acesso.
- TTL absoluto na API de 60 segundos por padrão; não renovar validade de asserção velha ao recebê-la. Validar guild e timestamp. Nova asserção não deve ser substituída por resposta antiga concorrente.
- Auto-criar STANDARD somente com role mapeada/ativa; SYSTEM_OWNER é resolvido primeiro, independente de Discord. Admin desativado continua bloqueado.
- Atualizar guard de todas as operações da API: grants de cargo + overrides; revokes explícitos prevalecem. Owner-only exige SYSTEM_OWNER ou OWNER Discord efetivamente verificado. Origem Discord sem cargo/lease válida falha fechado. Contas manuais legadas preservam semântica vigente de overrides.
- Falha Discord não apaga conta nem histórico; invalida autorização derivada segura. Não inferir NO_ROLE de erro de transporte.
- GET /internal/site/discord-role-mappings para PERMISSIONS_READ; POST para SYSTEM_OWNER apenas, com motivo, confirmação, idempotência e auditoria. O OWNER Discord não pode ampliar seu próprio mapeamento.
- Auditoria na criação e mudança efetiva, não em refresh sem mudança. Transações/operações/outbox conforme arquitetura existente.
- Testes API para owner institucional/Discord, spoof, serviço incorreto, HMAC, TTL, remoção/adição, overrides/revokes, concorrência, disabled, owner-only e indisponibilidade.

A aprovação pedida autoriza implementar e testar esse desenho no código da API e nos bancos isolados de testes. **Não inclui aplicar migration em banco real, publicar ou efetuar pagamentos.**
