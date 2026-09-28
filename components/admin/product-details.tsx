import type { z } from 'zod';
import type { productSchema } from '@/lib/api/catalog-contracts';

export function ProductDetails({ product }: { product: z.infer<typeof productSchema> }) {
  return <section className="admin-panel" aria-label="Detalhes do produto">
    <h2>Detalhes do produto</h2>
    <dl className="admin-form-grid">
      <div><dt>Validade</dt><dd>{product.validityMode === 'PERMANENT' ? 'Permanente' : 'Temporária'}</dd></div>
      <div><dt>Duração</dt><dd>{product.durationDays === null ? 'Sem prazo definido' : `${product.durationDays} dias`}</dd></div>
      <div><dt>Renovável</dt><dd>{product.renewable ? 'Sim' : 'Não'}</dd></div>
      <div><dt>Canal de venda</dt><dd>{product.salesChannels.join(' / ')}</dd></div>
      <div><dt>Tipo de benefício / entrega</dt><dd>{product.delivery.deliveryType}</dd></div>
    </dl>
  </section>;
}
