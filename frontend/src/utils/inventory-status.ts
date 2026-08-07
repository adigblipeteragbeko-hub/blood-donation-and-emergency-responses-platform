export type InventoryStatusLevel = 'stable' | 'watch' | 'low' | 'critical';

export function getInventoryStatus(bloodGroup: string, availableUnits: number): {
  label: string;
  level: InventoryStatusLevel;
  className: string;
} {
  const criticalThreshold = bloodGroup === 'O_NEG' ? 12 : bloodGroup === 'B_NEG' || bloodGroup === 'AB_NEG' ? 5 : 8;

  if (availableUnits <= Math.max(1, Math.floor(criticalThreshold / 2))) {
    return { label: 'Critical', level: 'critical', className: 'bg-red-100 text-red-700 border-red-200' };
  }
  if (availableUnits <= criticalThreshold) {
    return { label: 'Low', level: 'low', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  if (availableUnits <= criticalThreshold + 5) {
    return { label: 'Watch', level: 'watch', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  }
  return { label: 'Stable', level: 'stable', className: 'bg-green-100 text-green-700 border-green-200' };
}
