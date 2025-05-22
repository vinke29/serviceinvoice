import React, { useState, useEffect } from 'react'
import Drawer from './Drawer'
import { getAgentConfig, getClient } from '../firebaseData'
import { auth, db } from '../firebase'
import { pdfService } from '../services/pdfService'
import { doc, getDoc } from 'firebase/firestore'
import { format } from 'date-fns'
import { functions, httpsCallable } from '../firebase'
import { ClipboardIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { toast } from 'react-hot-toast';
import { storage } from '../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const sendInvoiceReminder = httpsCallable(functions, 'sendInvoiceReminder')

function InvoiceDetailsDrawer({ isOpen, onClose, invoice, onEditInvoice }) {
  const [tab, setTab] = useState('details')
  const [agentConfig, setAgentConfig] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [client, setClient] = useState(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [currentInvoice, setCurrentInvoice] = useState(invoice)
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTab('details')
    setCurrentInvoice(invoice)
  }, [invoice])

  useEffect(() => {
    if (tab === 'activity' && invoice?.id && auth.currentUser) {
      const fetchLatestInvoice = async () => {
        const invoiceRef = doc(db, 'users', auth.currentUser.uid, 'invoices', invoice.id);
        const invoiceSnap = await getDoc(invoiceRef);
        if (invoiceSnap.exists()) {
          setCurrentInvoice({ ...invoiceSnap.data(), id: invoice.id });
        }
      };
      fetchLatestInvoice();
    }
  }, [tab, invoice])

  // Load agent config and user profile on mount
  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser
      if (user) {
        // Get agent config
        const config = await getAgentConfig(user.uid)
        setAgentConfig(config || { netDays: 0 }) // Default to 0 days if not set
        
        // Get user profile
        try {
          const userDocRef = doc(db, 'users', user.uid)
          const userDoc = await getDoc(userDocRef)
          if (userDoc.exists()) {
            const userData = userDoc.data()
            console.log('Loaded user profile data:', JSON.stringify({
              ...userData,
              logo: userData.logo ? 'Logo exists (not showing full string)' : 'No logo'
            }, null, 2))
            setUserProfile(userData)
          } else {
            console.log('User profile document exists but no data found')
          }
        } catch (error) {
          console.error('Error loading user profile:', error)
        }
      }
    }
    fetchData()
  }, [])

  // Fetch client data when invoice changes
  useEffect(() => {
    const fetchClientData = async () => {
      if (invoice?.clientId && auth.currentUser) {
        try {
          const clientData = await getClient(auth.currentUser.uid, invoice.clientId)
          setClient(clientData)
        } catch (error) {
          console.error('Error fetching client data:', error)
        }
      }
    }
    
    if (invoice) {
      fetchClientData()
    }
  }, [invoice])

  // Clean up Blob URL when drawer closes
  useEffect(() => {
    if (!isOpen && pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  }, [isOpen]);

  // When details tab is opened, generate/upload PDF immediately
  useEffect(() => {
    if (tab === 'details' && isOpen && invoice && auth.currentUser) {
      setPdfUrl(null);
      setPdfUploading(true);
      (async () => {
        try {
          let mergedConfig = { ...agentConfig };
          if (userProfile) {
            mergedConfig = {
              ...mergedConfig,
              companyName: userProfile.companyName || '',
              email: userProfile.email || '',
              phone: userProfile.phone || '',
              address: userProfile.address || '',
              street: userProfile.street || userProfile.address || '',
              city: userProfile.city || '',
              state: userProfile.state || '',
              zip: userProfile.zip || '',
              postalCode: userProfile.postalCode || userProfile.zip || '',
              country: userProfile.country || '',
              website: userProfile.website || '',
              taxId: userProfile.taxId || '',
              paymentInstructions: userProfile.paymentInstructions || '',
              logo: userProfile.logo || null
            };
          }
          const pdfBlob = await pdfService.generateInvoicePdf(invoice, client, mergedConfig);
          const userId = auth.currentUser.uid;
          const invoiceId = invoice.id;
          const fileRef = storageRef(storage, `invoices/${userId}/${invoiceId}.pdf`);
          await uploadBytes(fileRef, pdfBlob, { contentType: 'application/pdf' });
          const url = await getDownloadURL(fileRef);
          setPdfUrl(url);
        } catch (error) {
          toast.error('Failed to generate or upload PDF.');
          setPdfUrl(null);
        } finally {
          setPdfUploading(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isOpen, invoice, auth.currentUser, agentConfig, userProfile, client]);

  if (!currentInvoice) return null

  // Format the invoice number
  const displayInvoiceNumber = currentInvoice.invoiceNumber || `INV-${currentInvoice.id.substring(0, 4).toUpperCase()}`

  // Download PDF (fetch as Blob and trigger download)
  const handleDownloadPdf = async () => {
    if (!pdfUrl) return;
    try {
      const response = await fetch(pdfUrl);
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
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`Invoice: ${displayInvoiceNumber}`}>
      {/* Tab Bar */}
      <div className="flex border-b border-secondary-200 mb-4">
        <button
          className={`px-4 py-2 font-medium ${tab === 'details' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-secondary-600'}`}
          onClick={() => setTab('details')}
        >
          Details
        </button>
        <button
          className={`px-4 py-2 font-medium ${tab === 'payments' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-secondary-600'}`}
          onClick={() => setTab('payments')}
        >
          Payments
        </button>
        <button
          className={`px-4 py-2 font-medium ${tab === 'activity' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-secondary-600'}`}
          onClick={() => setTab('activity')}
        >
          Activity
        </button>
      </div>
      <div className="space-y-8">
        {tab === 'details' && (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="rounded-xl bg-white shadow border border-secondary-100 p-6 flex flex-col md:flex-row md:items-center md:justify-between mb-2">
              <div>
                <div className="text-2xl font-bold text-secondary-900 mb-1">Invoice #{displayInvoiceNumber}</div>
                <div className="text-secondary-700 text-base mb-1">Client: <span className="font-semibold">{currentInvoice.clientName}</span></div>
                <div className="text-secondary-600 text-lg font-bold">${currentInvoice.amount}</div>
              </div>
              <div className="flex items-center mt-4 md:mt-0">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${currentInvoice.status === 'paid' ? 'bg-green-100 text-green-800' : currentInvoice.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{currentInvoice.status.charAt(0).toUpperCase() + currentInvoice.status.slice(1)}</span>
              </div>
            </div>
            {/* Dates Card */}
            <div className="rounded-xl bg-white shadow border border-secondary-100 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-secondary-500 font-semibold mb-1">Invoice Date</div>
                <div className="text-secondary-900">{new Date(currentInvoice.date || currentInvoice.createdAt).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-xs text-secondary-500 font-semibold mb-1">Due Date</div>
                <div className="text-secondary-900">{new Date(currentInvoice.dueDate).toLocaleDateString()} {agentConfig && <span className="text-xs text-secondary-500 ml-1">(Net {agentConfig.netDays} days)</span>}</div>
              </div>
              <div>
                <div className="text-xs text-secondary-500 font-semibold mb-1">Paid Date</div>
                <div className="text-secondary-900">{currentInvoice.paidAt ? format(new Date(currentInvoice.paidAt), 'PPP') : '--'}</div>
              </div>
            </div>
            {/* Billing Card */}
            <div className="rounded-xl bg-white shadow border border-secondary-100 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-secondary-500 font-semibold mb-1">Billing Type</div>
                <div className="text-secondary-900">{currentInvoice.billingFrequency ? (currentInvoice.billingFrequency === 'one-time' ? 'One-Time Charge' : `Recurring (${currentInvoice.billingFrequency.charAt(0).toUpperCase() + currentInvoice.billingFrequency.slice(1)})`) : 'Not specified'}</div>
              </div>
              <div>
                <div className="text-xs text-secondary-500 font-semibold mb-1">Description</div>
                <div className="text-secondary-900">{currentInvoice.description}</div>
              </div>
            </div>
            {/* PDF Actions & Edit Invoice Card */}
            <div className="rounded-xl bg-white shadow border border-secondary-100 p-4 flex flex-col gap-4">
              <div className="font-semibold text-secondary-900 mb-2">Invoice PDF</div>
              {pdfUploading ? (
                <div className="flex flex-col items-center justify-center min-h-[56px]">
                  <Spinner />
                  <span className="text-xs text-secondary-500 mt-2">Generating PDF…</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0 w-full">
                  {/* Download PDF */}
                  <button
                    onClick={handleDownloadPdf}
                    disabled={!pdfUrl}
                    className={`flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${pdfUrl ? 'bg-primary-600 hover:bg-primary-700' : 'bg-secondary-200 cursor-not-allowed'} transition`}
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                    Download
                  </button>
                  {/* Copy Link */}
                  <button
                    onClick={async () => {
                      if (pdfUrl) {
                        await navigator.clipboard.writeText(pdfUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }
                    }}
                    disabled={!pdfUrl}
                    className={`flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm ${pdfUrl ? 'text-primary-700 bg-primary-50 hover:bg-primary-100' : 'text-secondary-400 bg-secondary-100 cursor-not-allowed'} transition`}
                  >
                    <ClipboardIcon className="h-4 w-4 mr-2" />
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                  {/* Open in New Tab */}
                  <button
                    onClick={() => {
                      if (pdfUrl) window.open(pdfUrl, '_blank', 'noopener');
                    }}
                    disabled={!pdfUrl}
                    className={`flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm ${pdfUrl ? 'text-primary-700 bg-primary-50 hover:bg-primary-100' : 'text-secondary-400 bg-secondary-100 cursor-not-allowed'} transition`}
                  >
                    <ExternalLinkIcon className="h-4 w-4 mr-2" />
                    Open
                  </button>
                </div>
              )}
              {/* Edit Invoice Button */}
              <button
                onClick={onEditInvoice}
                className="mt-6 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 transition"
              >
                Edit Invoice
              </button>
            </div>
          </div>
        )}
        {tab === 'payments' && (
          <div className="text-secondary-600">
            {currentInvoice.paidAt ? (
              <div className="mb-2">
                <span className="font-medium text-secondary-900">Paid on:</span> {format(new Date(currentInvoice.paidAt), 'PPP')}
              </div>
            ) : (
              <div>No payments recorded for this invoice yet.</div>
            )}
          </div>
        )}
        {tab === 'activity' && (
          <div className="text-secondary-600">
            {currentInvoice.activity && currentInvoice.activity.length > 0 ? (
              (() => {
                // Deduplicate only exact duplicate objects
                const uniqueActivity = [];
                const seen = new Set();
                currentInvoice.activity
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .forEach(event => {
                    const key = JSON.stringify(event);
                    if (!seen.has(key)) {
                      uniqueActivity.push(event);
                      seen.add(key);
                    }
                  });
                return (
                  <ul className="space-y-2">
                    {uniqueActivity.map((event, idx) => {
                      let label = event.stage;
                      if (event.type === 'reminder_sent') {
                        const reminderNum = uniqueActivity
                          .filter(e => e.type === 'reminder_sent' && new Date(e.date) <= new Date(event.date)).length;
                        label = `${reminderNum === 1 ? '1st' : reminderNum === 2 ? '2nd' : reminderNum === 3 ? '3rd' : reminderNum + 'th'} Reminder Sent`;
                      }
                      if (!label) return null;
                      return (
                        <li key={idx} className="flex items-center space-x-2">
                          <span className="font-medium text-secondary-800">{label}</span>
                          <span className="text-xs text-secondary-500">{new Date(event.date).toLocaleString()}</span>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()
            ) : (
              <div>No activity recorded for this invoice yet.</div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

export default InvoiceDetailsDrawer 