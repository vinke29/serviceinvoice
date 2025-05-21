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

const sendInvoiceReminder = httpsCallable(functions, 'sendInvoiceReminder');
const sendInvoiceEscalation = httpsCallable(functions, 'sendInvoiceEscalation');
console.log("sendInvoiceReminder is defined:", typeof sendInvoiceReminder);
console.log("sendInvoiceEscalation is defined:", typeof sendInvoiceEscalation);

// Helper function to check if a date is in the future
function isDateInFuture(checkDate) {
  // Create a date object from the checkDate
  const dateToCheck = new Date(checkDate);
  
  // Create date representation of "right now"
  const now = new Date();
  
  // Get local date strings in YYYY-MM-DD format
  const checkDateStr = dateToCheck.toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  // Log the exact comparison
  console.log('Date comparison:', {
    checkDate,
    dateToCheck: dateToCheck.toISOString(),
    nowDate: now.toISOString(),
    checkDateStr,
    todayStr,
    isInFuture: checkDateStr > todayStr
  });
  
  // A simple string comparison works reliably for YYYY-MM-DD format
  return checkDateStr > todayStr;
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

function InvoiceForm({ invoice, onSubmit, onCancel, clients = [] }) {
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
    customized: false
  })
  const [agentConfig, setAgentConfig] = useState(null)
  const [isFutureInvoice, setIsFutureInvoice] = useState(false)
  const [isCustomDueDate, setIsCustomDueDate] = useState(false);

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

  const handleSubmit = (e) => {
    e.preventDefault()
    
    const selectedClient = clients.find(c => c.id === formData.clientId);
    const finalData = {
      ...formData,
      clientId: formData.clientId,
      clientName: selectedClient.name,
      isRecurring: formData.billingFrequency !== 'one-time',
      customized: false
    }
    
    onSubmit(finalData)
  }
  
  const handleClientChange = (e) => {
    const clientId = e.target.value
    const selectedClient = clients.find(c => c.id === clientId)
    
    setFormData({ 
      ...formData, 
      clientId,
      clientName: selectedClient ? selectedClient.name : '',
      amount: formData.amount && formData.amount !== '' ? formData.amount : ''
    })
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-1 sm:px-0">
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Client</label>
        <select
          value={formData.clientId}
          onChange={handleClientChange}
          className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-base"
          required
        >
          <option value="">Select a client</option>
          {activeClients.length > 0 ? (
            activeClients.map(client => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))
          ) : (
            <option value="" disabled>No active clients available for invoicing</option>
          )}
        </select>
        {activeClients.length === 0 && (
          <p className="mt-2 text-sm text-secondary-600">
            Only active clients are eligible for invoicing. Please activate a client or add a new client to proceed.
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Amount</label>
        <div className="relative">
          <span className="absolute left-4 top-3 text-secondary-500 text-base">$</span>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full pl-8 pr-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base bg-white"
            required
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Billing Frequency</label>
        <select
          value={formData.billingFrequency}
          onChange={handleFrequencyChange}
          className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-base"
        >
          <option value="one-time">One-Time Charge</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="biannually">Bi-annually</option>
          <option value="annually">Annually</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base bg-white"
          rows="3"
          required
          placeholder="Describe the invoice..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Invoice Date</label>
        <input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base bg-white"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">
          Due Date
          {agentConfig && (
            <span className="text-xs text-secondary-500 ml-2">
              {isCustomDueDate
                ? '(Custom due date)'
                : `(Net ${agentConfig.netDays === 0 ? 'Due immediately' : `${agentConfig.netDays} days`})`}
            </span>
          )}
        </label>
        <input
          type="date"
          value={formData.dueDate}
          onChange={(e) => {
            setFormData({ ...formData, dueDate: e.target.value });
            setIsCustomDueDate(true);
          }}
          className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base bg-white"
          required
        />
      </div>
      <div>
        <label className="flex items-center justify-between text-sm font-medium text-secondary-700 mb-1">
          <span>Status</span>
          {isFutureInvoice && (
            <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
              Future invoices are scheduled automatically
            </span>
          )}
        </label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          className={`w-full px-4 py-3 border rounded-xl text-base bg-white ${
            isFutureInvoice
              ? 'border-purple-300 bg-purple-50 focus:ring-2 focus:ring-purple-300 focus:border-purple-300 text-purple-700'
              : 'border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
          }`}
          disabled={isFutureInvoice}
          required
        >
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="scheduled">Scheduled</option>
        </select>
        {isFutureInvoice && (
          <p className="mt-1 text-xs text-secondary-500">
            This invoice will appear in the "Upcoming Invoices" section until the invoice date arrives.
          </p>
        )}
      </div>
      <div className="sticky bottom-0 bg-white pt-2 pb-1 flex gap-2 z-10">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 text-secondary-700 bg-secondary-100 rounded-xl font-medium text-base"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-xl font-bold text-base shadow hover:bg-primary-700 transition"
        >
          {invoice ? 'Update Invoice' : 'Create Invoice'}
        </button>
      </div>
    </form>
  );
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
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
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
  const generateFutureInvoices = async (userId, invoiceData) => {
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
          isRecurring: true
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
        const isFutureInvoice = isDateInFuture(invoiceDate);          
        const isRecurringInvoice = (invoiceData.billingFrequency && invoiceData.billingFrequency !== 'one-time');
        
        // Automatically set status to 'scheduled' for future dates
        if (isFutureInvoice && invoiceData.status !== 'scheduled') {
          invoiceData.status = 'scheduled';
        } else if (!isFutureInvoice && invoiceData.status === 'scheduled') {
          // If date is today or in the past, update status to pending
          invoiceData.status = 'pending';
        }
        
        // If this is a recurring invoice or future-dated, make sure the scheduled view will be shown
        if (isRecurringInvoice || isFutureInvoice) {
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
        
        // Ensure we have all required fields
        const dataWithDate = {
          ...invoiceData,
          date: invoiceData.date || localDateString,
          invoiceNumber: nextInvoiceNumber,
          amount: parseFloat(invoiceData.amount) || 0, // Ensure amount is a number
          billingFrequency: invoiceData.billingFrequency || 'one-time', // Ensure billing frequency is set
          isRecurring: invoiceData.billingFrequency !== 'one-time', // Set the recurring flag
          // Status is already set correctly above based on isFutureInvoice
          status: invoiceData.status
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
            // Generate future invoices immediately
            const futureInvoices = await generateFutureInvoices(user.uid, dataWithDate);
            
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
      setEditingInvoice(enhancedInvoice);
      setShowForm(true);
    } else {
      // Regular invoice handling
      setEditingInvoice(invoice);
      setShowForm(true);
    }
  };

  // Delete invoice
  const handleDeleteInvoice = async (invoice) => {
    setInvoiceToDelete(invoice);
    setShowDeleteModal(true);
  };

  // Confirm delete handler
  const confirmDeleteInvoice = async () => {
    const user = auth.currentUser;
    if (invoiceToDelete && user) {
      await deleteInvoice(user.uid, invoiceToDelete.id);
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceToDelete.id));
      setShowDeleteModal(false);
      setInvoiceToDelete(null);
    }
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
      // Update the local state with the new invoice
      setInvoices(prev => {
        // Make sure we're not duplicating
        const exists = prev.some(inv =>
          inv.id === newInvoice.id ||
          (inv.clientId === newInvoice.clientId &&
           inv.dueDate === newInvoice.dueDate &&
           Math.abs(new Date(inv.date) - new Date(newInvoice.date)) < 86400000) // Within 24 hours
        )
        // Only add if it doesn't exist
        if (!exists) {
          return [...prev, newInvoice]
        } else {
          return prev
        }
      })
      alert(`Invoice for ${scheduledInvoice.clientName} has been created and sent successfully`)
    } catch (error) {
      console.error("Error sending invoice now:", error)
      alert(`Error creating invoice: ${error.message}`)
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
        // Optionally, you can store original dates in custom fields if needed
        // For now, just keep the current dates
      };
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
    const user = auth.currentUser;
    if (!user) return;
    
    // Check if this is an active invoice (status is 'pending' or 'overdue')
    if ((updatedInvoice.status === 'pending' || updatedInvoice.status === 'overdue') && !updatedInvoice._bulkUpdate) {
      // Find the original invoice to compare changes
      const originalInvoice = invoices.find(inv => inv.id === updatedInvoice.id);
      if (!originalInvoice) return;
      
      // Check if we have future invoices for this client with same description (recurring series)
      const allInvoices = await getInvoices(user.uid);
      const futureInvoices = allInvoices.filter(inv =>
        inv.clientId === updatedInvoice.clientId &&
        inv.status === 'scheduled' &&
        inv.description === updatedInvoice.description &&
        new Date(inv.date) > new Date() &&
        inv.id !== updatedInvoice.id
      );
      
      // Set data for the active invoice update modal
      setActiveInvoiceUpdateData({
        updatedInvoice,
        originalInvoice,
        futureInvoices,
        client: clients.find(c => c.id === updatedInvoice.clientId)
      });
      setShowActiveInvoiceUpdateModal(true);
      return;
    }
    
    // Only intercept if this is a scheduled invoice and not a bulk update
    if (updatedInvoice.status === 'scheduled' && !updatedInvoice._bulkUpdate) {
      // Find all future scheduled invoices for the same client AND same service (description)
      const allInvoices = await getInvoices(user.uid);
      const futureInvoices = allInvoices.filter(inv =>
        inv.clientId === updatedInvoice.clientId &&
        inv.status === 'scheduled' &&
        inv.description === updatedInvoice.description && // Only update invoices with the same description
        new Date(inv.date) >= new Date(updatedInvoice.date) &&
        inv.id !== updatedInvoice.id
      );
      setPendingUpdateData({ updatedInvoice, futureInvoices });
      setFutureScheduledCount(futureInvoices.length);
      setShowUpdateModal(true);
      return;
    }
    
    // Normal update for single invoice
    try {
      await updateInvoice(user.uid, updatedInvoice);
      setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));
      setShowForm(false);
      setEditingInvoice(null);
      setSuccessMessage(`Invoice #${updatedInvoice.invoiceNumber} updated successfully.`);
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
      await handleUpdateInvoice({ ...updatedInvoice, _bulkUpdate: true });
    } else {
      // Update all future scheduled invoices of the same type (including the selected one)
      const updates = [updatedInvoice, ...futureInvoices].map(inv => ({
        ...inv,
        amount: updatedInvoice.amount,
        date: inv.id === updatedInvoice.id ? updatedInvoice.date : inv.date, // Only update date for the edited invoice
        billingFrequency: updatedInvoice.billingFrequency, // Propagate billing frequency changes
        activity: [
          ...(inv.activity || []),
          {
            type: 'updated',
            date: new Date().toISOString(),
            stage: 'Amount/date updated via bulk edit'
          }
        ],
        _bulkUpdate: true
      }));
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
      
      // Add activity log entry to the invoice
      const invoiceWithActivity = {
        ...updatedInvoice,
        activity: [
          ...(updatedInvoice.activity || []),
          {
            type: 'updated',
            date: new Date().toISOString(),
            changes: changes.join('; '),
            notifiedClient: options.notifyClient
          }
        ],
        _bulkUpdate: true
      };
      
      // Update the invoice
      await updateInvoice(user.uid, invoiceWithActivity);
      
      // Update future invoices if requested
      if (options.updateFutureInvoices && futureInvoices.length > 0) {
        const updates = futureInvoices.map(inv => ({
          ...inv,
          amount: updatedInvoice.amount,
          description: updatedInvoice.description,
          activity: [
            ...(inv.activity || []),
            {
              type: 'updated',
              date: new Date().toISOString(),
              stage: 'Updated from active invoice change'
            }
          ],
          _bulkUpdate: true
        }));
        
        for (const inv of updates) {
          await updateInvoice(user.uid, inv);
        }
        
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
        // TODO: Call the Firebase function to send the notification email
        showToast('info', 'Sending notification email to client...');
      }
      
      setShowForm(false);
      setEditingInvoice(null);
    } catch (error) {
      showToast('error', 'Failed to update invoice.');
      console.error('Active invoice update error:', error);
    }
    
    setActiveInvoiceUpdateData(null);
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => { setShowForm(false); setEditingInvoice(null); }}>
            <div
              className="bg-white rounded-none shadow-xl w-full h-full max-w-none max-h-none m-0 p-0 relative flex flex-col"
              onClick={e => e.stopPropagation()}
              ref={modalContentRef} // <-- ensure this is here
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
                  onSubmit={handleAddInvoice}
                  onCancel={() => { setShowForm(false); setEditingInvoice(null); }}
                  clients={clients}
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
            }).map((invoice) => (
              <MobileInvoiceTile
                key={invoice.id}
                invoice={invoice}
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
            ))}
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
                }).map((invoice) => (
                  <MobileInvoiceTile
                    key={invoice.id}
                    invoice={invoice}
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
                ))}
              </>
            )}
          </>
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
                    {invoice.invoiceNumber || `INV-${invoice.id.substring(0, 4).toUpperCase()}`}
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-medium text-secondary-900">{invoice.clientName}</p>
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
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-6 9 6-9 6-9-6zm0 0v6a9 9 0 009 9 9 9 0 009-9v-6" />
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
      >
        <InvoiceForm
          invoice={editingInvoice}
          clients={clients}
          onSubmit={editingInvoice ? handleUpdateInvoice : handleAddInvoice}
          onCancel={() => {
            setShowForm(false)
            setEditingInvoice(null)
          }}
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

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">Delete Invoice</h3>
            <p className="text-secondary-700 mb-4">Are you sure you want to delete this invoice? This action cannot be undone.</p>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 rounded-lg bg-secondary-100 text-secondary-700 hover:bg-secondary-200"
                onClick={() => { setShowDeleteModal(false); setInvoiceToDelete(null); }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                onClick={confirmDeleteInvoice}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <UpdateScheduledInvoicesModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleUpdateModalConfirm}
        futureCount={futureScheduledCount}
        invoiceAmount={pendingUpdateData?.updatedInvoice?.amount}
        invoiceDate={pendingUpdateData?.updatedInvoice?.date}
      />

      <ActiveInvoiceUpdateModal
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