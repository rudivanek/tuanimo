export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(decimals)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(decimals)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}
