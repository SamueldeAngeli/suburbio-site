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
type DeliveryType = Product['delivery']['deliveryType'];
// Tipos em português, com o que a cidade entrega. Item, veículo e slot são sempre permanentes na entrega.
const types: {
  value: DeliveryType;
  label: string;
  hint: string;
  field?: string;
  placeholder?: string;
  permanent?: boolean;
}[] = [
  {
    value: 'INVENTORY_ITEM',
    label: 'Item',
    hint: 'Vai para o inventário (ou o Baú de entregas).',
    field: 'Nome do item no jogo',
    placeholder: 'repairkit',
    permanent: true,
  },
  {
    value: 'VEHICLE',
    label: 'Veículo',
    hint: 'Vai para a garagem, com a chave.',
    field: 'Modelo do veículo (spawn)',
    placeholder: 'sultan',
    permanent: true,
  },
  { value: 'VIP', label: 'VIP', hint: 'Cargo no Discord e benefícios na cidade.' },
  { value: 'CHARACTER_SLOT', label: 'Slot de personagem', hint: 'Mais um personagem na conta.', permanent: true },
  {
    value: 'PROPERTY',
    label: 'Imóvel',
    hint: 'Casa ou propriedade na cidade.',
    field: 'Código do imóvel',
    placeholder: 'casa_praia_01',
  },
  {
    value: 'CUSTOM',
    label: 'Outro (integração)',
    hint: 'Entregue por um resource da cidade.',
    field: 'Código da integração',
    placeholder: 'pelucias',
  },
];
const vipPlans = [
  ['start', 'Start'],
  ['patrao', 'Patrão'],
  ['magnata', 'Magnata'],
  ['elite', 'Elite'],
  ['lendario', 'Lendário'],
];
const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
const lines = (value: FormDataEntryValue | null) =>
  String(value ?? '')
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
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
  const payload = product?.delivery.deliveryPayload;
  const initialType = product?.delivery.deliveryType === 'SERVICE' ? 'CUSTOM' : product?.delivery.deliveryType;
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(initialType ?? 'INVENTORY_ITEM');
  const [validityMode, setValidityMode] = useState(product?.validityMode ?? 'PERMANENT');
  const [onSite, setOnSite] = useState(
    product ? product.salesChannels.some((c) => c === 'SITE_VIP' || c === 'WEB') : true,
  );
  const [inGame, setInGame] = useState(
    product?.salesChannels.some((c) => c === 'INGAME_CRYPTO' || c === 'INGAME') ?? false,
  );
  const [stockMode, setStockMode] = useState(product?.stockMode ?? 'UNLIMITED');
  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const type = types.find((t) => t.value === deliveryType) ?? types[0]!;
  const deliveryValue = payload ? String(Object.values(payload)[0] ?? '') : '';
  const knownPlan = vipPlans.some(([v]) => v === deliveryValue.replace(/^vip_/, ''));
  const [plan, setPlan] = useState(
    product?.delivery.deliveryType === 'VIP' ? (knownPlan ? deliveryValue.replace(/^vip_/, '') : 'other') : 'start',
  );
  const permanentOnly = type.permanent === true;
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage('');
    const form = new FormData(event.currentTarget);
    const value = deliveryType === 'VIP' && plan !== 'other' ? plan : String(form.get('deliveryValue') ?? '').trim();
    // "Outro" mantém SERVICE em produtos antigos que já eram serviço.
    const savedType: DeliveryType =
      deliveryType === 'CUSTOM' && product?.delivery.deliveryType === 'SERVICE' ? 'SERVICE' : deliveryType;
    const deliveryPayload =
      savedType === 'CHARACTER_SLOT'
        ? { amount: 1 }
        : savedType === 'VEHICLE'
          ? { vehicleModel: value }
          : savedType === 'PROPERTY'
            ? { propertyCode: value }
            : savedType === 'INVENTORY_ITEM'
              ? { itemName: value, amount: Number(form.get('deliveryAmount')) }
              : savedType === 'VIP'
                ? { plan: value }
                : savedType === 'SERVICE'
                  ? { service: value }
                  : { adapter: value };
    const priceBrl = Number(form.get('priceBrl') ?? 0),
      priceCrypto = Number(form.get('priceCrypto') ?? 0);
    // Erros em linguagem simples antes da validação completa.
    const problem =
      !onSite && !inGame
        ? 'Marque onde o produto será vendido: no site, no jogo ou nos dois.'
        : onSite && !(priceBrl > 0)
          ? 'Informe o preço em reais para vender no site.'
          : inGame && !(priceCrypto > 0)
            ? 'Informe o preço em Crypto para vender no jogo.'
            : savedType !== 'CHARACTER_SLOT' && !/^[a-zA-Z0-9_-]{1,64}$/.test(value)
              ? `Informe ${(type.field ?? 'o código do plano').toLowerCase()} (letras, números, _ ou -).`
              : !slug
                ? 'O identificador fica vazio: confira o nome do produto.'
                : null;
    if (problem) {
      setMessage(problem);
      return;
    }
    const temporary = !permanentOnly && validityMode === 'DURATION';
    const input = {
      allowCustomGifts: savedType === 'CUSTOM' && form.get('allowCustomGifts') === 'on',
      name: name.trim(),
      slug,
      description: String(form.get('description') ?? ''),
      categoryId: String(form.get('categoryId')),
      imageUrl: String(form.get('imageUrl') ?? '').trim(),
      gallery: lines(form.get('gallery')),
      features: lines(form.get('features')),
      featured: form.has('featured'),
      location: savedType === 'PROPERTY' ? String(form.get('location') ?? '') : (product?.location ?? ''),
      trunkKg:
        savedType === 'VEHICLE' && form.get('trunkKg') ? Number(form.get('trunkKg')) : (product?.trunkKg ?? null),
      visualizacao: { tipo: String(form.get('visualizacao') ?? product?.visualizacao?.tipo ?? 'nenhuma') },
      status: String(form.get('status') ?? product?.status ?? 'active'),
      displayOrder: Number(form.get('displayOrder') ?? 0),
      salesChannels: [...(onSite ? ['SITE_VIP'] : []), ...(inGame ? ['INGAME_CRYPTO'] : [])],
      storefronts: inGame ? form.getAll('storefronts').map(String) : [],
      priceCrypto: inGame ? priceCrypto : (product?.priceCrypto ?? 0),
      priceMinor: onSite ? Math.round(priceBrl * 100) : (product?.priceMinor ?? 0),
      stockMode,
      stockQuantity: stockMode === 'LIMITED' ? Number(form.get('stockQuantity')) : (product?.stockQuantity ?? 0),
      validityMode: temporary ? 'DURATION' : 'PERMANENT',
      durationDays: temporary ? Number(form.get('durationDays')) : null,
      renewable: temporary && form.get('renewable') === 'on',
      delivery: { deliveryType: savedType, deliveryPayload },
    };
    const valid = productInput.safeParse(input);
    if (!valid.success) {
      const field = String(valid.error.issues[0]?.path[0] ?? '');
      setMessage(
        field === 'imageUrl' || field === 'gallery'
          ? 'As imagens precisam ser links HTTPS completos.'
          : field === 'categoryId'
            ? 'Escolha uma categoria.'
            : field === 'name'
              ? 'O nome precisa ter de 2 a 120 letras.'
              : field === 'durationDays'
                ? 'A duração vai de 1 a 3650 dias.'
                : 'Confira os campos destacados.',
      );
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
    <form onSubmit={save} className="admin-editor product-form" noValidate>
      <fieldset disabled={busy}>
        <legend>1. O que você está vendendo?</legend>
        <div className="product-types" role="radiogroup" aria-label="Tipo de produto">
          {types.map((t) => (
            <label key={t.value} className={deliveryType === t.value ? 'is-selected' : undefined}>
              <input
                type="radio"
                name="type"
                value={t.value}
                checked={deliveryType === t.value}
                onChange={() => setDeliveryType(t.value)}
              />
              <strong>{t.label}</strong>
              <small>{t.hint}</small>
            </label>
          ))}
        </div>
        <div className="admin-form-grid">
          {deliveryType === 'VIP' ? (
            <>
              <label>
                Plano
                <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                  {vipPlans.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                  <option value="other">Outro código</option>
                </select>
              </label>
              {plan === 'other' && (
                <label>
                  Código do plano
                  <input name="deliveryValue" defaultValue={knownPlan ? '' : deliveryValue} placeholder="vip_custom" />
                </label>
              )}
            </>
          ) : (
            type.field && (
              <label>
                {type.field}
                <input
                  name="deliveryValue"
                  defaultValue={product?.delivery.deliveryType === deliveryType ? deliveryValue : ''}
                  placeholder={type.placeholder}
                  autoComplete="off"
                />
              </label>
            )
          )}
          {deliveryType === 'INVENTORY_ITEM' && (
            <label>
              Quantidade entregue
              <input
                name="deliveryAmount"
                type="number"
                min={1}
                max={10000}
                defaultValue={payload && 'amount' in payload ? payload.amount : 1}
              />
            </label>
          )}
        </div>
        {deliveryType === 'CHARACTER_SLOT' && (
          <p className="admin-note">Limite de 5 personagens por conta. Quem já tem 5 fica pendente para a staff.</p>
        )}
      </fieldset>

      <fieldset disabled={busy}>
        <legend>2. Como aparece na loja</legend>
        <div className="admin-form-grid">
          <label>
            Nome
            <input
              name="name"
              value={name}
              maxLength={120}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="Kit de Reparo"
            />
          </label>
          <label>
            Categoria
            <select
              name="categoryId"
              defaultValue={product?.categoryId ?? categories.find((c) => c.status === 'active')?.id ?? ''}
            >
              <option value="" disabled>
                Selecione
              </option>
              {categories
                .filter((c) => c.status === 'active' || c.id === product?.categoryId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="span-2">
            Imagem (link HTTPS, opcional)
            <input name="imageUrl" type="url" defaultValue={product?.imageUrl} placeholder="https://…" />
          </label>
        </div>
        <label>
          Descrição
          <textarea name="description" maxLength={3000} defaultValue={product?.description} />
        </label>
      </fieldset>

      <fieldset disabled={busy}>
        <legend>3. Onde vender e por quanto</legend>
        <div className="product-channels">
          <div className={onSite ? 'is-selected' : undefined}>
            <label className="product-toggle">
              <input type="checkbox" checked={onSite} onChange={(e) => setOnSite(e.target.checked)} /> Vender no site
            </label>
            {onSite && (
              <label>
                Preço (R$)
                <input
                  name="priceBrl"
                  type="number"
                  min={0}
                  max={1000000}
                  step="0.01"
                  defaultValue={product?.priceMinor ? product.priceMinor / 100 : ''}
                  placeholder="15,00"
                />
              </label>
            )}
          </div>
          <div className={inGame ? 'is-selected' : undefined}>
            <label className="product-toggle">
              <input type="checkbox" checked={inGame} onChange={(e) => setInGame(e.target.checked)} /> Vender no jogo
            </label>
            {inGame && (
              <>
                <label>
                  Preço (Crypto)
                  <input
                    name="priceCrypto"
                    type="number"
                    min={0}
                    max={100000000}
                    step={1}
                    defaultValue={product?.priceCrypto || ''}
                    placeholder="500"
                  />
                </label>
                <div className="admin-channel-options">
                  <span>Aparece em</span>
                  {Object.entries(storefrontLabels).map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="checkbox"
                        name="storefronts"
                        value={value}
                        defaultChecked={product?.storefronts?.some((s) => s === value) ?? false}
                      />{' '}
                      {label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </fieldset>

      {!permanentOnly && (
        <fieldset disabled={busy}>
          <legend>4. Validade</legend>
          <div className="product-validity">
            <label>
              <input
                type="radio"
                name="validity"
                checked={validityMode === 'PERMANENT'}
                onChange={() => setValidityMode('PERMANENT')}
              />{' '}
              Para sempre
            </label>
            <label>
              <input
                type="radio"
                name="validity"
                checked={validityMode === 'DURATION'}
                onChange={() => setValidityMode('DURATION')}
              />{' '}
              Por um período
            </label>
            {validityMode === 'DURATION' && (
              <>
                <label>
                  Dias
                  <input
                    name="durationDays"
                    type="number"
                    min={1}
                    max={3650}
                    step={1}
                    defaultValue={product?.durationDays ?? 30}
                  />
                </label>
                <label>
                  <input type="checkbox" name="renewable" defaultChecked={product?.renewable ?? false} /> Pode renovar
                </label>
              </>
            )}
          </div>
          <p className="admin-note">A contagem começa quando a cidade ativa o benefício.</p>
        </fieldset>
      )}

      <details className="product-more" open={false}>
        <summary>Mais opções</summary>
        <fieldset disabled={busy}>
          <div className="admin-form-grid">
            <label>
              Status
              <select name="status" defaultValue={product?.status ?? 'active'}>
                <option value="active">Ativo (à venda)</option>
                {canDisable && (
                  <>
                    <option value="inactive">Inativo (fora da loja)</option>
                    <option value="archived">Arquivado</option>
                  </>
                )}
              </select>
            </label>
            <label>
              Estoque
              <select value={stockMode} onChange={(e) => setStockMode(e.target.value as typeof stockMode)}>
                <option value="UNLIMITED">Ilimitado</option>
                <option value="LIMITED">Limitado</option>
              </select>
            </label>
            {stockMode === 'LIMITED' && (
              <label>
                Quantidade em estoque
                <input
                  name="stockQuantity"
                  type="number"
                  min={0}
                  max={100000000}
                  step={1}
                  defaultValue={product?.stockQuantity ?? 0}
                />
              </label>
            )}
            <label>
              Posição na loja (menor aparece primeiro)
              <input name="displayOrder" type="number" min={0} max={100000} defaultValue={product?.displayOrder ?? 0} />
            </label>
            <label>
              Identificador (endereço)
              <input
                value={slug}
                maxLength={100}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
              />
            </label>
            {deliveryType === 'VEHICLE' && (
              <label>
                Porta-malas (kg)
                <input type="number" name="trunkKg" min="0" step="0.1" defaultValue={product?.trunkKg ?? ''} />
              </label>
            )}
            {deliveryType === 'PROPERTY' && (
              <label>
                Localização
                <input name="location" maxLength={300} defaultValue={product?.location ?? ''} />
              </label>
            )}
            {(deliveryType === 'VEHICLE' || deliveryType === 'PROPERTY') && (
              <label>
                Visualização
                <select name="visualizacao" defaultValue={product?.visualizacao?.tipo ?? 'nenhuma'}>
                  <option value="nenhuma">Imagem e galeria</option>
                  <option value="360">360 (usa a galeria)</option>
                  <option value="3d">3D (usa a imagem)</option>
                </select>
              </label>
            )}
          </div>
          <label>
            <input name="featured" type="checkbox" defaultChecked={product?.featured ?? false} /> Destacar na loja
          </label>
          {deliveryType === 'CUSTOM' && (
            <label>
              <input type="checkbox" name="allowCustomGifts" defaultChecked={product?.allowCustomGifts ?? false} /> Pode
              ser dado de presente
            </label>
          )}
          <label>
            Galeria (um link HTTPS por linha)
            <textarea name="gallery" defaultValue={product?.gallery?.join('\n') ?? ''} />
          </label>
          <label>
            Características (uma por linha)
            <textarea name="features" defaultValue={product?.features?.join('\n') ?? ''} />
          </label>
        </fieldset>
      </details>

      <div className="product-save">
        <button className="button" disabled={busy || categories.length === 0}>
          {busy ? 'Salvando…' : product ? 'Salvar alterações' : 'Cadastrar produto'}
        </button>
        {categories.length === 0 && <span className="admin-note">Crie uma categoria antes de cadastrar produtos.</span>}
        {message && (
          <p role="status" className={message === 'Produto salvo.' ? 'admin-note' : 'admin-warning'}>
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
