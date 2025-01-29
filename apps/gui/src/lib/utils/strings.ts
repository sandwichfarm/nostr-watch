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

export const truncateWithEllipsis = (text: string, maxLength: number): string => {
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + '...';    
    }
    return text;
}
