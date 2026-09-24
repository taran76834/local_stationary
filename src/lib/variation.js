/**
 * Format item variation details as a plain text string.
 * e.g. "Chocolate | 1kg"
 */
export function formatItemVariation(flavor, unitDisplay, productName) {
  const parts = [];
  if (flavor && flavor.trim() && flavor.trim().toLowerCase() !== (productName || '').trim().toLowerCase()) {
    parts.push(flavor.trim());
  }
  if (unitDisplay && unitDisplay.trim() && unitDisplay.trim().toLowerCase() !== 'standard') {
    parts.push(unitDisplay.trim());
  }
  return parts.join(' | ');
}

/**
 * Format item variation details as an HTML snippet for use in emails.
 * Returns an empty string if there is nothing meaningful to show.
 */
export function formatItemVariationHtml(flavor, unitDisplay, productName) {
  const text = formatItemVariation(flavor, unitDisplay, productName);
  if (!text) return '';
  return text;
}
