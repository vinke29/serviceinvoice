import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { getClients, getInvoices, getAgentConfig } from '../firebaseData'
import { auth } from '../firebase'
import { endOfMonth, startOfMonth, isWithinInterval, addDays, format, isFuture, isThisMonth, parseISO } from 'date-fns'
import { invoiceGenerationService } from '../services/invoiceGenerationService'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function StatCard({ title, value, icon, color }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-6 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-secondary-600">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${color.replace('text', 'bg')} bg-opacity-10`}>
          {icon}
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${color.replace('text', 'bg')} bg-opacity-20`}></div>
    </div>
  )
}

function ActivityCard({ client, service, amount, status, date, type }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid':
        return 'text-primary-600 bg-primary-50'
      case 'Pending':
        return 'text-orange-600 bg-orange-50'
      default:
        return 'text-secondary-600 bg-secondary-50'
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-soft hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center space-x-4">
        <div className="h-10 w-10 rounded-full bg-primary-50 flex items-center justify-center">
          <span className="text-primary-700 font-medium">{client[0]}</span>
        </div>
        <div>
          <p className="font-medium text-secondary-900">{client}</p>
          <div className="flex items-center text-sm text-secondary-600">
            <span className="font-medium">{type}</span>
            <span className="mx-1">•</span>
            <span>{service}</span>
          </div>
          <p className="text-xs text-secondary-500">Due: {date}</p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-secondary-900 font-medium">${amount}</span>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>{status}</span>
      </div>
    </div>
  )
}

function ExpectedThisMonthCard() {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-6 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-secondary-600">Expected This Month</p>
          <p className={`text-3xl font-bold mt-2 text-primary-600`}>$0</p>
        </div>
        <div className={`p-3 rounded-xl bg-primary-600 bg-opacity-10`}>
          <span>📅</span>
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full bg-primary-600 bg-opacity-20`}></div>
    </div>
  )
}

