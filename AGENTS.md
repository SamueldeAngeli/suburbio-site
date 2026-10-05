<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Subúrbio RP — regras do site

- Preservar homepage, identidade e Área VIP demo em app/page.tsx/app/globals.css. Não reconstruir frontend público.
- Browser → Next.js/BFF → HMAC → Subúrbio API. Nunca banco institucional, bot ou FiveM direto para estado central. Redis próprio do site é permitido para estado efêmero local (salas, TTL, rate limit), isolado das chaves institucionais.
- Contrato oficial: D:/api suburbio/docs/HTTP_CONTRACTS.md e código de rotas v0.3. Lacunas em docs/API_GAPS.md; propostas não são endpoints disponíveis.
- Secrets somente em módulos server-only; nunca NEXT_PUBLIC_, logs ou Client Components.
- Sessão Discord não concede admin. AccountService consulta POST /internal/site/admin/resolve e falha fechado se a API não autorizar. Sem exceção hardcoded para owner e sem bypass dev em produção.
- Guard em cada página/handler, motivo/confirmação/CSRF/idempotência nas escritas; ator humano vem da sessão.
- Cliente do catálogo real não retorna catálogo fictício. Mocks só testes e Área VIP demo já identificada.
- Preparar Windows Server 2025/Node, não export estático. Não publicar externamente sem instrução específica.
- Verificar npm test, npm run typecheck, npm run lint, npm run build e npm run verify:client. Não declarar OAuth/API live sem evidência.
- Contexto persistente (normativo): docs/ARCHITECTURE.md, docs/ENVIRONMENT.md, docs/SECURITY.md, docs/DEPLOYMENT.md, docs/OPERATIONS.md, docs/TESTING.md, docs/PRODUCTION_CHECKLIST.md, docs/ADMIN_PERMISSIONS.md. Relatórios antigos em docs/history/ não são normativos.

## Revisão permanente de arquitetura
Seguir docs/RESPONSIBILITY_MATRIX.md: API somente para estado central; OAuth/UI/salas locais no site, mídia em WebRTC/LiveKit. Antes de criar, procurar implementação e dono; ao substituir, remover antigo validado sem consumidores e atualizar testes/docs/config. Preservar HMAC, guards, idempotência e auditoria. Não criar abstração apenas estética.
