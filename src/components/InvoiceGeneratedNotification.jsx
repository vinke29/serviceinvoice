import { useState, useEffect } from 'react';

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
  const [notifications, setNotifications] = useState([]);
  
  useEffect(() => {
    // Subscribe to invoice generation events
    const unsubscribe = InvoiceGenerationEvents.subscribe((event) => {
      const { invoice, client } = event.detail;
      
      // Add the notification to the list with a unique ID
      setNotifications(prev => [...prev, {
        id: Date.now(),
        invoice,
        client,
        timestamp: new Date()
      }]);
      
      // Automatically remove notifications after 10 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== event.id));
      }, 10000);
    });
    
    // Clean up the subscription when the component unmounts
    return unsubscribe;
  }, []);
  
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  if (notifications.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {notifications.map(notification => (
        <div 
          key={notification.id} 
          className="bg-white shadow-lg rounded-lg p-4 border-l-4 border-primary-500 flex items-start gap-3 animate-slideIn"
        >
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-grow">
            <div className="font-medium text-secondary-900">Invoice Generated</div>
            <p className="text-sm text-secondary-600">
              Invoice #{notification.invoice?.invoiceNumber} for {notification.client?.name} 
              has been generated and sent.
            </p>
            <p className="text-xs text-secondary-500 mt-1">
              {notification.timestamp.toLocaleTimeString()}
            </p>
          </div>
          <button 
            onClick={() => removeNotification(notification.id)}
            className="flex-shrink-0 text-secondary-400 hover:text-secondary-600"
          >
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
} 