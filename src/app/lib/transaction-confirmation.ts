export const TRANSACTION_CONFIRMATION_ATTEMPTS = 20;

export function confirmationFailure(hashes: string[], attempts = TRANSACTION_CONFIRMATION_ATTEMPTS) {
  return new Error(
    `Transaction confirmation failed after ${attempts} queries. ` +
    `Receipt and transaction could not both be confirmed. Hash: ${hashes.join(', ')}. ` +
    'On-chain status is unknown; check this hash before sending again.',
  );
}
