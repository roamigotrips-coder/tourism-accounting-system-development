import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchCurrencies as fetchCurrenciesDb,
  upsertCurrencies as upsertCurrenciesDb,
  fetchCurrencyRates as fetchCurrencyRatesDb,
  upsertCurrencyRates as upsertCurrencyRatesDb,
  fetchSetting,
  saveSetting,
} from '../lib/supabaseSync';

export type Currency = {
  code: string;
  symbol: string;
  name: string;
  enabled: boolean;
};

export type CurrencyRate = {
  code: string;
  rate: number;
  date: string;
  source?: string;
};

export type RevaluationDraftLine = {
  id: string;
  accountCode: string;
  accountName: string;
  currency: string;
  foreignBalance: number;
  oldRate: number;
  newRate: number;
  baseOld: number;
  baseNew: number;
  difference: number;
};

export type CurrencyContextType = {
  baseCurrency: string;
  setBaseCurrency: (code: string) => void;
  currencies: Currency[];
  setCurrencies: React.Dispatch<React.SetStateAction<Currency[]>>;
  rates: CurrencyRate[];
  setRates: React.Dispatch<React.SetStateAction<CurrencyRate[]>>;
  getRate: (code: string) => number;
  convert: (amount: number, from: string, to?: string) => number;
  loading: boolean;
  error: string | null;
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const DEFAULT_CURRENCIES: Currency[] = [
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', enabled: true },
  { code: 'USD', symbol: '$', name: 'US Dollar', enabled: true },
  { code: 'EUR', symbol: '€', name: 'Euro', enabled: true },
  { code: 'GBP', symbol: '£', name: 'British Pound', enabled: true },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', enabled: true },
];

const DEFAULT_RATES: CurrencyRate[] = [
  { code: 'AED', rate: 1, date: new Date().toISOString().slice(0, 10), source: 'Manual' },
  { code: 'USD', rate: 3.6725, date: new Date().toISOString().slice(0, 10), source: 'Manual' },
  { code: 'EUR', rate: 4.00, date: new Date().toISOString().slice(0, 10), source: 'Manual' },
  { code: 'GBP', rate: 4.55, date: new Date().toISOString().slice(0, 10), source: 'Manual' },
  { code: 'INR', rate: 0.044, date: new Date().toISOString().slice(0, 10), source: 'Manual' },
];

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [baseCurrency, setBaseCurrencyState] = useState<string>('AED');
  const [currencies, setCurrenciesState] = useState<Currency[]>(DEFAULT_CURRENCIES);
  const [rates, setRatesState] = useState<CurrencyRate[]>(DEFAULT_RATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load from Supabase on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [baseSetting, curs, rts] = await Promise.all([
          fetchSetting('baseCurrency'),
          fetchCurrenciesDb(),
          fetchCurrencyRatesDb(),
        ]);
        if (cancelled) return;
        if (baseSetting) setBaseCurrencyState(baseSetting);
        if (curs !== null && curs.length > 0) setCurrenciesState(curs);
        else {
          // Seed defaults
          setCurrenciesState(DEFAULT_CURRENCIES);
          upsertCurrenciesDb(DEFAULT_CURRENCIES).catch(() => {});
        }
        if (rts !== null && rts.length > 0) setRatesState(rts);
        else {
          setRatesState(DEFAULT_RATES);
          upsertCurrencyRatesDb(DEFAULT_RATES).catch(() => {});
        }
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load currency data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getRate = (code: string) => {
    if (!code || code === baseCurrency) return 1;
    const r = rates.find(r => r.code === code);
    return r?.rate || 1;
  };

  const setBaseCurrency = (code: string) => {
    setBaseCurrencyState(code);
    saveSetting('baseCurrency', code).catch(() => {});
  };

  const setCurrencies: React.Dispatch<React.SetStateAction<Currency[]>> = (action) => {
    setCurrenciesState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      upsertCurrenciesDb(next).catch(() => {});
      return next;
    });
  };

  const setRates: React.Dispatch<React.SetStateAction<CurrencyRate[]>> = (action) => {
    setRatesState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      upsertCurrencyRatesDb(next).catch(() => {});
      return next;
    });
  };

  const convert = (amount: number, from: string, to?: string) => {
    const target = to || baseCurrency;
    if (from === target) return amount;
    const amountInBase = from === baseCurrency ? amount : amount * getRate(from);
    if (target === baseCurrency) return amountInBase;
    const rateToTarget = 1 / getRate(target);
    return amountInBase * rateToTarget;
  };

  const value = useMemo(() => ({ baseCurrency, setBaseCurrency, currencies, setCurrencies, rates, setRates, getRate, convert, loading, error }), [baseCurrency, currencies, rates, loading, error]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
};
