'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { z } from 'zod';
import { productSchema, categorySchema, productInput } from '@/lib/api/catalog-contracts';
const storefrontLabels = {
  VIP_STORE: 'Loja VIP',
  VIP_DEALERSHIP: 'Concessionária VIP',
  VIP_REAL_ESTATE: 'Imobiliária VIP',
  CRYPTO_STORE: 'Loja Crypto',
};
type Product = z.infer<typeof productSchema>;
export function ProductEditor({
  product,
  categories,
  canDisable,
}: {
  product?: Product;
  categories: z.infer<typeof categorySchema>[];
  canDisable: boolean;
}) {
  const router = useRouter(),
    key = useRef<string | null>(null),
    lastPayload = useRef('');
  const [deliveryType, setDeliveryType] = useState(product?.delivery.deliveryType ?? 'VIP');
  const [validityMode, setValidityMode] = useState(product?.validityMode ?? 'PERMANENT');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const payload = product?.delivery.deliveryPayload;
  const deliveryValue = payload ? Object.values(payload)[0] : '';
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage('');
    const form = new FormData(event.currentTarget),
      value = String(form.get('deliveryValue') ?? '');
    const deliveryPayload =
      deliveryType === 'CHARACTER_SLOT'
        ? { amount: 1 }
        : deliveryType === 'VEHICLE'
          ? { vehicleModel: value }
          : deliveryType === 'PROPERTY'
            ? { propertyCode: value }
            : deliveryType === 'INVENTORY_ITEM'
              ? { itemName: value, amount: Number(form.get('deliveryAmount')) }
              : deliveryType === 'VIP'
                ? { plan: value }
                : deliveryType === 'SERVICE'
                  ? { service: value }
                  : { adapter: value };
    const input = {
      allowCustomGifts: form.get('allowCustomGifts') === 'on',
      name: String(form.get('name')),
      slug: String(form.get('slug')),
      description: String(form.get('description')),
      categoryId: String(form.get('categoryId')),
      imageUrl: String(form.get('imageUrl')),
      status: String(form.get('status')),
      displayOrder: Number(form.get('displayOrder')),
      salesChannels: form.getAll('salesChannels').map(String),
      storefronts: form.getAll('storefronts').map(String),
      priceCrypto: Number(form.get('priceCrypto')),
      priceMinor: Math.round(Number(form.get('priceBrl')) * 100),
      stockMode: String(form.get('stockMode')),
      stockQuantity: Number(form.get('stockQuantity')),
      validityMode,
      durationDays: validityMode === 'DURATION' ? Number(form.get('durationDays')) : null,
      renewable: validityMode === 'DURATION' && form.get('renewable') === 'true',
      delivery: { deliveryType, deliveryPayload },
    };
    const valid = productInput.safeParse(input);
    if (!valid.success) {
      setMessage('Confira os campos, o canal e os dados de entrega.');
      return;
    }
    const content = JSON.stringify(input);
    if (lastPayload.current !== content) {
      key.current = crypto.randomUUID();
      lastPayload.current = content;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-suburbio-intent': 'product.save' },
        body: JSON.stringify({
          product: valid.data,
          id: product?.id,
          expectedRevision: product?.revision,
          idempotencyKey: key.current,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error?.message ?? 'Não foi possível salvar.');
        return;
      }
      setMessage('Produto salvo.');
      router.push('/admin/products');
      router.refresh();
    } catch {
      setMessage('Conexão interrompida. Tente novamente com os mesmos dados.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="admin-editor">
      <fieldset disabled={busy}>
        <legend>Informações do benefício</legend>
        <div className="admin-form-grid">
          <label>
            Nome
            <input name="name" required minLength={2} maxLength={120} defaultValue={product?.name} />
          </label>
          <label>
            Identificador
            <input
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={100}
              defaultValue={product?.slug}
              placeholder="vip-cria"
            />
          </label>
          <label>
            Categoria
            <select name="categoryId" required defaultValue={product?.categoryId ?? ''}>
              <option value="" disabled>
                Selecione
              </option>
              {categories
                .filter((c) => c.status === 'active')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={product?.status ?? 'active'}>
              <option value="active">Ativo</option>
              {canDisable && (
                <>
                  <option value="inactive">Inativo</option>
                  <option value="archived">Arquivado</option>
                </>
              )}
            </select>
          </label>
          <label>
            Imagem (URL HTTPS)
            <input name="imageUrl" type="url" defaultValue={product?.imageUrl} />
          </label>
          <label>
            Ordem de exibição
            <input
              name="displayOrder"
              type="number"
              min={0}
              max={100000}
              required
              defaultValue={product?.displayOrder ?? 0}
            />
          </label>
          <label>
            Preço WEB (BRL)
            <input
              name="priceBrl"
              type="number"
              min={0}
              max={1000000}
              step="0.01"
              required
              defaultValue={(product?.priceMinor ?? 0) / 100}
            />
          </label>
          <label>
            Preço INGAME (Crypto)
            <input
              name="priceCrypto"
              type="number"
              min={0}
              max={100000000}
              step={1}
              required
              defaultValue={product?.priceCrypto ?? 0}
            />
          </label>
          <label>
            Estoque
            <select name="stockMode" defaultValue={product?.stockMode ?? 'UNLIMITED'}>
              <option value="UNLIMITED">Ilimitado</option>
              <option value="LIMITED">Limitado</option>
            </select>
          </label>
          <label>
            Quantidade em estoque
            <input
              name="stockQuantity"
              type="number"
              min={0}
              max={100000000}
              step={1}
              required
              defaultValue={product?.stockQuantity ?? 0}
            />
          </label>
          <label>
            Validade
            <select value={validityMode} onChange={(e) => setValidityMode(e.target.value as typeof validityMode)}>
              <option value="PERMANENT">Permanente</option>
              <option value="DURATION">Temporária</option>
            </select>
          </label>
          {validityMode === 'DURATION' && (
            <label>
              Duração (dias)
              <input
                name="durationDays"
                type="number"
                min={1}
                max={3650}
                step={1}
                required
                defaultValue={product?.durationDays ?? 30}
              />
            </label>
          )}
        </div>
        {validityMode === 'DURATION' && (
          <label>
            Renovável
            <select name="renewable" defaultValue={String(product?.renewable ?? false)}>
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
          </label>
        )}
        <p className="admin-note">
          A validade começa somente após a ativação confirmada na cidade. Alterações não mudam a duração de compras
          anteriores.
        </p>
        <label>
          <input type="checkbox" name="allowCustomGifts" defaultChecked={product?.allowCustomGifts ?? false} /> Permitir
          presente para benefício CUSTOM
        </label>
        {deliveryType === 'CHARACTER_SLOT' && (
          <p className="admin-note">
            Slots devem permanecer inativos até a validação da base FiveM real. Limite máximo: 5.
          </p>
        )}
        <label>
          Descrição
          <textarea name="description" maxLength={3000} defaultValue={product?.description} />
        </label>
        <div className="admin-channel-options">
          <label>
            <input
              type="checkbox"
              name="salesChannels"
              value="SITE_VIP"
              defaultChecked={product ? product.salesChannels.some((c) => c === 'SITE_VIP' || c === 'WEB') : true}
            />{' '}
            Disponível no site (WEB)
          </label>
          <label>
            <input
              type="checkbox"
              name="salesChannels"
              value="INGAME_CRYPTO"
              defaultChecked={product?.salesChannels.some((c) => c === 'INGAME_CRYPTO' || c === 'INGAME') ?? false}
            />{' '}
            Disponível no jogo (INGAME)
          </label>
        </div>
        <fieldset>
          <legend>Onde este produto aparece dentro do jogo?</legend>
          <div className="admin-channel-options">
            {Object.entries(storefrontLabels).map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  name="storefronts"
                  value={value}
                  defaultChecked={product?.storefronts?.some((s) => s === value) ?? false}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="admin-note">
          Um único produto e SKU para os dois canais. As storefronts não duplicam o cadastro.
        </p>
        <div className="admin-form-grid">
          <label>
            Tipo de benefício / entrega
            <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as typeof deliveryType)}>
              <option value="VIP">VIP — Plano VIP</option>
              <option value="VEHICLE">VEHICLE — Veículo</option>
              <option value="PROPERTY">PROPERTY — Propriedade</option>
              <option value="INVENTORY_ITEM">INVENTORY_ITEM — Item</option>
              <option value="SERVICE">SERVICE — Serviço</option>
              <option value="CUSTOM">CUSTOM — Personalizado</option>
              <option disabled value="CRYPTO">
                CRYPTO — Cadastro aguardando contrato
              </option>
              <option value="CHARACTER_SLOT">CHARACTER_SLOT — Aguardando base real</option>
            </select>
          </label>
          <label>
            {deliveryType === 'PROPERTY'
              ? 'Código da propriedade'
              : deliveryType === 'VEHICLE'
                ? 'Modelo do veículo'
                : deliveryType === 'VIP'
                  ? 'Código do plano'
                  : deliveryType === 'INVENTORY_ITEM'
                    ? 'Código do item'
                    : 'Código da integração'}
            <input
              name="deliveryValue"
              required={deliveryType !== 'CHARACTER_SLOT'}
              disabled={deliveryType === 'CHARACTER_SLOT'}
              pattern="[a-zA-Z0-9_-]{1,64}"
              defaultValue={deliveryValue}
            />
          </label>
          {deliveryType === 'INVENTORY_ITEM' && (
            <label>
              Quantidade do item
              <input
                name="deliveryAmount"
                type="number"
                min={1}
                max={10000}
                defaultValue={payload && 'amount' in payload ? payload.amount : 1}
                required
              />
            </label>
          )}
        </div>
        <p className="admin-note">
          O catálogo será atualizado e a alteração ficará registrada na auditoria. A entrega no jogo aguarda a
          integração do bridge.
        </p>
        <button className="button" disabled={busy || categories.length === 0}>
          {busy ? 'Salvando…' : 'Salvar produto'}
        </button>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
