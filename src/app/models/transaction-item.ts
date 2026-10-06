import { formatAmount, formatDateUTC } from '../lib/format';
import { AddressTx } from '../types/backed-api';

export class TransactionItem {
  constructor(
    data: AddressTx,
    options?: {
      owner?: string;
      nativeSymbol?: string;
    },
  ) {
    this.owner = options?.owner;
    this.nativeSymbol = options?.nativeSymbol;
    this.data = data;
  }

  owner?: string;
  nativeSymbol?: string;
  data!: AddressTx;

  get txType() {
    switch (this.data.type) {
      case '1':
        return this.isOwner ? 'Send' : 'Receive';
      case '2':
        return 'Validator Staking';
      case '3':
      case '5':
        return 'Stake withdrawal';
      case '4':
        return 'Delegation';
      case '7':
        return 'Contract Creation';
      case '8':
        if (this.data.functions === 'transfer') {
          return this.isOwner ? 'Send' : 'Receive';
        } else if (this.data.functions === 'flowIn') {
          return 'Flow in';
        } else if (this.data.functions === 'requestNativeFlowOut') {
          return 'Flow out';
        }
        return this.data.functions;
      case '9':
        return 'Lock';
      case '10':
        return 'Unlock';
      case '13':
        return 'Vote';
      case '98':
        return 'Treasury';
      case '99':
        return 'Delegator Rewards';
    }

    return 'Transaction';
  }

  get isOwner() {
    const { fromAddress, fromEvmAddress } = this.data;
    if (!fromAddress && !fromEvmAddress) {
      return true;
    }
    return (
      this.owner?.toLowerCase() ===
      (fromAddress || fromEvmAddress).toLowerCase()
    );
  }

  get value() {
    const {
      amount,
      tokenAmount,
      type,
      assetType,
      assetTypeSymbol,
      symbol,
      contractName,
      functions,
    } = this.data;

    if (type === '7') {
      return contractName;
    }
    const _amount = type === '1' ? amount : tokenAmount || amount;
    const _symbol =
      assetType === 'OHI' ? this.nativeSymbol : assetTypeSymbol || symbol;

    if (_amount) {
      if (['10', '5', '3', '99', '98'].includes(type)) {
        return `+${formatAmount(_amount, 18)} ${_symbol}`;
      } else if (['1'].includes(type)) {
        return `${this.isOwner ? '-' : '+'}${formatAmount(_amount, 18)} ${_symbol}`;
      } else if (type === '8') {
        if (['flowIn', 'requestNativeFlowOut'].includes(functions ?? '')) {
          return `-${formatAmount(_amount, 18)} ${_symbol}`;
        }
        return `${this.isOwner ? '-' : '+'}${formatAmount(_amount, 18)} ${_symbol}`;
      } else {
        return `-${formatAmount(_amount, 18)} ${_symbol}`;
      }
    }
    return '--';
  }

  get timeStr() {
    return formatDateUTC(this.data.tradeTime, 'MM-DD HH:mm:ss');
  }

  get belowValue() {
    const { toEvmAddress, toAddress, fromAddress, fromEvmAddress, type } =
      this.data;

    const from = fromAddress || fromEvmAddress;
    const to = toAddress || toEvmAddress;
    const address = this.data.address || this.owner;
    switch (type) {
      case '2':
        return {
          type: 'To',
          address: address,
        };
      case '3':
      case '5':
      case '10':
      case '98':
        return {
          type: 'From',
          address: address,
        };
      case '99':
        return {
          type: 'From',
          address: from,
        };
      case '8':
      default:
        if (['flowIn', 'requestNativeFlowOut'].includes(this.data.functions)) {
          return {
            type: 'To',
            address: this.owner,
          };
        }
        return {
          type: this.isOwner ? 'To' : 'From',
          address: this.isOwner ? to : from,
        };
    }
  }

  isSame(hash: string) {
    return this.data.txHash === hash;
  }
  //     txTypeForTransfer() {
  //       if (this.data.type)
  //   }
}
