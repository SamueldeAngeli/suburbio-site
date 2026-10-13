// Navegação de página inteira (sessão inválida → login). Isolada para ser substituível em testes.
export const redirectTo = (url: string) => window.location.assign(url);
