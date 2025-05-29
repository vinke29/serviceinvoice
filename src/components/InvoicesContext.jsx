import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getInvoices } from '../firebaseData';
import { auth } from '../firebase';

const InvoicesContext = createContext();

export function InvoicesProvider({ children }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshInvoices = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      setLoading(true);
      const data = await getInvoices(user.uid);
      setInvoices(data);
      setLoading(false);
    } else {
      setInvoices([]);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshInvoices();
  }, [refreshInvoices]);

  return (
    <InvoicesContext.Provider value={{ invoices, setInvoices, refreshInvoices, loading }}>
      {children}
    </InvoicesContext.Provider>
  );
}

export function useInvoices() {
  return useContext(InvoicesContext);
} 