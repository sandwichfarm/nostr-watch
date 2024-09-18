export const shuffleArray = <T>(array: T[]): void => {
  let currentIndex = array.length;
  while (currentIndex != 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
};

export const chunkArray = <T>(arr: T[], chunkSize: number): T[][] => {
  shuffleArray(arr);
  if (chunkSize <= 0) {
    throw new Error("Chunk size must be greater than 0.");
  }
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.slice(i, i + chunkSize));
  }
  return result;
};