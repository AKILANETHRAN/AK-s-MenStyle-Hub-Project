/**
 * AK'S MEN STYLE — BUY MORE, SAVE MORE CART REWARD SERVICE
 * Centralized business logic for cart-level rewards based on real cart subtotal.
 */

export const CART_REWARD_TIERS = [
  { tier: 0, minSpend: 0, minAmount: 0, maxSpend: 999.99, percentage: 0, label: 'No Cart Reward' },
  { tier: 1, minSpend: 1000, minAmount: 1000, maxSpend: 1999.99, percentage: 10, label: '10% OFF' },
  { tier: 2, minSpend: 2000, minAmount: 2000, maxSpend: 2999.99, percentage: 20, label: '20% OFF' },
  { tier: 3, minSpend: 3000, minAmount: 3000, maxSpend: Infinity, percentage: 30, label: '30% OFF — MAX SAVING' }
];

/**
 * Calculates authoritative cart reward from subtotal
 * @param {number} subtotal Real current cart subtotal
 * @returns {object} Reward breakdown { tier, percentage, rewardAmount, nextThreshold, amountToNextTier, finalTotal, tierLabel }
 */
export function calculateCartReward(subtotal) {
  const numSubtotal = Math.max(0, Math.round((Number(subtotal) || 0) * 100) / 100);

  let tier = 0;
  let percentage = 0;
  let nextThreshold = 1000;
  let amountToNextTier = 1000;
  let tierLabel = 'No Cart Reward';

  if (numSubtotal >= 3000) {
    tier = 3;
    percentage = 30;
    nextThreshold = null;
    amountToNextTier = 0;
    tierLabel = '30% OFF — MAX SAVING';
  } else if (numSubtotal >= 2000) {
    tier = 2;
    percentage = 20;
    nextThreshold = 3000;
    amountToNextTier = Math.round((3000 - numSubtotal) * 100) / 100;
    tierLabel = '20% OFF';
  } else if (numSubtotal >= 1000) {
    tier = 1;
    percentage = 10;
    nextThreshold = 2000;
    amountToNextTier = Math.round((2000 - numSubtotal) * 100) / 100;
    tierLabel = '10% OFF';
  } else {
    tier = 0;
    percentage = 0;
    nextThreshold = 1000;
    amountToNextTier = Math.round((1000 - numSubtotal) * 100) / 100;
    tierLabel = 'No Cart Reward';
  }

  const rawReward = (numSubtotal * percentage) / 100;
  const rewardAmount = Math.round(rawReward * 100) / 100;
  const finalTotal = Math.max(0, Math.round((numSubtotal - rewardAmount) * 100) / 100);

  return {
    tier,
    percentage,
    rewardAmount,
    nextThreshold,
    amountToNextTier,
    finalTotal,
    tierLabel
  };
}
