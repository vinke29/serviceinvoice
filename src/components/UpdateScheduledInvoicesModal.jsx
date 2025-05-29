import React, { useState } from 'react';
import PropTypes from 'prop-types';

const UpdateScheduledInvoicesModal = ({
  isOpen,
  onClose,
  onConfirm,
  futureCount,
  invoiceAmount,
  invoiceDate
}) => {
  const [scope, setScope] = useState('all');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Update Scheduled Invoices</h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <p className="mb-2">You are editing a scheduled invoice for <span className="font-medium">${invoiceAmount}</span> on <span className="font-medium">{invoiceDate}</span>.</p>
          <p className="mb-2">How would you like to apply this change?</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="scope" value="single" checked={scope === 'single'} onChange={() => setScope('single')} />
              <span>This invoice only</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="scope" value="all" checked={scope === 'all'} onChange={() => setScope('all')} />
              <span>This and all future scheduled invoices for this service <span className="text-xs text-secondary-500">({futureCount} will be updated)</span></span>
            </label>
          </div>
          <p className="text-amber-700 bg-amber-50 p-3 rounded-md text-sm mt-2">Note: Past and paid invoices will not be changed.</p>
        </div>
        <div className="px-6 py-3 bg-gray-50 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">Cancel</button>
          <button onClick={() => onConfirm(scope)} className="px-4 py-2 text-sm font-medium text-white rounded-md bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">Confirm</button>
        </div>
      </div>
    </div>
  );
};

UpdateScheduledInvoicesModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  futureCount: PropTypes.number.isRequired,
  invoiceAmount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  invoiceDate: PropTypes.string
};

export default UpdateScheduledInvoicesModal; 