import { useCallback, useEffect, useRef, useState } from 'react';
import { useFeedback } from '../providers/feedback-provider';
import { copyText } from '../lib/helper';

interface CopyFeedbackOptions {
  key?: string;
  successMessage?: string;
  successTitle?: string;
  errorTitle?: string;
  errorMessage?: string;
}

const DEFAULT_RESET_DELAY = 2000;

export function useCopyFeedback(resetDelay = DEFAULT_RESET_DELAY) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const { showError, showSuccess } = useFeedback();

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (value: string, options: CopyFeedbackOptions = {}) => {
      try {
        await copyText(value);

        setCopiedValue(options.key ?? value);

        if (resetTimerRef.current) {
          window.clearTimeout(resetTimerRef.current);
        }

        resetTimerRef.current = window.setTimeout(() => {
          setCopiedValue(null);
        }, resetDelay);

        showSuccess(
          options.successTitle ?? 'Copied to clipboard',
          options.successMessage,
        );

        return true;
      } catch (error) {
        setCopiedValue(null);

        const message =
          options.errorMessage ??
          (error instanceof Error && error.message
            ? error.message
            : 'Unable to copy to the clipboard. Please try again.');

        showError(options.errorTitle ?? 'Copy failed', message);

        return false;
      }
    },
    [resetDelay, showError, showSuccess],
  );

  return { copiedValue, copy };
}
