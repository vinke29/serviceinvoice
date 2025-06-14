import { useState, useEffect, useRef } from 'react'
import Drawer from './Drawer'
import { useLocation } from 'react-router-dom'
import InvoiceDetailsDrawer from './InvoiceDetailsDrawer'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as Popover from '@radix-ui/react-popover';
import { CheckIcon, ChevronDownIcon, CalendarIcon } from '@radix-ui/react-icons';
import { format, isValid, addDays, startOfMonth, endOfMonth, addMonths, parseISO, isFuture, isWithinInterval } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import clsx from 'clsx';
import { getInvoices, addInvoice, updateInvoice, deleteInvoice, getClients, getAgentConfig, updateClient } from '../firebaseData';
import { auth, functions } from '../firebase';
import { showToast } from '../utils/toast.jsx';
import InvoiceGenerationService from '../services/invoiceGenerationService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-hot-toast';
import { useInvoices } from './InvoicesContext';
import { exportToCSV } from '../utils/csvExport';
import MobileInvoiceTile from './MobileInvoiceTile';
import { Pencil2Icon } from '@radix-ui/react-icons';
import UpdateScheduledInvoicesModal from './UpdateScheduledInvoicesModal';
import ActiveInvoiceUpdateModal from './ActiveInvoiceUpdateModal';
import DeleteInvoiceModal from './DeleteInvoiceModal.jsx';
import { v4 as uuidv4 } from 'uuid';

const sendInvoiceReminder = httpsCallable(functions, 'sendInvoiceReminder');
const sendInvoiceEscalation = httpsCallable(functions, 'sendInvoiceEscalation');
const sendInvoiceUpdateNotification = httpsCallable(functions, 'sendInvoiceUpdateNotification');
const sendInvoiceDeleteNotification = httpsCallable(functions, 'sendInvoiceDeleteNotification');
console.log("sendInvoiceReminder is defined:", typeof sendInvoiceReminder);
console.log("sendInvoiceEscalation is defined:", typeof sendInvoiceEscalation);

// Add this at the top of the file:
const minimalRedesign = false; // Toggle this to false to revert to the old UI

// Helper function to check if a date is in the future
function isDateInFuture(checkDate) {
  // Parse both dates as local YYYY-MM-DD
  const today = new Date();
  const todayYMD = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  const checkYMD = typeof checkDate === 'string'
    ? checkDate
    : checkDate instanceof Date
      ? checkDate.getFullYear() + '-' + String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + String(checkDate.getDate()).padStart(2, '0')
      : '';

  return checkYMD > todayYMD;
}

// Helper to robustly extract month/year from a scheduled invoice
function getInvoiceMonthYear(inv) {
  let invoiceMonth = inv.month;
  let invoiceYear = inv.year;
  if (invoiceMonth === undefined || invoiceYear === undefined) {
    // Parse the date string as a local date to avoid timezone issues
    const dateString = inv.scheduledDate || inv.date;
    const [year, month, day] = dateString.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    invoiceMonth = d.getMonth();
    invoiceYear = d.getFullYear();
  }
  return { invoiceMonth, invoiceYear };
}

