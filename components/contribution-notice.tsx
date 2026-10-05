export function ContributionNotice({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <aside className="contribution-notice">
        <p>
          <strong>Importante:</strong> toda aquisição é considerada uma contribuição ao projeto Subúrbio RP. Em troca da
          contribuição, você recebe o benefício selecionado. Contribuições não possuem reembolso.
        </p>
      </aside>
    );

  return (
    <aside className="contribution-notice" aria-label="Contribuição ao projeto">
      <h3>Contribuição ao projeto</h3>
      <p>
        Toda aquisição realizada no site da Subúrbio RP é entendida como uma contribuição/doação destinada à manutenção,
        desenvolvimento e continuidade do projeto.
      </p>
      <p>
        Como benefício pela contribuição realizada, o jogador recebe o item, VIP, Crypto, veículo, casa ou outro
        benefício selecionado no momento da aquisição.
      </p>
      <p>As contribuições/doações realizadas não são reembolsáveis.</p>
    </aside>
  );
}
