import { useEffect, useMemo, useState } from 'react';
import { cn } from './ui/utils';

interface TokenIconProps {
  src?: string;
  alt: string;
  fallback?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  badgeSrc?: string;
  badgeAlt?: string;
  badgeFallback?: string;
  badgeClassName?: string;
  badgeImageClassName?: string;
  badgeFallbackClassName?: string;
}

function isImageSource(value?: string) {
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return false;
  }

  return (
    normalizedValue.startsWith('/') ||
    normalizedValue.startsWith('./') ||
    normalizedValue.startsWith('../') ||
    normalizedValue.startsWith('http://') ||
    normalizedValue.startsWith('https://') ||
    normalizedValue.startsWith('data:image/') ||
    /\.(svg|png|jpe?g|gif|webp|avif)$/i.test(normalizedValue)
  );
}

function getFallbackLabel(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return '?';
  }

  if (normalizedValue.startsWith('0x')) {
    return normalizedValue.slice(2, 4).toUpperCase();
  }

  const parts = normalizedValue.split(/[\s/-]+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return normalizedValue.slice(0, 2).toUpperCase();
}

export function TokenIcon({
  src,
  alt,
  fallback,
  className,
  imageClassName,
  fallbackClassName,
  badgeSrc,
  badgeAlt,
  badgeFallback,
  badgeClassName,
  badgeImageClassName,
  badgeFallbackClassName,
}: TokenIconProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageSource = useMemo(
    () => (isImageSource(src) ? src?.trim() : undefined),
    [src],
  );

  useEffect(() => {
    setImageFailed(false);
  }, [imageSource]);

  const label = getFallbackLabel(fallback || alt);
  const showImage = Boolean(imageSource) && !imageFailed;
  const shouldShowBadge = Boolean(badgeSrc || badgeFallback);

  return (
    <div className='relative inline-flex'>
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden rounded-full border border-white/10 bg-secondary/80 text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)]',
          className,
        )}>
        {showImage ? (
          <img
            src={imageSource}
            alt={alt}
            className={cn('h-full w-full object-contain', imageClassName)}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span
            className={cn(
              'text-sm font-semibold uppercase tracking-[0.08em]',
              fallbackClassName,
            )}>
            {label}
          </span>
        )}
      </div>
      {shouldShowBadge ? (
        <TokenIcon
          src={badgeSrc}
          alt={badgeAlt || `${alt} badge`}
          fallback={badgeFallback}
          className={cn(
            'absolute -bottom-1 -right-1 h-4 w-4 border-border bg-background shadow-lg ring-2 ring-background',
            badgeClassName,
          )}
          imageClassName={badgeImageClassName}
          fallbackClassName={cn(
            'text-[8px] font-bold tracking-[0.08em]',
            badgeFallbackClassName,
          )}
        />
      ) : null}
    </div>
  );
}
