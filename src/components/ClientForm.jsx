import { useState, useEffect, useRef } from 'react'
import { addDays, addWeeks, addMonths, parseISO, format } from 'date-fns'
import StatusChangeConfirmModal from './StatusChangeConfirmModal'
import { showToast } from '../utils/toast.jsx'
import { GoogleMap, useJsApiLoader, Autocomplete } from '@react-google-maps/api'

const GOOGLE_MAPS_LIBRARIES = ['places'];

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

function ClientForm({ client, onSubmit, onCancel, scheduledInvoicesCount = 0 }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    customerSince: '',
    lastInvoiced: '',
    lastPaid: '',
    paymentScore: '',
    status: 'active',
  })
  
  // Track the original status
  const [originalStatus, setOriginalStatus] = useState('active');

  const [showStatusModal, setShowStatusModal] = useState(false)
  const [pendingData, setPendingData] = useState(null)

  const autocompleteRef = useRef(null);
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (!place.address_components) return;
      const getComponent = (type) => {
        const comp = place.address_components.find(c => c.types.includes(type));
        return comp ? comp.long_name : '';
      };
      setFormData(f => ({
        ...f,
        address: getComponent('street_number') + ' ' + getComponent('route'),
        city: getComponent('locality') || getComponent('sublocality') || getComponent('postal_town'),
        state: getComponent('administrative_area_level_1'),
        zip: getComponent('postal_code'),
        country: getComponent('country'),
      }));
    }
  };

  useEffect(() => {
    if (client) {
      // Split existing name into firstName and lastName if it exists
      const { name, ...otherFields } = client;
      let firstName = '', lastName = '';
      if (name) {
        const nameParts = name.trim().split(/\s+/);
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }
      setFormData({ ...otherFields, firstName, lastName });
      setOriginalStatus(otherFields.status || 'active');
    } else {
      // Set customerSince to today on creation and status to active
      setFormData(f => ({ 
        ...f, 
        customerSince: new Date().toISOString().slice(0, 10),
        status: 'active'
      }))
      setOriginalStatus('active');
    }
  }, [client])

  // Remove all invoice date calculation useEffect hooks
  
  const handleSubmit = (e) => {
    e.preventDefault()
    // Combine firstName and lastName into name field and ensure dates are in correct format
    const formattedData = {
      ...formData,
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      customerSince: formData.customerSince ? formatDateString(formData.customerSince) : ''
    };
    // Remove firstName and lastName from final submission
    delete formattedData.firstName;
    delete formattedData.lastName;

    // Only show modal if status is being changed to on_hold or cancelled
    if ((formData.status === 'on_hold' || formData.status === 'cancelled') && formData.status !== originalStatus) {
      setPendingData(formattedData)
      setShowStatusModal(true)
      return
    }
    onSubmit(formattedData)
    showToast('success', isNewClient ? 'Client created successfully!' : 'Client updated successfully!')
  }

  // Determine if this is a new client (no id)
  const isNewClient = !client || !client.id

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">First Name</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Last Name</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
              placeholder="Smith"
            />
          </div>
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
        <div className="col-span-2">
          <label className="block text-sm font-medium text-secondary-700 mb-1">Street Address</label>
          {isLoaded ? (
            <Autocomplete
              onLoad={ac => (autocompleteRef.current = ac)}
              onPlaceChanged={onPlaceChanged}
            >
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </Autocomplete>
          ) : (
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">City</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">State / Province</label>
          <input
            type="text"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">ZIP / Postal Code</label>
          <input
            type="text"
            value={formData.zip}
            onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
            className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">Country</label>
          <input
            type="text"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
            className="w-full px-4 py-2 border border-secondary-200 rounded-lg bg-gray-50 text-secondary-500"
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
      {showStatusModal && (
        <StatusChangeConfirmModal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          onConfirm={() => {
            setShowStatusModal(false)
            if (pendingData) {
              onSubmit(pendingData)
              showToast('success', isNewClient ? 'Client created successfully!' : 'Client updated successfully!')
            }
          }}
          clientName={`${formData.firstName} ${formData.lastName}`.trim()}
          action={formData.status === 'cancelled' ? 'cancel' : 'hold'}
          scheduledInvoicesCount={scheduledInvoicesCount}
        />
      )}
    </>
  )
}

export default ClientForm 