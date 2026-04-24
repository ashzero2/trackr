import type { SQLiteDatabase } from 'expo-sqlite';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { BudgetRepository } from '@/data/budget-repository';
import { CategoryRepository } from '@/data/category-repository';
import { TransactionRepository } from '@/data/transaction-repository';
import { TripRepository } from '@/data/trip-repository';
import { openAndPrepareDatabase } from '@/db/open-database';

export type Repositories = {
  categories: CategoryRepository;
  transactions: TransactionRepository;
  trips: TripRepository;
  budgets: BudgetRepository;
};

type DatabaseContextValue = {
  ready: boolean;
  error: Error | null;
  db: SQLiteDatabase | null;
  categories: CategoryRepository | null;
  transactions: TransactionRepository | null;
  trips: TripRepository | null;
  budgets: BudgetRepository | null;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [db, setDb] = useState<SQLiteDatabase | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const database = await openAndPrepareDatabase();
        if (cancelled) {
          await database.closeAsync();
          return;
        }
        setDb(database);
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<DatabaseContextValue>(() => {
    if (!ready || !db) {
      return {
        ready: false,
        error,
        db: null,
        categories: null,
        transactions: null,
        trips: null,
        budgets: null,
      };
    }
    const trips = new TripRepository(db);
    return {
      ready: true,
      error,
      db,
      categories: new CategoryRepository(db),
      trips,
      transactions: new TransactionRepository(db, trips),
      budgets: new BudgetRepository(db),
    };
  }, [ready, error, db]);

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return ctx;
}

export function useRepositories(): Repositories & { db: SQLiteDatabase } {
  const { ready, db, categories, transactions, trips, budgets, error } = useDatabase();
  if (error) {
    throw error;
  }
  if (!ready || !db || !categories || !transactions || !trips || !budgets) {
    throw new Error('Database not ready');
  }
  return { db, categories, transactions, trips, budgets };
}