function InvoiceCard({ invoice }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid':
        return 'text-primary-600 bg-primary-50'
      case 'Pending':
        return 'text-orange-600 bg-orange-50'
      case 'Overdue':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-secondary-600 bg-secondary-50'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-soft p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-secondary-900">{invoice.clientName}</h3>
          <p className="text-sm text-secondary-600 mt-1">{invoice.description}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-primary-600">${invoice.amount}</p>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
            {invoice.status}
          </span>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-secondary-100">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-secondary-600">Invoice Date</p>
            <p className="text-secondary-900 font-medium">{invoice.date}</p>
          </div>
          <div>
            <p className="text-secondary-600">Due Date</p>
            <p className="text-secondary-900 font-medium">{invoice.dueDate}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function InvoiceForm({ invoice, onSubmit, onCancel, clients = [], isMobile }) {
  // Filter only active clients (case-insensitive comparison)
  const activeClients = clients.filter(client => client.status.toLowerCase() === 'active');

  // Create today's date in local timezone
  const today = new Date();
  const localDateString = today.getFullYear() + '-' + 
    String(today.getMonth() + 1).padStart(2, '0') + '-' + 
    String(today.getDate()).padStart(2, '0');

  const [formData, setFormData] = useState({
    clientId: '',
    clientName: '',
    amount: '',
    description: '',
    date: localDateString,
    dueDate: '',
    status: 'pending',
    billingFrequency: 'one-time',
    isRecurring: false,
    customized: false,
    items: [] // Add items to formData state
  })
  const [agentConfig, setAgentConfig] = useState(null)
  const [isFutureInvoice, setIsFutureInvoice] = useState(false)
  const [isCustomDueDate, setIsCustomDueDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load agent config on mount
  useEffect(() => {
    const fetchAgentConfig = async () => {
      const user = auth.currentUser
      if (user) {
        const config = await getAgentConfig(user.uid)
        setAgentConfig(config || { netDays: 0 })
      }
    }
    fetchAgentConfig()
  }, [])

  useEffect(() => {
    if (invoice) {
      console.log('FORM RECEIVING INVOICE:', invoice);
      
      // Make a clean copy of the data for the form
      const cleanFormData = {
        ...formData,  // Keep default values
        ...invoice,   // Override with invoice values
        
        // Explicitly set critical fields
        clientId: invoice.clientId || '',
        clientName: invoice.clientName || '',
        amount: invoice.amount || '',
        description: invoice.description || '',
        
        // Critical fields that need special handling
        billingFrequency: invoice.billingFrequency || (invoice.type === 'Recurring' ? 'monthly' : 'one-time'),
        
        // Date handling - ensure it's a string in YYYY-MM-DD format
        date: invoice.scheduledDate || 
              (typeof invoice.date === 'string' ? invoice.date : 
              invoice.date instanceof Date ? invoice.date.toISOString().split('T')[0] : localDateString),
        
        // Copy other fields as is
        dueDate: invoice.dueDate || '',
        status: invoice.status || 'pending',
        isRecurring: invoice.isRecurring || invoice.type === 'Recurring' || false
      };
      
      // If invoice.items is empty but description/amount exist, prepopulate items
      if ((!invoice.items || invoice.items.length === 0) && invoice.description && invoice.amount) {
        cleanFormData.items = [{
          id: Date.now() + '-' + Math.random(),
          description: invoice.description,
          quantity: 1,
          unitPrice: parseFloat(invoice.amount) || 0
        }];
      }
      
      console.log('SETTING CLEAN FORM DATA:', cleanFormData);
      setFormData(cleanFormData);
    }
  }, [invoice, localDateString]);

  // Calculate due date when invoice date or client changes
  useEffect(() => {
    if (formData.date && agentConfig) {
      const invoiceDate = new Date(formData.date)
      let dueDate;
      if (agentConfig.netDays === 0) {
        dueDate = invoiceDate;
      } else {
        dueDate = addDays(invoiceDate, agentConfig.netDays);
      }
      setFormData(prev => ({ ...prev, dueDate: dueDate.toISOString().slice(0, 10) }))
      setIsCustomDueDate(false); // Reset custom flag when auto-calculating
    }
  }, [formData.date, agentConfig])
  
  useEffect(() => {
    if (formData.date) {
      const isInFuture = isDateInFuture(formData.date);
      setIsFutureInvoice(isInFuture);
      
      if (isInFuture && formData.status !== 'scheduled') {
        setFormData(prev => ({ ...prev, status: 'scheduled' }));
      } else if (!isInFuture && formData.status === 'scheduled') {
        setFormData(prev => ({ ...prev, status: 'pending' }));
      }
    }
  }, [formData.date]);

  // Add a default item row when creating a new invoice
  useEffect(() => {
    if (!invoice && (!formData.items || formData.items.length === 0)) {
      setFormData(f => ({
        ...f,
        items: [
          { id: Date.now() + '-' + Math.random(), description: '', quantity: 1, unitPrice: '' }
        ]
      }));
    }
  }, [invoice]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      let itemsTotal = 0;
      if (formData.items && formData.items.length > 0) {
        itemsTotal = formData.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
      }
      const finalData = {
        ...formData,
        amount: formData.items && formData.items.length > 0 ? itemsTotal : formData.amount
      };
      await onSubmit(finalData);
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleClientChange = (e) => {
    const clientId = e.target.value
    const selectedClient = clients.find(c => c.id === clientId)
    setFormData(prev => ({
      ...prev,
      clientId,
      clientName: selectedClient ? selectedClient.name : ''
    }))
  }

  // Handle billing frequency change
  const handleFrequencyChange = (e) => {
    const frequency = e.target.value
    setFormData({
      ...formData,
      billingFrequency: frequency,
      isRecurring: frequency !== 'one-time'
    })
  }

  // Calculate line item totals and overall total
  const itemsSubtotal = formData.items && formData.items.length > 0
    ? formData.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0)
    : 0;
  const totalAmount = formData.items && formData.items.length > 0
    ? itemsSubtotal
    : Number(formData.amount) || 0;

  // Step state for mobile
  const [step, setStep] = useState(0);
  const steps = [
    'Client',
    'Summary & Items',
    'Dates & Frequency',
    'Review'
  ];

  // Helper to render step content for mobile
  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="mb-1">
            <label className="block text-base font-semibold text-blue-800 mb-1">Client</label>
            <select
              value={formData.clientId}
              onChange={handleClientChange}
              className="w-full px-4 py-2 min-h-[40px] text-base border border-blue-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-sm transition placeholder-gray-700"
              required
            >
              <option value="">Select a client</option>
              {activeClients.length > 0 ? (
                activeClients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))
              ) : (
                <option value="" disabled>No active clients available for invoicing</option>
              )}
            </select>
            {activeClients.length === 0 && (
              <p className="mt-2 text-sm text-blue-500">Only active clients are eligible for invoicing. Please activate or add a client.</p>
            )}
          </div>
        );
      case 1:
        return (
          <>
            <div className="mb-1">
              <label className="block text-base font-semibold text-blue-800 mb-1">Summary</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 min-h-[44px] border border-blue-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white placeholder-gray-400 shadow-sm transition"
                placeholder="Describe the work, project, or service..."
              />
            </div>
            {/* Items Section (improved for clarity) */}
            <div className="mb-1">
              <label className="block text-base font-semibold text-blue-800 mb-1">Line Items</label>
              {formData.items.map((item, idx) => (
                <div key={item.id || idx} className="border rounded-lg p-3 mb-3 bg-blue-50">
                  <label className="block text-xs font-medium text-blue-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={e => {
                      const items = [...formData.items];
                      items[idx].description = e.target.value;
                      setFormData(f => ({ ...f, items }));
                    }}
                    className="w-full px-3 py-2 border border-blue-200 rounded focus:ring-2 focus:ring-primary-400 bg-white min-w-0 placeholder-gray-400 mb-2"
                    placeholder="e.g. Consulting hours"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-blue-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity === '' ? '' : item.quantity}
                        onChange={e => {
                          const val = e.target.value;
                          const items = [...formData.items];
                          // Allow empty string for editing, otherwise parse as number
                          items[idx].quantity = val === '' ? '' : val.replace(/^0+(?!$)/, ''); // Remove leading zeros
                          setFormData(f => ({ ...f, items }));
                        }}
                        onBlur={e => {
                          const items = [...formData.items];
                          // On blur, if empty or invalid, set to 1
                          if (!items[idx].quantity || isNaN(Number(items[idx].quantity)) || Number(items[idx].quantity) < 1) {
                            items[idx].quantity = 1;
                            setFormData(f => ({ ...f, items }));
                          }
                        }}
                        className="md:col-span-1 w-full px-3 py-2 border border-blue-200 rounded focus:ring-2 focus:ring-primary-400 bg-white placeholder-gray-400"
                        placeholder="Qty"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-blue-700 mb-1">Unit Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold pointer-events-none">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice === '' ? '' : item.unitPrice}
                          onChange={e => {
                            const items = [...formData.items];
                            items[idx].unitPrice = e.target.value === '' ? '' : Number(e.target.value);
                            setFormData(f => ({ ...f, items }));
                          }}
                          className="w-full pl-7 pr-2 py-2 border border-blue-200 rounded focus:ring-2 focus:ring-primary-400 bg-white placeholder-gray-400"
                          placeholder="e.g. 50.00"
                          inputMode="decimal"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-blue-700 font-medium">Line Total:</span>
                    <span className="text-base font-bold text-blue-900">${(Number(item.quantity) * Number(item.unitPrice) || 0).toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const items = formData.items.filter((_, i) => i !== idx);
                        setFormData(f => ({ ...f, items }));
                      }}
                      className="text-red-500 hover:text-red-700 transition text-lg p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-red-300 active:bg-red-100 w-9 h-9 flex items-center justify-center bg-transparent"
                      aria-label="Remove item"
                      style={{ zIndex: 2 }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setFormData(f => ({
                    ...f,
                    items: [
                      ...f.items,
                      { id: Date.now() + '-' + Math.random(), description: '', quantity: 1, unitPrice: '' }
                    ]
                  }));
                }}
                className="flex items-center justify-center gap-2 w-full mt-1 py-2 border border-blue-200 rounded-lg text-blue-700 font-medium bg-white hover:bg-blue-50 hover:border-blue-400 transition shadow-sm"
                style={{ fontSize: '1rem' }}
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-blue-300 bg-blue-50 text-blue-500 mr-1">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" /></svg>
                </span>
                Add Item
              </button>
            </div>
          </>
        );
      case 2:
        return (
          <>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-base font-semibold text-blue-800 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-sm transition"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-blue-800 mb-1">Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-sm transition"
                />
              </div>
            </div>
            <div className="mb-1 mt-4">
              <label className="block text-base font-semibold text-blue-800 mb-1">Billing Frequency</label>
              <select
                value={formData.billingFrequency}
                onChange={handleFrequencyChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-sm transition"
              >
                <option value="one-time">One-Time</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </>
        );
      case 3:
        return (
          <div className="p-4 bg-blue-50 rounded-xl shadow">
            <div className="flex items-center mb-4">
              <svg className="w-6 h-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              <h2 className="text-lg font-bold">Review Invoice</h2>
            </div>
            <div className="mb-2"><b>Client:</b> {clients.find(c => c.id === formData.clientId)?.name || ''}</div>
            <div className="mb-2"><b>Summary:</b> {formData.description}</div>
            <hr className="my-3" />
            <div className="mb-2">
              <b>Items:</b>
              <table className="w-full mt-2 text-sm">
                <thead>
                  <tr className="text-blue-700">
                    <th className="text-left">Description</th>
                    <th className="text-center">Qty</th>
                    <th className="text-center">Unit Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.description}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-center">${Number(item.unitPrice).toFixed(2)}</td>
                      <td className="text-right">${(item.quantity * item.unitPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <hr className="my-3" />
            <div className="flex justify-between items-center text-lg font-bold mb-2">
              <span>Total:</span>
              <span className="text-primary-600 text-2xl">${totalAmount.toFixed(2)}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-blue-100 text-sm text-blue-700 opacity-80">
              <div className="flex justify-between mb-1">
                <span>Invoice Date:</span>
                <span>{formData.date}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Due Date:</span>
                <span>{formData.dueDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Billing Frequency:</span>
                <span>{formData.billingFrequency}</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // ... existing code ...

  // Render
  if (isMobile) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-0 sm:px-0 pb-20 min-h-screen bg-white">
        {/* Progress Indicator */}
        <div className="flex justify-center items-center gap-2 my-4">
          {steps.map((label, idx) => (
            <div key={label} className={`w-2 h-2 rounded-full ${idx === step ? 'bg-primary-600' : 'bg-blue-200'}`}></div>
          ))}
        </div>
        {/* Step Content */}
        {renderStepContent()}
        {/* Navigation Buttons */}
        <div className="sticky bottom-0 left-0 w-full bg-gradient-to-t from-white via-white/90 to-white/60 pt-6 pb-2 px-0 flex gap-4 justify-between z-10 border-t border-blue-100">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 rounded-lg font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition shadow-sm"
              disabled={submitting}
            >
              Back
            </button>
          )}
          {step < steps.length - 1 && (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="px-8 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-600 hover:to-primary-800 shadow-lg transition border-none ml-auto"
              disabled={step === 0 && !formData.clientId || submitting}
            >
              Next
            </button>
          )}
          {step === steps.length - 1 && (
            <button
              type="submit"
              className="px-8 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-600 hover:to-primary-800 shadow-lg transition border-none ml-auto"
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2"><svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> Creating...</span>
              ) : (
                invoice ? 'Update Invoice' : 'Create Invoice'
              )}
            </button>
          )}
        </div>
      </form>
    );
  }
  // ... existing code ...

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-0 sm:px-0 pb-20 min-h-screen bg-white">
      {/* Client Section */}
      <div className="mb-1">
        <label className="block text-base font-semibold text-blue-800 mb-1">Client</label>
        <select
          value={formData.clientId}
          onChange={handleClientChange}
          className="w-full px-4 py-2 min-h-[40px] text-base border border-blue-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-sm transition placeholder-gray-700"
          required
        >
          <option value="">Select a client</option>
          {activeClients.length > 0 ? (
            activeClients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))
          ) : (
            <option value="" disabled>No active clients available for invoicing</option>
          )}
        </select>
        {activeClients.length === 0 && (
          <p className="mt-2 text-sm text-blue-500">Only active clients are eligible for invoicing. Please activate or add a client.</p>
        )}
      </div>
      {/* Invoice Summary Section */}
      <div className="mb-1">
        <label className="block text-base font-semibold text-blue-800 mb-1">Summary</label>
        <textarea
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2 min-h-[44px] border border-blue-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white placeholder-gray-400 shadow-sm transition"
          placeholder="Describe the work, project, or service..."
        />
      </div>
      {/* Items Section */}
      <div className="mb-1">
        <label className="block text-base font-semibold text-blue-800 mb-1">Line Items</label>
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-6 gap-2 text-sm font-semibold text-blue-700 mb-1 px-1">
            <div className="md:col-span-2 col-span-1">Description</div>
            <div className="md:col-span-1 col-span-1">Qty</div>
            <div className="md:col-span-1 col-span-1">Unit Price</div>
            <div className="md:col-span-1 col-span-1">Total</div>
            <div className="md:col-span-1 col-span-1"></div>
          </div>
          {formData.items.map((item, idx) => (
            <div key={item.id || idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center bg-white rounded-lg p-1 border border-blue-100">
              {/* Description: wider on desktop */}
              <input
                type="text"
                value={item.description}
                onChange={e => {
                  const items = [...formData.items];
                  items[idx].description = e.target.value;
                  setFormData(f => ({ ...f, items }));
                }}
                className="md:col-span-2 flex-1 px-3 py-2 border border-blue-200 rounded focus:ring-2 focus:ring-primary-400 bg-white min-w-0 placeholder-gray-400"
                placeholder="Item description"
              />
              {/* Quantity */}
              <input
                type="number"
                min="1"
                value={item.quantity === '' ? '' : item.quantity}
                onChange={e => {
                  const val = e.target.value;
                  const items = [...formData.items];
                  // Allow empty string for editing, otherwise parse as number
                  items[idx].quantity = val === '' ? '' : val.replace(/^0+(?!$)/, ''); // Remove leading zeros
                  setFormData(f => ({ ...f, items }));
                }}
                onBlur={e => {
                  const items = [...formData.items];
                  // On blur, if empty or invalid, set to 1
                  if (!items[idx].quantity || isNaN(Number(items[idx].quantity)) || Number(items[idx].quantity) < 1) {
                    items[idx].quantity = 1;
                    setFormData(f => ({ ...f, items }));
                  }
                }}
                className="md:col-span-1 w-full px-3 py-2 border border-blue-200 rounded focus:ring-2 focus:ring-primary-400 bg-white placeholder-gray-400"
                placeholder="Qty"
              />
              {/* Unit Price with $ inside input */}
              <div className="md:col-span-1 w-full relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold pointer-events-none">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice === '' ? '' : item.unitPrice}
                  onChange={e => {
                    const items = [...formData.items];
                    items[idx].unitPrice = e.target.value === '' ? '' : Number(e.target.value);
                    setFormData(f => ({ ...f, items }));
                  }}
                  className="w-full pl-7 pr-2 py-2 border border-blue-200 rounded focus:ring-2 focus:ring-primary-400 bg-white placeholder-gray-400"
                  placeholder="Price"
                  inputMode="decimal"
                />
              </div>
              {/* Total */}
              <div className="md:col-span-1 w-full px-3 py-2 text-right text-blue-900 font-semibold">
                ${(Number(item.quantity) * Number(item.unitPrice) || 0).toFixed(2)}
              </div>
              {/* Remove button */}
              <div className="md:col-span-1 flex items-center justify-end w-full md:w-8">
                <button
                  type="button"
                  onClick={() => {
                    const items = formData.items.filter((_, i) => i !== idx);
                    setFormData(f => ({ ...f, items }));
                  }}
                  className="text-red-500 hover:text-red-700 transition text-lg p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-red-300 active:bg-red-100 w-9 h-9 flex items-center justify-center bg-transparent md:bg-white md:shadow-sm md:static md:right-auto md:top-auto"
                  aria-label="Remove item"
                  style={{ zIndex: 2 }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setFormData(f => ({
                ...f,
                items: [
                  ...f.items,
                  { id: Date.now() + '-' + Math.random(), description: '', quantity: 1, unitPrice: '' }
                ]
              }));
            }}
            className="flex items-center justify-center gap-2 w-full mt-1 py-2 border border-blue-200 rounded-lg text-blue-700 font-medium bg-white hover:bg-blue-50 hover:border-blue-400 transition shadow-sm"
            style={{ fontSize: '1rem' }}
          >
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-blue-300 bg-blue-50 text-blue-500 mr-1">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" /></svg>
            </span>
            Add Item
          </button>
          {/* Subtotal/Total Row */}
          {formData.items.length > 0 && (
            <div className="flex justify-end mt-1">
              <div className="text-base font-bold text-blue-900">Subtotal: ${itemsSubtotal.toFixed(2)}</div>
            </div>
          )}
        </div>
      </div>
      {/* Amount & Frequency Section */}
      {(!formData.items || formData.items.length === 0) ? (
        <div className="mb-1">
          <label className="block text-base font-semibold text-blue-800 mb-1">Total Amount</label>
          <div className="flex items-center mb-4">
            <span className="inline-block text-gray-400 font-bold pl-3 pr-1">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={totalAmount === 0 ? '' : totalAmount}
              onChange={e => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-1 py-2 border border-blue-200 rounded-xl bg-white text-blue-900 font-bold shadow-sm transition placeholder-gray-700"
              placeholder="Total amount"
              inputMode="decimal"
            />
          </div>
          <label className="block text-base font-semibold text-blue-800 mb-1">Billing Frequency</label>
          <select
            value={formData.billingFrequency}
            onChange={handleFrequencyChange}
            className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-sm transition"
          >
            <option value="one-time">One-Time</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      ) : (
        <div className="mb-1">
          <label className="block text-base font-semibold text-blue-800 mb-1">Billing Frequency</label>
          <select
            value={formData.billingFrequency}
            onChange={handleFrequencyChange}
            className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-sm transition"
          >
            <option value="one-time">One-Time</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      )}
      {/* Dates Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-base font-semibold text-blue-800 mb-1">Invoice Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={e => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-sm transition"
          />
        </div>
        <div>
          <label className="block text-base font-semibold text-blue-800 mb-1">Due Date</label>
          <input
            type="date"
            value={formData.dueDate}
            onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
            className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-sm transition"
          />
        </div>
      </div>
      {/* Status Section */}
      <div className="mb-1">
        <label className="block text-base font-semibold text-blue-800 mb-1">Status</label>
        <select
          value={formData.status}
          onChange={e => setFormData({ ...formData, status: e.target.value })}
          className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-white shadow-sm transition"
        >
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="scheduled">Scheduled</option>
        </select>
      </div>
      {/* Sticky Action Bar */}
      <div className="sticky bottom-0 left-0 w-full bg-gradient-to-t from-white via-white/90 to-white/60 pt-6 pb-2 px-0 flex gap-4 justify-end z-10 border-t border-blue-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 rounded-lg font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition shadow-sm"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-8 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-600 hover:to-primary-800 shadow-lg transition border-none"
          disabled={submitting}
        >
          {submitting ? (
            <span className="flex items-center gap-2"><svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> Creating...</span>
          ) : (
            invoice ? 'Update Invoice' : 'Create Invoice'
          )}
        </button>
      </div>
    </form>
  )
}

// Modern Filter Bar Components (copied from Clients.jsx)
function MultiSelectDropdown({ label, options, selected, setSelected }) {
  const handleToggle = (option) => {
    setSelected(selected.includes(option)
      ? selected.filter((o) => o !== option)
      : [...selected, option]);
  };
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="min-w-[140px] px-3 py-2 border border-secondary-200 rounded-lg flex items-center justify-between bg-white text-sm text-secondary-900 hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
          type="button"
        >
          <span>{selected.length ? selected.join(', ') : `Select ${label}`}</span>
          <ChevronDownIcon className="ml-2 w-4 h-4 text-secondary-500" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content className="z-50 min-w-[180px] bg-white border border-secondary-200 rounded-lg shadow-lg p-2 mt-2">
        {options.map((option) => (
          <DropdownMenu.Item key={option} asChild>
            <label
              className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-secondary-50 rounded select-none"
              onClick={() => handleToggle(option)}
            >
              <Checkbox.Root
                checked={selected.includes(option)}
                tabIndex={-1}
                className="w-4 h-4 border border-secondary-300 rounded flex items-center justify-center bg-white pointer-events-none"
                id={`${label}-${option}`}
              >
                <Checkbox.Indicator>
                  <CheckIcon className="w-3 h-3 text-primary-600" />
                </Checkbox.Indicator>
              </Checkbox.Root>
              <span className="text-sm">{option}</span>
            </label>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

function DateRangePopover({ label, value, setValue }) {
  const [open, setOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState({ from: value[0], to: value[1] });

  useEffect(() => {
    setPendingRange({ from: value[0], to: value[1] });
  }, [value[0], value[1]]);

  const display = pendingRange.from && pendingRange.to
    ? `${format(pendingRange.from, 'MM/dd/yyyy')} - ${format(pendingRange.to, 'MM/dd/yyyy')}`
    : 'Select range';

  const handleSelect = (range) => {
    setPendingRange(range || { from: undefined, to: undefined });
    if (range?.from && range?.to && range.from !== range.to) {
      setValue([range.from, range.to]);
      setOpen(false);
      setPendingRange({ from: undefined, to: undefined });
    }
  };

  const handleClear = () => {
    setPendingRange({ from: undefined, to: undefined });
    setValue([undefined, undefined]);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="min-w-[180px] px-3 py-2 border border-secondary-200 rounded-lg flex items-center bg-white text-sm text-secondary-900 hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
          type="button"
        >
          <CalendarIcon className="mr-2 w-4 h-4 text-secondary-500" />
          <span>{display}</span>
        </button>
      </Popover.Trigger>
      <Popover.Content className="z-50 bg-white border border-secondary-200 rounded-xl shadow-xl p-4 mt-2">
        <DayPicker
          mode="range"
          selected={pendingRange.from || pendingRange.to ? pendingRange : { from: value[0], to: value[1] }}
          onSelect={handleSelect}
          numberOfMonths={2}
        />
        <div className="flex justify-end mt-2">
          <button
            className="text-xs text-secondary-600 hover:text-primary-600"
            onClick={handleClear}
            type="button"
          >
            Clear
          </button>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}

function SuccessNotification({ message, onClose }) {
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef(null);
  
  useEffect(() => {
    // Auto close after 5 seconds
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Allow animation to complete
    }, 5000);
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onClose]);
  
  return (
    <div 
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md transform transition-all duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 translate-y-[-20px]'
      }`}
    >
      <div className="bg-white border-l-4 border-primary-500 rounded-lg shadow-xl p-4 mx-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-secondary-900">{message}</p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => {
                setVisible(false);
                setTimeout(onClose, 300);
              }}
              className="bg-white rounded-md inline-flex text-secondary-400 hover:text-secondary-500"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Invoices() {
  const { invoices, setInvoices, refreshInvoices, loading } = useInvoices();
  const [clients, setClients] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const location = useLocation();
  const [selectedMonth, setSelectedMonth] = useState(getInitialMonth());
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [showInvoiceDrawer, setShowInvoiceDrawer] = useState(false)
  const [statusFilter, setStatusFilter] = useState([])
  const [dateRange, setDateRange] = useState([undefined, undefined])
  const [invoiceDateRange, setInvoiceDateRange] = useState([undefined, undefined])
  const [initialLoad, setInitialLoad] = useState(true)
  const [scheduledInvoices, setScheduledInvoices] = useState([]);
  const [showScheduled, setShowScheduled] = useState(false);
  const [activeScheduleMonth, setActiveScheduleMonth] = useState('current');
  const [selectedScheduleYear, setSelectedScheduleYear] = useState(new Date().getFullYear());
  const [selectedScheduleMonth, setSelectedScheduleMonth] = useState(new Date().getMonth());
  const [agentConfig, setAgentConfig] = useState(null);
  const [isMobile, setIsMobile] = useState(true); // Force mobile view for testing
  const [successMessage, setSuccessMessage] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteModalData, setDeleteModalData] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionInvoice, setActionInvoice] = useState(null);
  const [showScheduledMobile, setShowScheduledMobile] = useState(false);
  const modalContentRef = useRef(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [pendingUpdateData, setPendingUpdateData] = useState(null);
  const [futureScheduledCount, setFutureScheduledCount] = useState(0);
  const [showActiveInvoiceUpdateModal, setShowActiveInvoiceUpdateModal] = useState(false);
  const [activeInvoiceUpdateData, setActiveInvoiceUpdateData] = useState(null);
  const modalKeyRef = useRef(0);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Add screen size detection
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkScreenSize();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkScreenSize);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Remove detailed debug scheduled invoice month/year logging
  useEffect(() => {
    // Initialize with current date
    const currentDate = new Date();
    setSelectedScheduleMonth(currentDate.getMonth());
    setSelectedScheduleYear(currentDate.getFullYear());
  }, []);

  // Read year and month from URL
  function getInitialMonth() {
    const params = new URLSearchParams(location.search);
    const year = parseInt(params.get('year'));
    const month = parseInt(params.get('month'));
    if (!isNaN(year) && !isNaN(month)) {
      return new Date(year, month - 1, 1);
    }
    return new Date();
  }

  // Update selectedMonth if URL changes
  useEffect(() => {
    setSelectedMonth(getInitialMonth());
  }, [location.search]);

  // Load invoices and clients from Firestore on mount
  useEffect(() => {
    const fetchClients = async () => {
      const user = auth.currentUser;
      if (user) {
        const clientsData = await getClients(user.uid);
        setClients(clientsData);
      } else {
        setClients([]);
      }
    };
    fetchClients();
  }, []);

  // Calculate scheduled invoices for the next 12 months
  useEffect(() => {
    if (clients.length > 0) {
      const nextYearInvoices = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      invoices.forEach(invoice => {
        if (invoice.deleted) return;
        const client = clients.find(c => c.id === invoice.clientId);
        if (!client || client.onHold) return; // <-- Enforce this filter
        try {
          const [year, month, day] = invoice.date.split('-').map(Number);
          const invoiceDate = new Date(year, month - 1, day);
          if (invoice.status === 'scheduled' || (invoice.isRecurring && isFuture(invoiceDate))) {
            nextYearInvoices.push({
              id: invoice.id,
              clientId: invoice.clientId,
              clientName: invoice.clientName,
              amount: invoice.amount,
              description: invoice.description,
              scheduledDate: invoice.date,
              dueDate: invoice.dueDate,
              date: invoiceDate,
              type: invoice.isRecurring ? 'Recurring' : 'Manual Scheduled',
              month: invoiceDate.getMonth(),
              year: invoiceDate.getFullYear()
            });
          }
        } catch (e) {
          console.error(`Error processing scheduled invoice:`, e);
        }
      });
      nextYearInvoices.sort((a, b) => a.date - b.date);
      setScheduledInvoices(nextYearInvoices);
      if (nextYearInvoices.length > 0) {
        setShowScheduled(true);
        const firstDate = nextYearInvoices[0].date;
        setSelectedScheduleMonth(firstDate.getMonth());
        setSelectedScheduleYear(firstDate.getFullYear());
      }
    }
  }, [clients, invoices]);

  // Modify the generateFutureInvoices function
  const generateFutureInvoices = async (userId, invoiceData, seriesId) => {
    if (!invoiceData.isRecurring || invoiceData.billingFrequency === 'one-time') {
      return [];
    }
    
    try {
      // Use local date construction to avoid timezone issues
      const [year, month, day] = invoiceData.date.split('-').map(Number);
      const startDate = new Date(year, month - 1, day); // month is 0-based
      console.log('DEBUG: startDate', startDate.toISOString(), startDate);
      const netDays = agentConfig?.netDays ?? 0;
      
      // Calculate number of invoices based on frequency
      let numFutureInvoices;
      switch (invoiceData.billingFrequency) {
        case 'weekly':
          numFutureInvoices = 51; // 51 more weeks (first week is handled by initial invoice)
          break;
        case 'monthly':
          numFutureInvoices = 11; // 11 more months (first month is handled by initial invoice)
          break;
        case 'quarterly':
          numFutureInvoices = 3; // Rest of the year (first quarter handled by initial invoice)
          break;
        case 'biannually':
          numFutureInvoices = 1; // Rest of the year (first half handled by initial invoice)
          break;
        case 'annually':
          numFutureInvoices = 0; // First year handled by initial invoice
          break;
        default:
          numFutureInvoices = 11; // Default to monthly
      }
      
      const scheduledInvoiceData = [];
      let currentDate = startDate;
      
      // Advance to next period first since initial invoice handles the first period
      switch (invoiceData.billingFrequency) {
        case 'weekly':
          currentDate = addDays(currentDate, 7);
          break;
        case 'monthly':
          currentDate = addMonths(currentDate, 1);
          break;
        case 'quarterly':
          currentDate = addMonths(currentDate, 3);
          break;
        case 'biannually':
          currentDate = addMonths(currentDate, 6);
          break;
        case 'annually':
          currentDate = addMonths(currentDate, 12);
          break;
        default:
          currentDate = addMonths(currentDate, 1);
      }
      
      // Generate future invoices (starting from second period)
      for (let i = 0; i < numFutureInvoices; i++) {
        console.log(`DEBUG: Generating invoice #${i+1} for currentDate`, currentDate.toISOString(), currentDate);
        // Calculate due date using local date math
        const dueDate = netDays === 0
          ? format(currentDate, 'yyyy-MM-dd')
          : format(addDays(currentDate, netDays), 'yyyy-MM-dd');
        console.log(`DEBUG: Scheduled invoice date: ${format(currentDate, 'yyyy-MM-dd')}, dueDate: ${dueDate}`);
        // Create the invoice - keep original description
        const scheduledInvoice = {
          clientId: invoiceData.clientId,
          clientName: invoiceData.clientName,
          invoiceNumber: `INV-SCHED-${Date.now()}-${i + 1}`,
          amount: invoiceData.amount,
          description: invoiceData.description, // Keep original description
          date: format(currentDate, 'yyyy-MM-dd'),
          dueDate,
          status: 'scheduled',
          billingFrequency: invoiceData.billingFrequency,
          isRecurring: true,
          ...(seriesId ? { seriesId } : invoiceData.seriesId ? { seriesId: invoiceData.seriesId } : {})
        };
        
        scheduledInvoiceData.push(scheduledInvoice);
        
        // Advance to next date based on frequency
        switch (invoiceData.billingFrequency) {
          case 'weekly':
            currentDate = addDays(currentDate, 7);
            break;
          case 'monthly':
            currentDate = addMonths(currentDate, 1);
            break;
          case 'quarterly':
            currentDate = addMonths(currentDate, 3);
            break;
          case 'biannually':
            currentDate = addMonths(currentDate, 6);
            break;
          case 'annually':
            currentDate = addMonths(currentDate, 12);
            break;
          default:
            currentDate = addMonths(currentDate, 1);
        }
      }
      
      // Save all invoices to Firebase in parallel
      const savedInvoices = await Promise.all(
        scheduledInvoiceData.map(invoice => addInvoice(userId, invoice))
      );
      
      // Force refresh the scheduled invoices list
      setInvoices(prev => [...prev, ...savedInvoices]);
      
      return savedInvoices;
    } catch (error) {
      console.error("Error generating future invoices:", error);
      return [];
    }
  };

  // Helper function to create a local date string in YYYY-MM-DD format
  const getLocalDateString = (date = new Date()) => {
    return date.getFullYear() + '-' + 
      String(date.getMonth() + 1).padStart(2, '0') + '-' + 
      String(date.getDate()).padStart(2, '0');
  };

  // Add invoice
  const handleAddInvoice = async (invoiceData) => {
    const user = auth.currentUser
    if (user) {
      try {
        // Create today's date in local timezone for defaults
        const currentDate = new Date();
        const localDateString = currentDate.getFullYear() + '-' + 
          String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + 
          String(currentDate.getDate()).padStart(2, '0');
        
        // Ensure all required fields exist with proper defaults to prevent undefined issues
        invoiceData = {
          clientId: invoiceData.clientId || '',
          clientName: invoiceData.clientName || '',
          amount: invoiceData.amount || 0,
          description: invoiceData.description || '',
          date: invoiceData.date || localDateString, // Use local date string
          dueDate: invoiceData.dueDate || '',
          status: invoiceData.status || 'pending',
          billingFrequency: invoiceData.billingFrequency || 'one-time',
          ...invoiceData // Keep any other fields
        };
        
        // Check if this is a future-dated invoice
        let invoiceDate;
        try {
          invoiceDate = new Date(invoiceData.date);
          if (!isValid(invoiceDate)) {
            invoiceDate = new Date(); // Default to today if invalid
          }
        } catch (error) {
          console.error("Invalid date format:", error);
          invoiceDate = new Date(); // Default to today on error
        }
        
        // Use our helper function to check if the date is in the future
        const isFutureInvoice = isDateInFuture(invoiceData.date); // Use the date string directly
        // Force status to 'scheduled' for future invoices, 'pending' otherwise
        invoiceData.status = isFutureInvoice ? 'scheduled' : 'pending';
        if (isFutureInvoice) setShowScheduled(true);
        console.log('DEBUG: Invoice status before save:', invoiceData.status, invoiceData.date);
        
        // If this is a recurring invoice or future-dated, make sure the scheduled view will be shown
        if (invoiceData.isRecurring || isFutureInvoice) {
          setShowScheduled(true);
          
          // Set the active tab to the month of the first invoice
          if (isValid(invoiceDate)) {
            setSelectedScheduleMonth(invoiceDate.getMonth());
            setSelectedScheduleYear(invoiceDate.getFullYear());
          }
        }
        
        // Generate a unique invoice number
        let nextInvoiceNumber = "INV-0001"
        if (invoices.length > 0) {
          // Extract all numeric parts of invoice numbers, skip undefined or non-string
          const invoiceNumbers = invoices
            .filter(inv => typeof inv.invoiceNumber === 'string' && inv.invoiceNumber.startsWith("INV-"))
            .map(inv => {
              try {
                const numStr = inv.invoiceNumber.replace("INV-", "")
                return parseInt(numStr, 10)
              } catch (error) {
                return 0
              }
            })
            .filter(num => !isNaN(num))
          if (invoiceNumbers.length > 0) {
            const maxNumber = Math.max(...invoiceNumbers)
            nextInvoiceNumber = `INV-${String(maxNumber + 1).padStart(4, '0')}`
          }
        }
        
        // Always declare seriesId
        let seriesId = undefined;
        if (invoiceData.billingFrequency && invoiceData.billingFrequency !== 'one-time') {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            seriesId = crypto.randomUUID();
          } else if (typeof uuidv4 !== 'undefined') {
            seriesId = uuidv4();
          } else {
            seriesId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
          }
        }
        
        // Ensure we have all required fields
        const dataWithDate = {
          ...invoiceData,
          date: invoiceData.date || localDateString,
          invoiceNumber: nextInvoiceNumber,
          amount: parseFloat(invoiceData.amount) || 0, // Ensure amount is a number
          billingFrequency: invoiceData.billingFrequency || 'one-time', // Ensure billing frequency is set
          isRecurring: invoiceData.billingFrequency !== 'one-time', // Set the recurring flag
          // Status is already set correctly above based on isFutureInvoice
          status: invoiceData.status,
          ...(seriesId !== undefined ? { seriesId } : {})
        }
        
        console.log("Creating invoice with data:", dataWithDate);
        
        // Save to Firebase
        const newInvoice = await addInvoice(user.uid, dataWithDate)
        
        // Immediately add to state to prevent lag
        setInvoices(prev => {
          // Check if this invoice already exists to prevent duplicates
          const exists = prev.some(inv => inv.id === newInvoice.id)
          
          if (exists) {
            // Update the existing invoice instead of adding a new one
            return prev.map(inv => inv.id === newInvoice.id ? newInvoice : inv)
          } else {
            // Add the new invoice
            return [...prev, newInvoice]
          }
        })
        
        // Update client with billing information from invoice
        if (dataWithDate.clientId) {
          try {
            const client = clients.find(c => c && c.id === dataWithDate.clientId);
            if (client) {
              const clientUpdates = {
                billingFrequency: dataWithDate.billingFrequency,
                fee: dataWithDate.amount
              };
              
              // If this is a future invoice, set it as next invoice date
              if (isFutureInvoice) {
                clientUpdates.nextInvoiceDate = dataWithDate.date;
              } else {
                // If not a future invoice, update the lastInvoiced date
                clientUpdates.lastInvoiced = dataWithDate.date;
                
                // Calculate next invoice date based on billing frequency for recurring invoices
                if (dataWithDate.isRecurring) {
                  const nextDate = calculateNextInvoiceDate(
                    new Date(dataWithDate.date), 
                    dataWithDate.billingFrequency
                  );
                  clientUpdates.nextInvoiceDate = nextDate.toISOString().slice(0, 10);
                }
              }
              
              // Update the client in Firebase
              await updateClient(user.uid, { ...client, ...clientUpdates });
              
              // Update the local clients state
              setClients(prev => prev.map(c => 
                c.id === client.id ? { ...c, ...clientUpdates } : c
              ));
            }
          } catch (error) {
            console.error("Error updating client after invoice creation:", error);
          }
        }
        
        // Generate future invoices if this is a recurring invoice
        if (dataWithDate.isRecurring) {
          try {
            // Generate future invoices immediately, passing seriesId
            const futureInvoices = await generateFutureInvoices(user.uid, dataWithDate, seriesId);
            
            // Show success message with accurate count
            setSuccessMessage(
              `Created invoice #${dataWithDate.invoiceNumber} and ${futureInvoices.length} future ${dataWithDate.billingFrequency} invoices. View them in the "Upcoming Invoices" section.`
            );
          } catch (error) {
            console.error("Error generating future invoices:", error);
            setSuccessMessage(
              `Invoice #${dataWithDate.invoiceNumber} created successfully, but there was an error generating future invoices.`
            );
          }
        } else if (isFutureInvoice) {
          setSuccessMessage(
            `Invoice #${dataWithDate.invoiceNumber} has been scheduled for ${format(invoiceDate, 'PPP')}. View it in the "Upcoming Invoices" section.`
          );
        } else {
          setSuccessMessage(
            `Invoice #${dataWithDate.invoiceNumber} has been created successfully.`
          );
        }
      } catch (error) {
        console.error("Error creating invoice:", error);
        alert(`Failed to create invoice: ${error.message}`);
      }
    }
    setShowForm(false)
  }
  
  // Helper function to calculate the next invoice date based on frequency
  const calculateNextInvoiceDate = (currentDate, frequency) => {
    try {
      switch (frequency.toLowerCase()) {
        case 'weekly':
          return addDays(currentDate, 7);
        case 'monthly':
          return addMonths(currentDate, 1);
        case 'quarterly':
          return addMonths(currentDate, 3);
        case 'biannually':
          return addMonths(currentDate, 6);
        case 'annually':
          return addMonths(currentDate, 12);
        case 'one-time':
          return null;
        default:
          return addMonths(currentDate, 1); // Default to monthly
      }
    } catch (error) {
      console.error('Error calculating next invoice date:', error);
      return null;
    }
  }

  // Edit invoice
  const handleEditInvoice = async (invoice) => {
    // Log the full invoice object to see all fields
    console.log('FULL INVOICE OBJECT:', invoice);
    
    // For scheduled/recurring invoices, create a completely new object with the right fields
    if (invoice.status === 'scheduled' || invoice.type === 'Recurring') {
      // Create a fresh invoice object with only the fields we care about
      const enhancedInvoice = {
        ...invoice,
        // Force the date to be the scheduled date as a string (not a Date object)
        date: invoice.scheduledDate || (typeof invoice.date === 'string' ? invoice.date : 
              invoice.date instanceof Date ? invoice.date.toISOString().split('T')[0] : ''),
        // Set the billing frequency based on the type column
        billingFrequency: 'monthly',  // Default for recurring invoices
        isRecurring: true
      };
      
      console.log('ENHANCED INVOICE BEFORE EDIT:', enhancedInvoice);
      
      // Open form with enhanced data
      setEditingInvoice({ ...enhancedInvoice }); // clone to force new reference
      setShowForm(true);
    } else {
      // Regular invoice handling
      setEditingInvoice({ ...invoice }); // clone to force new reference
      setShowForm(true);
    }
  };

  // Delete invoice
  const handleDeleteInvoice = async (invoice) => {
    const user = auth.currentUser;
    if (!user) return;
    // Determine if this is a recurring/scheduled invoice
    const isRecurring = invoice.isRecurring || invoice.billingFrequency !== 'one-time';
    const isScheduled = invoice.status === 'scheduled';
    let futureInvoices = [];
    if (isRecurring || isScheduled) {
      // Find all future scheduled invoices for this client/series
      const allInvoices = await getInvoices(user.uid);
      futureInvoices = allInvoices.filter(inv =>
        inv.clientId === invoice.clientId &&
        inv.status === 'scheduled' &&
        inv.description === invoice.description &&
        new Date(inv.date) >= new Date(invoice.date) &&
        inv.id !== invoice.id
      );
    }
    setDeleteModalData({
      invoice,
      futureInvoices,
      isRecurring,
      isScheduled,
      client: clients.find(c => c.id === invoice.clientId)
    });
    setShowDeleteModal(true);
  };

  // Confirm delete handler
  const handleDeleteModalConfirm = async (options) => {
    setShowDeleteModal(false);
    if (!deleteModalData) return;
    const { invoice, futureInvoices, client } = deleteModalData;
    const user = auth.currentUser;
    if (!user) return;
    let deletedInvoices = [];
    if (options.scope === 'single') {
      deletedInvoices = [invoice];
      await deleteInvoice(user.uid, invoice.id);
      setInvoices(prev => prev.filter(inv => inv.id !== invoice.id));
    } else {
      // Delete this and all future scheduled invoices
      const idsToDelete = [invoice.id, ...futureInvoices.map(inv => inv.id)];
      deletedInvoices = [invoice, ...futureInvoices];
      for (const id of idsToDelete) {
        await deleteInvoice(user.uid, id);
      }
      setInvoices(prev => prev.filter(inv => !idsToDelete.includes(inv.id)));
    }
    // Optionally notify client
    if (options.notifyClient && client) {
      try {
        await sendInvoiceDeleteNotification({
          userId: user.uid,
          invoiceIds: deletedInvoices.map(inv => inv.id),
          clientId: client.id,
          scope: options.scope,
          invoices: deletedInvoices // Pass full invoice data
        });
      } catch (error) {
        console.error('Error sending invoice deletion notification:', error);
      }
    }
    setDeleteModalData(null);
    setSuccessMessage(`Deleted ${deletedInvoices.length} invoice${deletedInvoices.length > 1 ? 's' : ''}.`);
  };

  // Send a scheduled invoice now
  const handleSendNow = async (scheduledInvoice) => {
    const user = auth.currentUser
    if (!user) {
      console.error("No user logged in")
      return
    }

    try {
      // Create an actual invoice from the scheduled information
      const today = new Date();
      const invoiceData = {
        clientId: scheduledInvoice.clientId,
        clientName: scheduledInvoice.clientName,
        amount: scheduledInvoice.amount,
        description: scheduledInvoice.description,
        date: getLocalDateString(today), // Today's date using our helper function
        dueDate: scheduledInvoice.dueDate, // Keep the original due date
        status: 'pending'
      }
      // Generate a truly unique invoice number by finding the highest existing number and adding 1
      let nextInvoiceNumber = "INV-0001"
      if (invoices.length > 0) {
        // Extract all numeric parts of invoice numbers, skip undefined or non-string
        const invoiceNumbers = invoices
          .filter(inv => typeof inv.invoiceNumber === 'string' && inv.invoiceNumber.startsWith("INV-"))
          .map(inv => {
            try {
              const numStr = inv.invoiceNumber.replace("INV-", "")
              return parseInt(numStr, 10)
            } catch (error) {
              return 0
            }
          })
          .filter(num => !isNaN(num))
        if (invoiceNumbers.length > 0) {
          const maxNumber = Math.max(...invoiceNumbers)
          nextInvoiceNumber = `INV-${String(maxNumber + 1).padStart(4, '0')}`
        }
      }
      invoiceData.invoiceNumber = nextInvoiceNumber
      // Save the new invoice to Firebase with a forced unique ID
      const newInvoice = await addInvoice(user.uid, invoiceData)
      console.log("Created new invoice:", newInvoice)
      // Optionally, delete the original scheduled invoice
      await deleteInvoice(user.uid, scheduledInvoice.id)
      
      // Immediately update local state to remove the invoice from scheduled list
      setScheduledInvoices(prev => prev.filter(inv => inv.id !== scheduledInvoice.id));
      
      // Force a refresh of the invoices from Firestore to ensure everything is in sync
      await refreshInvoices();
      
      // Use toast instead of alert
      showToast('success', `Invoice for ${scheduledInvoice.clientName} has been created and sent successfully`);
    } catch (error) {
      console.error("Error sending invoice now:", error)
      // Use toast instead of alert for errors too
      showToast('error', `Error creating invoice: ${error.message}`);
    }
  }

  const handleMonthChange = (months) => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(newDate.getMonth() + months)
    setSelectedMonth(newDate)
  }

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice)
    setShowInvoiceDrawer(true)
  }

  // Invoice status options
  const INVOICE_STATUS_OPTIONS = ['Pending', 'Paid', 'Overdue', 'Scheduled'];

  // Add filter bar UI at the top
  const filteredInvoices = invoices.filter(invoice => {
    // Skip deleted or scheduled invoices
    if (invoice.deleted || invoice.status === 'scheduled') return false;
    
    // Status
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1));
    
    // Due Date
    const dueDate = new Date(invoice.dueDate);
    const matchesDueDate = (!dateRange[0] || dueDate >= new Date(dateRange[0])) && (!dateRange[1] || dueDate <= new Date(dateRange[1]));
    
    // Invoice Date
    const invoiceDate = new Date(invoice.date || invoice.createdAt);
    const matchesInvoiceDate = (!invoiceDateRange[0] || invoiceDate >= new Date(invoiceDateRange[0])) && 
                              (!invoiceDateRange[1] || invoiceDate <= new Date(invoiceDateRange[1]));
    
    // Search
    const matchesSearch = 
      invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Month filter (existing logic)
    const monthFilterDate = new Date(invoice.dueDate);
    const isInSelectedMonth =
      monthFilterDate.getMonth() === selectedMonth.getMonth() &&
      monthFilterDate.getFullYear() === selectedMonth.getFullYear();
    
    return matchesStatus && matchesDueDate && matchesInvoiceDate && matchesSearch && isInSelectedMonth;
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  // Add handler to send reminder email
  async function handleSendReminder(invoice, setInvoices, setSelectedInvoice, e) {
    if (e) e.stopPropagation(); // Prevent drawer from opening
    
    // Set loading state
    showToast('info', 'Sending reminder...', { autoClose: false, toastId: 'sending-reminder' });
    
    try {
      const user = auth.currentUser;
      console.log("Current auth user:", user);
      
      if (!user) {
        console.error("Not authenticated - user is null");
        toast.dismiss('sending-reminder');
        showToast('error', 'You must be logged in to send reminders.');
        throw new Error('Not authenticated');
      }
      
      // Ensure we have a fresh token
      await user.getIdToken(true);
      console.log("Auth token refreshed");
      
      // Find the client for this invoice
      const client = clients.find(c => c.id === invoice.clientId);
      if (!client) {
        console.error("Client not found for ID:", invoice.clientId);
        toast.dismiss('sending-reminder');
        showToast('error', 'Client information not found.');
        throw new Error('Client not found');
      }
      
      console.log("Calling sendInvoiceReminder function with params:", {
        userId: user.uid,
        invoiceId: invoice.id,
        clientId: client.id
      });
      
      const result = await sendInvoiceReminder({
        userId: user.uid,
        invoiceId: invoice.id,
        clientId: client.id
      });
      
      console.log("sendInvoiceReminder result:", result);
      toast.dismiss('sending-reminder');
      showToast('success', 'Reminder email sent!');
    } catch (error) {
      toast.dismiss('sending-reminder');
      console.error("Send reminder error:", error);
      
      // Check for specific error codes and provide user-friendly messages
      if (error.code === "functions/resource-exhausted") {
        console.error("SendGrid credits exceeded:", error);
        showToast('error', 'Email sending limit reached. Please upgrade your SendGrid plan or try again later.');
      } else if (error.code === "functions/unauthenticated" || 
          (error.message && error.message.includes("Unauthorized")) || 
          (error.details && error.details.includes("Unauthorized"))) {
        console.error("Authentication error details:", error);
        showToast('error', 'Authentication failed. Please log out and log back in.');
      } else if (error.code === "functions/permission-denied") {
        showToast('error', 'You do not have permission to send this reminder.');
      } else if (error.code === "functions/not-found") {
        showToast('error', 'The invoice or client information could not be found.');
      } else if (error.code === "functions/invalid-argument") {
        showToast('error', 'Invalid information provided. Please try again.');
      } else if (error.code && error.code.startsWith("functions/")) {
        showToast('error', `Server error: ${error.message || "Unknown error"}`);
      } else {
        showToast('error', `Failed to send reminder: ${error.message || "Unknown error"}`);
      }
    }
  }

  // Add handler to mark invoice as paid
  async function handleMarkPaid(invoice, setInvoices, setSelectedInvoice) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const paidAt = new Date().toISOString();
      await updateInvoice(user.uid, { ...invoice, status: 'paid', paidAt });
      setInvoices(prev => prev.map(inv => inv.id === invoice.id ? { ...inv, status: 'paid', paidAt } : inv));
      setSelectedInvoice && setSelectedInvoice(prev => prev && prev.id === invoice.id ? { ...prev, status: 'paid', paidAt } : prev);
      showToast('success', 'Invoice marked as paid!');
    } catch (error) {
      showToast('error', 'Failed to mark as paid.');
      console.error('Mark paid error:', error);
    }
  }

  // Add handler to mark invoice as unpaid
  async function handleMarkUnpaid(invoice, setInvoices, setSelectedInvoice) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      // Restore original invoice date and due date
      const updatedInvoice = {
        ...invoice,
        status: 'pending',
      };
      delete updatedInvoice.paidAt; // Remove the paidAt field
      await updateInvoice(user.uid, updatedInvoice);
      setInvoices(prev => prev.map(inv => inv.id === invoice.id ? updatedInvoice : inv));
      setSelectedInvoice && setSelectedInvoice(prev => prev && prev.id === invoice.id ? updatedInvoice : prev);
      showToast('success', 'Invoice marked as unpaid!');
    } catch (error) {
      showToast('error', 'Failed to mark as unpaid.');
      console.error('Mark unpaid error:', error);
    }
  }

  // Add this function in the Invoices component:
  const handleUpdateInvoice = async (updatedInvoice) => {
    console.log('handleUpdateInvoice called', updatedInvoice);
    const user = auth.currentUser;
    if (!user) return;
    
    // CRITICAL FIX: Always remove the _bulkUpdate flag that might have been added in a previous update
    // This ensures the modal always shows, even for repeated updates to the same invoice
    const cleanedInvoice = { ...updatedInvoice };
    delete cleanedInvoice._bulkUpdate;
    console.log('Invoice cleaned of _bulkUpdate flag:', cleanedInvoice);
    
    // Check if this is an active invoice (status is 'pending' or 'overdue')
    if (cleanedInvoice.status === 'pending' || cleanedInvoice.status === 'overdue') {
      console.log('Displaying active invoice update modal');
      // Find the original invoice to compare changes - use the latest version from state
      const originalInvoice = invoices.find(inv => inv.id === cleanedInvoice.id);
      if (!originalInvoice) return;
      
      // Force refreshing invoices to ensure we have the latest data
      let latestInvoices = invoices;
      try {
        if (initialLoad) {
          latestInvoices = await getInvoices(user.uid);
          setInvoices(latestInvoices);
        }
      } catch (error) {
        console.error("Error refreshing invoices:", error);
      }
      // Check if we have future invoices for this client with same seriesId (recurring series)
      let futureInvoices = [];
      if (cleanedInvoice.seriesId) {
        futureInvoices = latestInvoices.filter(inv =>
          inv.seriesId === cleanedInvoice.seriesId &&
          inv.status === 'scheduled' &&
          new Date(inv.date) > new Date() &&
          inv.id !== cleanedInvoice.id
        );
      } else {
        // fallback for legacy invoices without seriesId
        futureInvoices = latestInvoices.filter(inv =>
          inv.clientId === cleanedInvoice.clientId &&
          inv.status === 'scheduled' &&
          inv.description === cleanedInvoice.description &&
          new Date(inv.date) > new Date() &&
          inv.id !== cleanedInvoice.id
        );
      }
      // Only show modal if amount, dueDate, or description changed
      if (
        originalInvoice.amount !== cleanedInvoice.amount ||
        originalInvoice.dueDate !== cleanedInvoice.dueDate ||
        originalInvoice.description !== cleanedInvoice.description
      ) {
        // ... existing code ...
      }
      
      console.log('Future invoices found:', futureInvoices.length);
      console.log('Current modal state:', showActiveInvoiceUpdateModal);
      
      // First, completely reset modal state by closing it
      setShowActiveInvoiceUpdateModal(false);
      setActiveInvoiceUpdateData(null);
      
      // Increment the key to ensure React sees this as a new modal instance
      modalKeyRef.current += 1;
      
      // Prepare the data for the modal
      const modalData = {
        updatedInvoice: cleanedInvoice,
        originalInvoice,
        futureInvoices,
        client: clients.find(c => c.id === cleanedInvoice.clientId),
        modalKey: modalKeyRef.current
      };
      
      console.log('Setting activeInvoiceUpdateData:', modalData);
      
      // Use setTimeout to ensure state updates happen in sequence
      setTimeout(() => {
        // Set the data first
        setActiveInvoiceUpdateData(modalData);
        
        // Then open the modal in another tick
        setTimeout(() => {
          console.log('Opening modal now');
          setShowActiveInvoiceUpdateModal(true);
        }, 50);
      }, 50);
      
      return;
    }
    
    // Only intercept if this is a scheduled invoice and not a bulk update
    if (cleanedInvoice.status === 'scheduled') {
      // Find all future scheduled invoices for the same client AND same service (description)
      const allInvoices = await getInvoices(user.uid);
      const futureInvoices = allInvoices.filter(inv =>
        inv.clientId === cleanedInvoice.clientId &&
        inv.status === 'scheduled' &&
        inv.description === cleanedInvoice.description && // Only update invoices with the same description
        new Date(inv.date) >= new Date(cleanedInvoice.date) &&
        inv.id !== cleanedInvoice.id
      );
      setPendingUpdateData({ updatedInvoice: cleanedInvoice, futureInvoices });
      setFutureScheduledCount(futureInvoices.length);
      setShowUpdateModal(true);
      return;
    }
    
    // Normal update for single invoice
    try {
      await updateInvoice(user.uid, cleanedInvoice);
      setInvoices(prev => prev.map(inv => inv.id === cleanedInvoice.id ? cleanedInvoice : inv));
      setShowForm(false);
      setEditingInvoice(null);
      setSuccessMessage(`Invoice #${cleanedInvoice.invoiceNumber} updated successfully.`);
    } catch (error) {
      showToast('error', 'Failed to update invoice.');
      console.error('Update invoice error:', error);
    }
  };

  // Handler for modal confirmation
  const handleUpdateModalConfirm = async (scope) => {
    setShowUpdateModal(false);
    if (!pendingUpdateData) return;
    const { updatedInvoice, futureInvoices } = pendingUpdateData;
    const user = auth.currentUser;
    if (!user) return;
    if (scope === 'single') {
      // Update only the selected invoice
      // Make a clean copy without the _bulkUpdate flag
      const cleanInvoice = { ...updatedInvoice };
      // Safely remove the _bulkUpdate flag
      delete cleanInvoice._bulkUpdate;
      console.log('Cleaned invoice for single update:', cleanInvoice);
      await handleUpdateInvoice(cleanInvoice);
    } else {
      // Update all future scheduled invoices of the same type (including the selected one)
      // --- NEW LOGIC: Recalculate dates for all future invoices based on the new date and frequency ---
      let currentDate = new Date(updatedInvoice.date);
      const frequency = updatedInvoice.billingFrequency;
      const netDays = agentConfig && agentConfig.netDays !== undefined ? agentConfig.netDays : 0;
      const updates = [updatedInvoice, ...futureInvoices].map((inv, idx) => {
        // Create a clean invoice without _bulkUpdate flag
        const cleanInv = { ...inv };
        delete cleanInv._bulkUpdate;
        // For the first invoice, use the updated date; for others, increment by frequency
        let newDate;
        if (idx === 0) {
          newDate = currentDate;
        } else {
          currentDate = calculateNextInvoiceDate(currentDate, frequency);
          newDate = currentDate;
        }
        // Calculate due date based on agentConfig.netDays
        let newDueDate;
        if (netDays) {
          newDueDate = addDays(newDate, netDays).toISOString().slice(0, 10);
        } else {
          newDueDate = newDate.toISOString().slice(0, 10);
        }
        return {
          ...cleanInv,
          amount: updatedInvoice.amount,
          date: newDate.toISOString().slice(0, 10),
          dueDate: newDueDate,
          billingFrequency: frequency, // Propagate billing frequency changes
          activity: [
            ...(cleanInv.activity || []),
            {
              type: 'updated',
              date: new Date().toISOString(),
              stage: 'Amount/date updated via bulk edit'
            }
          ]
        };
      });
      for (const inv of updates) {
        await updateInvoice(user.uid, inv);
      }
      setInvoices(prev => prev.map(inv => {
        const updated = updates.find(u => u.id === inv.id);
        return updated ? updated : inv;
      }));
      setShowForm(false);
      setEditingInvoice(null);
      setSuccessMessage(`Updated ${updates.length} scheduled invoices for this service.`);
    }
    setPendingUpdateData(null);
  };

  // Handler for active invoice update modal confirmation
  const handleActiveInvoiceUpdateConfirm = async (options) => {
    setShowActiveInvoiceUpdateModal(false);
    if (!activeInvoiceUpdateData) return;
    
    const { updatedInvoice, originalInvoice, futureInvoices, client } = activeInvoiceUpdateData;
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      // Add activity log entry for the changes
      const changes = [];
      if (originalInvoice.amount !== updatedInvoice.amount) {
        changes.push(`Amount changed from $${originalInvoice.amount} to $${updatedInvoice.amount}`);
      }
      if (originalInvoice.description !== updatedInvoice.description) {
        changes.push(`Description changed from "${originalInvoice.description}" to "${updatedInvoice.description}"`);
      }
      if (originalInvoice.dueDate !== updatedInvoice.dueDate) {
        changes.push(`Due date changed from ${originalInvoice.dueDate} to ${updatedInvoice.dueDate}`);
      }
      
      // CRITICAL FIX: Create a clean copy of the invoice without the _bulkUpdate flag
      // to prevent issues with subsequent edits
      const cleanInvoice = { ...updatedInvoice };
      delete cleanInvoice._bulkUpdate;
      
      // Add activity log entry to the invoice
      const invoiceWithActivity = {
        ...cleanInvoice,
        activity: [
          ...(cleanInvoice.activity || []),
          {
            type: 'updated',
            date: new Date().toISOString(),
            changes: changes.join('; '),
            notifiedClient: options.notifyClient
          }
        ]
      };
      
      // Update the invoice
      await updateInvoice(user.uid, invoiceWithActivity);
      
      // Update future invoices if requested
      if (options.updateFutureInvoices && futureInvoices.length > 0) {
        const updates = futureInvoices.map(inv => {
          // Remove _bulkUpdate flag from each future invoice too
          const cleanFutureInvoice = { ...inv };
          delete cleanFutureInvoice._bulkUpdate;
          
          return {
            ...cleanFutureInvoice,
            amount: cleanInvoice.amount,
            description: cleanInvoice.description,
            activity: [
              ...(cleanFutureInvoice.activity || []),
              {
                type: 'updated',
                date: new Date().toISOString(),
                stage: 'Updated from active invoice change'
              }
            ]
          };
        });
        
        for (const inv of updates) {
          await updateInvoice(user.uid, inv);
        }
        
        // Update the local state with all changes
        setInvoices(prev => prev.map(inv => {
          if (inv.id === invoiceWithActivity.id) return invoiceWithActivity;
          const updated = updates.find(u => u.id === inv.id);
          return updated ? updated : inv;
        }));
        
        setSuccessMessage(`Updated invoice #${updatedInvoice.invoiceNumber} and ${futureInvoices.length} future invoices.`);
      } else {
        // Just update the single invoice in the UI
        setInvoices(prev => prev.map(inv => 
          inv.id === invoiceWithActivity.id ? invoiceWithActivity : inv
        ));
        setSelectedInvoice(prev => prev && prev.id === invoiceWithActivity.id ? invoiceWithActivity : prev);
        setSuccessMessage(`Invoice #${updatedInvoice.invoiceNumber} updated successfully.`);
      }
      
      // If notification is requested, call Firebase Function to send email
      if (options.notifyClient && client) {
        // Call the Firebase function to send the notification email
        try {
          showToast('info', 'Sending notification email to client...', { autoClose: false, toastId: 'sending-update-notification' });
          
          // Call the update notification function
          const result = await sendInvoiceUpdateNotification({
            userId: user.uid,
            invoiceId: invoiceWithActivity.id,
            clientId: client.id,
            changes: changes.join('; ')
          });
          
          console.log("sendInvoiceUpdateNotification result:", result);
          toast.dismiss('sending-update-notification');
          showToast('success', 'Update notification sent successfully!');
        } catch (error) {
          toast.dismiss('sending-update-notification');
          console.error('Error sending update notification:', error);
          
          if (error.code === "functions/resource-exhausted") {
            showToast('error', 'Email sending limit reached. Please upgrade your SendGrid plan or try again later.');
          } else if (error.code === "functions/unauthenticated") {
            showToast('error', 'Authentication failed. Please log out and log back in.');
          } else {
            showToast('error', `Failed to send notification: ${error.message || "Unknown error"}`);
          }
        }
      }
      
      // Refresh invoices from the server to ensure we have the latest data
      setTimeout(async () => {
        try {
          const latestInvoices = await getInvoices(user.uid);
          setInvoices(latestInvoices);
        } catch (error) {
          console.error('Error refreshing invoices after update:', error);
        }
      }, 500);
      
      setShowForm(false);
      setEditingInvoice(null);
    } catch (error) {
      showToast('error', 'Failed to update invoice.');
      console.error('Active invoice update error:', error);
    }
    
    // Clear the active invoice update data after a short delay to ensure clean state
    setTimeout(() => {
      setActiveInvoiceUpdateData(null);
    }, 100);
  };

  // Add handler to send escalation email
  async function handleSendEscalation(invoice, setInvoices, setSelectedInvoice, e) {
    if (e) e.stopPropagation();
    showToast('info', 'Sending escalation...', { autoClose: false, toastId: 'sending-escalation' });
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.dismiss('sending-escalation');
        showToast('error', 'You must be logged in to send escalations.');
        throw new Error('Not authenticated');
      }
      await user.getIdToken(true);
      const client = clients.find(c => c.id === invoice.clientId);
      if (!client) {
        toast.dismiss('sending-escalation');
        showToast('error', 'Client information not found.');
        throw new Error('Client not found');
      }
      const result = await sendInvoiceEscalation({
        userId: user.uid,
        invoiceId: invoice.id,
        clientId: client.id
      });
      toast.dismiss('sending-escalation');
      showToast('success', 'Escalation email sent!');
    } catch (error) {
      toast.dismiss('sending-escalation');
      if (error.code === "functions/resource-exhausted") {
        showToast('error', 'Email sending limit reached. Please upgrade your SendGrid plan or try again later.');
      } else if (error.code === "functions/unauthenticated") {
        showToast('error', 'Authentication failed. Please log out and log back in.');
      } else if (error.code === "functions/permission-denied") {
        showToast('error', 'You do not have permission to send this escalation.');
      } else if (error.code === "functions/not-found") {
        showToast('error', 'The invoice or client information could not be found.');
      } else if (error.code === "functions/invalid-argument") {
        showToast('error', 'Invalid information provided. Please try again.');
      } else if (error.code && error.code.startsWith("functions/")) {
        showToast('error', `Server error: ${error.message || "Unknown error"}`);
      } else {
        showToast('error', `Failed to send escalation: ${error.message || "Unknown error"}`);
      }
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    if (status) {
      // Capitalize first letter for filter match (e.g., 'Paid', 'Pending')
      setStatusFilter([status.charAt(0).toUpperCase() + status.slice(1)]);
    } else {
      setStatusFilter([]);
    }
  }, [location.search]);

  // Move this useEffect to the top level (if not already):
  useEffect(() => {
    if (showForm && modalContentRef.current) {
      modalContentRef.current.scrollTop = 0;
    }
  }, [showForm]);

  if (loading) {
    return <div className="min-h-[300px] flex items-center justify-center text-lg text-secondary-600">Loading invoices...</div>
  }

  // Find the main invoice list/table render and add this above it:
  if (isMobile) {
    // Separate scheduled and regular invoices
    const regularInvoices = invoices.filter(inv => !inv.deleted && inv.status !== 'scheduled');
    const scheduledInvoices = invoices.filter(inv => !inv.deleted && inv.status === 'scheduled');
    return (
      <div className="p-2 pb-24">
        <div className="sticky top-0 z-10 bg-white pb-2">
          <button
            onClick={() => setShowForm(true)}
            className="w-full mb-2 px-4 py-3 bg-primary-600 text-white rounded-xl font-bold text-lg shadow hover:bg-primary-700 transition"
          >
            + Add Invoice
          </button>
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-2"
          />
          <button
            className="w-full mb-2 px-4 py-2 bg-secondary-100 text-secondary-700 rounded-lg font-semibold text-base shadow hover:bg-secondary-200 transition"
            onClick={() => setShowFilters(f => !f)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          {showFilters && (
            <div className="bg-white rounded-xl shadow-soft p-4 mb-2">
              <div className="mb-4 flex justify-between items-center">
                <h3 className="text-base font-medium text-secondary-800">Filters</h3>
                <button
                  onClick={() => {
                    setStatusFilter([])
                    setDateRange([undefined, undefined])
                    setInvoiceDateRange([undefined, undefined])
                  }}
                  className="px-3 py-1 text-xs bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Status</label>
                  <MultiSelectDropdown
                    label="Status"
                    options={INVOICE_STATUS_OPTIONS}
                    selected={statusFilter}
                    setSelected={setStatusFilter}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Invoice Date</label>
                  <DateRangePopover
                    label="Invoice Date"
                    value={invoiceDateRange}
                    setValue={setInvoiceDateRange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Due Date</label>
                  <DateRangePopover
                    label="Due Date"
                    value={dateRange}
                    setValue={setDateRange}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        {/* InvoiceForm Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={(e) => { 
            // Only close if the click was directly on this element (the backdrop)
            if (e.target === e.currentTarget) {
              setShowForm(false); 
              setEditingInvoice(null);
            }
          }}>
            <div
              className="bg-white rounded-none shadow-xl w-full h-full max-w-none max-h-none m-0 p-0 relative flex flex-col"
              onClick={e => e.stopPropagation()}
              ref={modalContentRef}
              style={{ height: '100%', width: '100%', overflowY: 'auto' }}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
                <h2 className="text-xl font-bold text-secondary-900">{editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}</h2>
                <button className="text-secondary-400 hover:text-secondary-700 text-2xl" onClick={() => { setShowForm(false); setEditingInvoice(null); }} aria-label="Close">&times;</button>
              </div>
              <div className="p-6 pt-2 flex-1 overflow-y-auto">
                <InvoiceForm
                  invoice={editingInvoice}
                  onSubmit={editingInvoice ? handleUpdateInvoice : handleAddInvoice}
                  onCancel={() => { setShowForm(false); setEditingInvoice(null); }}
                  clients={clients}
                  isMobile={isMobile}
                />
              </div>
            </div>
          </div>
        )}
        {/* Regular Invoices */}
        {regularInvoices.length > 0 && (
          <>
            <div className="text-lg font-semibold text-secondary-700 mt-4 mb-2">Invoices</div>
            {regularInvoices.filter(inv => {
              // Apply search and filters
              const matchesSearch =
                inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inv.description.toLowerCase().includes(searchTerm.toLowerCase());
              // Status filter
              const matchesStatus = statusFilter.length === 0 || statusFilter.includes(inv.status.charAt(0).toUpperCase() + inv.status.slice(1));
              // Date filters
              const dueDate = new Date(inv.dueDate);
              const matchesDueDate = (!dateRange[0] || dueDate >= new Date(dateRange[0])) && (!dateRange[1] || dueDate <= new Date(dateRange[1]));
              const invoiceDate = new Date(inv.date || inv.createdAt);
              const matchesInvoiceDate = (!invoiceDateRange[0] || invoiceDate >= new Date(invoiceDateRange[0])) && (!invoiceDateRange[1] || invoiceDate <= new Date(invoiceDateRange[1]));
              return matchesSearch && matchesStatus && matchesDueDate && matchesInvoiceDate;
            }).map((invoice) => {
              const client = clients.find(c => c.id === invoice.clientId) || {};
              return (
                <MobileInvoiceTile
                  key={invoice.id}
                  invoice={invoice}
                  client={client}
                  onMarkPaid={() => handleMarkPaid(invoice, setInvoices, setSelectedInvoice)}
                  onMarkUnpaid={() => handleMarkUnpaid(invoice, setInvoices, setSelectedInvoice)}
                  onEdit={() => handleEditInvoice(invoice)}
                  onDelete={async () => {
                    const user = auth.currentUser;
                    if (user) {
                      try {
                        await deleteInvoice(user.uid, invoice.id);
                        setInvoices(prev => prev.filter(inv => inv.id !== invoice.id));
                        showToast('success', 'Invoice deleted.');
                      } catch (error) {
                        showToast('error', 'Failed to delete invoice.');
                      }
                    }
                  }}
                  onSendReminder={() => handleSendReminder(invoice, setInvoices, setSelectedInvoice)}
                  onSendEscalation={() => handleSendEscalation(invoice, setInvoices, setSelectedInvoice)}
                />
              );
            })}
          </>
        )}
        {/* Scheduled Invoices */}
        {scheduledInvoices.length > 0 && (
          <>
            <button
              className="w-full mb-2 px-4 py-2 bg-secondary-100 text-secondary-700 rounded-lg font-semibold text-base shadow hover:bg-secondary-200 transition"
              onClick={() => setShowScheduledMobile(v => !v)}
            >
              {showScheduledMobile ? 'Hide Scheduled Invoices' : `Show Scheduled Invoices (${scheduledInvoices.length})`}
            </button>
            {showScheduledMobile && (
              <>
                <div className="text-lg font-semibold text-secondary-700 mt-4 mb-2">Scheduled Invoices</div>
                {scheduledInvoices.filter(inv => {
                  // Apply search and filters
                  const matchesSearch =
                    inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    inv.description.toLowerCase().includes(searchTerm.toLowerCase());
                  // Status filter
                  const matchesStatus = statusFilter.length === 0 || statusFilter.includes(inv.status.charAt(0).toUpperCase() + inv.status.slice(1));
                  // Date filters
                  const dueDate = new Date(inv.dueDate);
                  const matchesDueDate = (!dateRange[0] || dueDate >= new Date(dateRange[0])) && (!dateRange[1] || dueDate <= new Date(dateRange[1]));
                  const invoiceDate = new Date(inv.date || inv.createdAt);
                  const matchesInvoiceDate = (!invoiceDateRange[0] || invoiceDate >= new Date(invoiceDateRange[0])) && (!invoiceDateRange[1] || invoiceDate <= new Date(invoiceDateRange[1]));
                  return matchesSearch && matchesStatus && matchesDueDate && matchesInvoiceDate;
                }).map((invoice) => {
                  const client = clients.find(c => c.id === invoice.clientId) || {};
                  return (
                    <MobileInvoiceTile
                      key={invoice.id}
                      invoice={invoice}
                      client={client}
                      onMarkPaid={() => handleMarkPaid(invoice, setInvoices, setSelectedInvoice)}
                      onMarkUnpaid={() => handleMarkUnpaid(invoice, setInvoices, setSelectedInvoice)}
                      onEdit={() => handleEditInvoice(invoice)}
                      onDelete={async () => {
                        const user = auth.currentUser;
                        if (user) {
                          try {
                            await deleteInvoice(user.uid, invoice.id);
                            setInvoices(prev => prev.filter(inv => inv.id !== invoice.id));
                            showToast('success', 'Invoice deleted.');
                          } catch (error) {
                            showToast('error', 'Failed to delete invoice.');
                          }
                        }
                      }}
                      onSendReminder={() => handleSendReminder(invoice, setInvoices, setSelectedInvoice)}
                      onSendEscalation={() => handleSendEscalation(invoice, setInvoices, setSelectedInvoice)}
                    />
                  );
                })}
              </>
            )}
          </>
        )}
        
        {/* Add the ActiveInvoiceUpdateModal to the mobile version */}
        <ActiveInvoiceUpdateModal
          key={activeInvoiceUpdateData?.modalKey || 'mobile-update-modal'}
          isOpen={showActiveInvoiceUpdateModal}
          onClose={() => setShowActiveInvoiceUpdateModal(false)}
          onConfirm={handleActiveInvoiceUpdateConfirm}
          invoiceNumber={activeInvoiceUpdateData?.updatedInvoice?.invoiceNumber || ''}
          clientName={activeInvoiceUpdateData?.client?.name || ''}
          originalValues={{
            amount: activeInvoiceUpdateData?.originalInvoice?.amount || '',
            description: activeInvoiceUpdateData?.originalInvoice?.description || '',
            dueDate: activeInvoiceUpdateData?.originalInvoice?.dueDate || '',
            billingFrequency: activeInvoiceUpdateData?.originalInvoice?.billingFrequency || 'one-time'
          }}
          newValues={{
            amount: activeInvoiceUpdateData?.updatedInvoice?.amount || '',
            description: activeInvoiceUpdateData?.updatedInvoice?.description || '',
            dueDate: activeInvoiceUpdateData?.updatedInvoice?.dueDate || '',
            billingFrequency: activeInvoiceUpdateData?.updatedInvoice?.billingFrequency || 'one-time'
          }}
          futureInvoicesCount={activeInvoiceUpdateData?.futureInvoices?.length || 0}
        />
        
        {/* Add other modals */}
        <UpdateScheduledInvoicesModal
          isOpen={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          onConfirm={handleUpdateModalConfirm}
          futureCount={futureScheduledCount}
          invoiceAmount={pendingUpdateData?.updatedInvoice?.amount}
          invoiceDate={pendingUpdateData?.updatedInvoice?.date}
        />
        
        <DeleteInvoiceModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteModalConfirm}
          invoice={deleteModalData?.invoice}
          futureInvoicesCount={deleteModalData?.futureInvoices?.length || 0}
          isRecurring={deleteModalData?.isRecurring}
          isScheduled={deleteModalData?.isScheduled}
          clientName={deleteModalData?.client?.name || ''}
        />
        
        {successMessage && (
          <SuccessNotification 
            message={successMessage} 
            onClose={() => setSuccessMessage(null)} 
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-secondary-900">Invoices</h2>
        <div className="flex flex-row items-center space-x-2 md:space-x-2">
          {/* Mobile: right-aligned actions */}
          <div className="flex flex-row items-center space-x-2 md:hidden">
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors duration-200 flex items-center space-x-2 text-base font-medium shadow-sm"
              style={{ minWidth: 'auto' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Invoice</span>
            </button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="p-2 rounded-full bg-secondary-100 text-secondary-700 hover:bg-secondary-200 focus:outline-none ml-1">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-[160px] bg-white border border-secondary-200 rounded-lg shadow-lg p-2 mt-2">
                <DropdownMenu.Item asChild>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-secondary-50 rounded flex items-center space-x-2"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                    <span>Show Filters</span>
                  </button>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-secondary-50 rounded flex items-center space-x-2"
                    onClick={() => {
                      const now = new Date();
                      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
                      const columns = [
                        'invoiceNumber', 'clientName', 'amount', 'description', 'date', 'dueDate', 'status', 'billingFrequency', 'isRecurring'
                      ];
                      const data = invoices.filter(inv => {
                        if (inv.status === 'scheduled') return false;
                        const invDate = new Date(inv.date);
                        return invDate >= twelveMonthsAgo && invDate <= now;
                      }).map(inv => ({
                        invoiceNumber: inv.invoiceNumber,
                        clientName: inv.clientName,
                        amount: inv.amount,
                        description: inv.description,
                        date: inv.date,
                        dueDate: inv.dueDate,
                        status: inv.status,
                        billingFrequency: inv.billingFrequency,
                        isRecurring: inv.isRecurring ? 'Yes' : 'No'
                      }));
                      exportToCSV({ data, filename: `invoices-${new Date().toISOString().slice(0,10)}.csv`, columns });
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      <path d="M8 16h8M8 12h8M8 8h8" />
                    </svg>
                    <span>Export to CSV</span>
                  </button>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
          {/* Desktop: all actions visible, left-aligned */}
          <div className="hidden md:flex flex-row space-x-2 items-center">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200 transition-colors duration-200 flex items-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
              <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Invoice</span>
            </button>
            <button
              onClick={() => {
                const now = new Date();
                const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
                const columns = [
                  'invoiceNumber', 'clientName', 'amount', 'description', 'date', 'dueDate', 'status', 'billingFrequency', 'isRecurring'
                ];
                const data = invoices.filter(inv => {
                  if (inv.status === 'scheduled') return false;
                  const invDate = new Date(inv.date);
                  return invDate >= twelveMonthsAgo && invDate <= now;
                }).map(inv => ({
                  invoiceNumber: inv.invoiceNumber,
                  clientName: inv.clientName,
                  amount: inv.amount,
                  description: inv.description,
                  date: inv.date,
                  dueDate: inv.dueDate,
                  status: inv.status,
                  billingFrequency: inv.billingFrequency,
                  isRecurring: inv.isRecurring ? 'Yes' : 'No'
                }));
                exportToCSV({ data, filename: `invoices-${new Date().toISOString().slice(0,10)}.csv`, columns });
              }}
              className="px-4 py-2 bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200 flex items-center space-x-2"
              aria-label="Export to CSV"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                <path d="M8 16h8M8 12h8M8 8h8" />
              </svg>
              <span className="hidden sm:inline">Export to CSV</span>
            </button>
          </div>
        </div>
      </div>
      <div className={`transition-all duration-300 overflow-hidden ${showFilters ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-white rounded-xl shadow-soft p-6 mb-4">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-lg font-medium text-secondary-800">Filters</h3>
            <button
              onClick={() => {
                setStatusFilter([])
                setDateRange([undefined, undefined])
                setInvoiceDateRange([undefined, undefined])
              }}
              className="px-3 py-1 text-sm bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200"
            >
              Clear All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Group 1: Invoice Status */}
            <div className="space-y-2 border border-secondary-100 rounded-lg overflow-hidden">
              <h4 className="text-sm font-semibold text-secondary-800 border-b border-secondary-200 pb-2 uppercase tracking-wider bg-secondary-50 px-4 py-2">Invoice Status</h4>
              <div className="space-y-4 p-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Status</label>
                  <MultiSelectDropdown
                    label="Status"
                    options={INVOICE_STATUS_OPTIONS}
                    selected={statusFilter}
                    setSelected={setStatusFilter}
                  />
                </div>
              </div>
            </div>
            {/* Group 2: Invoice Dates */}
            <div className="space-y-2 border border-secondary-100 rounded-lg overflow-hidden">
              <h4 className="text-sm font-semibold text-secondary-800 border-b border-secondary-200 pb-2 uppercase tracking-wider bg-secondary-50 px-4 py-2">Invoice Dates</h4>
              <div className="space-y-4 p-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Invoice Date</label>
                  <DateRangePopover
                    label="Invoice Date"
                    value={invoiceDateRange}
                    setValue={setInvoiceDateRange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Due Date</label>
                  <DateRangePopover
                    label="Due Date"
                    value={dateRange}
                    setValue={setDateRange}
                  />
                </div>
              </div>
            </div>
            {/* (Optional) Add more filter groups here if needed */}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleMonthChange(-1)}
              className="p-2 text-secondary-600 hover:text-primary-600 transition-colors duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-lg font-medium text-secondary-900">
              {selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => handleMonthChange(1)}
              className="p-2 text-secondary-600 hover:text-primary-600 transition-colors duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-secondary-200 bg-secondary-50">
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Invoice #</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Client</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Amount</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Description</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Invoice Date</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Due Date</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Status</th>
                <th className="text-right py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-secondary-100 hover:bg-secondary-50 cursor-pointer" onClick={() => handleViewInvoice(invoice)}>
                  <td className="py-4 px-4 font-medium text-secondary-900">
                    <div>{invoice.invoiceNumber || `INV-${invoice.id.substring(0, 4).toUpperCase()}`}</div>
                    <div className="text-xs text-secondary-400 mt-1">ID: {invoice.id}</div>
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-medium text-secondary-900">{invoice.clientName}</p>
                    {invoice.description && (
                      <div className="text-xs text-secondary-500 mt-1">{invoice.description}</div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-medium text-secondary-900">${invoice.amount}</span>
                  </td>
                  <td className="py-4 px-4 text-secondary-600">{invoice.description}</td>
                  <td className="py-4 px-4 text-secondary-600">
                    {invoice.date instanceof Date
                      ? format(invoice.date, 'yyyy-MM-dd')
                      : (invoice.date || (invoice.scheduledDate instanceof Date
                          ? format(invoice.scheduledDate, 'yyyy-MM-dd')
                          : invoice.scheduledDate))}
                  </td>
                  <td className="py-4 px-4 text-secondary-600">
                    {invoice.dueDate instanceof Date
                      ? format(invoice.dueDate, 'yyyy-MM-dd')
                      : invoice.dueDate}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>{invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end space-x-2">
                      {/* Mark Paid/Unpaid */}
                      {invoice.status === 'paid' ? (
                        <button
                          onClick={e => { e.stopPropagation(); handleMarkUnpaid(invoice, setInvoices, setSelectedInvoice); }}
                          className="p-2 text-secondary-600 hover:text-yellow-600 transition-colors duration-200"
                          title="Mark Unpaid"
                          aria-label="Mark Unpaid"
                        >
                          {/* Unpaid icon (circle with line) */}
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" strokeWidth="2" />
                            <line x1="8" y1="8" x2="16" y2="16" strokeWidth="2" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); handleMarkPaid(invoice, setInvoices, setSelectedInvoice); }}
                          className="p-2 text-secondary-600 hover:text-green-600 transition-colors duration-200"
                          title="Mark Paid"
                          aria-label="Mark Paid"
                        >
                          {/* Paid icon (check circle) */}
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" strokeWidth="2" />
                            <path d="M9 12l2 2l4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                      {/* Edit */}
                      <button
                        onClick={e => { e.stopPropagation(); handleEditInvoice(invoice); }}
                        className="p-2 text-secondary-600 hover:text-primary-600 transition-colors duration-200"
                        title="Edit"
                        aria-label="Edit"
                      >
                        {/* Edit icon */}
                        <Pencil2Icon className="w-5 h-5" />
                      </button>
                      {/* Delete */}
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteInvoice(invoice); }}
                        className="p-2 text-secondary-600 hover:text-red-600 transition-colors duration-200"
                        title="Delete"
                        aria-label="Delete"
                      >
                        {/* Delete icon */}
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      {/* Overflow menu for less common actions */}
                      {(invoice.status === 'pending' || invoice.status === 'overdue') && (
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button
                              className="p-2 text-secondary-600 hover:text-primary-600 transition-colors duration-200"
                              title="More Actions"
                              aria-label="More Actions"
                              onClick={e => e.stopPropagation()}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="19" cy="12" r="2" />
                                <circle cx="5" cy="12" r="2" />
                              </svg>
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content className="z-50 min-w-[160px] bg-white border border-secondary-200 rounded-lg shadow-lg p-2 mt-2">
                            <DropdownMenu.Item asChild>
                              <button
                                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary-50 rounded"
                                onClick={e => { e.stopPropagation(); handleSendReminder(invoice, setInvoices, setSelectedInvoice, e); }}
                              >
                                Send Reminder
                              </button>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item asChild>
                              <button
                                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary-50 rounded"
                                onClick={e => { e.stopPropagation(); handleSendEscalation(invoice, setInvoices, setSelectedInvoice, e); }}
                                disabled={invoice.activity && invoice.activity.some(a => a.type === 'escalation_sent')}
                              >
                                Send Escalation
                              </button>
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Root>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scheduled Invoices Section */}
      <div className="bg-white rounded-2xl shadow-soft p-6 mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-secondary-900">
            Upcoming Invoices {scheduledInvoices.length > 0 && <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-2">{scheduledInvoices.length}</span>}
          </h3>
          <div className="flex items-center space-x-2">
            <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded-full text-xs font-medium">
              Future 12 Months
            </span>
            <button
              onClick={() => setShowScheduled(!showScheduled)}
              className="text-secondary-500 hover:text-secondary-700"
            >
              {showScheduled ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        
        {showScheduled && (
          <>
            {/* Month selection tabs */}
            <div className="mb-6 overflow-x-auto">
              <div className="flex space-x-2 pb-2">
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date();
                  date.setMonth(date.getMonth() + i);
                  const monthYearLabel = `${months[date.getMonth()]} ${date.getFullYear()}`;
                  const isCurrentMonth = i === 0;
                  
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        // Set the selected month and year for schedule display
                        setSelectedScheduleMonth(date.getMonth());
                        setSelectedScheduleYear(date.getFullYear());
                        
                        // Force a refresh of the scheduled invoices display
                        setTimeout(() => {
                          setScheduledInvoices(prev => [...prev]);
                        }, 5);
                      }}
                      className={`relative px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                        (selectedScheduleMonth === date.getMonth() && selectedScheduleYear === date.getFullYear()) 
                          ? 'bg-primary-600 text-white' 
                          : isCurrentMonth 
                            ? 'bg-primary-50 text-primary-700' 
                            : 'bg-gray-50 text-secondary-600 hover:bg-gray-100'
                      }`}
                    >
                      {monthYearLabel}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {scheduledInvoices.filter(invoice => {
              const { invoiceMonth, invoiceYear } = getInvoiceMonthYear(invoice);
              return invoiceMonth === selectedScheduleMonth && invoiceYear === selectedScheduleYear;
            })
            .length === 0 ? (
              <div className="text-secondary-500 py-4 text-center">
                No upcoming invoices for {months[selectedScheduleMonth]} {selectedScheduleYear}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-secondary-200">
                      <th className="py-3 px-4 font-medium text-secondary-500">Client</th>
                      <th className="py-3 px-4 font-medium text-secondary-500">Amount</th>
                      <th className="py-3 px-4 font-medium text-secondary-500">Description</th>
                      <th className="py-3 px-4 font-medium text-secondary-500">Scheduled Date</th>
                      <th className="py-3 px-4 font-medium text-secondary-500">Due Date</th>
                      <th className="py-3 px-4 font-medium text-secondary-500">Type</th>
                      <th className="py-3 px-4 font-medium text-secondary-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduledInvoices
                      .filter(invoice => {
                        const { invoiceMonth, invoiceYear } = getInvoiceMonthYear(invoice);
                        return invoiceMonth === selectedScheduleMonth && invoiceYear === selectedScheduleYear;
                      })
                      .map((invoice, idx) => (
                      <tr key={`scheduled-${idx}-${invoice.clientId}`} className="border-b border-secondary-100">
                        <td className="py-4 px-4 font-medium text-secondary-900">
                          {invoice.clientName}
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-medium text-secondary-900">${invoice.amount}</span>
                        </td>
                        <td className="py-4 px-4 text-secondary-600">{invoice.description}</td>
                        <td className="py-4 px-4 text-secondary-600">
                          {invoice.date instanceof Date
                            ? format(invoice.date, 'yyyy-MM-dd')
                            : (invoice.date || (invoice.scheduledDate instanceof Date
                                ? format(invoice.scheduledDate, 'yyyy-MM-dd')
                                : invoice.scheduledDate))}
                        </td>
                        <td className="py-4 px-4 text-secondary-600">
                          {invoice.dueDate instanceof Date
                            ? format(invoice.dueDate, 'yyyy-MM-dd')
                            : invoice.dueDate}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium 
                            ${invoice.type === 'First Invoice'
                              ? 'bg-green-100 text-green-800'
                              : invoice.type === 'Pending Invoice'
                                ? 'bg-orange-100 text-orange-800'
                                : invoice.type === 'Manual Scheduled'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {invoice.type}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex justify-end space-x-2">
                            {(() => {
                              const scheduledDate = new Date(invoice.scheduledDate || invoice.date);
                              const now = new Date();
                              return scheduledDate.getMonth() === now.getMonth() && scheduledDate.getFullYear() === now.getFullYear();
                            })() && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSendNow(invoice); }}
                                className="p-2 text-secondary-600 hover:text-primary-600 transition-colors duration-200"
                                title="Send Now"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M22 2L15.5 22L11 13L2 8.5L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M11 13L15.5 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <line x1="7" y1="17" x2="4" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                  <line x1="9.5" y1="19.5" x2="7.5" y2="21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                  <line x1="12" y1="21" x2="10.5" y2="22.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditInvoice(invoice); }}
                              className="p-2 text-secondary-600 hover:text-primary-600 transition-colors duration-200"
                              title="Edit"
                            >
                              <Pencil2Icon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(invoice); }}
                              className="p-2 text-secondary-600 hover:text-red-600 transition-colors duration-200"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <Drawer
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingInvoice(null)
        }}
        title={editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
        maxWidth='max-w-[50vw]'
      >
        <InvoiceForm
          invoice={editingInvoice}
          clients={clients}
          onSubmit={editingInvoice ? handleUpdateInvoice : handleAddInvoice}
          onCancel={() => {
            setShowForm(false)
            setEditingInvoice(null)
          }}
          isMobile={isMobile}
        />
      </Drawer>

      <InvoiceDetailsDrawer
        isOpen={showInvoiceDrawer}
        onClose={() => setShowInvoiceDrawer(false)}
        invoice={selectedInvoice}
        onEditInvoice={invoice => {
          setEditingInvoice(invoice);
          setShowForm(true);
          setShowInvoiceDrawer(false);
        }}
      />

      {successMessage && (
        <SuccessNotification 
          message={successMessage} 
          onClose={() => setSuccessMessage(null)} 
        />
      )}

      <DeleteInvoiceModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteModalConfirm}
        invoice={deleteModalData?.invoice}
        futureInvoicesCount={deleteModalData?.futureInvoices?.length || 0}
        isRecurring={deleteModalData?.isRecurring}
        isScheduled={deleteModalData?.isScheduled}
        clientName={deleteModalData?.client?.name || ''}
      />

      <UpdateScheduledInvoicesModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleUpdateModalConfirm}
        futureCount={futureScheduledCount}
        invoiceAmount={pendingUpdateData?.updatedInvoice?.amount}
        invoiceDate={pendingUpdateData?.updatedInvoice?.date}
      />

      <ActiveInvoiceUpdateModal
        key={activeInvoiceUpdateData?.modalKey || undefined}
        isOpen={showActiveInvoiceUpdateModal}
        onClose={() => setShowActiveInvoiceUpdateModal(false)}
        onConfirm={handleActiveInvoiceUpdateConfirm}
        invoiceNumber={activeInvoiceUpdateData?.updatedInvoice?.invoiceNumber || ''}
        clientName={activeInvoiceUpdateData?.client?.name || ''}
        originalValues={{
          amount: activeInvoiceUpdateData?.originalInvoice?.amount || '',
          description: activeInvoiceUpdateData?.originalInvoice?.description || '',
          dueDate: activeInvoiceUpdateData?.originalInvoice?.dueDate || '',
          billingFrequency: activeInvoiceUpdateData?.originalInvoice?.billingFrequency || 'one-time'
        }}
        newValues={{
          amount: activeInvoiceUpdateData?.updatedInvoice?.amount || '',
          description: activeInvoiceUpdateData?.updatedInvoice?.description || '',
          dueDate: activeInvoiceUpdateData?.updatedInvoice?.dueDate || '',
          billingFrequency: activeInvoiceUpdateData?.updatedInvoice?.billingFrequency || 'one-time'
        }}
        futureInvoicesCount={activeInvoiceUpdateData?.futureInvoices?.length || 0}
      />
    </div>
  )
}

export default Invoices 