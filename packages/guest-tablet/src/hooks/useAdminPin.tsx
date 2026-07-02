import { useCallback, useState } from 'react';
import AdminPinDialog from '../components/AdminPinDialog';
import { verifyAdminPin } from '../utils/guestStorage';

export function useAdminPin() {
  const [pending, setPending] = useState<{ resolve: (ok: boolean) => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requirePin = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        setError(null);
        setPending({ resolve });
      }),
    [],
  );

  const close = useCallback((result: boolean) => {
    setPending((current) => {
      current?.resolve(result);
      return null;
    });
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    (pin: string) => {
      if (verifyAdminPin(pin)) {
        close(true);
        return;
      }
      setError('Incorrect PIN. Try again.');
    },
    [close],
  );

  const pinDialog = pending ? (
    <AdminPinDialog
      open
      error={error}
      onSubmit={handleSubmit}
      onCancel={() => close(false)}
    />
  ) : null;

  return { requirePin, pinDialog };
}
