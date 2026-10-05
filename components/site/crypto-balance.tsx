'use client';
import Link from 'next/link';
import { Diamond, ArrowUpRight } from 'lucide-react';
import { useCitizen, type BalanceState } from './citizen-provider';
import { formatCrypto } from '@/lib/api/citizen-contracts';
export function CryptoBalanceValue({ state, card = false }: { state: BalanceState; card?: boolean }) {
  const text = state.status === 'ready' ? formatCrypto(state.balance) : '—';
  const label =
    state.status === 'ready'
      ? `Saldo: ${text} Crypto`
      : state.status === 'loading'
        ? 'Consultando saldo Crypto'
        : 'Não foi possível consultar seu saldo agora.';
  return (
    <Link
      href="/#crypto"
      className={card ? 'crypto-account-balance' : 'crypto-nav-balance'}
      aria-label={label}
      title={label}
      aria-busy={state.status === 'loading'}
    >
      <Diamond size={16} />
      <span className={state.status === 'loading' ? 'crypto-balance-skeleton' : ''}>{text}</span>
      <small>Crypto</small>
      {card && (
        <span className="crypto-buy-label">
          Adquirir Crypto <ArrowUpRight size={14} />
        </span>
      )}
    </Link>
  );
}
export function CryptoBalance({ mobile = false, card = false }: { mobile?: boolean; card?: boolean }) {
  const data = useCitizen();
  if (data?.session.status !== 'authenticated') return null;
  return (
    <div className={card ? 'citizen-card citizen-crypto' : mobile ? 'crypto-mobile' : 'crypto-desktop'}>
      {card && (
        <div className="citizen-card-top">
          <span>SEU SALDO CRYPTO</span>
        </div>
      )}
      <CryptoBalanceValue state={data.balance} card={card} />
    </div>
  );
}
