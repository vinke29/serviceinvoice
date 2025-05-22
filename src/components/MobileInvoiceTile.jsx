import React, { useRef, useState } from 'react';
import { CheckIcon, ChevronRightIcon, BellIcon, ExclamationTriangleIcon, Pencil2Icon, TrashIcon, ClipboardIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { pdfService } from '../services/pdfService';
import { storage, auth } from '../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-hot-toast';
import DeleteInvoiceModal from './DeleteInvoiceModal';

function getInitials(name) {
  if (!name) return '';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function MobileInvoiceTile({ invoice, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onSendReminder, onSendEscalation }) {
  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const isPaid = invoice.status && invoice.status.toLowerCase() === 'paid';
  const statusColor = isPaid
    ? 'bg-green-100 text-green-700'
    : invoice.status && invoice.status.toLowerCase() === 'overdue'
      ? 'bg-red-100 text-red-700'
      : 'bg-orange-50 text-orange-600';
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleTileClick() {
    setExpanded(v => !v);
    setShowActions(true);
  }

  // Helper to generate/upload PDF and get URL
  const getOrCreatePdfUrl = async () => {
    if (pdfUrl) return pdfUrl;
    setPdfLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const userId = user.uid;
      const invoiceId = invoice.id;
      const fileRef = storageRef(storage, `invoices/${userId}/${invoiceId}.pdf`);
      try {
        // Try to get existing URL
        const url = await getDownloadURL(fileRef);
        setPdfUrl(url);
        return url;
      } catch (e) {
        // If not found, generate and upload
        const pdfBlob = await pdfService.generateInvoicePdf(invoice);
        await uploadBytes(fileRef, pdfBlob, { contentType: 'application/pdf' });
        const url = await getDownloadURL(fileRef);
        setPdfUrl(url);
        return url;
      }
    } catch (err) {
      toast.error('Failed to generate or fetch PDF.');
      return null;
    } finally {
      setPdfLoading(false);
    }
  };

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
            <button
              className="w-full py-3 mb-2 rounded-lg bg-red-50 text-red-700 font-semibold text-base flex items-center justify-center gap-2"
              onClick={() => {
                setShowActions(false);
                setIsDeleteModalOpen(true);
              }}
            >
              <TrashIcon className="w-5 h-5" /> Delete
            </button>
            <button className="w-full py-3 mb-2 rounded-lg bg-yellow-50 text-yellow-700 font-semibold text-base flex items-center justify-center gap-2" onClick={() => { setShowActions(false); onSendReminder(); }}>
              <BellIcon className="w-5 h-5" /> Send Reminder
            </button>
            <button className="w-full py-3 mb-2 rounded-lg bg-purple-50 text-purple-700 font-semibold text-base flex items-center justify-center gap-2" onClick={() => { setShowActions(false); onSendEscalation(); }}>
              <ExclamationTriangleIcon className="w-5 h-5" /> Send Escalation
            </button>
            {/* PDF Actions Section */}
            <div className="mt-4 mb-2 text-sm font-semibold text-secondary-700">PDF</div>
            <button
              className="w-full py-3 mb-2 rounded-lg bg-primary-50 text-primary-700 font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-60"
              disabled={pdfLoading}
              onClick={async () => {
                const url = await getOrCreatePdfUrl();
                if (url) {
                  setPdfLoading(true);
                  try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Failed to fetch PDF');
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = `${invoice?.invoiceNumber || 'invoice'}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                  } catch (err) {
                    toast.error('Failed to download PDF.');
                  } finally {
                    setPdfLoading(false);
                  }
                }
              }}
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
              Download PDF {pdfLoading && <span className="ml-2 animate-spin">⏳</span>}
            </button>
            <button
              className="w-full py-3 mb-2 rounded-lg bg-primary-50 text-primary-700 font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-60"
              disabled={pdfLoading}
              onClick={async () => {
                const url = await getOrCreatePdfUrl();
                if (url) {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  toast.success('PDF link copied!');
                  setTimeout(() => setCopied(false), 1500);
                }
              }}
            >
              <ClipboardIcon className="h-5 w-5 mr-2" />
              {copied ? 'Copied!' : 'Copy PDF Link'}
            </button>
            <button
              className="w-full py-3 mb-2 rounded-lg bg-primary-50 text-primary-700 font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-60"
              disabled={pdfLoading}
              onClick={async () => {
                const url = await getOrCreatePdfUrl();
                if (url) window.open(url, '_blank', 'noopener');
              }}
            >
              <ExternalLinkIcon className="h-5 w-5 mr-2" />
              Open PDF
            </button>
            <button className="w-full py-3 mt-2 rounded-lg bg-secondary-100 text-secondary-700 font-semibold text-base" onClick={() => setShowActions(false)}>Cancel</button>
          </div>
        </div>
      )}
      {/* Delete Invoice Modal */}
      <DeleteInvoiceModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={(options) => {
          onDelete(options);
          setIsDeleteModalOpen(false);
        }}
        invoice={invoice}
        clientName={invoice?.clientName}
      />
    </>
  );
}

export default MobileInvoiceTile; 