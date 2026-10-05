'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { z } from 'zod';
import { categorySchema } from '@/lib/api/catalog-contracts';
export function CategoryEditor({
  category,
  canDisable = false,
}: {
  category?: z.infer<typeof categorySchema>;
  canDisable?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const router = useRouter(),
    key = useRef(''),
    last = useRef('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    const input = {
      name: String(form.get('name')),
      slug: String(form.get('slug')),
      displayOrder: Number(form.get('displayOrder')),
      status: String(form.get('status') ?? 'active'),
    };
    const body = JSON.stringify(input);
    if (body !== last.current) {
      last.current = body;
      key.current = crypto.randomUUID();
    }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-suburbio-intent': 'category.save' },
        body: JSON.stringify({
          category: input,
          id: category?.id,
          expectedRevision: category?.revision,
          idempotencyKey: key.current,
        }),
      });
      const data = await r.json();
      setMessage(r.ok ? 'Categoria salva.' : (data.error?.message ?? 'Não foi possível salvar.'));
      if (r.ok) router.refresh();
    } catch {
      setMessage('Conexão interrompida. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-editor" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>{category ? 'Editar categoria' : 'Nova categoria'}</legend>
        <div className="admin-form-grid">
          <label>
            Nome
            <input name="name" required minLength={2} maxLength={120} defaultValue={category?.name} />
          </label>
          <label>
            Identificador
            <input
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={100}
              placeholder="veiculos"
              defaultValue={category?.slug}
            />
          </label>
          <label>
            Ordem
            <input
              name="displayOrder"
              type="number"
              min={0}
              max={100000}
              defaultValue={category?.displayOrder ?? 0}
              required
            />
          </label>
          {canDisable && (
            <label>
              Status
              <select name="status" defaultValue={category?.status ?? 'active'}>
                <option value="active">Ativa</option>
                <option value="inactive">Inativa</option>
                <option value="archived">Arquivada</option>
              </select>
            </label>
          )}
        </div>
        <button className="button small">{busy ? 'Salvando…' : 'Salvar categoria'}</button>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
