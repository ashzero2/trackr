/**
 * One random template per app session (until JS reload) so the line does not
 * flicker on re-renders, but still feels varied across launches.
 */
const TEMPLATES = [
  'Good day, {name}',
  'Hey, {name}',
  'Nice to see you, {name}',
  '{name}, you’re on track',
  'Welcome back, {name}',
  '{name}, keep it up',
  'Hi {name}',
  '{name}, stay sharp',
  'Look who’s budgeting — hi, {name}',
  '{name}, your money called. It said thanks.',
  'Ahoy, {name} — spreadsheets ahead',
  '{name}, the piggy bank sent its regards',
  'Budget hero {name}, reporting for duty',
  'Hey {name}, no receipt left behind',
  '{name}, you + this app = unstoppable (financially speaking)',
  'Sup {name} — time to peek at the numbers',
  '{name}, your future self is rooting for you',
  'Oh hey, {name} — wallet check?',
  '{name}, still crushing it. Carry on.',
  '{name}, the coffee fund salutes you',
  'Beep boop, {name} — finance mode: on',
  '{name}, let’s see what those dollars did',
] as const;

let sessionTemplateIndex: number | null = null;

export function greetingForSession(displayName: string): string {
  const name = displayName.trim() || 'there';
  if (sessionTemplateIndex === null) {
    sessionTemplateIndex = Math.floor(Math.random() * TEMPLATES.length);
  }
  return TEMPLATES[sessionTemplateIndex]!.replace(/\{name\}/g, name);
}
