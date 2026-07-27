import { ValueTransformer } from 'typeorm';

export const bigintTransformer: ValueTransformer = {
  to: (value: string | number | null | undefined): string | null => {
    if (value === null || value === undefined) {
      return null;
    }
    return String(value);
  },
  from: (value: string | number | null | undefined): string | null => {
    if (value === null || value === undefined) {
      return null;
    }
    return String(value);
  },
};
