import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface GuestModalProps {
  open: boolean;
  children: ReactNode;
  onBackdropClick?: () => void;
  zIndexClass?: string;
}

export default function GuestModal({
  open,
  children,
  onBackdropClick,
  zIndexClass = 'z-[200]',
}: GuestModalProps) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4`}
      style={{ touchAction: 'manipulation' }}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={onBackdropClick}
        aria-label="Close dialog"
      />
      <div
        className="relative z-10 w-full max-w-sm pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
