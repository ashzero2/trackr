/**
 * One short greeting per app session (until JS reload) so the header stays one line.
 */
const TEMPLATES = [
  'Hi, {name}',
  'Hey {name}',
  'Welcome, {name}',
  'Good day, {name}',
  'Hi there, {name}',
  'Hello, {name}',
  'Nice to see you, {name}',
  '{name}, welcome back',
] as const;

let sessionTemplateIndex: number | null = null;

export function greetingForSession(displayName: string): string {
  const name = displayName.trim() || 'there';
  if (sessionTemplateIndex === null) {
    sessionTemplateIndex = Math.floor(Math.random() * TEMPLATES.length);
  }
  return TEMPLATES[sessionTemplateIndex]!.replace(/\{name\}/g, name);
}
