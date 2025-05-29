import React, { useState } from 'react';
import PropTypes from 'prop-types';

const ActiveInvoiceUpdateModal = ({
  isOpen,
  onClose,
  onConfirm,
  invoiceNumber,
  clientName,
  originalValues,
  newValues,
  futureInvoicesCount
}) => {
  const [options, setOptions] = useState({
    notifyClient: true,
    updateFutureInvoices: false
  });
  
  if (!isOpen) return null;
  
  // Calculate what fields have changed
  const changes = [];
  if (originalValues.amount !== newValues.amount) {
    changes.push({
      field: 'Amount',
      from: `$${originalValues.amount}`,
      to: `$${newValues.amount}`
    });
  }
  if (originalValues.description !== newValues.description) {
    changes.push({
      field: 'Description',
      from: originalValues.description,
      to: newValues.description
    });
  }
  if (originalValues.dueDate !== newValues.dueDate) {
    changes.push({
      field: 'Due Date',
      from: originalValues.dueDate,
      to: newValues.dueDate
    });
  }
  if (originalValues.billingFrequency !== newValues.billingFrequency) {
    changes.push({
      field: 'Billing Frequency',
      from: originalValues.billingFrequency,
      to: newValues.billingFrequency
    });
  }
  
  const hasRecurringFutureInvoices = futureInvoicesCount > 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 m-0" onClick={e => { 
      console.log('Backdrop clicked'); 
      if (e.target === e.currentTarget) onClose(); 
    }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-fade-in" onClick={e => {
        console.log('Modal content clicked');
        e.stopPropagation();
      }}>
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-gray-800">Update Invoice #{invoiceNumber}</h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <p className="mb-2">You are updating an <span className="font-medium text-orange-600">active invoice</span> for <span className="font-medium">{clientName}</span>.</p>
          
          {/* List of changes */}
          <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
            <h4 className="font-medium mb-2">Changes:</h4>
            {changes.length > 0 ? (
              <ul className="space-y-1">
                {changes.map((change, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{change.field}:</span>{' '}
                    <span className="line-through text-red-600">{change.from}</span>{' → '}
                    <span className="text-green-600">{change.to}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No changes detected</p>
            )}
          </div>
          
          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="notifyClient" 
                checked={options.notifyClient} 
                onChange={() => setOptions({...options, notifyClient: !options.notifyClient})}
                className="rounded text-primary-600 focus:ring-primary-500 w-5 h-5"
              />
              <label htmlFor="notifyClient" className="text-sm">
                Send notification email to client with updated invoice
              </label>
            </div>
            
            {hasRecurringFutureInvoices && (
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="updateFutureInvoices" 
                  checked={options.updateFutureInvoices} 
                  onChange={() => setOptions({...options, updateFutureInvoices: !options.updateFutureInvoices})}
                  className="rounded text-primary-600 focus:ring-primary-500 w-5 h-5"
                />
                <label htmlFor="updateFutureInvoices" className="text-sm">
                  Update {futureInvoicesCount} future scheduled invoices with these changes
                </label>
              </div>
            )}
          </div>
          
          <p className="text-amber-700 bg-amber-50 p-3 rounded-md text-sm">
            <strong>Note:</strong> Client will receive a notification email with the updated invoice PDF attached.
          </p>
        </div>
        <div className="px-6 py-3 bg-gray-50 flex justify-end space-x-3 sticky bottom-0">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(options)} 
            className="px-4 py-2 text-sm font-medium text-white rounded-md bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Confirm Update
          </button>
        </div>
      </div>
    </div>
  );
};

ActiveInvoiceUpdateModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  invoiceNumber: PropTypes.string.isRequired,
  clientName: PropTypes.string.isRequired,
  originalValues: PropTypes.shape({
    amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    description: PropTypes.string,
    dueDate: PropTypes.string,
    billingFrequency: PropTypes.string
  }).isRequired,
  newValues: PropTypes.shape({
    amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    description: PropTypes.string,
    dueDate: PropTypes.string,
    billingFrequency: PropTypes.string
  }).isRequired,
  futureInvoicesCount: PropTypes.number
};

ActiveInvoiceUpdateModal.defaultProps = {
  futureInvoicesCount: 0
};

export default ActiveInvoiceUpdateModal; 