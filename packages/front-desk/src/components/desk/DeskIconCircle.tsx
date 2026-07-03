import type { LucideIcon } from 'lucide-react';

type DeskIconCircleSize = 'sm' | 'md' | 'lg';

interface DeskIconCircleProps {
  icon: LucideIcon;
  muted?: boolean;
  size?: DeskIconCircleSize;
  className?: string;
}

const SIZE_CLASSES: Record<DeskIconCircleSize, { wrap: string; icon: string }> = {
  sm: { wrap: 'w-9 h-9', icon: 'w-4 h-4' },
  md: { wrap: 'w-11 h-11', icon: 'w-5 h-5' },
  lg: { wrap: 'w-12 h-12', icon: 'w-6 h-6' },
};

export default function DeskIconCircle({
  icon: Icon,
  muted = false,
  size = 'md',
  className = '',
}: DeskIconCircleProps) {
  const { wrap, icon } = SIZE_CLASSES[size];

  return (
    <div
      className={`${wrap} rounded-full flex items-center justify-center shrink-0 ${
        muted ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-900'
      } ${className}`}
    >
      <Icon className={icon} strokeWidth={2} />
    </div>
  );
}
