// Origem pública canônica do site = AUTH_URL (a mesma variável que o Auth.js usa para callback e cookies).
// Sem domínio fixo no código: dev usa http://localhost:3002, produção https://<domínio raiz>.
// Sem `server-only`: também é lido pelo next.config.ts no build.
export function canonicalOrigin(authUrl: string | undefined) {
  if (!authUrl) return null;
  try {
    const url = new URL(authUrl);
    return url.protocol === 'https:' || url.protocol === 'http:' ? new URL(url.origin) : null;
  } catch {
    return null;
  }
}

// `www.<raiz>` → raiz, preservando caminho e query. Cookies do Auth.js são host-only: sem este redirect,
// www e raiz teriam sessões independentes e o OAuth falharia (state/PKCE gravados no host errado).
// O proxy HTTPS também redireciona; isto cobre o caso de o Host original chegar ao Next. Requisições com
// Host 127.0.0.1/localhost nunca casam, então não há loop.
export function wwwRedirects(authUrl: string | undefined) {
  const origin = canonicalOrigin(authUrl);
  if (!origin || origin.protocol !== 'https:' || origin.hostname.startsWith('www.') || !origin.hostname.includes('.'))
    return [];
  return [
    {
      source: '/:path*',
      has: [{ type: 'host' as const, value: `www\\.${origin.hostname.replace(/\./g, '\\.')}` }],
      destination: `${origin.origin}/:path*`,
      permanent: true,
    },
  ];
}
