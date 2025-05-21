import React, { useState, useEffect } from 'react'
import Drawer from './Drawer'
import { getAgentConfig, getClient } from '../firebaseData'
import { auth, db } from '../firebase'
import { pdfService } from '../services/pdfService'
import { doc, getDoc } from 'firebase/firestore'
import { format } from 'date-fns'
import { functions, httpsCallable } from '../firebase'

const sendInvoiceReminder = httpsCallable(functions, 'sendInvoiceReminder')

function InvoiceDetailsDrawer({ isOpen, onClose, invoice, onEditInvoice }) {
  const [tab, setTab] = useState('details')
  const [agentConfig, setAgentConfig] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [client, setClient] = useState(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [currentInvoice, setCurrentInvoice] = useState(invoice)

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

  const handleDownloadPdf = async () => {
    if (!invoice) return
    
    try {
      setIsGeneratingPdf(true)
      
      // Merge agent config with user profile for PDF generation
      let mergedConfig = { ...agentConfig }
      
      // Add user profile data to the config
      if (userProfile) {
        console.log('Merging user profile into PDF config')
        mergedConfig = {
          ...mergedConfig,
          companyName: userProfile.companyName || '',
          email: userProfile.email || '',
          phone: userProfile.phone || '',
          address: userProfile.address || '',
          city: userProfile.city || '',
          state: userProfile.state || '',
          zip: userProfile.zip || '', 
          country: userProfile.country || '',
          website: userProfile.website || '',
          taxId: userProfile.taxId || '',
          paymentInstructions: userProfile.paymentInstructions || '',
          logo: userProfile.logo || null
        }
      }
      
      console.log('Generating PDF with merged config:', JSON.stringify({
        ...mergedConfig,
        logo: mergedConfig.logo ? 'Logo exists (not showing full string)' : 'No logo'
      }, null, 2))
      
      // Generate the invoice PDF
      const pdfBlob = await pdfService.generateInvoicePdf(invoice, client, mergedConfig)
      
      // Create filename with invoice number
      const invoiceNumber = invoice.invoiceNumber || `INV-${invoice.id.substring(0, 4).toUpperCase()}`
      const filename = `invoice-${invoiceNumber}.pdf`
      
      // Download the PDF
      pdfService.downloadPdf(pdfBlob, filename)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  if (!currentInvoice) return null

  // Format the invoice number
  const displayInvoiceNumber = currentInvoice.invoiceNumber || `INV-${currentInvoice.id.substring(0, 4).toUpperCase()}`

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
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-lg font-semibold text-secondary-900">Invoice #{displayInvoiceNumber}</div>
              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <span className="inline-flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                ) : (
                  <span className="inline-flex items-center">
                    <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download PDF
                  </span>
                )}
              </button>
            </div>
            <div className="text-xs text-secondary-500">ID: {currentInvoice.id}</div>
            <div className="text-secondary-700">Client: {currentInvoice.clientName}</div>
            <div className="text-secondary-600 text-sm">Amount: <span className="font-bold text-secondary-900">${currentInvoice.amount}</span></div>
            <div className="text-secondary-600 text-sm">Status: <span className={`px-2 py-1 rounded-full text-xs font-bold ${currentInvoice.status === 'paid' ? 'bg-green-100 text-green-800' : currentInvoice.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{currentInvoice.status.charAt(0).toUpperCase() + currentInvoice.status.slice(1)}</span></div>
            <div className="text-secondary-600 text-sm">
              Invoice Date: {new Date(currentInvoice.date || currentInvoice.createdAt).toLocaleDateString()}
            </div>
            <div className="text-secondary-600 text-sm">
              Due Date: {new Date(currentInvoice.dueDate).toLocaleDateString()} 
              {agentConfig && <span className="text-xs text-secondary-500 ml-1">(Net {agentConfig.netDays} days)</span>}
            </div>
            {currentInvoice.paidDate && <div className="text-secondary-600 text-sm">Paid Date: {new Date(currentInvoice.paidDate).toLocaleDateString()}</div>}
            <div className="text-secondary-600 text-sm">Description: {currentInvoice.description}</div>
            <div className="text-secondary-600 text-sm">
              Billing Type: {currentInvoice.billingFrequency ? 
                (currentInvoice.billingFrequency === 'one-time' ? 
                  'One-Time Charge' : 
                  `Recurring (${currentInvoice.billingFrequency.charAt(0).toUpperCase() + currentInvoice.billingFrequency.slice(1)})`) : 
                'Not specified'}
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
              <ul className="space-y-2">
                {currentInvoice.activity
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .map((event, idx) => {
                    let label = event.stage;
                    if (event.type === 'reminder_sent') {
                      const reminderNum = currentInvoice.activity
                        .filter(e => e.type === 'reminder_sent' && new Date(e.date) <= new Date(event.date)).length;
                      label = `${reminderNum === 1 ? '1st' : reminderNum === 2 ? '2nd' : reminderNum === 3 ? '3rd' : reminderNum + 'th'} Reminder Sent`;
                    }
                    return (
                      <li key={idx} className="flex items-center space-x-2">
                        <span className="font-medium text-secondary-800">{label}</span>
                        <span className="text-xs text-secondary-500">{new Date(event.date).toLocaleString()}</span>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <div>No activity recorded for this invoice yet.</div>
            )}
          </div>
        )}
      </div>
      {/* Add Edit Invoice button at the bottom */}
      {typeof onEditInvoice === 'function' && tab === 'details' && (
        <div className="mt-8 flex justify-end">
          <button
            className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 text-lg font-medium"
            onClick={() => onEditInvoice(currentInvoice)}
          >
            Edit Invoice
          </button>
        </div>
      )}
    </Drawer>
  )
}

export default InvoiceDetailsDrawer 