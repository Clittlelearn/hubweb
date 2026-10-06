import * as React from 'react';

import { cn } from './utils';

type TextProps = React.ComponentProps<'span'> & {
  loading?: boolean;
  skeletonClassName?: string;
  skeletonWidth?: number | string;
};

function Text({
  className,
  loading = false,
  skeletonClassName,
  skeletonWidth,
  children,
  ...props
}: TextProps) {
  const skeletonStyle =
    skeletonWidth === undefined
      ? undefined
      : {
          width:
            typeof skeletonWidth === 'number'
              ? `${skeletonWidth}px`
              : skeletonWidth,
        };

  return (
    <span
      data-slot='text'
      className={cn('inline-block ', className)}
      {...props}>
      {loading ? (
        <span
          aria-hidden='true'
          className={cn(
            'block h-[0.6em] min-w-[2rem] rounded bg-foreground/40 animate-pulse',
            skeletonClassName,
          )}
          style={skeletonStyle}
        />
      ) : (
        children
      )}
    </span>
  );
}

export { Text };
