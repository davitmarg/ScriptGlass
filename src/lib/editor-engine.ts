import { Fountain } from 'fountain-js';

const fountain = new Fountain();

export function parseFountain(text: string) {
  return fountain.parse(text);
}

export function formatFountain(text: string) {
  // Simple formatting logic or just return raw for now
  return text;
}
