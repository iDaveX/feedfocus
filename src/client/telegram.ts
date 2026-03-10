export function getTelegramInitData(): string | null {
  const initData = (window as any).Telegram?.WebApp?.initData as string | undefined;
  if (initData && initData.trim().length > 0) return initData;
  return null;
}
