import { Check, Copy } from 'lucide-react';
import { type ComponentProps } from 'react';
import { useCopyFeedback } from '../hooks/use-copy-feedback';
import { cn } from './ui/utils';

interface CopyButtonProps extends Omit<
  ComponentProps<'button'>,
  'children' | 'type'
> {
  value: string;
  label?: string;
  copyKey?: string;
  iconClassName?: string;
  stopPropagation?: boolean;
  successTitle?: string;
  successMessage?: string;
  errorTitle?: string;
  errorMessage?: string;
}

export function CopyButton({
  value,
  label = 'Value',
  copyKey,
  iconClassName,
  stopPropagation = false,
  successTitle,
  successMessage,
  errorTitle,
  errorMessage,
  className,
  onClick,
  onMouseDown,
  ...props
}: CopyButtonProps) {
  const { copiedValue, copy } = useCopyFeedback();
  const resolvedKey = copyKey ?? value;
  const isCopied = copiedValue === resolvedKey;

  const handleMouseDown: NonNullable<ComponentProps<'button'>['onMouseDown']> =
    (event) => {
      if (stopPropagation) {
        event.stopPropagation();
      }

      onMouseDown?.(event);
    };

  const handleClick: NonNullable<ComponentProps<'button'>['onClick']> = (
    event,
  ) => {
    if (stopPropagation) {
      event.stopPropagation();
    }

    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    // The shared copy hook keeps each button's feedback behavior consistent.
    void copy(value, {
      key: resolvedKey,
      successTitle,
      successMessage: successMessage ?? `${label} copied.`,
      errorTitle: errorTitle ?? `${label} copy failed`,
      errorMessage:
        errorMessage ??
        `Unable to copy the ${label.toLowerCase()}. Check browser permissions and try again.`,
    });
  };

  return (
    <button
      type='button'
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      aria-label={props['aria-label'] ?? `Copy ${label}`}
      title={props.title ?? `Copy ${label}`}
      className={cn(
        'cursor-pointer text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}>
      {isCopied ? (
        <Check className={cn('h-4 w-4 text-green-500', iconClassName)} />
      ) : (
        <Copy className={cn('h-4 w-4', iconClassName)} />
      )}
    </button>
  );
}
