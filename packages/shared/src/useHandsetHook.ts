import { useEffect, useRef } from 'react';
import type { CallMetadata } from './types';

export type HandsetHookHandlers = {
  onAnswer: (callId: string) => void;
  onHangup: (callId: string) => void;
};

export function resolveHandsetHookAction(
  call: CallMetadata | null,
  localExt: string,
): { action: 'answer' | 'hangup'; callId: string } | null {
  if (!call) return null;

  if (call.status === 'ringing' && call.toExt === localExt) {
    return { action: 'answer', callId: call.callId };
  }

  if (call.status === 'connected') {
    return { action: 'hangup', callId: call.callId };
  }

  if (call.status === 'ringing' && call.fromExt === localExt) {
    return { action: 'hangup', callId: call.callId };
  }

  return null;
}

export function useHandsetHook(
  enabled: boolean,
  subscribeHandsetHook: (onPress: () => void) => () => void,
  localExt: string,
  currentCall: CallMetadata | null,
  handlers: HandsetHookHandlers,
) {
  const callRef = useRef(currentCall);
  const handlersRef = useRef(handlers);
  callRef.current = currentCall;
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    return subscribeHandsetHook(() => {
      const resolved = resolveHandsetHookAction(callRef.current, localExt);
      if (!resolved) return;

      if (resolved.action === 'answer') {
        handlersRef.current.onAnswer(resolved.callId);
      } else {
        handlersRef.current.onHangup(resolved.callId);
      }
    });
  }, [enabled, localExt, subscribeHandsetHook]);
}
