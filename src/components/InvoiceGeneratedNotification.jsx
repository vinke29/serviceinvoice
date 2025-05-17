import { useEffect } from 'react';
import { showToast } from '../utils/toast.jsx';

// Event bus for the invoice generation notifications
export const InvoiceGenerationEvents = {
  // Subscribe to invoice generation events
  subscribe: (callback) => {
    window.addEventListener('invoice-generated', callback);
    return () => window.removeEventListener('invoice-generated', callback);
  },
  
  // Emit invoice generation event with invoice data
  notify: (invoiceData) => {
    window.dispatchEvent(new CustomEvent('invoice-generated', { detail: invoiceData }));
  }
};

export default function InvoiceGeneratedNotification() {
  useEffect(() => {
    // Subscribe to invoice generation events
    const unsubscribe = InvoiceGenerationEvents.subscribe((event) => {
      const { invoice, client } = event.detail;
      const message = `Created invoice #${invoice?.invoiceNumber} for ${client?.name}. View it in the "Upcoming Invoices" section.`;
      showToast('success', message);
    });
    // Clean up the subscription when the component unmounts
    return unsubscribe;
  }, []);
  return null;
} 