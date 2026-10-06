import { useEffect } from 'react';

let activeLockCount = 0;
let previousBodyOverflow = '';
let previousBodyPaddingRight = '';
let previousDocumentOverflow = '';

export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (
      !locked ||
      typeof document === 'undefined' ||
      typeof window === 'undefined'
    ) {
      return;
    }

    if (activeLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      previousBodyPaddingRight = document.body.style.paddingRight;
      previousDocumentOverflow = document.documentElement.style.overflow;

      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      const currentBodyPaddingRight =
        Number.parseFloat(
          window.getComputedStyle(document.body).paddingRight,
        ) || 0;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${
          currentBodyPaddingRight + scrollbarWidth
        }px`;
      }
    }

    activeLockCount += 1;

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1);

      if (activeLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
        document.body.style.paddingRight = previousBodyPaddingRight;
        document.documentElement.style.overflow = previousDocumentOverflow;
      }
    };
  }, [locked]);
}
