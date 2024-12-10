export const capitalize = (text: string, allWords: boolean = false): string => {
    if (allWords) {
        return text
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    } else {
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }
}