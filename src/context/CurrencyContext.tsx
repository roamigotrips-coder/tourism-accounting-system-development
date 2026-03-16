import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Currency = {
  code: string; // e.g., AED, USD, EUR
  symbol: string; // e.g., د.إ, $
  name: string; // e.g., UAE Dirham
  enabled: boolean;
};

export type CurrencyRate = {
  code: string; // currency code
  rate: number; // 1 unit of code equals how many base currency units
  date: string; // last updated
  source?: string;
};

export type RevaluationDraftLine = {
  id: string;
  accountCode: string;
  accountName: string;
  currency: string;
  foreignBalance: number; // balance in foreign currency
  oldRate: number; // previous rate
  newRate: number; // new rate
  baseOld: number; // foreignBalance * oldRate
  baseNew: number; // foreignBalance * newRate
  difference: number; // baseNew - baseOld (positive = gain, negative = loss)
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
  const [baseCurrency, setBaseCurrencyState] = useState<string>(() => localStorage.getItem('baseCurrency') || 'AED');
  const [currencies, setCurrencies] = useState<Currency[]>(() => {
    const saved = localStorage.getItem('currencies');
    return saved ? JSON.parse(saved) : DEFAULT_CURRENCIES;
  });
  const [rates, setRates] = useState<CurrencyRate[]>(() => {
    const saved = localStorage.getItem('currencyRates');
    return saved ? JSON.parse(saved) : DEFAULT_RATES;
  });

  useEffect(() => {
    localStorage.setItem('baseCurrency', baseCurrency);
  }, [baseCurrency]);

  useEffect(() => {
    localStorage.setItem('currencies', JSON.stringify(currencies));
  }, [currencies]);

  useEffect(() => {
    localStorage.setItem('currencyRates', JSON.stringify(rates));
  }, [rates]);

  const getRate = (code: string) => {
    if (!code || code === baseCurrency) return 1;
    const r = rates.find(r => r.code === code);
    return r?.rate || 1;
  };

  const setBaseCurrency = (code: string) => {
    setBaseCurrencyState(code);
  };

  const convert = (amount: number, from: string, to?: string) => {
    const target = to || baseCurrency;
    if (from === target) return amount;
    // Convert from -> base
    const amountInBase = from === baseCurrency ? amount : amount * getRate(from);
    if (target === baseCurrency) return amountInBase;
    // Base -> target
    const rateToTarget = 1 / getRate(target);
    return amountInBase * rateToTarget;
  };

  const value = useMemo(() => ({ baseCurrency, setBaseCurrency, currencies, setCurrencies, rates, setRates, getRate, convert }), [baseCurrency, currencies, rates]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
};
