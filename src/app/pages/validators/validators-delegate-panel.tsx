import { ChevronDown, Lock } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { TokenIcon } from '../../components/token-icon';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { OPENHIVE_VALIDATOR_CONSTRAINTS } from '../../data/openhive-parameters';
import type { TokenInfo } from '../../types/common';
import type { ValidatorListItem } from './validators-types';

interface ValidatorsDelegatePanelProps {
  validators: ValidatorListItem[];
  availableTokens: TokenInfo[];
  selectedValidatorId: number | null;
  selectedTokenKey: string;
  selectedToken: TokenInfo | null;
  selectedValidator: ValidatorListItem | null;
  delegateAmount: string;
  delegateError: string;
  onSelectValidator: (validatorId: number | null) => void;
  onSelectToken: (tokenKey: string) => void;
  onDelegateAmountChange: (value: string) => void;
  onOpenDelegate: () => void;
  getTokenKey: (token: TokenInfo) => string;
}

export function ValidatorsDelegatePanel({
  validators,
  availableTokens,
  selectedValidatorId,
  selectedTokenKey,
  selectedToken,
  selectedValidator,
  delegateAmount,
  delegateError,
  onSelectValidator,
  onSelectToken,
  onDelegateAmountChange,
  onOpenDelegate,
  getTokenKey,
}: ValidatorsDelegatePanelProps) {
  const hasDelegateTokens = availableTokens.length > 0;
  const [tokenDropdownOpen, setTokenDropdownOpen] = useState(false);
  const [validatorDropdownOpen, setValidatorDropdownOpen] = useState(false);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);
  const validatorDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tokenDropdownRef.current &&
        !tokenDropdownRef.current.contains(event.target as Node)
      ) {
        setTokenDropdownOpen(false);
      }
      if (
        validatorDropdownRef.current &&
        !validatorDropdownRef.current.contains(event.target as Node)
      ) {
        setValidatorDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectToken = (tokenKey: string) => {
    onSelectToken(tokenKey);
    setTokenDropdownOpen(false);
  };

  const handleSelectValidator = (validatorId: number | null) => {
    onSelectValidator(validatorId);
    setValidatorDropdownOpen(false);
  };

  return (
    <Card className='border-border/50 bg-card p-6'>
      <div className='mb-6 flex items-center gap-3'>
        <div className='rounded-lg bg-primary/10 p-2'>
          <Lock className='h-5 w-5 text-primary' />
        </div>
        <div>
          <h3>Delegate to Validators</h3>
          <p className='mt-1 text-sm text-muted-foreground'>
            Choose one Flow token and invest it to a validator once.
          </p>
        </div>
      </div>

      <div className='space-y-4'>
        <div>
          <label className='mb-2 block text-sm text-muted-foreground'>
            Delegate Token
          </label>
          <div className='relative' ref={tokenDropdownRef}>
            <button
              type='button'
              disabled={!hasDelegateTokens}
              onClick={() => setTokenDropdownOpen((current) => !current)}
              className='flex w-full cursor-pointer items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-4 text-left transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60'>
              {selectedToken ? (
                <div className='flex items-center gap-3'>
                  <TokenIcon
                    src={selectedToken.logo}
                    alt={selectedToken.name || selectedToken.symbol}
                    fallback={selectedToken.symbol || selectedToken.name}
                    className='h-10 w-10'
                    fallbackClassName='text-sm font-bold tracking-[0.04em]'
                    badgeSrc={
                      selectedToken.isFlow ? '/token/flow.svg' : undefined
                    }
                  />
                  <div className='min-w-0 text-left'>
                    <p className='font-medium'>
                      {selectedToken.name || selectedToken.symbol}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {selectedToken.balance} {selectedToken.symbol}
                    </p>
                  </div>
                </div>
              ) : (
                <span className='text-sm text-muted-foreground'>
                  {hasDelegateTokens
                    ? 'Select a token...'
                    : 'No flow tokens available'}
                </span>
              )}
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                  tokenDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {tokenDropdownOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className='absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-border/50 bg-card shadow-xl'>
                  {availableTokens.map((token) => {
                    const key = getTokenKey(token);
                    const isSelected = key === selectedTokenKey;

                    return (
                      <button
                        key={key}
                        type='button'
                        onClick={() => handleSelectToken(key)}
                        className={`flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/50 ${
                          isSelected
                            ? 'border-l-2 border-l-primary bg-primary/5'
                            : ''
                        }`}>
                        <TokenIcon
                          src={token.logo}
                          alt={token.name || token.symbol}
                          fallback={token.symbol || token.name}
                          className='h-10 w-10'
                          fallbackClassName='text-sm font-bold tracking-[0.04em]'
                          badgeSrc={
                            token.isFlow ? '/token/flow.svg' : undefined
                          }
                        />
                        <div className='min-w-0 flex-1'>
                          <p className='font-medium'>
                            {token.name || token.symbol}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            {token.balance} {token.symbol}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          {/* <p className='mt-2 text-xs text-muted-foreground'>
            Only `isFlow = true` tokens are allowed here, and `OHI` is excluded.
          </p> */}
        </div>

        <div>
          <label className='mb-2 block text-sm text-muted-foreground'>
            Select Validator
          </label>
          <div className='relative' ref={validatorDropdownRef}>
            <button
              type='button'
              onClick={() => setValidatorDropdownOpen((current) => !current)}
              className='flex w-full cursor-pointer items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-4 text-left transition-colors hover:border-primary/50'>
              {selectedValidator ? (
                <div className='min-w-0 text-left'>
                  <p className='font-medium'>{selectedValidator.name}</p>
                  <p className='text-xs text-muted-foreground'>
                    APY {selectedValidator.apy} · Commission{' '}
                    {selectedValidator.commission}
                  </p>
                </div>
              ) : (
                <span className='text-sm text-muted-foreground'>
                  Choose a validator...
                </span>
              )}
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                  validatorDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {validatorDropdownOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className='absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-border/50 bg-card shadow-xl'>
                  {validators.map((validator) => {
                    const isSelected = validator.id === selectedValidatorId;

                    return (
                      <button
                        key={validator.id}
                        type='button'
                        onClick={() => handleSelectValidator(validator.id)}
                        className={`flex w-full cursor-pointer flex-col gap-0.5 p-4 text-left transition-colors hover:bg-secondary/50 ${
                          isSelected
                            ? 'border-l-2 border-l-primary bg-primary/5'
                            : ''
                        }`}>
                        <p className='font-medium'>{validator.name}</p>
                        <p className='text-xs text-muted-foreground'>
                          APY {validator.apy} · Commission{' '}
                          {validator.commission}
                        </p>
                      </button>
                    );
                  })}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <div>
          <label className='mb-2 block text-sm text-muted-foreground'>
            Amount to Delegate
          </label>
          <Input
            type='number'
            placeholder={`Amount >= ${OPENHIVE_VALIDATOR_CONSTRAINTS.INVESTOR_MIN_AMOUNT}`}
            min={OPENHIVE_VALIDATOR_CONSTRAINTS.INVESTOR_MIN_AMOUNT}
            value={delegateAmount}
            onChange={(event) => onDelegateAmountChange(event.target.value)}
            className='border-border/30 bg-secondary/30'
          />
        </div>

        {selectedToken ? (
          <div className='flex items-center justify-between rounded-lg border border-border/30 bg-secondary/20 p-4 text-sm'>
            <div className='flex items-center gap-3'>
              <TokenIcon
                src={selectedToken.logo}
                alt={selectedToken.name}
                fallback={selectedToken.symbol}
                className='h-9 w-9'
                badgeSrc={selectedToken.isFlow ? '/token/flow.svg' : undefined}
              />
              <div>
                <p className='font-medium'>{selectedToken.name}</p>
                <p className='text-xs text-muted-foreground'>
                  Available Balance
                </p>
              </div>
            </div>
            <p className='font-medium'>
              {selectedToken.balance} {selectedToken.symbol}
            </p>
          </div>
        ) : null}

        {selectedValidator ? (
          <div className='rounded-lg border border-primary/20 bg-primary/10 p-4'>
            <p className='mb-1 text-sm text-muted-foreground'>Estimated APY</p>
            <p className='text-2xl font-bold text-primary'>
              {selectedValidator.apy}
            </p>
          </div>
        ) : null}

        {delegateError ? <p className='text-sm text-red-400'>{delegateError}</p> : null}

        <Button
          className='w-full cursor-pointer bg-primary hover:bg-primary/90'
          disabled={
            !hasDelegateTokens ||
            !selectedToken ||
            !selectedValidator ||
            !delegateAmount ||
            Number(delegateAmount) <
              OPENHIVE_VALIDATOR_CONSTRAINTS.INVESTOR_MIN_AMOUNT
          }
          onClick={onOpenDelegate}>
          <Lock className='mr-2 h-4 w-4' />
          Delegate Now
        </Button>
      </div>
    </Card>
  );
}
