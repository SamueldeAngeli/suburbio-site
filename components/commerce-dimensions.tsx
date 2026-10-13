import { moneyMinor } from '@/lib/format-money';
type Dimension = {
  currency: 'BRL' | 'CRYPTO';
  origin: 'SITE' | 'IN_GAME';
  sales: number;
  gross: string;
  discount: string;
  net: string;
  commission: string | null;
};
export function CommerceDimensions({ rows }: { rows?: Dimension[] }) {
  if (!rows?.length) return null;
  return (
    <section className="admin-panel">
      <h2>Vendas por moeda e origem</h2>
      <p>BRL e Crypto são contabilizados separadamente. Crypto não gera repasse em reais.</p>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Moeda</th>
              <th>Origem</th>
              <th>Vendas</th>
              <th>Bruto</th>
              <th>Desconto</th>
              <th>Líquido</th>
              <th>Comissão gerada</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const amount = (v: string) =>
                r.currency === 'BRL' ? moneyMinor(v) : BigInt(v).toLocaleString('pt-BR') + ' Crypto';
              return (
                <tr key={r.currency + r.origin}>
                  <td>{r.currency}</td>
                  <td>{r.origin === 'SITE' ? 'Site' : 'In-game'}</td>
                  <td>{r.sales}</td>
                  <td>{amount(r.gross)}</td>
                  <td>{amount(r.discount)}</td>
                  <td>{amount(r.net)}</td>
                  <td>{r.commission === null ? 'Não configurada' : amount(r.commission)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
