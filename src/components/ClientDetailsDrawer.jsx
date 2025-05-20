import React, { useState, useEffect } from 'react'
import Drawer from './Drawer'
import ClientForm from './ClientForm'
import InvoiceDetailsDrawer from './InvoiceDetailsDrawer'
import { format } from 'date-fns'

function ClientDetailsDrawer({ isOpen, onClose, client, invoices = [], payments = [], onUpdate }) {
  const [editMode, setEditMode] = useState(false)
  const [displayData, setDisplayData] = useState(client || {})
  const [tab, setTab] = useState('info')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [showInvoiceDrawer, setShowInvoiceDrawer] = useState(false)

  // Update displayData and reset edit mode/tab when client changes
  useEffect(() => {
    if (client) {
      setDisplayData(client)
      setEditMode(false)
      setTab('info')
    }
  }, [client])

  if (!client) return null

  // Filter invoices and payments for this client, excluding scheduled invoices
  const clientInvoices = invoices
    .filter(inv => inv.clientId === client.id && inv.status !== 'scheduled')
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  
  console.log('Client ID:', client.id, 'Active Invoices found:', clientInvoices.length, 'Total invoices:', invoices.length)

  // Calculate scheduled invoices count for this client
  const scheduledInvoicesCount = invoices.filter(inv => inv.clientId === client.id && inv.status === 'scheduled').length;

  const clientPayments = payments.filter(pay => pay.clientId === client.id)

  const handleInvoiceClick = (invoice) => {
    setSelectedInvoice(invoice)
    setShowInvoiceDrawer(true)
  }

  const handleCloseInvoiceDrawer = () => {
    setShowInvoiceDrawer(false)
    setSelectedInvoice(null)
  }

  const handleSave = (updatedClient) => {
    if (onUpdate) {
      // Make sure to include the client ID
      const clientToUpdate = { ...updatedClient, id: client.id }
      
      // Update the local display data immediately
      setDisplayData(clientToUpdate)
      
      // Update Firestore and the parent component's state
      onUpdate(clientToUpdate)
    }
    setEditMode(false)
  }

  // Format the billing frequency for display
  const formatBillingFrequency = (frequency) => {
    if (!frequency) return 'Not set';
    
    const labels = {
      'weekly': 'Weekly',
      'monthly': 'Monthly',
      'quarterly': 'Quarterly',
      'biannually': 'Bi-annually',
      'annually': 'Annually',
      'one-time': 'One-time'
    };
    
    return labels[frequency.toLowerCase()] || frequency;
  };

  // Helper function to safely format date
  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      // Parse the date and format it without timezone issues
      const date = new Date(dateString);
      return format(date, 'MM/dd/yyyy');
    } catch (e) {
      return '-'
    }
  }

  // Format the invoice number
  const formatInvoiceNumber = (invoice) => {
    if (invoice.invoiceNumber) return invoice.invoiceNumber;
    if (invoice.id) return `INV-${invoice.id.substring(0, 4).toUpperCase()}`;
    return "Unknown";
  };

  // Helper: Recurring frequency order (most frequent first)
  const RECURRING_ORDER = ['weekly', 'monthly', 'quarterly', 'biannually', 'annually'];

  // Helper: Get the most frequent recurring invoice for a client
  function getMostFrequentRecurringInvoice(client, invoices) {
    const clientInvoices = invoices.filter(inv => inv.clientId === client.id);
    for (const freq of RECURRING_ORDER) {
      const recurring = clientInvoices.find(inv => inv.billingFrequency && inv.billingFrequency.toLowerCase() === freq);
      if (recurring) return recurring;
    }
    // If no recurring, return the latest one-time invoice
    return clientInvoices.find(inv => inv.billingFrequency && inv.billingFrequency.toLowerCase() === 'one-time') || null;
  }

  // Helper to format status with capital letter and spaces
  const formatStatus = (status) => {
    if (!status) return '';
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`Client: ${displayData?.name || ''}`}>
      {/* Tab Bar */}
      {!editMode && (
        <div className="flex border-b border-secondary-200 mb-4">
          <button
            className={`px-4 py-2 font-medium ${tab === 'info' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-secondary-600'}`}
            onClick={() => setTab('info')}
          >
            Client Info
          </button>
          <button
            className={`px-4 py-2 font-medium ${tab === 'billing' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-secondary-600'}`}
            onClick={() => setTab('billing')}
          >
            Billing
          </button>
          <button
            className={`px-4 py-2 font-medium ${tab === 'history' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-secondary-600'}`}
            onClick={() => setTab('history')}
          >
            History
          </button>
        </div>
      )}
      <div className="space-y-8">
        {!editMode ? (
          <>
            {tab === 'info' && (
              <div className="space-y-6">
                {/* Basic Info Card */}
                <div className="bg-white rounded-lg border border-secondary-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-secondary-200">
                    <h3 className="text-sm font-semibold text-secondary-800">Basic Information</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="text-sm text-secondary-500">Name</div>
                      <div className="text-secondary-900 font-medium">{displayData.name || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-secondary-500">Email</div>
                      <div className="text-secondary-900">{displayData.email || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-secondary-500">Phone</div>
                      <div className="text-secondary-900">{displayData.phone || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-secondary-500">Address</div>
                      <div className="text-secondary-900">
                        {displayData.street || displayData.city || displayData.state || displayData.postalCode || displayData.country
                          ? [displayData.street, displayData.city, displayData.state, displayData.postalCode, displayData.country].filter(Boolean).join(', ')
                          : (displayData.address || '-')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Status Card */}
                <div className="bg-white rounded-lg border border-secondary-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-secondary-200">
                    <h3 className="text-sm font-semibold text-secondary-800">Account Status</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="text-sm text-secondary-500">Status</div>
                      <div>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${displayData.status === 'active' ? 'bg-green-100 text-green-800' : displayData.status === 'delinquent' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                          {formatStatus(displayData.status) || 'Not set'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-secondary-500">Customer Since</div>
                      <div className="text-secondary-900">{formatDate(displayData.customerSince)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-secondary-500">Payment Score</div>
                      <div>
                        {displayData.paymentScore !== undefined ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            displayData.paymentScore >= 8 ? 'bg-green-100 text-green-800' : 
                            displayData.paymentScore >= 5 ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-red-100 text-red-800'}`}>
                            {displayData.paymentScore}
                          </span>
                        ) : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'billing' && (
              <div className="space-y-6">
                {/* Billing Configuration Card */}
                <div className="bg-white rounded-lg border border-secondary-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-secondary-200">
                    <h3 className="text-sm font-semibold text-secondary-800">Billing Configuration</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="text-sm text-secondary-500">Billing Frequency</div>
                      <div className="text-secondary-900 font-medium">
                        {(() => {
                          const recurringInvoice = getMostFrequentRecurringInvoice(displayData, invoices);
                          return recurringInvoice ? formatBillingFrequency(recurringInvoice.billingFrequency) : 'One-time';
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-secondary-500">Fee Amount</div>
                      <div className="text-secondary-900 font-medium">
                        {(() => {
                          const recurringInvoice = getMostFrequentRecurringInvoice(displayData, invoices);
                          return recurringInvoice && recurringInvoice.amount ? `$${recurringInvoice.amount}` : '-';
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-secondary-500">Billing Status</div>
                      <div>
                        {displayData.onHold ? (
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
                            On Hold
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Billing Schedule Card */}
                <div className="bg-white rounded-lg border border-secondary-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-secondary-200">
                    <h3 className="text-sm font-semibold text-secondary-800">Billing Schedule</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="text-sm text-secondary-500">Next Invoice</div>
                      <div className="text-secondary-900">
                        {(() => {
                          const recurringInvoice = getMostFrequentRecurringInvoice(displayData, invoices);
                          if (recurringInvoice && recurringInvoice.billingFrequency && recurringInvoice.billingFrequency.toLowerCase() !== 'one-time') {
                            return recurringInvoice.nextInvoiceDate ? `Next invoice on ${formatDate(recurringInvoice.nextInvoiceDate)}` : 'Recurring billing';
                          }
                          return 'No recurring billing';
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-secondary-500">Last Invoiced</div>
                      <div className="text-secondary-900">{formatDate(displayData.lastInvoiced)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-secondary-500">Last Payment</div>
                      <div className="text-secondary-900">{formatDate(displayData.lastPaid)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'history' && (
              <div className="space-y-6">
                {/* Invoices Table */}
                <div className="bg-white rounded-lg border border-secondary-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-secondary-200">
                    <h3 className="text-sm font-semibold text-secondary-800">Invoice History</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-secondary-200 bg-gray-50">
                          <th className="py-2 px-3 text-left font-medium text-secondary-600">Invoice #</th>
                          <th className="py-2 px-3 text-left font-medium text-secondary-600">Date</th>
                          <th className="py-2 px-3 text-left font-medium text-secondary-600">Amount</th>
                          <th className="py-2 px-3 text-left font-medium text-secondary-600">Status</th>
                          <th className="py-2 px-3 text-left font-medium text-secondary-600">Due Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-secondary-400">
                              No invoices found
                            </td>
                          </tr>
                        ) : (
                          clientInvoices.map(inv => (
                            <tr 
                              key={inv.id} 
                              className="border-b border-secondary-100 hover:bg-gray-50 cursor-pointer" 
                              onClick={() => handleInvoiceClick(inv)}
                            >
                              <td className="py-2 px-3 font-medium text-secondary-900">
                                {formatInvoiceNumber(inv)}
                              </td>
                              <td className="py-2 px-3 text-secondary-600">
                                {formatDate(inv.date || inv.createdAt)}
                              </td>
                              <td className="py-2 px-3 font-medium text-secondary-900">
                                ${inv.amount}
                              </td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  inv.status === 'paid' ? 'bg-green-100 text-green-800' : 
                                  inv.status === 'overdue' ? 'bg-red-100 text-red-800' : 
                                  'bg-yellow-100 text-yellow-800'}`}>
                                  {inv.status ? (inv.status.charAt(0).toUpperCase() + inv.status.slice(1)) : 'Pending'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-secondary-600">
                                {formatDate(inv.dueDate)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payments Table */}
                <div className="bg-white rounded-lg border border-secondary-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-secondary-200">
                    <h3 className="text-sm font-semibold text-secondary-800">Payment History</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-secondary-200 bg-gray-50">
                          <th className="py-2 px-3 text-left font-medium text-secondary-600">Date</th>
                          <th className="py-2 px-3 text-left font-medium text-secondary-600">Amount</th>
                          <th className="py-2 px-3 text-left font-medium text-secondary-600">Method</th>
                          <th className="py-2 px-3 text-left font-medium text-secondary-600">Invoice #</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientPayments.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-secondary-400">
                              No payments found
                            </td>
                          </tr>
                        ) : (
                          clientPayments.map(pay => (
                            <tr key={pay.id} className="border-b border-secondary-100">
                              <td className="py-2 px-3 text-secondary-600">
                                {formatDate(pay.date)}
                              </td>
                              <td className="py-2 px-3 font-medium text-secondary-900">
                                ${pay.amount || '-'}
                              </td>
                              <td className="py-2 px-3 text-secondary-600">
                                {pay.method || '-'}
                              </td>
                              <td className="py-2 px-3 text-secondary-600">
                                {pay.invoiceId || '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Button */}
            <div className="mt-6">
              <button
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200"
                onClick={() => setEditMode(true)}
              >
                Edit Client
              </button>
            </div>
          </>
        ) : (
          <ClientForm
            key={editMode ? (displayData.id ? displayData.id + '-edit' : 'new-edit') : (displayData.id || 'new')}
            client={displayData}
            onSubmit={handleSave}
            onCancel={() => setEditMode(false)}
            scheduledInvoicesCount={scheduledInvoicesCount}
          />
        )}
      </div>

      <InvoiceDetailsDrawer
        isOpen={showInvoiceDrawer}
        onClose={handleCloseInvoiceDrawer}
        invoice={selectedInvoice}
      />
    </Drawer>
  )
}

export default ClientDetailsDrawer 