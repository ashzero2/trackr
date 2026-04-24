import type { Repositories } from '@/contexts/database-context';
import type { Category } from '@/types/finance';

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function wantsListCategories(n: string): boolean {
  if (n.includes('categorize') && !n.includes('categories')) return false;
  if (!n.includes('categor')) return false;
  return (
    (n.includes('list') && n.includes('categor')) ||
    (n.includes('show') && n.includes('categor')) ||
    n.includes('what categories') ||
    n.includes('which categories') ||
    n.includes('my categories') ||
    n.includes('all categories') ||
    n === 'categories'
  );
}

function formatCategoryList(rows: Category[]): string {
  if (rows.length === 0) {
    return "You don't have any categories yet. Add transactions or create categories in Settings.";
  }
  const expenses = rows.filter((c) => c.type === 'expense').sort((a, b) => a.name.localeCompare(b.name));
  const incomes = rows.filter((c) => c.type === 'income').sort((a, b) => a.name.localeCompare(b.name));
  const lines: string[] = [`Here are your ${rows.length} categories:`];
  if (expenses.length) {
    lines.push('', 'Expense:');
    for (const c of expenses) {
      lines.push(`• ${c.name}`);
    }
  }
  if (incomes.length) {
    lines.push('', 'Income:');
    for (const c of incomes) {
      lines.push(`• ${c.name}`);
    }
  }
  return lines.join('\n');
}

/**
 * Handles a tiny set of intents locally (no Gemini). Returns null → caller should use the model.
 */
export async function tryExbotFastPath(userText: string, repos: Repositories): Promise<string | null> {
  const n = normalize(userText);
  if (!n) return null;

  if (wantsListCategories(n)) {
    const rows = await repos.categories.listAll();
    return formatCategoryList(rows);
  }

  return null;
}
