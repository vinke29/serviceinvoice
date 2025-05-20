import { useState, useEffect } from 'react'
import Drawer from './Drawer'
import ClientDetailsDrawer from './ClientDetailsDrawer'
import ClientForm from './ClientForm'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as Popover from '@radix-ui/react-popover';
import { CheckIcon, ChevronDownIcon, CalendarIcon } from '@radix-ui/react-icons';
import { format, isValid, parseISO } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import clsx from 'clsx';
import { getClients, addClient, updateClient, deleteClient, getInvoices, updateClientStatus } from '../firebaseData';
import { auth } from '../firebase';

const STATUS_OPTIONS = ['Active', 'Delinquent', 'Inactive']
const ON_HOLD_OPTIONS = ['All', 'On Hold', 'Not On Hold']

// Helper: Recurring frequency order (most frequent first)
const RECURRING_ORDER = ['weekly', 'monthly', 'quarterly', 'biannually', 'annually'];

function ClientCard({ client }) {
  return (
    <div className="bg-white rounded-xl shadow-soft p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 rounded-full bg-primary-50 flex items-center justify-center">
            <span className="text-primary-700 text-lg font-medium">{client.name[0]}</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-secondary-900">{client.name}</h3>
            <p className="text-sm text-secondary-600">{client.address}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-secondary-100">
        <div className="flex items-center space-x-4 text-sm text-secondary-600">
          <div className="flex items-center space-x-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>{client.email}</span>
          </div>
          <div className="flex items-center space-x-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>{client.phone}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Modern Filter Bar Components
function MultiSelectDropdown({ label, options, selected, setSelected }) {
  const handleToggle = (option) => {
    // Always store selected values as lowercase
    const lowerOption = option.toLowerCase();
    setSelected(selected.includes(lowerOption)
      ? selected.filter((o) => o !== lowerOption)
      : [...selected, lowerOption]);
  };
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="w-full min-w-[160px] px-3 py-2 border border-secondary-200 rounded-lg flex items-center justify-between bg-white text-sm text-secondary-900 hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
          type="button"
        >
          <span className="truncate">{selected.length ? selected.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ') : `Select ${label}`}</span>
          <ChevronDownIcon className="ml-2 w-4 h-4 text-secondary-500 flex-shrink-0" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content className="z-50 min-w-[180px] max-w-[280px] bg-white border border-secondary-200 rounded-lg shadow-lg p-2 mt-2">
        {options.map((option) => (
          <DropdownMenu.Item key={option} asChild>
            <label
              className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-secondary-50 rounded select-none"
              onClick={() => handleToggle(option)}
            >
              <Checkbox.Root
                checked={selected.includes(option.toLowerCase())}
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
          className="w-full min-w-[160px] px-3 py-2 border border-secondary-200 rounded-lg flex items-center justify-between bg-white text-sm text-secondary-900 hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
          type="button"
        >
          <div className="flex items-center">
            <CalendarIcon className="mr-2 w-4 h-4 text-secondary-500 flex-shrink-0" />
            <span className="truncate">{display}</span>
          </div>
          <ChevronDownIcon className="ml-2 w-4 h-4 text-secondary-500 flex-shrink-0" />
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

// Add this helper function to the top level
const formatBillingFrequency = (frequency) => {
  if (!frequency) return '-';
  
  const labels = {
    'weekly': 'Weekly',
    'monthly': 'Monthly',
    'quarterly': 'Quarterly',
    'biannually': 'Bi-annually',
    'annually': 'Annually',
    'one-time': 'One-Time'
  };
  
  return labels[frequency.toLowerCase()] || frequency;
};

// Helper to format status with capital letter and spaces
const formatStatus = (status) => {
  if (!status) return '';
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

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

// Helper: Get the most frequent recurring billing type for a client
function getClientBillingInfo(client, invoices) {
  const clientInvoices = invoices.filter(inv => inv.clientId === client.id);
  // Find the most frequent recurring type
  for (const freq of RECURRING_ORDER) {
    if (clientInvoices.some(inv => inv.billingFrequency && inv.billingFrequency.toLowerCase() === freq)) {
      return formatBillingFrequency(freq);
    }
  }
  // If no recurring, return One-Time
  return 'One-Time';
}

function Clients() {
  const [clients, setClients] = useState([])
  const [invoices, setInvoices] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [statusFilter, setStatusFilter] = useState([])
  const [customerSinceFrom, setCustomerSinceFrom] = useState('')
  const [customerSinceTo, setCustomerSinceTo] = useState('')
  const [lastInvoicedFrom, setLastInvoicedFrom] = useState('')
  const [lastInvoicedTo, setLastInvoicedTo] = useState('')
  const [lastPaidFrom, setLastPaidFrom] = useState('')
  const [lastPaidTo, setLastPaidTo] = useState('')
  const [nextInvoiceDateFrom, setNextInvoiceDateFrom] = useState('')
  const [nextInvoiceDateTo, setNextInvoiceDateTo] = useState('')
  const [onHoldFilter, setOnHoldFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  // Load clients and invoices from Firestore on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const user = auth.currentUser
      if (user) {
        // Fetch both clients and invoices in parallel
        const [clientsData, invoicesData] = await Promise.all([
          getClients(user.uid),
          getInvoices(user.uid)
        ])
        setClients(clientsData)
        setInvoices(invoicesData)
      } else {
        setClients([])
        setInvoices([])
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  // Add a refresh function that can be called after updates
  const refreshData = async () => {
    const user = auth.currentUser
    if (user) {
      const [clientsData, invoicesData] = await Promise.all([
        getClients(user.uid),
        getInvoices(user.uid)
      ])
      setClients(clientsData)
      setInvoices(invoicesData)
    }
  }

  // Add client
  const handleAddClient = async (clientData) => {
    const user = auth.currentUser
    if (user) {
      let clientToAdd = { ...clientData, status: clientData.status ? clientData.status.toLowerCase() : 'active' }
      const newClient = await addClient(user.uid, clientToAdd)
      await refreshData() // Refresh data after adding client
    }
    setShowForm(false)
  }

  // Edit client
  const handleEditClient = async (client) => {
    const user = auth.currentUser
    if (user) {
      // Find the original client
      const original = clients.find(c => c.id === client.id)
      const normalizedStatus = client.status ? client.status.toLowerCase() : 'active';
      if (original && original.status !== normalizedStatus && (normalizedStatus === 'cancelled' || normalizedStatus === 'on_hold')) {
        // Status changed to cancelled or on_hold, use updateClientStatus
        await updateClientStatus(user.uid, client.id, normalizedStatus)
      } else {
        // No status change, or not a special status, just update
        await updateClient(user.uid, { ...client, status: normalizedStatus })
      }
      await refreshData() // Refresh data after editing client
    }
    setEditingClient(null)
  }

  // Delete client
  const handleDeleteClient = async (clientId) => {
    const user = auth.currentUser
    if (user) {
      await deleteClient(user.uid, clientId)
      await refreshData() // Refresh data after deleting client
    }
  }

  const handleViewHistory = (client) => {
    setSelectedClient(client)
    setShowHistory(true)
  }

  const filteredClients = clients.filter(client => {
    // Search
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase())
    // Status
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes((client.status || '').toLowerCase())
    // Customer Since
    const sinceDate = new Date(client.customerSince)
    const matchesCustomerSince = (!customerSinceFrom || sinceDate >= new Date(customerSinceFrom)) && (!customerSinceTo || sinceDate <= new Date(customerSinceTo))
    // Last Invoiced
    const invoicedDate = new Date(client.lastInvoiced)
    const matchesLastInvoiced = (!lastInvoicedFrom || invoicedDate >= new Date(lastInvoicedFrom)) && (!lastInvoicedTo || invoicedDate <= new Date(lastInvoicedTo))
    // Last Paid
    const paidDate = new Date(client.lastPaid)
    const matchesLastPaid = (!lastPaidFrom || paidDate >= new Date(lastPaidFrom)) && (!lastPaidTo || paidDate <= new Date(lastPaidTo))
    // Next Invoice Date
    const nextInvoiceDate = new Date(client.nextInvoiceDate)
    const matchesNextInvoiceDate = (!nextInvoiceDateFrom || nextInvoiceDate >= new Date(nextInvoiceDateFrom)) && 
                                  (!nextInvoiceDateTo || nextInvoiceDate <= new Date(nextInvoiceDateTo))
    // On Hold filter
    const matchesOnHold =
      onHoldFilter === 'All' ||
      (onHoldFilter === 'On Hold' && client.onHold) ||
      (onHoldFilter === 'Not On Hold' && !client.onHold)
    return (
      matchesSearch &&
      matchesStatus &&
      matchesCustomerSince &&
      matchesLastInvoiced &&
      matchesLastPaid &&
      matchesNextInvoiceDate &&
      matchesOnHold
    )
  })

  // Helper function to determine which invoice date to display
  const getRelevantInvoiceDate = (client) => {
    if (client.onHold) {
      return { label: "Paused", value: null, isPaused: true };
    }

    // Just show the next invoice date if available
    if (client.nextInvoiceDate) {
      return { label: "Next Invoice", value: client.nextInvoiceDate, isNext: true };
    }
    
    // No invoice date available
    return { label: "Not Scheduled", value: null };
  };

  // Format the invoice date for display
  const formatInvoiceDate = (client) => {
    const dateInfo = getRelevantInvoiceDate(client);
    
    if (dateInfo.isPaused) {
      return <span className="text-orange-600 font-medium">Paused</span>;
    }
    
    if (!dateInfo.value) {
      return '-';
    }
    
    try {
      // Use date-fns format to ensure consistent date display
      const formattedDate = format(new Date(dateInfo.value), 'MM/dd/yyyy');
      return (
        <div>
          <div className="text-secondary-700 font-medium">
            {formattedDate}
          </div>
          <div className="text-xs text-secondary-500">{dateInfo.label}</div>
        </div>
      );
    } catch (e) {
      return '-';
    }
  };

  // Helper to consistently format dates
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch (e) {
      return '-';
    }
  };

  if (loading) {
    return <div className="min-h-[300px] flex items-center justify-center text-lg text-secondary-600">Loading clients...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-secondary-900">Clients</h2>
        <div className="flex items-center space-x-2">
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
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Filter Bar - Collapsible */}
      <div className={`transition-all duration-300 overflow-hidden ${showFilters ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-white rounded-xl shadow-soft p-6 mb-4">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-lg font-medium text-secondary-800">Filters</h3>
            <button
              onClick={() => {
                setStatusFilter([])
                setCustomerSinceFrom('')
                setCustomerSinceTo('')
                setLastInvoicedFrom('')
                setLastInvoicedTo('')
                setLastPaidFrom('')
                setLastPaidTo('')
                setNextInvoiceDateFrom('')
                setNextInvoiceDateTo('')
                setOnHoldFilter('All')
              }}
              className="px-3 py-1 text-sm bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200"
            >
              Clear All
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Group 1: Client Status */}
            <div className="space-y-2 border border-secondary-100 rounded-lg overflow-hidden">
              <h4 className="text-sm font-semibold text-secondary-800 border-b border-secondary-200 pb-2 uppercase tracking-wider bg-secondary-50 px-4 py-2">Client Status</h4>
              <div className="space-y-4 p-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Status</label>
                  <MultiSelectDropdown
                    label="Status"
                    options={STATUS_OPTIONS}
                    selected={statusFilter}
                    setSelected={setStatusFilter}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">On Hold</label>
                  <select
                    value={onHoldFilter}
                    onChange={e => setOnHoldFilter(e.target.value)}
                    className="w-full min-w-[160px] px-3 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
                  >
                    {ON_HOLD_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            {/* Group 2: Dates */}
            <div className="space-y-2 border border-secondary-100 rounded-lg overflow-hidden">
              <h4 className="text-sm font-semibold text-secondary-800 border-b border-secondary-200 pb-2 uppercase tracking-wider bg-secondary-50 px-4 py-2">Invoice Dates</h4>
              <div className="space-y-4 p-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Next Invoice Date</label>
                  <DateRangePopover
                    label="Next Invoice Date"
                    value={[
                      nextInvoiceDateFrom ? new Date(nextInvoiceDateFrom) : undefined,
                      nextInvoiceDateTo ? new Date(nextInvoiceDateTo) : undefined,
                    ]}
                    setValue={([from, to]) => {
                      setNextInvoiceDateFrom(from && isValid(from) ? format(from, 'yyyy-MM-dd') : '');
                      setNextInvoiceDateTo(to && isValid(to) ? format(to, 'yyyy-MM-dd') : '');
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Last Invoiced</label>
                  <DateRangePopover
                    label="Last Invoiced"
                    value={[
                      lastInvoicedFrom ? new Date(lastInvoicedFrom) : undefined,
                      lastInvoicedTo ? new Date(lastInvoicedTo) : undefined,
                    ]}
                    setValue={([from, to]) => {
                      setLastInvoicedFrom(from && isValid(from) ? format(from, 'yyyy-MM-dd') : '');
                      setLastInvoicedTo(to && isValid(to) ? format(to, 'yyyy-MM-dd') : '');
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Last Paid</label>
                  <DateRangePopover
                    label="Last Paid"
                    value={[
                      lastPaidFrom ? new Date(lastPaidFrom) : undefined,
                      lastPaidTo ? new Date(lastPaidTo) : undefined,
                    ]}
                    setValue={([from, to]) => {
                      setLastPaidFrom(from && isValid(from) ? format(from, 'yyyy-MM-dd') : '');
                      setLastPaidTo(to && isValid(to) ? format(to, 'yyyy-MM-dd') : '');
                    }}
                  />
                </div>
              </div>
            </div>
            
            {/* Group 3: Other Dates */}
            <div className="space-y-2 border border-secondary-100 rounded-lg overflow-hidden">
              <h4 className="text-sm font-semibold text-secondary-800 border-b border-secondary-200 pb-2 uppercase tracking-wider bg-secondary-50 px-4 py-2">Client History</h4>
              <div className="space-y-4 p-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Customer Since</label>
                  <DateRangePopover
                    label="Customer Since"
                    value={[
                      customerSinceFrom ? new Date(customerSinceFrom) : undefined,
                      customerSinceTo ? new Date(customerSinceTo) : undefined,
                    ]}
                    setValue={([from, to]) => {
                      setCustomerSinceFrom(from && isValid(from) ? format(from, 'yyyy-MM-dd') : '');
                      setCustomerSinceTo(to && isValid(to) ? format(to, 'yyyy-MM-dd') : '');
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-soft p-4">
        <input
          type="text"
          placeholder="Search clients by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-soft p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-secondary-200 bg-secondary-50">
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Name</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Billing Info</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Next Invoice Date</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Customer Since</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Last Invoiced</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Last Paid</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Payment Score</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Status</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">On Hold</th>
                <th className="text-right py-4 px-4 text-xs font-semibold text-secondary-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-secondary-100 hover:bg-secondary-50 cursor-pointer"
                  onClick={() => handleViewHistory(client)}
                >
                  <td className="py-4 px-4">
                    <div>
                      <span className="font-medium text-secondary-900">{client.name}</span>
                      <p className="text-sm text-secondary-600">{client.email}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div>
                      {(() => {
                        const recurringInvoice = getMostFrequentRecurringInvoice(client, invoices);
                        return recurringInvoice && recurringInvoice.amount !== undefined && recurringInvoice.amount !== null ? (
                          <span className="font-medium text-secondary-900">${Number(recurringInvoice.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-secondary-400">-</span>
                        );
                      })()}
                      <p className="text-sm text-secondary-600">{getClientBillingInfo(client, invoices)}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm text-secondary-900">{formatInvoiceDate(client)}</div>
                  </td>
                  <td className="py-4 px-4 text-secondary-600">{formatDate(client.customerSince)}</td>
                  <td className="py-4 px-4 text-secondary-600">{formatDate(client.lastInvoiced)}</td>
                  <td className="py-4 px-4 text-secondary-600">{formatDate(client.lastPaid)}</td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${client.paymentScore >= 8 ? 'bg-green-100 text-green-800' : client.paymentScore >= 5 ? 'bg-yellow-100 text-yellow-800' : client.paymentScore ? 'bg-red-100 text-red-800' : ''}`}>{client.paymentScore !== undefined && client.paymentScore !== '' ? client.paymentScore : '-'}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${((client.status || '').toLowerCase() === 'active') ? 'bg-green-100 text-green-800' : ((client.status || '').toLowerCase() === 'delinquent') ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>{formatStatus(client.status)}</span>
                  </td>
                  <td className="py-4 px-4">
                    {client.onHold ? (
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">On Hold</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700">No</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingClient(client);
                          setShowForm(true);
                        }}
                        className="p-2 text-secondary-600 hover:text-primary-600 transition-colors duration-200"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setClientToDelete(client);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 text-secondary-600 hover:text-red-600 transition-colors duration-200"
                        title="Delete"
                        aria-label="Delete"
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
      </div>

      {/* Add/Edit Client Drawer */}
      <Drawer
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingClient(null)
        }}
        title={editingClient ? 'Edit Client' : 'Add New Client'}
      >
        <ClientForm
          client={editingClient}
          onSubmit={handleAddClient}
          onCancel={() => {
            setShowForm(false)
            setEditingClient(null)
          }}
        />
      </Drawer>

      {/* Client History Drawer */}
      <ClientDetailsDrawer
        isOpen={showHistory}
        onClose={() => {
          setShowHistory(false)
          setSelectedClient(null)
        }}
        client={selectedClient}
        invoices={invoices}
        onUpdate={handleEditClient}
      />

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">Delete Client</h3>
            {(() => {
              const activeInvoices = invoices.filter(inv => inv.clientId === clientToDelete?.id && ['pending', 'unpaid'].includes((inv.status || '').toLowerCase()));
              if (activeInvoices.length > 0) {
                return (
                  <div className="mb-4">
                    <p className="text-red-600 font-medium mb-2">This client has {activeInvoices.length} active invoice{activeInvoices.length > 1 ? 's' : ''}.</p>
                    <p className="text-secondary-700">You must resolve or delete all active invoices before deleting this client.</p>
                  </div>
                );
              } else {
                return <p className="text-secondary-700 mb-4">Are you sure you want to delete this client? This action cannot be undone.</p>;
              }
            })()}
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 rounded-lg bg-secondary-100 text-secondary-700 hover:bg-secondary-200"
                onClick={() => { setShowDeleteModal(false); setClientToDelete(null); }}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 ${(() => {
                  const activeInvoices = invoices.filter(inv => inv.clientId === clientToDelete?.id && ['pending', 'unpaid'].includes((inv.status || '').toLowerCase()));
                  return activeInvoices.length > 0 ? 'opacity-50 cursor-not-allowed' : '';
                })()}`}
                disabled={(() => {
                  const activeInvoices = invoices.filter(inv => inv.clientId === clientToDelete?.id && ['pending', 'unpaid'].includes((inv.status || '').toLowerCase()));
                  return activeInvoices.length > 0;
                })()}
                onClick={async () => {
                  const activeInvoices = invoices.filter(inv => inv.clientId === clientToDelete?.id && ['pending', 'unpaid'].includes((inv.status || '').toLowerCase()));
                  if (clientToDelete && activeInvoices.length === 0) {
                    const user = auth.currentUser;
                    await deleteClient(user.uid, clientToDelete.id);
                    setClients(prev => prev.filter(c => c.id !== clientToDelete.id));
                    setShowDeleteModal(false);
                    setClientToDelete(null);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Clients