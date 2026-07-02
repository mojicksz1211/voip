export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface ConnectionBannerProps {
  status: ConnectionStatus;
}

export default function ConnectionBanner({ status }: ConnectionBannerProps) {
  if (status === 'connected') return null;

  const isConnecting = status === 'connecting';

  return (
    <div
      className={`shrink-0 px-3 py-2 text-[11px] font-semibold text-center ${
        isConnecting ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'
      }`}
      role="status"
    >
      {isConnecting
        ? 'Connecting to hotel server…'
        : 'Disconnected from server — retrying automatically…'}
    </div>
  );
}