function Dashboard() {
  const currentYear = new Date().getFullYear();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(null); // null means showing all months
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);

  const [clients, setClients] = useState([])
  const [invoices, setInvoices] = useState([])
  const [agentConfig, setAgentConfig] = useState(null)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const user = auth.currentUser
      if (user) {
        const [clientsData, invoicesData, configData] = await Promise.all([
          getClients(user.uid),
          getInvoices(user.uid),
          getAgentConfig(user.uid)
        ])
        setClients(clientsData)
        setInvoices(invoicesData)
        setAgentConfig(configData || { netDays: 7 }) // Default to 7 days if not set
      } else {
        setClients([])
        setInvoices([])
        setAgentConfig(null)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  // Calculate stats
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  
  console.log('============= DEBUGGING DASHBOARD CALCULATION =============');
  console.log('Current date:', now.toISOString());
  console.log('This month:', thisMonth, 'This year:', thisYear);
  
  // DEBUGGING: Log raw invoice data to find potential deleted invoices
  console.log('ALL INVOICES IN SYSTEM:', invoices.map(inv => ({
    id: inv.id,
    amount: inv.amount,
    clientId: inv.clientId,
    clientName: inv.clientName,
    dueDate: inv.dueDate,
    status: inv.status
  })));
  
  console.log('ALL CLIENTS IN SYSTEM:', clients.map(client => ({
    id: client.id,
    name: client.name,
    fee: client.fee,
    firstInvoiceDate: client.firstInvoiceDate,
    nextInvoiceDate: client.nextInvoiceDate,
    onHold: client.onHold
  })));
  
  // Helper: get active client IDs
  const activeClientIds = clients.filter(c => c.status === 'active' && !c.onHold).map(c => c.id);

  // Helper: should include invoice in dashboard calculations
  const shouldIncludeInvoice = (inv) => {
    if (inv.status === 'scheduled') {
      // Only include scheduled invoices for active clients
      return activeClientIds.includes(inv.clientId);
    }
    // Always include non-scheduled invoices
    return true;
  };

  // Calculate revenue for the selected year or month
  const calculateRevenue = () => {
    console.log("=============================================");
    console.log("DEBUGGING REVENUE CALCULATION");
    console.log("=============================================");
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log("No current user found");
      return { expected: 0, received: 0, pending: 0 };
    }
    
    const today = new Date();
    console.log(`Current user: ${currentUser.email} (${currentUser.uid})`);
    console.log(`Selected year: ${selectedYear}`);
    console.log(`Selected month: ${selectedMonth !== null ? months[selectedMonth] : 'All months'}`);
    
    // Filter invoices by year, month, and shouldIncludeInvoice
    const yearInvoices = invoices.filter(inv => {
      try {
        const dueDate = new Date(inv.dueDate);
        const matchesYear = dueDate.getFullYear() === selectedYear;
        // If a month is selected, also filter by month
        if (selectedMonth !== null) {
          return matchesYear && dueDate.getMonth() === selectedMonth && shouldIncludeInvoice(inv);
        }
        return matchesYear && shouldIncludeInvoice(inv);
      } catch (e) {
        return false;
      }
    });
    
    console.log(`Found ${yearInvoices.length} invoices for selected period`);
    
    // Calculate received amount (paid invoices)
    const receivedAmount = yearInvoices
      .filter(inv => (inv.status === 'paid' || inv.status === 'Paid') && !inv.deleted)
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    
    // Track which clients we've already counted to avoid double-counting
    const processedClientIds = new Set();
    
    // Calculate unpaid amount from existing invoices (excluding scheduled ones)
    const unpaidFromExistingInvoices = yearInvoices
      .filter(inv => 
        inv.status !== 'paid' && 
        inv.status !== 'Paid' && 
        inv.status !== 'scheduled' && // Exclude scheduled invoices from pending
        !inv.deleted
      )
      .reduce((sum, inv) => {
        // Track which clients already have invoices to avoid double counting
        if (inv.clientId) {
          processedClientIds.add(inv.clientId);
        }
        return sum + parseFloat(inv.amount || 0);
      }, 0);
    
    // Calculate future/scheduled invoices
    let futureInvoiceAmount = yearInvoices
      .filter(inv => 
        inv.status === 'scheduled' && // Include all scheduled invoices in expected revenue
        !inv.deleted &&
        // Only include scheduled invoices for active clients
        clients.find(c => c.id === inv.clientId)?.status === 'active' &&
        !clients.find(c => c.id === inv.clientId)?.onHold
      )
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    
    // Calculate total unpaid (only from existing non-scheduled invoices)
    const pendingAmount = unpaidFromExistingInvoices;
    
    // Total expected = received + pending + scheduled
    const expectedAmount = receivedAmount + unpaidFromExistingInvoices + futureInvoiceAmount;
    
    console.log(`Total received: $${receivedAmount}`);
    console.log(`Total unpaid from existing: $${unpaidFromExistingInvoices}`);
    console.log(`Total future scheduled: $${futureInvoiceAmount}`);
    console.log(`Total pending: $${pendingAmount}`);
    console.log(`Total expected: $${expectedAmount}`);
    
    return {
      expected: expectedAmount,
      received: receivedAmount,
      pending: pendingAmount
    };
  };
  
  // Helper function to calculate how many additional invoices will occur in the year after the first invoice
  const calculateRemainingInvoicesInYear = (startDate, frequency, year) => {
    if (!frequency) return 0; // If no frequency defined, no recurring invoices
    
    const endOfSelectedYear = new Date(year, 11, 31); // December 31 of selected year
    
    // Calculate interval between invoices in days
    let intervalDays;
    switch (frequency.toLowerCase()) {
      case 'weekly':
        intervalDays = 7;
        break;
      case 'biweekly':
        intervalDays = 14;
        break;
      case 'monthly':
        // Average month length for simplicity
        intervalDays = 30.5;
        break;
      case 'quarterly':
        intervalDays = 91.25; // ~365/4
        break;
      case 'annually':
        intervalDays = 365;
        break;
      default:
        intervalDays = 30.5; // Default to monthly
    }
    
    // Calculate days remaining in year from start date
    const daysRemaining = (endOfSelectedYear - startDate) / (1000 * 60 * 60 * 24);
    
    // Calculate how many more invoices will occur in the year
    const additionalInvoices = Math.floor(daysRemaining / intervalDays);
    
    return additionalInvoices;
  };
  
  // Helper function to calculate total invoices in a year
  const calculateTotalInvoicesInYear = (firstInvoiceDate, frequency, year) => {
    const startOfSelectedYear = new Date(year, 0, 1); // January 1 of selected year
    const endOfSelectedYear = new Date(year, 11, 31); // December 31 of selected year
    
    // If first invoice is after the end of the year, return 0
    if (firstInvoiceDate > endOfSelectedYear) return 0;
    
    // Calculate number of invoices based on frequency
    let numberOfInvoices;
    
    switch (frequency.toLowerCase()) {
      case 'weekly':
        numberOfInvoices = 52;
        break;
      case 'biweekly':
        numberOfInvoices = 26;
        break;
      case 'monthly':
        numberOfInvoices = 12;
        break;
      case 'quarterly':
        numberOfInvoices = 4;
        break;
      case 'annually':
        numberOfInvoices = 1;
        break;
      default:
        numberOfInvoices = 12; // Default to monthly
    }
    
    // If the first invoice date is after the start of the year,
    // we need to reduce the total count proportionally
    if (firstInvoiceDate > startOfSelectedYear) {
      const daysIntoYear = (firstInvoiceDate - startOfSelectedYear) / (1000 * 60 * 60 * 24);
      const fractionOfYearPassed = daysIntoYear / 365;
      const missedInvoices = Math.floor(numberOfInvoices * fractionOfYearPassed);
      return Math.max(0, numberOfInvoices - missedInvoices);
    }
    
    // If the first invoice date is before the start of the year,
    // we need to calculate based on when the next recurring invoice would fall in the year
    if (firstInvoiceDate < startOfSelectedYear) {
      // For recurring billing that started before the selected year
      // Determine when in our selected year the next invoice would occur
      
      // Calculate months/days between the first invoice and start of selected year
      const monthsBetween = (year - firstInvoiceDate.getFullYear()) * 12 + 
                            (0 - firstInvoiceDate.getMonth());
      
      let offsetInvoices = 0;
      
      switch (frequency.toLowerCase()) {
        case 'weekly':
          // Weekly invoices will always have 52 in a year regardless of start date
          return 52;
        case 'biweekly':
          // Biweekly invoices will always have 26 in a year regardless of start date
          return 26;
        case 'monthly':
          // For monthly, just modulo the months between to find offset
          offsetInvoices = monthsBetween % 12;
          if (offsetInvoices === 0) return 12; // If perfect alignment, all 12 months
          return 12; // Monthly will always have 12 invoices in a full year
        case 'quarterly':
          // For quarterly, calculate how many quarters have passed
          offsetInvoices = monthsBetween % 3;
          if (offsetInvoices === 0) return 4; // If perfect alignment, all 4 quarters
          return 4; // Quarterly will always have 4 invoices in a full year
        case 'annually':
          // For annual, check if anniversary falls in selected year
          const anniversaryMonth = firstInvoiceDate.getMonth();
          const anniversaryDay = firstInvoiceDate.getDate();
          // If the invoice date has an anniversary in the selected year, count it
          return 1; // Annual will have 1 invoice per year
        default:
          return numberOfInvoices; // Default case, just return standard count
      }
    }
    
    return numberOfInvoices;
  };
  
  // Helper function to check if a client has an invoice in a specific month
  const hasInvoiceInMonth = (nextInvoiceDate, frequency, year, month) => {
    const targetMonth = new Date(year, month, 1);
    
    // If client's next invoice is after the target month, then no invoice
    if (nextInvoiceDate.getFullYear() > year || 
        (nextInvoiceDate.getFullYear() === year && nextInvoiceDate.getMonth() > month)) {
      return false;
    }
    
    // If the invoice is exactly in the target month, then yes
    if (nextInvoiceDate.getFullYear() === year && nextInvoiceDate.getMonth() === month) {
      return true;
    }
    
    // If we're here, then nextInvoiceDate is before our target month
    // Check if any recurring invoices would land in target month
    
    // Calculate interval between invoices in months
    let intervalMonths;
    switch (frequency.toLowerCase()) {
      case 'weekly':
        return true; // Every month has at least one weekly invoice
      case 'biweekly':
        return true; // Every month has at least one biweekly invoice
      case 'monthly':
        intervalMonths = 1;
        break;
      case 'quarterly':
        intervalMonths = 3;
        break;
      case 'annually':
        intervalMonths = 12;
        break;
      default:
        intervalMonths = 1; // Default to monthly
    }
    
    // Calculate months between next invoice date and target month
    const monthsElapsed = (year - nextInvoiceDate.getFullYear()) * 12 + (month - nextInvoiceDate.getMonth());
    
    // Check if target month would have an invoice based on frequency
    return monthsElapsed % intervalMonths === 0;
  };

  // Get revenue stats for the selected period
  const revenue = calculateRevenue();
  
  // Get the total of all clients
  const totalClients = clients.length;

  // Recent activity: last 5 invoices
  const recentActivity = invoices
    .slice()
    .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
    .slice(0, 5)
    .map(inv => ({
      client: clients.find(c => c.id === inv.clientId)?.name || 'Unknown',
      service: inv.description,
      amount: inv.amount,
      status: inv.status.charAt(0).toUpperCase() + inv.status.slice(1),
      date: inv.dueDate,
      type: 'Invoice'
    }))

  // Monthly chart data - include client estimated invoices in the data
  const monthlyData = months.map((month, i) => {
    // Get the year and month we're calculating for
    // For each month, sum all invoices (including scheduled/recurring) with a due date in that month and year
    const monthInvoices = invoices.filter(inv => {
      try {
        const dueDate = new Date(inv.dueDate);
        return dueDate.getMonth() === i && dueDate.getFullYear() === selectedYear;
      } catch (e) {
        return false;
      }
    });

    // Calculate the paid and unpaid amounts from all invoices
    const paidAmount = monthInvoices
      .filter(inv => inv.status === 'paid' || inv.status === 'Paid')
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    const unpaidAmount = monthInvoices
      .filter(inv => inv.status !== 'paid' && inv.status !== 'Paid')
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    return {
      month,
      Paid: paidAmount,
      Unpaid: unpaidAmount
    };
  });

  if (loading) {
    return <div className="min-h-[300px] flex items-center justify-center text-lg text-secondary-600">Loading dashboard...</div>
  }

  const isEmpty = clients.length === 0 && invoices.length === 0

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">Welcome back!</h2>
          <p className="text-secondary-600 mt-1">Here's what's happening with your business today.</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Filter Controls - More consistent styling */}
          <div className="flex items-center space-x-3">
            {/* Year selector */}
            <div className="flex items-center bg-white rounded-lg shadow-soft">
              <button
                onClick={() => setSelectedYear(selectedYear - 1)}
                className="p-2 text-secondary-600 hover:text-primary-600 transition-colors duration-200"
                aria-label="Previous year"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="px-2 font-medium text-secondary-900">{selectedYear}</span>
              <button
                onClick={() => setSelectedYear(selectedYear + 1)}
                className="p-2 text-secondary-600 hover:text-primary-600 transition-colors duration-200"
                aria-label="Next year"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            
            {/* Month filter */}
            <div className="flex items-center bg-white rounded-lg shadow-soft">
              <select
                value={selectedMonth === null ? "" : selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value === "" ? null : Number(e.target.value))}
                className="border-none bg-transparent py-2 px-3 text-secondary-900 focus:ring-0 appearance-none cursor-pointer"
                aria-label="Filter by month"
              >
                <option value="">All Months</option>
                {months.map((month, index) => (
                  <option key={month} value={index}>{month}</option>
                ))}
              </select>
              <div className="pointer-events-none pr-2">
                <svg className="w-4 h-4 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="bg-white rounded-2xl shadow-soft p-8 text-center text-secondary-500 text-lg">
          No data yet. Add clients and invoices to see your business stats here!
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard 
              title={`Expected ${selectedMonth !== null ? months[selectedMonth] + ' ' : ''}${selectedYear} Revenue`} 
              value={`$${Math.round(revenue.expected)}`} 
              icon={<span>📅</span>} 
              color="text-primary-600" 
            />
            <StatCard 
              title={`Received in ${selectedMonth !== null ? months[selectedMonth] + ' ' : ''}${selectedYear}`} 
              value={`$${Math.round(revenue.received)}`} 
              icon={<span>💰</span>} 
              color="text-green-600" 
            />
            <StatCard 
              title="Pending Payments" 
              value={`$${Math.round(revenue.pending)}`} 
              icon={<span>⏳</span>} 
              color="text-orange-600" 
            />
            <StatCard 
              title="Total Clients" 
              value={totalClients} 
              icon={<span>👥</span>} 
              color="text-secondary-600" 
            />
          </div>

          <div className="bg-white rounded-2xl shadow-soft p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4">Monthly Revenue</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={monthlyData} 
                margin={{ top: 20, right: 5, left: 0, bottom: 5 }}
                barSize={isMobile ? 15 : 20}
              >
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: isMobile ? 10 : 12 }}
                  interval={isMobile ? 1 : 0}
                  tickMargin={10}
                />
                <YAxis 
                  tick={{ fontSize: isMobile ? 10 : 12 }}
                  width={isMobile ? 30 : 40}
                />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', padding: '8px' }}
                  itemStyle={{ padding: '2px 0' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '5px' }}
                  formatter={(value, name, props) => {
                    if (value === 0) return ['$0', name];
                    
                    // Determine if this is current month, past month, or future month
                    const monthIndex = months.indexOf(props.payload.month);
                    const isFutureMonth = (selectedYear > currentYear) || 
                                         (selectedYear === currentYear && monthIndex > thisMonth);
                    const isPastMonth = (selectedYear < currentYear) || 
                                       (selectedYear === currentYear && monthIndex < thisMonth);
                    
                    if (name === 'Paid') {
                      return [`$${value}`, 'Invoices paid in this month'];
                    } else { // Unpaid
                      if (isFutureMonth) {
                        return [`$${value}`, 'Expected payments (includes upcoming invoices)'];
                      } else if (monthIndex === thisMonth) {
                        return [`$${value}`, 'Expected payments this month'];
                      } else {
                        return [`$${value}`, 'Unpaid invoices from this month'];
                      }
                    }
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  iconSize={10}
                />
                <Bar dataKey="Paid" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Unpaid" stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-soft p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4">Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <div className="text-secondary-500">No recent invoices.</div>
            ) : (
              <div>
                <p className="text-sm text-secondary-600 mb-4">Your latest invoices and their current status</p>
                <div className="space-y-4">
                  {recentActivity.map((activity, i) => (
                    <ActivityCard key={i} {...activity} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard 