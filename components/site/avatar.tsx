'use client';
import Image from 'next/image';
import { useState } from 'react';
import { safeAvatar } from '@/lib/public-profile';
export function Avatar({ name, image, size = 36 }: { name: string; image?: string | null; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = safeAvatar(image);
  return (
    <span className="citizen-avatar" style={{ width: size, height: size }}>
      {src && failed !== src ? (
        <Image
          src={src}
          width={size}
          height={size}
          alt={`Avatar de ${name}`}
          onError={() => setFailed(src)}
          unoptimized
        />
      ) : (
        <span role="img" aria-label={`Avatar de ${name}`}>
          {name.trim().slice(0, 1).toLocaleUpperCase('pt-BR') || 'S'}
        </span>
      )}
    </span>
  );
}
