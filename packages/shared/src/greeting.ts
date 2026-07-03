export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getRoomGreeting(roomNum: string): string {
  const room = roomNum.trim();
  if (!room) return getGreeting();
  return `${getGreeting()}, Room ${room}!`;
}
