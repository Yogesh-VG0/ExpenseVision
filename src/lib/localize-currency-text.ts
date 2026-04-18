export function localizeCurrencyMentions(
  content: string,
  formatCurrency: (amount: number) => string
) {
  const replaceAmount = (match: string, amount: string) => {
    const numeric = Number(amount.replace(/,/g, ""));
    return Number.isFinite(numeric) ? formatCurrency(numeric) : match;
  };

  return content
    .replace(/\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, replaceAmount)
    .replace(/\bUSD\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/gi, replaceAmount);
}