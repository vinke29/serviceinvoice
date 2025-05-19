import React from 'react';
import PropTypes from 'prop-types';

const StatusChangeConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  clientName, 
  action, 
  scheduledInvoicesCount 
}) => {
  // Early return if not open
  if (!isOpen) return null;

  // Set title and message based on action type
  const getContent = () => {
    const actionText = action === 'cancel' ? 'canceled' : 'placed on hold';
    const title = action === 'cancel' 
      ? 'Cancel Client Account' 
      : 'Place Client Account On Hold';

    let message;
    if (scheduledInvoicesCount === 0) {
      message = (
        <>
          <p className="mb-4">
            <span className="font-medium">{clientName}</span> will be {actionText}.
          </p>
          <p className="mb-2">
            No scheduled invoices were found for this client.
          </p>
          <p className="text-amber-700 bg-amber-50 p-3 rounded-md text-sm">
            Note: Any active invoices will remain in your system and must be canceled manually if needed.
          </p>
        </>
      );
    } else {
      message = (
        <>
          <p className="mb-4">
            <span className="font-medium">{clientName}</span> will be {actionText}.
          </p>
          <p className="mb-2">
            {scheduledInvoicesCount} scheduled invoice{scheduledInvoicesCount === 1 ? '' : 's'} will be removed from the queue.
          </p>
          <p className="text-amber-700 bg-amber-50 p-3 rounded-md text-sm">
            Note: Any active invoices will remain in your system and must be canceled manually if needed.
          </p>
        </>
      );
    }
    return { title, message };
  };

  const { title, message } = getContent();

  const handleOverlayClick = (e) => {
    // Close only if clicking the overlay, not the modal content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlayClick}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            {title}
          </h3>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4">
          {message}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              action === 'cancel' 
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                : 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

StatusChangeConfirmModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  clientName: PropTypes.string.isRequired,
  action: PropTypes.oneOf(['cancel', 'hold']).isRequired,
  scheduledInvoicesCount: PropTypes.number.isRequired
};

export default StatusChangeConfirmModal; 