import type { LucideIcon } from 'lucide-react';

interface CallControlButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  variant?: 'default' | 'hangup';
  disabled?: boolean;
}

export default function CallControlButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  variant = 'default',
  disabled = false,
}: CallControlButtonProps) {
  const isHangup = variant === 'hangup';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
        isHangup ? '' : 'group'
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-full transition-colors ${
          isHangup
            ? 'w-16 h-16 bg-desk-hangup text-white shadow-lg hover:bg-red-600'
            : active
              ? 'w-14 h-14 bg-white/25 text-white ring-2 ring-white/50'
              : 'w-14 h-14 bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm'
        }`}
      >
        <Icon className={isHangup ? 'w-7 h-7' : 'w-6 h-6'} />
      </span>
      <span className={`text-[11px] font-medium ${isHangup ? 'text-white/90' : 'text-white/80'}`}>
        {label}
      </span>
    </button>
  );
}
