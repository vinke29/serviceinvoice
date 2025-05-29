import React, { useState } from 'react';

function DeleteInvoiceModal({
  isOpen,
  onClose,
  onConfirm,
  invoice,
  futureInvoicesCount = 0,
  isRecurring = false,
  isScheduled = false,
  clientName = ''
}) {
  const [scope, setScope] = useState('single');
  const [notifyClient, setNotifyClient] = useState(false);

  if (!isOpen || !invoice) return null;

  const isFutureOption = (isRecurring || isScheduled) && futureInvoicesCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold text-secondary-900 mb-2">Delete Invoice</h3>
        <p className="text-secondary-700 mb-4">
          {isFutureOption ? (
            <>
              This invoice is part of a recurring or scheduled series.<br />
              Do you want to delete <b>just this invoice</b> or <b>this and all future scheduled invoices</b> for this service?
            </>
          ) : (
            <>Are you sure you want to delete this invoice?</>
          )}
        </p>
        {isFutureOption && (
          <div className="mb-4">
            <label className="flex items-center mb-2">
              <input
                type="radio"
                name="delete-scope"
                value="single"
                checked={scope === 'single'}
                onChange={() => setScope('single')}
                className="mr-2"
              />
              <span>Delete</span>&nbsp;<b>just this invoice</b>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="delete-scope"
                value="future"
                checked={scope === 'future'}
                onChange={() => setScope('future')}
                className="mr-2"
              />
              <span>Delete</span>&nbsp;<b>this and {futureInvoicesCount} future scheduled invoice{futureInvoicesCount === 1 ? '' : 's'}</b>
            </label>
          </div>
        )}
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={notifyClient}
              onChange={e => setNotifyClient(e.target.checked)}
              className="mr-2"
            />
            Notify client{clientName ? ` (${clientName})` : ''} about this deletion
          </label>
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          <button
            className="px-4 py-2 rounded-lg bg-secondary-100 text-secondary-700 hover:bg-secondary-200"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            onClick={() => onConfirm({ scope, notifyClient })}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteInvoiceModal; 