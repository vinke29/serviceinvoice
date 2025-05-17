import React, { useState } from 'react';
import StatusChangeConfirmModal from './StatusChangeConfirmModal';
import { showToast } from '../utils/toast.jsx';

const StatusChangeModalDemo = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState('cancel');
  const [scheduledInvoices, setScheduledInvoices] = useState(3);

  const openModal = (action) => {
    setCurrentAction(action);
    setIsModalOpen(true);
  };

  const handleConfirm = () => {
    // Simulate the action and show a toast notification
    const actionText = currentAction === 'cancel' ? 'canceled' : 'put on hold';
    let message = `Client "ACME Corp" has been ${actionText}.`;
    if (scheduledInvoices === 1) {
      message += ' 1 scheduled invoice will be removed from the queue.';
    } else if (scheduledInvoices > 1) {
      message += ` ${scheduledInvoices} scheduled invoices will be removed from the queue.`;
    }
    showToast('info', message);
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-6">Status Change Modal Demo</h2>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Scheduled Invoices Count:
        </label>
        <input
          type="number"
          min="0"
          max="20"
          value={scheduledInvoices}
          onChange={(e) => setScheduledInvoices(parseInt(e.target.value, 10))}
          className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      
      <div className="flex space-x-4">
        <button
          onClick={() => openModal('cancel')}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Cancel Account
        </button>
        
        <button
          onClick={() => openModal('hold')}
          className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
        >
          Place Account On Hold
        </button>
      </div>
      
      <StatusChangeConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirm}
        clientName="ACME Corp"
        action={currentAction}
        scheduledInvoicesCount={scheduledInvoices}
      />
    </div>
  );
};

export default StatusChangeModalDemo; 