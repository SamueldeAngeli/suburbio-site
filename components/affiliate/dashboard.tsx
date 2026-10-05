import Link from 'next/link';
import { Handshake, Ticket, TrendingUp, ArrowUpRight } from 'lucide-react';
import type { z } from 'zod';
import type { dashboardSchema } from '@/lib/api/affiliate-contracts';
export type AffiliateDashboardData = z.infer<typeof dashboardSchema>;
import { moneyMinor } from '@/lib/format-money';
const types: Record<string, string> = {
  STAFF: 'Staff',
  STREAMER: 'Streamer',
  CREATOR: 'Criador',
  PARTNER: 'Parceiro',
  OTHER: 'Outro',
};
const statuses: Record<string, string> = {
  PENDING: 'Pendente',
  AVAILABLE: 'Disponível',
  PAID: 'Pago',
  REVERSED: 'Revertido',
};
export function AffiliateDashboard({
  data,
  basePath = '/minha-conta/afiliado',
}: {
  data: AffiliateDashboardData;
  basePath?: string;
}) {
  const a = data.affiliate,
    s = data.summary;
  const max = data.chart.reduce((m, p) => (BigInt(p.commissionMinor) > m ? BigInt(p.commissionMinor) : m), BigInt(1));
  return (
    <main className="affiliate-dashboard">
      <header className="affiliate-heading">
        <div>
          <span className="citizen-kicker">PROGRAMA DE AFILIADOS</span>
          <h1>
            Seu impacto no Subúrbio<span>.</span>
          </h1>
          <p>
            {a.name} <span className="affiliate-tag">{types[a.type]}</span>
          </p>
        </div>
        <Handshake size={42} strokeWidth={1} />
      </header>
      <section className="affiliate-coupon">
        <div>
          <span className="citizen-kicker">
            <Ticket size={15} /> SEU CUPOM · {a.couponName}
          </span>
          <strong>{a.code}</strong>
          <Link href={'/?ref=' + encodeURIComponent(a.code)}>
            Seu link de indicação <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="affiliate-rates">
          <div>
            <b>{a.discountPercent}%</b>
            <span>Desconto para o cliente</span>
          </div>
          <div>
            <b>{a.commissionPercent}%</b>
            <span>Sua comissão</span>
          </div>
        </div>
      </section>
      <div className="affiliate-section-head">
        <h2>Seu desempenho</h2>
        <nav className="affiliate-period" aria-label="Período do desempenho">
          {(['7', '30', '90', 'all'] as const).map((p) => (
            <Link key={p} href={basePath + '?period=' + p} aria-current={data.period === p ? 'page' : undefined}>
              {p === 'all' ? 'Todo período' : p + ' dias'}
            </Link>
          ))}
        </nav>
      </div>
      <section className="affiliate-metrics" aria-label="Resumo de comissões">
        {[
          ['Total vendido', moneyMinor(s.soldMinor)],
          ['Comissão gerada', moneyMinor(s.generatedMinor)],
          ['Pendente', moneyMinor(s.pendingMinor)],
          ['Disponível', moneyMinor(s.availableMinor)],
          ['Comissões liquidadas', moneyMinor(s.paidMinor)],
          ['Compras', String(s.purchases)],
          ['Compradores', String(s.buyers)],
          ['Estornos de comissão', moneyMinor(s.reversedMinor)],
        ].map(([label, value]) => (
          <article className="citizen-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      {s.debtMinor !== '0' && (
        <p className="affiliate-debt">
          Ajuste a compensar em próximos repasses: <strong>{moneyMinor(s.debtMinor)}</strong>.
        </p>
      )}
      <section className="citizen-card affiliate-chart">
        <div className="affiliate-section-head">
          <div>
            <span className="citizen-kicker">COMISSÕES POR DIA · UTC</span>
            <h2>Crescendo com a cidade</h2>
          </div>
          <TrendingUp size={24} />
        </div>
        {data.chart.length ? (
          <div className="affiliate-bars" role="img" aria-label="Gráfico de comissões por dia">
            {data.chart.map((p) => (
              <div className="affiliate-bar-column" key={p.date}>
                <div
                  className="affiliate-bar"
                  style={{ height: Math.max(2, Number((BigInt(p.commissionMinor) * BigInt(100)) / max)) + '%' }}
                  title={p.date + ': ' + moneyMinor(p.commissionMinor)}
                />
                <span>{p.date.slice(8) + '/' + p.date.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="affiliate-empty">
            <TrendingUp size={34} />
            <h3>Seu próximo resultado começa com uma indicação.</h3>
            <p>
              Ainda não há vendas ou comissões neste período. Compartilhe seu cupom e acompanhe os resultados por aqui.
            </p>
          </div>
        )}
        {data.chart.length > 0 && (
          <details>
            <summary>Ver valores do gráfico</summary>
            <ul>
              {data.chart.map((p) => (
                <li key={p.date}>
                  {p.date}: {moneyMinor(p.commissionMinor)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <section className="citizen-card affiliate-sales">
        <div className="affiliate-section-head">
          <h2>Vendas atribuídas</h2>
          <span>{data.total} compras</span>
        </div>
        <div className="affiliate-table-wrap">
          <table>
            <thead>
              <tr>
                {['Data', 'Pedido', 'Benefício / Qtd', 'Pago', 'Sua comissão', 'Status'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sales.map((r) => (
                <tr key={r.orderId}>
                  <td>{new Date(r.approvedAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                  <td>
                    <details>
                      <summary>#{r.orderId.slice(0, 8)}</summary>
                      <small>
                        {r.orderId}
                        <br />
                        Cupom: {r.affiliateCode}
                        <br />
                        Desconto: {r.discountRateApplied}% · Comissão: {r.commissionRateApplied}%<br />
                        Liberação: {new Date(r.availableAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        <br />
                        Revertido: {moneyMinor(r.reversedMinor)}
                        <br />A compensar: {moneyMinor(r.debtMinor)}
                      </small>
                    </details>
                  </td>
                  <td>
                    {r.products.map((p, i) => (
                      <div key={i}>
                        {p.name} <small>× {p.quantity}</small>
                      </div>
                    ))}
                  </td>
                  <td>{moneyMinor(r.paidMinor)}</td>
                  <td>{moneyMinor(r.commissionMinor)}</td>
                  <td>
                    <span className={'affiliate-status ' + r.status.toLowerCase()}>{statuses[r.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.sales.length && <p className="affiliate-empty-row">Nenhuma venda registrada neste período.</p>}
        <div className="affiliate-pagination">
          {data.page > 1 && (
            <Link href={basePath + '?period=' + data.period + '&page=' + (data.page - 1)}>Anterior</Link>
          )}
          <span>Página {data.page}</span>
          {data.page * data.pageSize < data.total && (
            <Link href={basePath + '?period=' + data.period + '&page=' + (data.page + 1)}>Próxima</Link>
          )}
        </div>
      </section>
      <p className="affiliate-footnote">
        Comissão sobre o valor pago após desconto. Liberação após {a.holdDays} dias de segurança. Compras com seu
        próprio cupom recebem desconto, mas não geram comissão. Resumos seguem o período selecionado; valores liquidados
        incluem compensações de estornos.
      </p>
    </main>
  );
}
