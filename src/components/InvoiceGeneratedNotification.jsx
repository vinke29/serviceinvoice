import { useEffect } from 'react';
import { showToast } from '../utils/toast.jsx'; // Ensure this path is correct

// Event bus for the invoice generation notifications
export const InvoiceGenerationEvents = {
  // Subscribe to invoice generation events
  subscribe: (callback) => {
    window.addEventListener('invoice-generated', callback);
    // Return the cleanup function directly
    return () => window.removeEventListener('invoice-generated', callback);
  },
  
  // Emit invoice generation event with invoice data
  notify: (invoiceData) => {
    window.dispatchEvent(new CustomEvent('invoice-generated', { detail: invoiceData }));
  }
};

export default function InvoiceGeneratedNotification() {
  useEffect(() => {
    const handleInvoiceGenerated = (event) => {
      const { invoice } = event.detail;
      const message = `Invoice #${invoice?.invoiceNumber} has been created successfully.`;
      // Use the showToast utility for consistency
      showToast('success', message);
    };

    const unsubscribe = InvoiceGenerationEvents.subscribe(handleInvoiceGenerated);
    
    return unsubscribe;
  }, []);
  
  return null;
} 