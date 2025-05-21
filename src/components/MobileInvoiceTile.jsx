import React, { useRef, useState } from 'react';
import { CheckIcon, ChevronRightIcon, BellIcon, ExclamationTriangleIcon, Pencil2Icon, TrashIcon } from '@radix-ui/react-icons';

function getInitials(name) {
  if (!name) return '';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function MobileInvoiceTile({ invoice, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onSendReminder, onSendEscalation }) {
  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const isPaid = invoice.status && invoice.status.toLowerCase() === 'paid';
  const statusColor = isPaid
    ? 'bg-green-100 text-green-700'
    : invoice.status && invoice.status.toLowerCase() === 'overdue'
      ? 'bg-red-100 text-red-700'
      : 'bg-orange-50 text-orange-600';

  function handleTileClick() {
    setExpanded(v => !v);
    setShowActions(true);
  }

  return (
    <>
      <div
        className={`relative bg-white/70 backdrop-blur-md shadow-md mb-5 px-4 py-3 rounded-2xl transition-all duration-300 ${expanded ? 'shadow-lg' : ''}`}
        style={{ overflow: 'hidden', border: '1px solid rgba(200,200,200,0.15)' }}
        onClick={handleTileClick}
      >
        {/* Main row */}
        <div className="flex items-center justify-between gap-2">
          {/* Avatar/Initials */}
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center text-base font-bold text-primary-700 mr-2 shadow-sm">
            {getInitials(invoice.clientName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base text-secondary-900 truncate">{invoice.clientName}</div>
            {invoice.description && <div className="text-xs text-secondary-400 italic truncate mt-0.5">{invoice.description}</div>}
          </div>
          <div className="flex flex-col items-end ml-2">
            <div className={`font-bold text-lg ${isPaid ? 'text-green-600' : invoice.status === 'overdue' ? 'text-red-600' : 'text-orange-600'}`}>${invoice.amount}</div>
            <div className={`mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>{invoice.status}</div>
          </div>
          <ChevronRightIcon className={`ml-2 w-5 h-5 text-secondary-200 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
        {/* Dates, only show on expand */}
        <div className={`flex items-center justify-between text-xs text-secondary-400 mt-2 transition-all duration-300 ${expanded ? 'opacity-100' : 'opacity-0 h-0'}`}
          style={{ height: expanded ? 'auto' : 0 }}>
          <div>Invoice: <span className="text-secondary-700 font-medium">{invoice.date}</span></div>
          <div>Due: <span className="text-secondary-700 font-medium">{invoice.dueDate}</span></div>
        </div>
      </div>
      {/* Actions Modal */}
      {showActions && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-40" onClick={() => setShowActions(false)}>
          <div className="bg-white rounded-t-2xl shadow-xl w-full max-w-md mx-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-bold mb-4">Actions</div>
            <button className="w-full py-3 mb-2 rounded-lg bg-green-50 text-green-700 font-semibold text-base flex items-center justify-center gap-2" onClick={() => { setShowActions(false); isPaid ? onMarkUnpaid() : onMarkPaid(); }}>
              <CheckIcon className="w-5 h-5" /> {isPaid ? 'Mark Unpaid' : 'Mark Paid'}
            </button>
            <button className="w-full py-3 mb-2 rounded-lg bg-blue-50 text-blue-700 font-semibold text-base flex items-center justify-center gap-2" onClick={() => { setShowActions(false); onEdit(); }}>
              <Pencil2Icon className="w-5 h-5" /> Edit
            </button>
            <button className="w-full py-3 mb-2 rounded-lg bg-red-50 text-red-700 font-semibold text-base flex items-center justify-center gap-2" onClick={() => { setShowActions(false); onDelete(); }}>
              <TrashIcon className="w-5 h-5" /> Delete
            </button>
            <button className="w-full py-3 mb-2 rounded-lg bg-yellow-50 text-yellow-700 font-semibold text-base flex items-center justify-center gap-2" onClick={() => { setShowActions(false); onSendReminder(); }}>
              <BellIcon className="w-5 h-5" /> Send Reminder
            </button>
            <button className="w-full py-3 mb-2 rounded-lg bg-purple-50 text-purple-700 font-semibold text-base flex items-center justify-center gap-2" onClick={() => { setShowActions(false); onSendEscalation(); }}>
              <ExclamationTriangleIcon className="w-5 h-5" /> Send Escalation
            </button>
            <button className="w-full py-3 mt-2 rounded-lg bg-secondary-100 text-secondary-700 font-semibold text-base" onClick={() => setShowActions(false)}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileInvoiceTile; 