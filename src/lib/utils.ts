import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAcronym(name: string) {
  if (!name) return "";
  return name
    .split(' ')
    .filter(word => word.length > 0)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
}
