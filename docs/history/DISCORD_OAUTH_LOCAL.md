# Discord OAuth — estado local em 2026-10-03

## Configuração e verificação

- Client ID reutilizado da configuração local do bot; Client Secret fornecido pelo usuário e salvo exclusivamente em `.env.local`, ignorado pelo Git. Token do bot não utilizado.
- OAuth habilitado localmente em http://localhost:3002. Callback exata: http://localhost:3002/api/auth/callback/discord.
- No Discord Developer Portal, abrir a aplicação correspondente e cadastrar essa callback em OAuth2 > Redirects, salvando a alteração. Em seguida acessar http://localhost:3002/login e autorizar a aplicação.
- Início real do fluxo verificado localmente: destino discord.com, callback correta, state presente, scopes identify e guilds.members.read, sem client_secret na URL. A troca do código e o login completo ainda não foram homologados com uma conta real.
- A consulta de participação/cargos segue https://docs.discord.com/developers/resources/user#get-current-user-guild-member .
- HTTP local exige modo desenvolvimento. Produção exige HTTPS e callback no domínio definitivo do site. Build de verificação executado com AUTH_ENABLED=false apenas no processo de compilação, sem desativar a configuração local de desenvolvimento.

## Cargos administrativos

A implementação na API foi aprovada e consta em DISCORD_ROLES_IMPLEMENTED.md. Migration 011 aplicada somente em bancos isolados de teste; nenhuma migration aplicada em banco real. DISCORD_ROLE_AUTH_ENABLED=false e SUBURBIO_API_ENABLED=false permanecem na configuração local. Login Discord, isoladamente, não concede administração.

O site está preparado para consultar participação e cargos exclusivamente no servidor, com cache de 30 segundos e atualização forçada nas operações sensíveis. As permissões efetivas continuam sendo recebidas da API. A extensão membership do resolver é uma proposta; não está disponível na API atual.

O token OAuth fica somente na memória do processo, nunca na sessão enviada ao navegador. Reinício, expiração ou troca de processo exigem novo login para restabelecer a consulta de cargos. Não há renovação por refresh token nem armazenamento distribuído nesta etapa. Falha de consulta não reutiliza prova antiga. SYSTEM_OWNER depende da resolução explícita da API.

A página /admin/permissions/discord apresenta a proposta desativada, sem CRUD funcional. /admin/debug/auth exige ambiente development e SYSTEM_OWNER confirmado; não apresenta tokens ou segredos.

## Validação

O resultado final das verificações é registrado na resposta da tarefa. Testes HTTP usam um processo isolado e credenciais fictícias; não comprovam autorização real no Discord. A suíte da API não foi executada nesta etapa, pois a API não foi alterada.
