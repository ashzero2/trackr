import type { SQLiteDatabase } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { BudgetRepository } from '@/data/budget-repository';
import { CategoryRepository } from '@/data/category-repository';
import { RecurringRepository } from '@/data/recurring-repository';
import { TransactionRepository } from '@/data/transaction-repository';
import { TripRepository } from '@/data/trip-repository';
import { openAndPrepareDatabase } from '@/db/open-database';

export type Repositories = {
  categories: CategoryRepository;
  transactions: TransactionRepository;
  trips: TripRepository;
  budgets: BudgetRepository;
  recurring: RecurringRepository;
};

type DatabaseContextValue = {
  ready: boolean;
  error: Error | null;
  db: SQLiteDatabase | null;
  categories: CategoryRepository | null;
  transactions: TransactionRepository | null;
  trips: TripRepository | null;
  budgets: BudgetRepository | null;
  recurring: RecurringRepository | null;
  /** Incremented every time a transaction is inserted, updated, or deleted. */
  dataVersion: number;
  bumpDataVersion: () => void;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  // Stable callback reference so repositories don't need re-instantiation on version change
  const bumpDataVersion = useCallback(() => setDataVersion((v) => v + 1), []);
  const bumpRef = useRef(bumpDataVersion);
  bumpRef.current = bumpDataVersion;

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
    // Stable bump thunk so that changing dataVersion doesn't re-create repositories
    const bump = () => bumpRef.current();
    if (!ready || !db) {
      return {
        ready: false,
        error,
        db: null,
        categories: null,
        transactions: null,
        trips: null,
        budgets: null,
        recurring: null,
        dataVersion,
        bumpDataVersion: bump,
      };
    }
    const trips = new TripRepository(db);
    return {
      ready: true,
      error,
      db,
      categories: new CategoryRepository(db),
      trips,
      transactions: new TransactionRepository(db, trips, bump),
      budgets: new BudgetRepository(db),
      recurring: new RecurringRepository(db),
      dataVersion,
      bumpDataVersion: bump,
    };
  }, [ready, error, db, dataVersion]);

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
  const { ready, db, categories, transactions, trips, budgets, recurring, error } = useDatabase();
  if (error) {
    throw error;
  }
  if (!ready || !db || !categories || !transactions || !trips || !budgets || !recurring) {
    throw new Error('Database not ready');
  }
  return { db, categories, transactions, trips, budgets, recurring };
}
