import { useState, useEffect } from 'react'
import { addDays, addWeeks, addMonths, parseISO, format } from 'date-fns'

// Helper function to normalize dates to YYYY-MM-DD format without timezone issues
const formatDateString = (date) => {
  if (!date) return '';
  // If it's already a string in YYYY-MM-DD format, return as is
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  // Otherwise, ensure we're working with a Date object and format it
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy-MM-dd');
};

function ClientForm({ client, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    customerSince: '',
    lastInvoiced: '',
    lastPaid: '',
    paymentScore: '',
    status: 'active',
  })
  
  // Remove all first/next invoice and onHold related state
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (client) {
      setFormData(client)
    } else {
      // Set customerSince to today on creation and status to active
      setFormData(f => ({ 
        ...f, 
        customerSince: new Date().toISOString().slice(0, 10),
        status: 'active'
      }))
    }
  }, [client])

  // Remove all invoice date calculation useEffect hooks
  
  const handleSubmit = (e) => {
    e.preventDefault()
    // Ensure dates are in the correct format before submitting
    const formattedData = {
      ...formData,
      customerSince: formData.customerSince ? formatDateString(formData.customerSince) : ''
    };
    onSubmit(formattedData)
  }

  // Determine if this is a new client (no id)
  const isNewClient = !client || !client.id

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Phone</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Address</label>
        <textarea
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          rows="3"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Customer Since</label>
        <input
          type="date"
          value={formData.customerSince || ''}
          readOnly
          disabled
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg bg-secondary-50 text-secondary-500"
        />
        <div className="text-xs text-secondary-500 mt-1">Set automatically when the client is created.</div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Status</label>
        <select
          value={formData.status}
          onChange={e => setFormData({ ...formData, status: e.target.value })}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
        >
          <option value="">Select status</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="cancelled">Cancelled</option>
          <option value="delinquent">Delinquent</option>
        </select>
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-secondary-700 hover:text-secondary-900 font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200"
        >
          {client ? 'Update Client' : 'Add Client'}
        </button>
      </div>
    </form>
  )
}

export default ClientForm 