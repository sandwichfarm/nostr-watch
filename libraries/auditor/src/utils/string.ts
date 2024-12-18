export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function truncate(str: string, maxLength: number = 64): string {
  if (str.length <= maxLength) {
      return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

export function toCode(message: string): string {
  return message.toUpperCase().replace(/ /g, "_")
}

export function fromCode(message: string): string {
  return message.toLowerCase().replace(/_/g, ' ')
}