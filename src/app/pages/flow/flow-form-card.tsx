import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  LoaderCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { CopyButton } from '../../components/copy-button';
import { TransactionModal } from '../../components/transaction-modal';
import { TokenIcon } from '../../components/token-icon';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { shortAddress } from '../../lib/format';
import {
  canUseDirection,
  formatBalance,
  getAvailableBalance,
  getDisplayedAddress,
  getDisplayedAddressLabel,
  getRequestedBalance,
  parseFlowAmount,
  useFlowFormState,
} from './use-flow-form-state';
import type { FlowAssetOption } from './utils';

// Own the full form state for selecting assets, loading balances, and submitting flow actions.
export function FlowFormCard({
  assets,
  defaultAssetId,
  isAssetsLoading = false,
  assetsError = '',
}: {
  assets: FlowAssetOption[];
  defaultAssetId?: string;
  isAssetsLoading?: boolean;
  assetsError?: string;
}) {
  const {
    activeTab,
    sortedAssets,
    amount,
    availableBalance,
    closeFlowModal,
    confirmFlow,
    dropdownOpen,
    dropdownRef,
    error,
    handleAmountChange,
    handleAssetPickerKeyDown,
    handleSelectAsset,
    handleTabChange,
    isAssetPickerDisabled,
    isBalanceLoading,
    isFlowModalOpen,
    isFlowTransactionPending,
    openFlowModal,
    selectedAsset,
    selectedAssetAddress,
    selectedAssetIndex,
    setDropdownOpen,
    transactionDebugJson,
  } = useFlowFormState({
    assets,
    defaultAssetId,
    isAssetsLoading,
  });

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className='lg:col-span-3'>
        <Card className='border-border/50 bg-card p-0'>
          <div className='flex overflow-hidden rounded-t-xl border-b border-border/30'>
            {(['in', 'out'] as const).map((dir) => (
              <button
                key={dir}
                type='button'
                onClick={() => handleTabChange(dir)}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 px-6 py-4 transition-all ${
                  activeTab === dir
                    ? 'border-b-2 border-primary bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/20 hover:text-foreground'
                }`}>
                {dir === 'in' ? (
                  <ArrowDownToLine className='h-4 w-4' />
                ) : (
                  <ArrowUpFromLine className='h-4 w-4' />
                )}
                <span className='font-medium'>
                  Flow {dir === 'in' ? 'In' : 'Out'}
                </span>
              </button>
            ))}
          </div>

          <AnimatePresence mode='wait'>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className='space-y-6 p-6'>
              <div
                className={`flex items-center gap-3 rounded-lg border p-4 ${
                  activeTab === 'in'
                    ? 'border-green-500/20 bg-green-500/5'
                    : 'border-red-500/20 bg-red-500/5'
                }`}>
                <div
                  className={`rounded-lg p-2 ${
                    activeTab === 'in' ? 'bg-green-500/15' : 'bg-red-500/15'
                  }`}>
                  {activeTab === 'in' ? (
                    <ArrowDownToLine className='h-5 w-5 text-green-500' />
                  ) : (
                    <ArrowUpFromLine className='h-5 w-5 text-red-500' />
                  )}
                </div>
                <div>
                  <p className='text-sm font-medium'>
                    {activeTab === 'in'
                      ? 'Convert ERC20 tokens into Flow assets'
                      : 'Convert Flow assets back to ERC20 tokens'}
                  </p>
                  <p className='mt-0.5 text-xs text-muted-foreground'>
                    {activeTab === 'in'
                      ? 'The available balance comes from the ERC20 contract balanceOf result'
                      : 'The available balance comes from the HiveX asset-type balance'}
                  </p>
                </div>
              </div>

              <div>
                <label className='mb-2 block text-sm text-muted-foreground'>
                  Select Asset
                </label>
                <div className='relative' ref={dropdownRef}>
                  <div
                    role='button'
                    tabIndex={isAssetPickerDisabled ? -1 : 0}
                    aria-disabled={isAssetPickerDisabled}
                    aria-expanded={dropdownOpen}
                    onKeyDown={handleAssetPickerKeyDown}
                    onClick={() => {
                      if (!isAssetPickerDisabled) {
                        setDropdownOpen((current) => !current);
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-4 text-left transition-colors hover:border-primary/50 ${
                      isAssetPickerDisabled
                        ? 'cursor-not-allowed opacity-60'
                        : 'cursor-pointer'
                    }`}>
                    {selectedAsset ? (
                      <div className='flex items-center gap-3'>
                        <TokenIcon
                          src={selectedAsset.logo}
                          alt={selectedAsset.name || selectedAsset.symbol}
                          fallback={selectedAsset.symbol || selectedAsset.name}
                          className='h-10 w-10'
                          fallbackClassName='text-sm font-bold tracking-[0.04em]'
                          badgeSrc={
                            activeTab === 'out' ? '/token/flow.svg' : undefined
                          }
                        />
                        <div className='min-w-0 text-left'>
                          <p className='font-medium'>
                            {selectedAsset.name || selectedAsset.symbol}
                          </p>
                          <div className='flex items-center gap-2'>
                            <span className='truncate font-mono text-xs text-muted-foreground'>
                              {shortAddress(selectedAssetAddress)}
                            </span>
                            {selectedAssetAddress ? (
                              <CopyButton
                                value={selectedAssetAddress}
                                label={`${selectedAsset.name || selectedAsset.symbol} ${getDisplayedAddressLabel(activeTab)}`}
                                iconClassName='h-3 w-3'
                                className='shrink-0'
                                stopPropagation
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className='flex items-center gap-3 text-sm text-muted-foreground'>
                        {isAssetsLoading ? (
                          <LoaderCircle className='h-4 w-4 animate-spin' />
                        ) : null}
                        <span>
                          {isAssetsLoading
                            ? 'Loading flow assets...'
                            : 'No flow assets available'}
                        </span>
                      </div>
                    )}
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                        dropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>

                  <AnimatePresence>
                    {dropdownOpen ? (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className='absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-border/50 bg-card shadow-xl'>
                        {sortedAssets.map((asset, index) => (
                          <button
                            key={asset.assetType || asset.contractAddress}
                            type='button'
                            onClick={() => handleSelectAsset(index)}
                            className={`flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/50 ${
                              index === selectedAssetIndex
                                ? 'border-l-2 border-l-primary bg-primary/5'
                                : ''
                            }`}>
                            <TokenIcon
                              src={asset.logo}
                              alt={asset.name || asset.symbol}
                              fallback={asset.symbol || asset.name}
                              className='h-10 w-10'
                              fallbackClassName='text-sm font-bold tracking-[0.04em]'
                              badgeSrc={
                                activeTab === 'out'
                                  ? '/token/flow.svg'
                                  : undefined
                              }
                            />
                            <div className='min-w-0 flex-1'>
                              <div className='flex items-center gap-2'>
                                <p className='font-medium'>
                                  {asset.name || asset.symbol}
                                </p>
                                {!canUseDirection(asset, activeTab) ? (
                                  <span className='rounded border border-border/40 px-1.5 py-0.5 text-[10px] text-muted-foreground'>
                                    Disabled
                                  </span>
                                ) : null}
                              </div>
                              <span className='block truncate font-mono text-xs text-muted-foreground'>
                                {getDisplayedAddress(asset, activeTab)}
                              </span>
                            </div>
                            <div className='text-right text-xs text-muted-foreground'>
                              <span>
                                {getRequestedBalance(asset, activeTab) === null
                                  ? '--'
                                  : formatBalance(
                                      getAvailableBalance(asset, activeTab),
                                    )}
                              </span>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
                {assetsError ? (
                  <p className='mt-2 text-sm text-red-400'>{assetsError}</p>
                ) : null}
              </div>

              <div>
                <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
                  <label className='text-sm text-muted-foreground'>
                    Amount
                  </label>
                  <div className='flex min-w-0 flex-wrap items-center gap-2 text-sm'>
                    <span className='text-muted-foreground'>Available:</span>
                    {isBalanceLoading ? (
                      <LoaderCircle className='h-4 w-4 animate-spin text-muted-foreground' />
                    ) : (
                      <span className='min-w-0 break-all font-medium'>
                        {formatBalance(availableBalance)}
                      </span>
                    )}
                    <button
                      type='button'
                      onClick={() => handleAmountChange(availableBalance)}
                      disabled={!selectedAsset || isBalanceLoading}
                      className='ml-1 cursor-pointer text-xs text-primary hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50'>
                      MAX
                    </button>
                  </div>
                </div>
                <Input
                  type='number'
                  placeholder='0.00'
                  value={amount}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  className='h-14 border-border/50 bg-secondary/20 text-xl placeholder:text-muted-foreground/40'
                />
                {error ? (
                  <p className='mt-2 text-sm text-red-400'>{error}</p>
                ) : null}
              </div>

              {selectedAsset &&
              parseFlowAmount(
                amount,
                activeTab === 'in'
                  ? selectedAsset.decimals
                  : selectedAsset.assetDecimals,
              ) ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className='space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm'>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Conversion</span>
                    <span className='font-medium'>
                      {activeTab === 'in' ? 'ERC20 → Flow' : 'Flow → ERC20'}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Asset</span>
                    <span className='font-medium'>{selectedAsset.symbol}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Amount</span>
                    <span className='font-medium'>
                      {amount} {selectedAsset.symbol}
                    </span>
                  </div>
                  <div className='flex justify-between border-t border-border/30 pt-2'>
                    <span className='text-muted-foreground'>Est. Time</span>
                    <span className='font-medium text-primary'>~2 min</span>
                  </div>
                </motion.div>
              ) : null}

              <Button
                onClick={openFlowModal}
                disabled={
                  isAssetsLoading ||
                  isBalanceLoading ||
                  isFlowTransactionPending ||
                  !selectedAsset ||
                  !canUseDirection(selectedAsset, activeTab) ||
                  !amount ||
                  !parseFlowAmount(
                    amount,
                    activeTab === 'in'
                      ? selectedAsset.decimals
                      : selectedAsset.assetDecimals,
                  )
                }
                className={`h-12 w-full cursor-pointer ${
                  activeTab === 'in'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}>
                {activeTab === 'in' ? (
                  <ArrowDownToLine className='mr-2 h-4 w-4' />
                ) : (
                  <ArrowUpFromLine className='mr-2 h-4 w-4' />
                )}
                Confirm Flow {activeTab === 'in' ? 'In' : 'Out'}
              </Button>
            </motion.div>
          </AnimatePresence>
        </Card>
      </motion.div>

      <TransactionModal
        isOpen={isFlowModalOpen}
        onClose={closeFlowModal}
        title={`Flow ${activeTab === 'in' ? 'In' : 'Out'}`}
        confirmText={`Confirm Flow ${activeTab === 'in' ? 'In' : 'Out'}`}
        onConfirm={confirmFlow}>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Conversion</p>
            <p className='font-medium'>
              {activeTab === 'in' ? 'ERC20 → Flow' : 'Flow → ERC20'}
            </p>
          </div>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Asset</p>
            <p className='font-medium'>{selectedAsset?.symbol || '-'}</p>
          </div>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Amount</p>
            <p className='font-medium'>
              {formatBalance(amount || '0')}{' '}
              {selectedAsset?.symbol || ''}
            </p>
          </div>
          <div className='rounded-lg border border-primary/20 bg-primary/10 p-4'>
            <p className='mb-1 text-sm text-muted-foreground'>Estimated Time</p>
            <p className='text-lg font-bold text-primary'>~2 minutes</p>
          </div>
          <div className='overflow-hidden rounded-lg border border-border/50 bg-black/30'>
            <div className='flex items-center justify-between border-b border-border/40 px-4 py-3'>
              <div>
                <p className='text-sm font-medium'>Transaction Debug JSON</p>
                <p className='text-xs text-muted-foreground'>
                  Ethereum RPC request and hivex parameter mapping
                </p>
              </div>
              {transactionDebugJson ? (
                <CopyButton
                  value={transactionDebugJson}
                  label='Transaction debug JSON'
                  iconClassName='h-4 w-4'
                />
              ) : null}
            </div>
            <pre className='max-h-64 overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-xs leading-5 text-emerald-300'>
              {transactionDebugJson || '{}'}
            </pre>
          </div>
        </div>
      </TransactionModal>
    </>
  );
}
