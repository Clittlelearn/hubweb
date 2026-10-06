import assert from 'node:assert/strict';
import test from 'node:test';
import { compareBalancesDescending, compareRawTokenBalances } from '../../src/app/lib/token-balance-sort';

test('raw balances compare human quantities across token decimals', () => {
  const input = [{ balance: '2000000000000000000', decimals: 18 },
    { balance: '1000000000000', decimals: 8 }, { balance: '0', decimals: 8 }];
  assert.deepEqual([...input].sort(compareRawTokenBalances), [input[1], input[0], input[2]]);
  assert.equal(input[0].decimals, 18);
});
test('large and tiny balances retain precision without compact labels', () => {
  assert.equal(compareBalancesDescending('9007199254740993.00000001', '9007199254740993.00000002'), 1);
  assert.equal(compareBalancesDescending('1', '0', 255, 8), -1);
  assert.equal(compareRawTokenBalances({balance:'100',decimals:2}, {balance:'100000000',decimals:8}), 0);
});
test('unknown and invalid values sort below known zero', () => {
  for (const value of [null, undefined, '', 'NaN', 'Infinity', '1K', '-1']) {
    assert.equal(compareBalancesDescending(value, '0'), 1);
  }
  assert.equal(compareBalancesDescending(null, undefined), 0);
});
