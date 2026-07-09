export type InviteErrorCode = 'DND' | 'BUSY' | 'OFFLINE' | 'UNKNOWN';

export interface InviteErrorBody {
  error?: string;
  code?: string;
}

export function parseInviteErrorCode(data: InviteErrorBody): InviteErrorCode {
  if (data.code === 'DND') return 'DND';
  if (data.code === 'OFFLINE') return 'OFFLINE';
  if (data.code === 'BUSY') return 'BUSY';
  const msg = data.error || '';
  if (/do not disturb|dnd/i.test(msg)) return 'DND';
  if (/not online|offline/i.test(msg)) return 'OFFLINE';
  if (/busy/i.test(msg)) return 'BUSY';
  return 'UNKNOWN';
}

/** User-facing invite failure message (guest tablet uses Filipino for front desk). */
export function formatInviteError(data: InviteErrorBody, toExt?: string): string {
  const code = parseInviteErrorCode(data);
  if (code === 'DND') {
    if (toExt === '000') {
      return 'Ang front desk ay hindi available ngayon (Do Not Disturb). Subukan muli mamaya.';
    }
    return data.error || 'Hindi available ang tinatawagan (Do Not Disturb).';
  }
  if (code === 'OFFLINE') {
    if (toExt === '000') {
      return 'Ang front desk ay offline. Subukan muli mamaya.';
    }
    return data.error || 'Hindi online ang tinatawagan.';
  }
  if (code === 'BUSY') {
    return data.error || 'Busy ang tinatawagan. Subukan muli mamaya.';
  }
  return data.error || 'Hindi makatawag. Busy o offline ang receiver.';
}
