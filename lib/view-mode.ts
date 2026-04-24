import { ViewMode } from '@/types/finance';

export function deriveViewMode(travelModeEnabled: boolean): ViewMode {
  return travelModeEnabled ? ViewMode.TRAVEL : ViewMode.NORMAL;
}
