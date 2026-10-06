import { METHOD_OPTIONS } from '../config';
import {
  targetLabel,
  usesAssetType,
  usesRawAmount,
  usesUtxoHash,
  usesVoteHash,
} from '../lib/utils';
import type { SdkFormState, SdkMethod, SdkRunMode } from '../types';

interface SdkCallFormProps {
  form: SdkFormState;
  isRunning: boolean;
  onRun: (mode: SdkRunMode) => void;
  onUpdate: <K extends keyof SdkFormState>(
    key: K,
    value: SdkFormState[K],
  ) => void;
}

export function SdkCallForm({
  form,
  isRunning,
  onRun,
  onUpdate,
}: SdkCallFormProps) {
  return (
    <section className='panel form-panel'>
      <div className='panel-heading'>
        <h2>SDK Call</h2>
        <span className='sdk-entry'>@openhive/sdk</span>
      </div>

      <div className='form-grid'>
        <label className='field'>
          <span>Method</span>
          <select
            value={form.method}
            onChange={(event) =>
              onUpdate('method', event.target.value as SdkMethod)
            }>
            {METHOD_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className='field wide'>
          <span>{targetLabel(form.method)}</span>
          <input
            value={form.targetAddress}
            onChange={(event) => onUpdate('targetAddress', event.target.value)}
            placeholder='0x...'
          />
        </label>

        {usesAssetType(form.method) && (
          <label className='field'>
            <span>Asset type</span>
            <input
              value={form.assetType}
              onChange={(event) => onUpdate('assetType', event.target.value)}
            />
          </label>
        )}

        <label className='field'>
          <span>Gas asset</span>
          <input
            value={form.gasAssetType}
            onChange={(event) => onUpdate('gasAssetType', event.target.value)}
          />
        </label>

        {(form.method === 'transfer' || form.method === 'transaction') && (
          <>
            <label className='field'>
              <span>Value</span>
              <input
                inputMode='decimal'
                value={form.transferValue}
                onChange={(event) =>
                  onUpdate('transferValue', event.target.value)
                }
              />
            </label>

            <label className='field'>
              <span>Value decimals</span>
              <input
                inputMode='numeric'
                value={form.transferValueDecimals}
                onChange={(event) =>
                  onUpdate('transferValueDecimals', event.target.value)
                }
              />
            </label>
          </>
        )}

        {usesRawAmount(form.method) && (
          <label className='field'>
            <span>Amount raw</span>
            <input
              inputMode='numeric'
              value={form.amountRaw}
              onChange={(event) => onUpdate('amountRaw', event.target.value)}
            />
          </label>
        )}

        {form.method === 'stake' && (
          <label className='field'>
            <span>Reward rank</span>
            <input
              value={form.rewardRank}
              onChange={(event) => onUpdate('rewardRank', event.target.value)}
            />
          </label>
        )}

        {(form.method === 'delegate' || form.method === 'delegateAlias') && (
          <label className='field'>
            <span>Delegate type</span>
            <input
              value={form.delegateType}
              onChange={(event) => onUpdate('delegateType', event.target.value)}
            />
          </label>
        )}

        {form.method === 'lock' && (
          <label className='field'>
            <span>Lock type</span>
            <input
              value={form.lockType}
              onChange={(event) => onUpdate('lockType', event.target.value)}
            />
          </label>
        )}

        {usesUtxoHash(form.method) && (
          <label className='field wide'>
            <span>UTXO hash</span>
            <input
              value={form.utxoHash}
              onChange={(event) => onUpdate('utxoHash', event.target.value)}
              placeholder='0x...'
            />
          </label>
        )}

        {usesVoteHash(form.method) && (
          <label className='field wide'>
            <span>Vote hash</span>
            <input
              value={form.voteHash}
              onChange={(event) => onUpdate('voteHash', event.target.value)}
              placeholder='0x...'
            />
          </label>
        )}

        {form.method === 'vote' && (
          <label className='field'>
            <span>Vote</span>
            <select
              value={form.voteValue}
              onChange={(event) =>
                onUpdate('voteValue', event.target.value as '1' | '0')
              }>
              <option value='1'>For</option>
              <option value='0'>Against</option>
            </select>
          </label>
        )}

        {form.method === 'bonus' && (
          <label className='check-field'>
            <input
              type='checkbox'
              checked={form.firstChoose}
              onChange={(event) =>
                onUpdate('firstChoose', event.target.checked)
              }
            />
            <span>first_choose</span>
          </label>
        )}

        <label className='field wide'>
          <span>encoded_info</span>
          <input
            value={form.encodedInfo}
            onChange={(event) => onUpdate('encodedInfo', event.target.value)}
          />
        </label>

        <div className='toggle-row wide'>
          <label className='check-field'>
            <input
              type='checkbox'
              checked={form.sponsorGas}
              onChange={(event) => onUpdate('sponsorGas', event.target.checked)}
            />
            <span>sponsor_gas</span>
          </label>
          <label className='check-field'>
            <input
              type='checkbox'
              checked={form.isFindUtxo}
              onChange={(event) => onUpdate('isFindUtxo', event.target.checked)}
            />
            <span>is_find_utxo</span>
          </label>
          <label className='check-field'>
            <input
              type='checkbox'
              checked={form.waitForReceipt}
              onChange={(event) =>
                onUpdate('waitForReceipt', event.target.checked)
              }
            />
            <span>wait()</span>
          </label>
        </div>
      </div>

      <div className='actions'>
        <button
          className='button'
          type='button'
          disabled={isRunning}
          onClick={() => onRun('build')}>
          Build Unsigned Tx
        </button>
        <button
          className='button primary'
          type='button'
          disabled={isRunning}
          onClick={() => onRun('send')}>
          Send With Wallet
        </button>
      </div>
    </section>
  );
}
