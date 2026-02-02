// Simple balance utilities
export function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(4);
}
