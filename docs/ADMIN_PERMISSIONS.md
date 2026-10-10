# Acesso administrativo — v0.3

Discord OAuth autentica identidade; a API autoriza. POST /internal/site/admin/resolve exige HMAC e serviço site. O BFF deriva discordId da sessão e converte isSystemOwner explicitamente em fullAccess, sem exceções de ID no frontend.

Sem sessão: login. Conta desconhecida/inativa ou capability ausente: 403. API indisponível/não configurada: falha fechada. Cada página e handler verifica acesso. Não persistir capabilities no navegador.

Catálogo central: D:/api suburbio/src/modules/admin/capabilities.ts. STANDARD não tem grants implícitos; overrides válidos concedem permissões e revokes prevalecem. Owner recebe todas. Grupos e expiração de overrides ainda pendentes.

COUPONS_CREATE, COUPONS_UPDATE e COUPONS_DISABLE são exclusivos do owner, inclusive contra overrides legados. Domínio, painel, BFF, regras, métricas e reservas implementados com testes negativos de overrides adulterados.

Catálogo exige PRODUCTS_READ/CREATE/UPDATE; status inactive/archived também exige PRODUCTS_DISABLE. Categorias seguem a mesma política. ReadOnly bloqueia BFF e API. Mutações idempotentes e auditadas; ator nunca vem do browser.

## Bootstrap autorizado

O documento posterior autorizou explicitamente o Discord 403707367885242378 como BOOTSTRAP SYSTEM_OWNER. A revisão automática aceitou nesta continuação configurar BOOTSTRAP_OWNER_ENABLED=true e BOOTSTRAP_OWNER_DISCORD_ID no .env local da API. Não foi iniciado o processo com esse .env nem acessado o banco real: configuração não comprova provisão na VPS.

Após migrations e boot controlado, conferir AdminAccount e ADMIN_AUDIT. Desabilitar bootstrap após provisão se não desejar reativação automática no próximo boot. Owner independe de PlayerAccount, personagem e wipe.

Cargos Discord (2026-10-03): implementação aprovada no código da API, migration 011 e testes isolados. Ativação real depende de migration e conexão HMAC. Estado e homologação: docs/DISCORD_ROLES_IMPLEMENTED.md. SYSTEM_OWNER independente; Staff/Suporte desativados.


## Afiliados — 2026-10-04
AFFILIATES_READ, AFFILIATES_MANAGE, AFFILIATES_PAYOUT_READ e AFFILIATES_PAYOUT_MANAGE. Sem concessão automática ao Discord OWNER, Staff ou Suporte; SYSTEM_OWNER preservado. Payout registra transferência manual externa, com confirmação, idempotência, observação, compensação de débitos e auditoria.

## Cargos Discord — matriz definitiva (2026-10-09)

Fonte: `D:/api suburbio/src/modules/admin/discord-role-matrix.ts`, aplicada pelo SYSTEM_OWNER com
`npm run admin:discord-roles -- --actor <discordId> [--apply]` (dry-run padrão; produção exige
`APPLY_CONFIRM=<POSTGRES_DATABASE>`). Grava via `saveMapping`: motivo, auditoria `admin.discord.mapping.changed` e outbox.

| Cargo | Role ID | Capabilities |
| --- | --- | --- |
| Owner | 876948888114839626 | todas as 37 (inclusive cupons owner-only) |
| COO | 1507491888314449960 | 32: todas exceto COUPONS_CREATE/UPDATE/DISABLE, ADMINS_MANAGE, ADMIN_PERMISSIONS_MANAGE |
| Community Manager | 876948888114839625 | DASHBOARD_READ, PLAYERS_READ, ALLOWLIST_READ, ALLOWLIST_REVOKE, PUNISHMENTS_READ, PUNISHMENTS_WRITE, TICKETS_READ, TICKETS_MANAGE, AUDIT_READ, DISCORD_READ |
| Dev | 876948888085467199 | DASHBOARD_READ, PLAYERS_READ, SERVICES_READ, SETTINGS_READ, AUDIT_READ, DISCORD_READ |
| Staff | 876948888085467204 | DASHBOARD_READ, PLAYERS_READ, ALLOWLIST_READ, ALLOWLIST_REVOKE, PUNISHMENTS_READ, PUNISHMENTS_WRITE, TICKETS_READ, TICKETS_MANAGE |
| Suporte | 876948888085467202 | DASHBOARD_READ, PLAYERS_READ, ALLOWLIST_READ, TICKETS_READ |

Regras aplicadas no backend:

- Todo mapping persiste `is_owner=false`; `saveMapping` recusa `isOwner=true` e a resolução ignora `is_owner` legado.
- COUPONS_CREATE/UPDATE/DISABLE só podem estar no mapping do role 876948888114839626 (`COUPON_OWNER_ROLE_ID`); qualquer outro role_id é recusado e, se existir no banco, não concede.
- Nenhum cargo resolve `isSystemOwner=true`. SYSTEM_OWNER é a conta persistida (bootstrap), autoridade raiz e única que altera mappings.
- Vários cargos = união. Remoção do cargo, saída da guild ou Discord indisponível retiram o acesso derivado (refresh `DISCORD_ROLE_REFRESH_SECONDS`, lease de 60 s na API); mapping desativado retira na hora.
- Lacunas conhecidas: sem capability de auditoria parcial nem de configuração "técnica"; categorias ficam sob PRODUCTS_*; a tela de reembolsos exige REFUNDS_MANAGE; ADMINS_MANAGE, ORDERS_MANAGE, PUNISHMENTS_WRITE, REFUNDS_READ, SETTINGS_WRITE e TICKETS_* ainda não são exigidas por nenhuma rota.
- Token Discord fica só na memória do processo do site: após restart/deploy, admins por cargo precisam entrar de novo.
