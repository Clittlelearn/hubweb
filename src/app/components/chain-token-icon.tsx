import { TokenIcon } from './token-icon';
import { cn } from './ui/utils';

interface ChainTokenIconProps {
  tokenSrc?: string;
  tokenAlt: string;
  tokenFallback?: string;
  chainSrc?: string;
  chainAlt?: string;
  chainFallback?: string;
  className?: string;
  tokenClassName?: string;
  tokenImageClassName?: string;
  tokenFallbackClassName?: string;
  chainClassName?: string;
}

export function ChainTokenIcon({
  tokenSrc,
  tokenAlt,
  tokenFallback,
  chainSrc,
  chainAlt,
  chainFallback,
  className,
  tokenClassName,
  tokenImageClassName,
  tokenFallbackClassName,
  chainClassName,
}: ChainTokenIconProps) {
  const shouldShowChainBadge = Boolean(chainSrc || chainFallback);

  return (
    <TokenIcon
      src={tokenSrc}
      alt={tokenAlt}
      fallback={tokenFallback}
      className={cn(className, tokenClassName)}
      imageClassName={tokenImageClassName}
      fallbackClassName={tokenFallbackClassName}
      badgeSrc={shouldShowChainBadge ? chainSrc : undefined}
      badgeAlt={chainAlt || 'Chain'}
      badgeFallback={chainFallback}
      badgeClassName={chainClassName}
    />
  );
}
