import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string, decimals = 0): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0';
  return '$' + num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatNumber(value: number | string, decimals = 0): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
