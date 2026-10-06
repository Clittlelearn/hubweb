import {
  DEFAULT_NETWORK,
  getNetworkByChainId,
  getNetworkByKey,
} from './wallet';

export async function copyText(str: string) {
  if (!str) {
    throw new Error('Nothing to copy.');
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(str);
      return true;
    }
  } catch {
    // Fall back to the legacy execCommand path below.
  }

  const textarea = document.createElement('textarea');
  textarea.value = str;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previousRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let isCopy = false;

  try {
    isCopy = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);

    if (selection) {
      selection.removeAllRanges();
      if (previousRange) {
        selection.addRange(previousRange);
      }
    }
  }

  if (!isCopy) {
    throw new Error(
      'Unable to copy to the clipboard. Check browser permissions and try again.',
    );
  }

  return true;
}

export function toExplorer(
  type: 'tx' | 'address' | 'token' | 'validator',
  val: string,
  options?: { chainId?: number },
) {
  if (!val || typeof window === 'undefined') {
    return;
  }

  const network =
    (typeof options?.chainId === 'number'
      ? getNetworkByChainId(options.chainId)
      : undefined) ?? getNetworkByKey(DEFAULT_NETWORK);
  const explorerBaseUrl = network.explorerBaseUrl;
  const path =
    type === 'validator'
      ? `/validator?address=${val}`
      : `/${type}/${val}`;

  if (!explorerBaseUrl) {
    return;
  }

  window.open(new URL(path, `${explorerBaseUrl}/`).toString(), '_blank');
}

export const errorHandling = (error: any): Error => {
  if (error instanceof Error) {
    const rpcError = error as Error & {
      data?: { message?: string };
      error?: { message?: string };
      info?: { error?: { message?: string } };
    };
    const rpcMessage =
      rpcError.info?.error?.message ??
      rpcError.error?.message ??
      rpcError.data?.message;
    let message =
      typeof rpcMessage === 'string' && rpcMessage.trim()
        ? rpcMessage
        : error.message;

    try {
      const errs = message
        ?.split?.('info=')?.[1]
        ?.split?.(', code=')?.[0];
      const messageStr = JSON.parse(errs ?? '{}')?.error?.message;

      if (messageStr) {
        message = messageStr;
      } else {
        const m = message?.split?.('(')?.[0];
        message = m || message;
      }
    } catch {
      const errs = message?.split?.('(');
      message = errs?.[0] ?? message;
    }

    const messageSplit = message.split(':');

    if (
      messageSplit[messageSplit.length - 1]
        ?.trim()
        .includes('User denied request signature')
    ) {
      throw new Error('User denied request signature');
    }
    throw new Error(message);
  } else {
    if ('message' in error) {
      if (error.message.includes('user rejected')) {
        throw new Error('User rejected the request');
      } else if (error.message === 'withdraw_paused') {
        throw new Error('Withdraw is temporarily suspended at the moment.');
      } else if (
        error.message.includes(
          'insufficient funds for intrinsic transaction cost',
        ) ||
        error.message === 'insufficient_balance'
      ) {
        throw new Error('Insufficient balance');
      } else if (
        error?.data?.message?.includes('gas required exceeds allowance')
      ) {
        throw new Error('Insufficient balance');
      } else if (
        error.message.includes('missing revert data in call exception')
      ) {
        throw new Error('JsonRpc error, please try again later');
      } else {
        throw new Error(error.message);
      }
    } else {
      throw new TypeError(
        (
          (error as any)?.data?.message ??
          (error as any).message ??
          error ??
          ''
        ).toString(),
      );
    }
  }
};
