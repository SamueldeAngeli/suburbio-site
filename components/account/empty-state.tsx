import Link from 'next/link';
import { ArrowUpRight, Box } from 'lucide-react';
export function EmptyState({
  title,
  description,
  href,
  label,
  icon,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="citizen-empty">
      <span className="citizen-empty-icon">{icon ?? <Box size={25} strokeWidth={1.3} />}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {href && label && (
        <Link className="citizen-text-link" href={href}>
          {label}
          <ArrowUpRight size={15} />
        </Link>
      )}
    </div>
  );
}
