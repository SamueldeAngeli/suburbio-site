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
