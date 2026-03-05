import { format, isValid } from 'date-fns';

export function safeFormat(date: string | number | Date | null | undefined, formatStr: string): string {
  if (!date) return 'N/A';
  
  const d = new Date(date);
  if (!isValid(d)) return 'Invalid Date';
  
  return format(d, formatStr);
}
