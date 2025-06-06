import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { BellIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Checkbox } from '@radix-ui/react-checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import clsx from 'clsx';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useInvoices } from './InvoicesContext';
import { auth } from '../firebase';
import { exportToCSV } from '../utils/csvExport';

const ReminderOpsDashboard = () => {
  const [filters, setFilters] = useState({
    status: 'active', // 'active' | 'completed' | 'all'
    type: 'all', // 'all' | 'reminder' | 'escalation'
    daysOverdue: 'all', // 'all' | '1-7' | '8-14' | '15+'
    dateRange: {
      from: null,
      to: null
    }
  });

  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState({ from: null, to: null });
  const [showFilters, setShowFilters] = useState(false);

  const { invoices, refreshInvoices } = useInvoices();
  const [reminders, setReminders] = useState([]);

  useEffect(() => {
    refreshInvoices && refreshInvoices();
  }, []);

  useEffect(() => {
    // Debug: log invoices context
    console.log('Invoices in reminders context:', invoices);
    // Use invoices from context to build reminders
    const buildReminders = async () => {
      // Fetch agent config for reminder interval
      let agentConfig = null;
      const user = auth.currentUser;
      if (typeof window !== 'undefined' && user?.uid) {
        try {
          agentConfig = await import('../firebaseData').then(mod => mod.getAgentConfig(user.uid));
        } catch (e) { agentConfig = null; }
      }
      const reminderInterval = agentConfig && agentConfig.reminderIntervalDays ? agentConfig.reminderIntervalDays : 3;
      const now = new Date();
      const remindersList = invoices
        .filter(inv =>
          inv.status !== 'scheduled' &&
          inv.status !== 'Scheduled' &&
          inv.status !== 'paid' &&
          inv.status !== 'Paid'
        )
        .map(inv => {
          const due = new Date(inv.dueDate);
          const created = inv.createdAt ? new Date(inv.createdAt) : due;
          const daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
          let stage = '';
          let type = '';
          let reminderCount = 0;
          let invoiceSentDate = null;
          let escalationSent = false;
          if (Array.isArray(inv.activity)) {
            reminderCount = inv.activity.filter(a => a.type === 'reminder_sent').length;
            invoiceSentDate = inv.activity.find(a => a.type === 'invoice_sent')?.date;
            escalationSent = inv.activity.some(a => a.type === 'escalation_sent');
          }
          if (escalationSent) {
            stage = 'Escalation Sent';
            type = 'escalation';
          } else if (reminderCount === 0) {
            stage = 'Invoice Sent';
            type = 'invoice';
          } else {
            stage = `${reminderCount === 1 ? '1st' : reminderCount === 2 ? '2nd' : reminderCount === 3 ? '3rd' : reminderCount + 'th'} Reminder Sent`;
            type = 'reminder';
          }
          // Next action: only if reminder interval is defined and type is invoice or reminder
          let nextAction = '';
          if (type === 'invoice' && reminderInterval) {
            const next = new Date(created);
            next.setDate(next.getDate() + reminderInterval);
            nextAction = next;
          } else if (type === 'reminder' && reminderInterval) {
            const next = new Date(due);
            next.setDate(next.getDate() + reminderInterval);
            nextAction = next;
          } else {
            nextAction = null;
          }
          return {
            id: inv.id,
            clientName: inv.clientName || 'Unknown',
            invoiceNumber: inv.invoiceNumber || inv.id,
            amount: inv.amount,
            dueDate: due,
            daysOverdue,
            type,
            stage,
            nextAction,
            status: 'active'
          };
        });
      setReminders(remindersList);
    };
    buildReminders();
  }, [invoices]);

  const getStatusBadgeClass = (type, stage) => {
    if (type === 'escalation') {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getDaysOverdueClass = (days) => {
    if (days > 14) return 'text-red-600';
    if (days > 7) return 'text-orange-600';
    return 'text-yellow-600';
  };

  const handleQuickAction = (id, action) => {
    // Implement quick actions (send now, pause, mark as paid)
    console.log(`Action ${action} for reminder ${id}`);
  };

  const formatRangeLabel = () => {
    const { from, to } = filters.dateRange;
    if (from && to) {
      return `${format(from, 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`;
    }
    if (from) {
      return `${format(from, 'MMM d, yyyy')} – ...`;
    }
    return 'Date Range';
  };

  // Filter reminders based on filters
  const filteredReminders = reminders.filter(reminder => {
    // Status
    if (filters.status !== 'all' && reminder.status !== filters.status) return false;
    // Type
    if (filters.type !== 'all' && reminder.type !== filters.type) return false;
    // Days overdue
    if (filters.daysOverdue === '1-7' && (reminder.daysOverdue < 1 || reminder.daysOverdue > 7)) return false;
    if (filters.daysOverdue === '8-14' && (reminder.daysOverdue < 8 || reminder.daysOverdue > 14)) return false;
    if (filters.daysOverdue === '15+' && reminder.daysOverdue < 15) return false;
    // Date range
    if (filters.dateRange.from && reminder.dueDate < filters.dateRange.from) return false;
    if (filters.dateRange.to && reminder.dueDate > filters.dateRange.to) return false;
    return true;
  });

  if (invoices.length === 0) {
    return <div className="min-h-[300px] flex items-center justify-center text-lg text-secondary-600">No invoices to show.</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col md:flex-row md:space-x-2 space-y-2 md:space-y-0 items-start md:items-center justify-between">
        <div className="flex flex-row items-center justify-between w-full md:w-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Reminders & Escalations</h1>
          <div className="flex flex-row items-center justify-end w-full md:hidden space-x-2 ml-auto">
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
                      const columns = [
                        'clientName', 'invoiceNumber', 'amount', 'daysOverdue', 'stage', 'nextAction', 'type', 'status'
                      ];
                      const data = filteredReminders.map(reminder => ({
                        clientName: reminder.clientName,
                        invoiceNumber: reminder.invoiceNumber,
                        amount: reminder.amount,
                        daysOverdue: reminder.daysOverdue,
                        stage: reminder.stage,
                        nextAction: reminder.nextAction ? (typeof reminder.nextAction === 'string' ? reminder.nextAction : (reminder.nextAction instanceof Date ? reminder.nextAction.toISOString().slice(0,10) : '')) : '',
                        type: reminder.type,
                        status: reminder.status
                      }));
                      exportToCSV({ data, filename: `reminders-${new Date().toISOString().slice(0,10)}.csv`, columns });
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
        </div>
        {/* Desktop: All buttons visible */}
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
            onClick={() => {
              const columns = [
                'clientName', 'invoiceNumber', 'amount', 'daysOverdue', 'stage', 'nextAction', 'type', 'status'
              ];
              const data = filteredReminders.map(reminder => ({
                clientName: reminder.clientName,
                invoiceNumber: reminder.invoiceNumber,
                amount: reminder.amount,
                daysOverdue: reminder.daysOverdue,
                stage: reminder.stage,
                nextAction: reminder.nextAction ? (typeof reminder.nextAction === 'string' ? reminder.nextAction : (reminder.nextAction instanceof Date ? reminder.nextAction.toISOString().slice(0,10) : '')) : '',
                type: reminder.type,
                status: reminder.status
              }));
              exportToCSV({ data, filename: `reminders-${new Date().toISOString().slice(0,10)}.csv`, columns });
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

      {/* Filters */}
      <div className={`transition-all duration-300 overflow-hidden ${showFilters ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-white rounded-xl shadow-soft p-6 mb-6">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-lg font-medium text-secondary-800">Filters</h3>
            <button
              onClick={() => setFilters({
                status: 'active',
                type: 'all',
                daysOverdue: 'all',
                dateRange: { from: null, to: null }
              })}
              className="px-3 py-1 text-sm bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200"
            >
              Clear All
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Group 1: Reminder Status */}
            <div className="space-y-2 border border-secondary-100 rounded-lg overflow-hidden">
              <h4 className="text-sm font-semibold text-secondary-800 border-b border-secondary-200 pb-2 uppercase tracking-wider bg-secondary-50 px-4 py-2">Reminder Status</h4>
              <div className="space-y-4 p-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Status</label>
                  <select
                    className="w-full min-w-[160px] px-3 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="all">All</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Type</label>
                  <select
                    className="w-full min-w-[160px] px-3 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  >
                    <option value="all">All Types</option>
                    <option value="reminder">Reminders</option>
                    <option value="escalation">Escalations</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Group 2: Timing Filters */}
            <div className="space-y-2 border border-secondary-100 rounded-lg overflow-hidden">
              <h4 className="text-sm font-semibold text-secondary-800 border-b border-secondary-200 pb-2 uppercase tracking-wider bg-secondary-50 px-4 py-2">Timing</h4>
              <div className="space-y-4 p-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Days Overdue</label>
                  <select
                    className="w-full min-w-[160px] px-3 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
                    value={filters.daysOverdue}
                    onChange={(e) => setFilters({ ...filters, daysOverdue: e.target.value })}
                  >
                    <option value="all">All Days</option>
                    <option value="1-7">1-7 Days</option>
                    <option value="8-14">8-14 Days</option>
                    <option value="15+">15+ Days</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-secondary-700 mb-1">Due Date Range</label>
                  <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                    <PopoverTrigger className="w-full min-w-[160px] px-3 py-2 border border-secondary-200 rounded-lg flex items-center justify-between bg-white text-sm text-secondary-900 hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200">
                      <div className="flex items-center">
                        <span className="truncate">{formatRangeLabel()}</span>
                      </div>
                      <svg className="w-4 h-4 text-secondary-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </PopoverTrigger>
                    <PopoverContent className="z-50 bg-white border border-secondary-200 rounded-xl shadow-xl p-4 mt-2">
                      <DayPicker
                        mode="range"
                        selected={pendingRange.from || pendingRange.to ? pendingRange : filters.dateRange}
                        onSelect={(range) => {
                          setPendingRange(range);
                          if (range?.from && range?.to && range.from !== range.to) {
                            setFilters({ ...filters, dateRange: range });
                            setDatePopoverOpen(false);
                            setPendingRange({ from: null, to: null });
                          }
                        }}
                        numberOfMonths={2}
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          className="text-xs text-secondary-600 hover:text-primary-600"
                          onClick={() => {
                            setPendingRange({ from: null, to: null });
                            setFilters({ ...filters, dateRange: { from: null, to: null } });
                          }}
                          type="button"
                        >
                          Clear
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        {filteredReminders.length === 0 ? (
          <div className="p-8 text-center text-secondary-500 text-lg">No reminders or escalations to show.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Days Overdue
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Next Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReminders.map((reminder) => (
                <tr
                  key={reminder.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => {/* Open details drawer */}}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{reminder.clientName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{reminder.invoiceNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      ${reminder.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={clsx("text-sm font-medium", getDaysOverdueClass(reminder.daysOverdue))}>
                      {reminder.daysOverdue} days
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={clsx(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      getStatusBadgeClass(reminder.type, reminder.stage)
                    )}>
                      {reminder.type === 'reminder' ? (
                        <BellIcon className="mr-1 h-3 w-3" />
                      ) : (
                        <ExclamationTriangleIcon className="mr-1 h-3 w-3" />
                      )}
                      {reminder.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {reminder.nextAction ? format(reminder.nextAction, 'MMM d, yyyy') : ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button className="inline-flex items-center px-2 py-1 border border-secondary-200 rounded-lg bg-white hover:bg-secondary-50 focus:outline-none">
                          Actions
                          <svg className="ml-2 w-4 h-4 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content align="end" sideOffset={4} className="z-[9999] w-56 bg-white border border-secondary-200 rounded-lg shadow-lg mt-2">
                          <DropdownMenu.Item asChild>
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-secondary-100 rounded"
                              onClick={(e) => { e.stopPropagation(); handleQuickAction(reminder.id, 'markAsPaid'); }}
                            >
                              Mark as Paid
                            </button>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item asChild>
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-secondary-100 rounded"
                              onClick={(e) => { e.stopPropagation(); handleQuickAction(reminder.id, 'pause'); }}
                            >
                              Pause
                            </button>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item asChild>
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-secondary-100 rounded"
                              onClick={(e) => { e.stopPropagation(); handleQuickAction(reminder.id, 'sendReminder'); }}
                            >
                              Send Reminder
                            </button>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item asChild>
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-secondary-100 rounded"
                              onClick={(e) => { e.stopPropagation(); handleQuickAction(reminder.id, 'sendEscalation'); }}
                            >
                              Send Escalation
                            </button>
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ReminderOpsDashboard; 