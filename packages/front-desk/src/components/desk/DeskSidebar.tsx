import { LayoutDashboard, Grid3X3, Clock, Building2, Bell, Settings } from 'lucide-react';
import type { DeskNav } from '../../utils/deskHelpers';

interface DeskSidebarProps {
  activeNav: DeskNav;
  onNavChange: (nav: DeskNav) => void;
  pendingRequests: number;
  layout?: 'side' | 'bottom';
}

const NAV_ITEMS: { id: DeskNav; icon: typeof Grid3X3; label: string }[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'keypad', icon: Grid3X3, label: 'Keypad' },
  { id: 'recents', icon: Clock, label: 'Recents' },
  { id: 'rooms', icon: Building2, label: 'Rooms' },
  { id: 'requests', icon: Bell, label: 'Requests' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export default function DeskSidebar({
  activeNav,
  onNavChange,
  pendingRequests,
  layout = 'side',
}: DeskSidebarProps) {
  const isBottom = layout === 'bottom';

  return (
    <nav
      className={`shrink-0 bg-white border-slate-200 flex ${
        isBottom
          ? 'flex-row justify-around items-center h-[72px] border-t px-2 safe-area-pb'
          : 'flex-col items-stretch py-4 gap-1 w-[104px] border-r px-2'
      }`}
    >
      {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
        const active = activeNav === id;
        const showBadge = id === 'requests' && pendingRequests > 0;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavChange(id)}
            title={label}
            className={`relative flex flex-col items-center justify-center transition-colors rounded-xl ${
              isBottom ? 'flex-1 py-2.5 gap-1' : 'w-full py-3 gap-1.5'
            } ${
              active
                ? 'text-desk-primary bg-blue-50'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-6 h-6 shrink-0" strokeWidth={2} />
            <span
              className={`font-medium leading-none text-center ${
                isBottom ? 'text-[10px]' : 'text-xs'
              }`}
            >
              {label}
            </span>
            {showBadge && (
              <span
                className={`absolute min-w-[20px] h-5 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ${
                  isBottom ? 'top-1 right-1 sm:right-3' : 'top-1 right-1'
                }`}
              >
                {pendingRequests > 9 ? '9+' : pendingRequests}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
