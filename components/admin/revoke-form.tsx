'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
export function RevokeForm({ playerId, disabled }: { playerId: string; disabled: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [key, setKey] = useState('');
  const [open, setOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const router = useRouter();
  async function revoke(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || readOnly || busy || !confirmed || reason.trim().length < 3 || !key) return;
    setBusy(true); setAttempted(true); setFeedback('');
    try {
      const response = await fetch('/api/admin/allowlist/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Suburbio-Intent': 'allowlist.revoke' }, body: JSON.stringify({ playerId, reason: reason.trim(), confirmed, idempotencyKey: key }) });
      const result = await response.json();
      if (!response.ok) {
        if (result.error?.code === 'API_READ_ONLY') setReadOnly(true);
        setFeedback(`${result.error?.message ?? 'Não foi possível concluir a solicitação.'} ${result.error?.reference ?? ''}`);
      } else { setFeedback(`Allowlist revogada. Operação: ${result.data.operationId}`); dialog.current?.close(); setOpen(false); router.refresh(); }
    } catch { setFeedback('Não foi possível confirmar o resultado. Tente novamente com esta mesma solicitação; não inicie outra operação.'); }
    finally { setBusy(false); }
  }
  return <div className="admin-revoke"><button className="button outline" disabled={disabled || readOnly} onClick={() => { if (!key) setKey(crypto.randomUUID()); setOpen(true); dialog.current?.showModal(); }}>Revogar allowlist</button>{disabled && <p className="admin-note">Revogação indisponível para este acesso ou estado.</p>}{feedback && !open && <p role="status">{feedback}</p>}
    <dialog ref={dialog} className="admin-revoke-dialog" onCancel={event => { if (busy) event.preventDefault(); else setOpen(false); }}><form onSubmit={revoke}><span className="admin-kicker">AÇÃO ADMINISTRATIVA</span><h2>Revogar acesso à cidade?</h2><p>Esta ação remove a allowlist ativa do jogador e será auditada pela API.</p><label>Motivo<textarea required minLength={3} maxLength={500} value={reason} onChange={event => { setReason(event.target.value); setKey(crypto.randomUUID()); }} disabled={busy || readOnly || attempted}/></label><label className="admin-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy || readOnly}/>Confirmo a revogação deste jogador.</label>{feedback && <p role="status" className="admin-warning">{feedback}</p>}<div className="admin-dialog-actions"><button type="button" className="button outline" disabled={busy} onClick={() => { dialog.current?.close(); setOpen(false); }}>Cancelar</button><button className="button" disabled={busy || readOnly || !confirmed || reason.trim().length < 3}>{busy ? 'Enviando…' : 'Confirmar revogação'}</button></div></form></dialog>
  </div>;
}
