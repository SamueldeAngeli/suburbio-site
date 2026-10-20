'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestRoom } from '@/lib/screen/room-client';

/** Encerrar transmissão de terceiros. A rota confere na API a capability de moderação de quem pede. */
export function EndBroadcast({ code, title }: { code: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  if (!open)
    return (
      <button className="button small outline" onClick={() => setOpen(true)}>
        Encerrar
      </button>
    );
  return (
    <form
      className="admin-inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage('');
        try {
          await requestRoom('end', { code, reason: reason.trim() });
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Não foi possível encerrar.');
          setBusy(false);
        }
      }}
    >
      <label>
        Motivo para encerrar “{title}”
        <input required minLength={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <button className="button small" disabled={busy || reason.trim().length < 3}>
        Confirmar encerramento
      </button>
      <button type="button" className="button small outline" onClick={() => setOpen(false)}>
        Cancelar
      </button>
      {message && <p role="alert">{message}</p>}
    </form>
  );
}
