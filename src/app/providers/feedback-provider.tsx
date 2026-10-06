import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../components/ui/utils';

type FeedbackVariant = 'success' | 'error';

interface FeedbackItem {
  id: number;
  title: string;
  message?: string;
  variant: FeedbackVariant;
}

interface FeedbackOptions {
  title: string;
  message?: string;
  variant: FeedbackVariant;
  duration?: number;
}

interface FeedbackContextType {
  showFeedback: (options: FeedbackOptions) => void;
  showSuccess: (title: string, message?: string, duration?: number) => void;
  showError: (title: string, message?: string, duration?: number) => void;
}

const DEFAULT_DURATION = 3200;

const FeedbackContext = createContext<FeedbackContextType | null>(null);

function FeedbackToast({
  item,
  onDismiss,
}: {
  item: FeedbackItem;
  onDismiss: (id: number) => void;
}) {
  const isSuccess = item.variant === 'success';
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;
  const accentClassName = isSuccess
    ? 'bg-emerald-400/90 shadow-[0_0_20px_rgba(52,211,153,0.38)]'
    : 'bg-red-400/90 shadow-[0_0_20px_rgba(248,113,113,0.34)]';
  const accentGlowClassName = isSuccess
    ? 'bg-[radial-gradient(circle,rgba(52,211,153,0.1),transparent_70%)]'
    : 'bg-[radial-gradient(circle,rgba(248,113,113,0.09),transparent_70%)]';
  const surfaceClassName = isSuccess
    ? 'bg-[radial-gradient(circle_at_18%_30%,rgba(52,211,153,0.08),transparent_36%),linear-gradient(180deg,rgba(22,26,34,0.52),rgba(8,10,14,0.34))]'
    : 'bg-[radial-gradient(circle_at_18%_30%,rgba(248,113,113,0.07),transparent_36%),linear-gradient(180deg,rgba(22,26,34,0.52),rgba(8,10,14,0.34))]';
  const iconTileClassName = isSuccess
    ? 'bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-300/10'
    : 'bg-red-400/10 text-red-200 ring-1 ring-red-300/10';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -18, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -14, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
      className={cn(
        'pointer-events-auto relative w-full overflow-hidden rounded-[1.75rem] border border-white/8 shadow-[0_16px_36px_rgba(0,0,0,0.22)] backdrop-blur-2xl',
        'sm:rounded-2xl sm:shadow-[0_18px_40px_rgba(0,0,0,0.2)]',
        surfaceClassName,
      )}>
      <div className='pointer-events-none absolute inset-x-8 top-0 h-px ' />
      <div
        className={cn(
          'pointer-events-none absolute -left-6 top-1/2 h-20 w-20 -translate-y-1/2 blur-2xl',
          accentGlowClassName,
        )}
      />
      <div className='pointer-events-none absolute inset-x-0 top-0 h-14 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_72%)] opacity-60' />
      <div className='relative flex items-center gap-2.5 px-3 py-2.5 sm:items-start sm:gap-3 sm:p-4'>
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:mt-0.5 sm:h-10 sm:w-10 sm:rounded-xl',
            iconTileClassName,
          )}>
          <Icon className='h-3.5 w-3.5 sm:h-5 sm:w-5' />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                accentClassName,
              )}
            />
            <p className='truncate text-xs font-semibold leading-4 text-white sm:text-sm'>
              {item.title}
            </p>
          </div>
          {item.message ? (
            <p className='mt-0.5 pl-3.5 text-[10px] leading-3.5 text-white/62 sm:mt-1 sm:pl-0 sm:text-sm sm:leading-5 sm:text-muted-foreground'>
              {item.message}
            </p>
          ) : null}
        </div>
        <button
          type='button'
          onClick={() => onDismiss(item.id)}
          className='-mr-0.5 flex h-6.5 w-6.5 shrink-0 self-center items-center justify-center rounded-full bg-white/[0.04] text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white sm:h-8 sm:w-8'
          aria-label='Dismiss notification'>
          <X className='h-3 w-3 sm:h-4 sm:w-4' />
        </button>
      </div>
    </motion.div>
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const nextIdRef = useRef(0);
  const timeoutRef = useRef<Record<number, number>>({});

  const dismissFeedback = useCallback((id: number) => {
    const timeoutId = timeoutRef.current[id];

    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete timeoutRef.current[id];
    }

    setItems((currentItems) => currentItems.filter((item) => item.id !== id));
  }, []);

  const showFeedback = useCallback(
    ({
      duration = DEFAULT_DURATION,
      title,
      message,
      variant,
    }: FeedbackOptions) => {
      const id = nextIdRef.current + 1;
      nextIdRef.current = id;

      setItems((currentItems) => {
        const nextItems = [...currentItems, { id, title, message, variant }];

        if (nextItems.length > 3) {
          const droppedItems = nextItems.slice(0, nextItems.length - 3);

          droppedItems.forEach((item) => {
            const timeoutId = timeoutRef.current[item.id];

            if (timeoutId) {
              window.clearTimeout(timeoutId);
              delete timeoutRef.current[item.id];
            }
          });
        }

        return nextItems.slice(-3);
      });

      timeoutRef.current[id] = window.setTimeout(() => {
        dismissFeedback(id);
      }, duration);
    },
    [dismissFeedback],
  );

  useEffect(() => {
    return () => {
      Object.values(timeoutRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  const value = useMemo<FeedbackContextType>(
    () => ({
      showFeedback,
      showSuccess: (title, message, duration) =>
        showFeedback({ title, message, duration, variant: 'success' }),
      showError: (title, message, duration) =>
        showFeedback({ title, message, duration, variant: 'error' }),
    }),
    [showFeedback],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div
        className='pointer-events-none fixed inset-x-0 top-0 z-[140] flex justify-center px-3 sm:inset-x-auto sm:top-auto sm:bottom-4 sm:right-4 sm:px-0 sm:justify-end'
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.6rem)' }}>
        <div className='flex w-full max-w-[20rem] flex-col gap-2 sm:max-w-sm sm:gap-3'>
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <FeedbackToast
                key={item.id}
                item={item}
                onDismiss={dismissFeedback}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }

  return context;
}
