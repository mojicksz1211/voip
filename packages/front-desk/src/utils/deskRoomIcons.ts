import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BedDouble,
  Building2,
  ConciergeBell,
  Shirt,
  Sparkles,
  UtensilsCrossed,
  User,
  Wrench,
} from 'lucide-react';
import type { SIPExtension } from '@hotel-voip/shared';

const STAFF_ICON_BY_EXT: Record<string, LucideIcon> = {
  '101': Sparkles,
  '102': UtensilsCrossed,
  '103': Shirt,
  '104': Wrench,
  '911': AlertTriangle,
};

export function getExtensionIcon(ext: Pick<SIPExtension, 'extension' | 'name' | 'clientType'>): LucideIcon {
  if (ext.clientType === 'guest') {
    return BedDouble;
  }
  return STAFF_ICON_BY_EXT[ext.extension] ?? User;
}

export const GUEST_SECTION_ICON = Building2;
export const STAFF_SECTION_ICON = ConciergeBell;
