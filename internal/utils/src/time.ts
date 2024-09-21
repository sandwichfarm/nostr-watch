export const now = (): number => new Date().getTime();
export const nowstr = (): number => Math.round(now() / 1000);

export const msToCronTime = (milliseconds: number): string => {
  if (!Number.isInteger(milliseconds) || milliseconds < 0) {
    return 'Invalid input';
  }
  const minutes = Math.ceil(milliseconds / 60000);
  if (minutes >= 60) {
    const hours = Math.ceil(minutes / 60);
    return `0 */${hours} * * *`;
  } else {
    return `*/${minutes} * * * *`;
  }
};