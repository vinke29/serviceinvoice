import React from 'react'
import { useState, useEffect } from 'react'
import { addDays, addWeeks, addMonths, parseISO, format } from 'date-fns'
import StatusChangeConfirmModal from './StatusChangeConfirmModal'
import { showToast } from '../utils/toast.jsx'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import { GoogleMap, useJsApiLoader, Autocomplete } from '@react-google-maps/api'

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
  console.log('Environment variables:', import.meta.env);
  console.log('Google Maps API Key:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
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

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  });

  console.log('Google Maps isLoaded:', isLoaded);

  const [addressFields, setAddressFields] = useState({
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: ''
  });

  const autocompleteRef = React.useRef(null);
  const [autocomplete, setAutocomplete] = useState(null);

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
      // Set address fields from client if present
      setAddressFields({
        street: client.street || '',
        city: client.city || '',
        state: client.state || '',
        postalCode: client.postalCode || '',
        country: client.country || ''
      });
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
    const submissionData = {
      ...formData,
      ...addressFields,
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      customerSince: formData.customerSince ? formatDateString(formData.customerSince) : ''
    };
    // Remove firstName and lastName from final submission
    delete submissionData.firstName;
    delete submissionData.lastName;

    // Only show modal if status is being changed to on_hold or cancelled
    if ((formData.status === 'on_hold' || formData.status === 'cancelled') && formData.status !== originalStatus) {
      setPendingData(submissionData)
      setShowStatusModal(true)
      return
    }
    onSubmit(submissionData)
  }

  // Determine if this is a new client (no id)
  const isNewClient = !client || !client.id

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 px-1 sm:px-0 pb-24">
        <div className="mb-2">
          <label className="block text-base sm:text-sm font-medium text-secondary-700 mb-1">First Name</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className="w-full px-4 py-3 min-h-[44px] text-base sm:text-sm appearance-none border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            required
            placeholder="John"
          />
        </div>
        <div className="mb-2">
          <label className="block text-base sm:text-sm font-medium text-secondary-700 mb-1">Last Name</label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className="w-full px-4 py-3 min-h-[44px] text-base sm:text-sm appearance-none border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            required
            placeholder="Smith"
          />
        </div>
        <div className="mb-2">
          <label className="block text-base sm:text-sm font-medium text-secondary-700 mb-1">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-3 min-h-[44px] text-base sm:text-sm appearance-none border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            required
          />
        </div>
        <div className="mb-2">
          <label className="block text-base sm:text-sm font-medium text-secondary-700 mb-1">Phone</label>
          <PhoneInput
            country={'us'}
            value={formData.phone}
            onChange={phone => setFormData({ ...formData, phone })}
            inputClass="w-full px-4 py-3 min-h-[44px] text-base sm:text-sm appearance-none border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            containerClass="w-full"
          />
        </div>
        <div className="mb-2">
          <label className="block text-base sm:text-sm font-medium text-secondary-700 mb-1">Street Name</label>
          {isLoaded ? (
            <Autocomplete
              onLoad={ac => {
                console.log('Autocomplete loaded:', ac);
                setAutocomplete(ac);
              }}
              onPlaceChanged={() => {
                console.log('Place changed, autocomplete:', autocomplete);
                if (!autocomplete) {
                  console.error('Autocomplete is not loaded yet');
                  return;
                }
                try {
                  const place = autocomplete.getPlace();
                  console.log('Selected place:', place);
                  
                  if (!place) {
                    console.error('No place selected');
                    return;
                  }

                  const components = place.address_components || [];
                  console.log('Address components:', components);

                  if (!components.length) {
                    console.warn('No address components found');
                    alert('Could not extract address components from the selected place. Please try again or enter manually.');
                    return;
                  }

                  const getComponent = (type) => {
                    const comp = components.find(c => c.types.includes(type));
                    return comp ? comp.long_name : '';
                  };

                  const street = [getComponent('street_number'), getComponent('route')].filter(Boolean).join(' ').trim();
                  const newAddressFields = {
                    street,
                    city: getComponent('locality') || getComponent('sublocality') || '',
                    state: getComponent('administrative_area_level_1'),
                    postalCode: getComponent('postal_code'),
                    country: getComponent('country'),
                  };
                  
                  console.log('Setting address fields:', newAddressFields);
                  setAddressFields(newAddressFields);
                } catch (error) {
                  console.error('Error processing place:', error);
                  alert('There was an error processing the selected address. Please try again or enter manually.');
                }
              }}
            >
              <input
                type="text"
                value={addressFields.street}
                onChange={e => setAddressFields({
                  street: e.target.value,
                  city: '',
                  state: '',
                  postalCode: '',
                  country: ''
                })}
                className="w-full px-4 py-3 min-h-[44px] text-base sm:text-sm appearance-none border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                placeholder="Start typing address..."
              />
            </Autocomplete>
          ) : (
            <input
              type="text"
              value={addressFields.street}
              onChange={e => setAddressFields({ ...addressFields, street: e.target.value })}
              className="w-full px-4 py-3 min-h-[44px] text-base sm:text-sm appearance-none border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
              placeholder="Start typing address..."
            />
          )}
        </div>
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="block text-base sm:text-sm font-medium text-secondary-700 mb-1">City</label>
            <input
              type="text"
              value={addressFields.city}
              onChange={e => setAddressFields({ ...addressFields, city: e.target.value })}
              className="w-full px-4 py-3 min-h-[44px] text-base sm:text-sm appearance-none border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
              placeholder="City"
            />
          </div>
          <div>
            <label className="block text-base sm:text-sm font-medium text-secondary-700 mb-1">State</label>
            <input
              type="text"
              value={addressFields.state}
              onChange={e => setAddressFields({ ...addressFields, state: e.target.value })}
              className="w-full px-4 py-3 min-h-[44px] text-base sm:text-sm appearance-none border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
              placeholder="State"
            />
          </div>
          <div>
            <label className="block text-base sm:text-sm font-medium text-secondary-700 mb-1">Postal Code</label>
            <input
              type="text"
              value={addressFields.postalCode}
              onChange={e => setAddressFields({ ...addressFields, postalCode: e.target.value })}
              className="w-full px-4 py-3 min-h-[44px] text-base sm:text-sm appearance-none border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
              placeholder="Postal Code"
            />
          </div>
          <div>
            <label className="block text-base sm:text-sm font-medium text-secondary-700 mb-1">Country</label>
            <input
              type="text"
              value={addressFields.country}
              onChange={e => setAddressFields({ ...addressFields, country: e.target.value })}
              className="w-full px-4 py-3 min-h-[44px] text-base sm:text-sm appearance-none border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
              placeholder="Country"
            />
          </div>
        </div>
        <div className="mb-2">
          <label className="block text-base sm:text-sm font-medium text-secondary-700 mb-1">Customer Since</label>
          <input
            type="date"
            value={formData.customerSince}
            onChange={e => setFormData({ ...formData, customerSince: e.target.value })}
            className="w-full px-4 py-3 min-h-[44px] text-base sm:text-sm appearance-none border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            required
          />
          <span className="block text-xs text-secondary-500 mt-1">Set automatically when the client is created.</span>
        </div>
        <div className="mb-2">
          <label className="block text-base sm:text-sm font-medium text-secondary-700 mb-1">Status</label>
          <select
            value={formData.status}
            onChange={e => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-4 py-3 min-h-[44px] text-base sm:text-sm appearance-none border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
          >
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="fixed bottom-0 left-0 w-full z-50 bg-white pt-2 pb-3 flex gap-2 shadow-lg sm:static sm:shadow-none">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 min-h-[44px] text-base sm:text-sm text-secondary-700 bg-secondary-100 rounded-xl font-medium shadow-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-3 min-h-[44px] text-base sm:text-sm bg-primary-600 text-white rounded-xl font-bold shadow hover:bg-primary-700 transition"
          >
            {isNewClient ? 'Add Client' : 'Update Client'}
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