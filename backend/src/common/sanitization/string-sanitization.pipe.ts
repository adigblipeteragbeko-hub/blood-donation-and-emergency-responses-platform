import { Injectable, PipeTransform } from '@nestjs/common';

function sanitizeString(value: string): string {
  return value.replace(/[<>]/g, '').trim();
}

function walk(input: unknown): unknown {
  if (typeof input === 'string') {
    return sanitizeString(input);
  }

  if (Array.isArray(input)) {
    return input.map((item) => walk(item));
  }

  if (input && typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      result[key] = walk(value);
    }
    return result;
  }

  return input;
}

@Injectable()
export class StringSanitizationPipe implements PipeTransform {
  transform(value: unknown) {
    return walk(value);
  }
}
