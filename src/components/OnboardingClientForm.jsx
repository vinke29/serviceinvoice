import React, { useState, useRef } from 'react'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api'

function OnboardingClientForm({ onSubmit, onCancel, renderActions, formData, setFormData }) {
  // Use controlled state from parent if provided, else fallback to internal state
  const [internalFormData, internalSetFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    customerSince: new Date().toISOString().slice(0, 10),
    status: 'Active'
  })
  const data = formData || internalFormData;
  const setData = setFormData || internalSetFormData;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  });

  const [addressFields, setAddressFields] = useState({
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: ''
  });

  const autocompleteRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault()
    // Combine firstName and lastName into name field for submission
    const submissionData = {
      ...data,
      ...addressFields,
      name: `${data.firstName} ${data.lastName}`.trim()
    };
    // Remove firstName and lastName from final submission
    delete submissionData.firstName;
    delete submissionData.lastName;
    onSubmit(submissionData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" id="onboarding-client-form">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">First Name</label>
          <input
            type="text"
            value={data.firstName}
            onChange={(e) => setData({ ...data, firstName: e.target.value })}
            className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
            placeholder="John"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">Last Name</label>
          <input
            type="text"
            value={data.lastName}
            onChange={(e) => setData({ ...data, lastName: e.target.value })}
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
          value={data.email}
          onChange={(e) => setData({ ...data, email: e.target.value })}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
          placeholder="client@example.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Phone</label>
        <PhoneInput
          international
          defaultCountry="US"
          value={data.phone}
          onChange={phone => setData({ ...data, phone })}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Street Name</label>
        {isLoaded ? (
          <Autocomplete
            onLoad={ref => (autocompleteRef.current = ref)}
            onPlaceChanged={() => {
              if (!autocompleteRef.current) return;
              const place = autocompleteRef.current.getPlace();
              const components = place.address_components || [];
              const getComponent = (type) => {
                const comp = components.find(c => c.types.includes(type));
                return comp ? comp.long_name : '';
              };
              setAddressFields({
                street: `${getComponent('street_number')} ${getComponent('route')}`.trim() || place.name || '',
                city: getComponent('locality') || getComponent('sublocality') || '',
                state: getComponent('administrative_area_level_1'),
                postalCode: getComponent('postal_code'),
                country: getComponent('country'),
              });
            }}
          >
            <input
              type="text"
              value={addressFields.street}
              onChange={e => setAddressFields({ ...addressFields, street: e.target.value })}
              className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
              placeholder="Start typing address..."
            />
          </Autocomplete>
        ) : (
          <input
            type="text"
            value={addressFields.street}
            onChange={e => setAddressFields({ ...addressFields, street: e.target.value })}
            className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
            placeholder="Street address"
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 mt-2">
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">City</label>
          <input type="text" value={addressFields.city} onChange={e => setAddressFields({ ...addressFields, city: e.target.value })} className="w-full px-4 py-2 border border-secondary-200 rounded-lg" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">State</label>
          <input type="text" value={addressFields.state} onChange={e => setAddressFields({ ...addressFields, state: e.target.value })} className="w-full px-4 py-2 border border-secondary-200 rounded-lg" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">Postal Code</label>
          <input type="text" value={addressFields.postalCode} onChange={e => setAddressFields({ ...addressFields, postalCode: e.target.value })} className="w-full px-4 py-2 border border-secondary-200 rounded-lg" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">Country</label>
          <input type="text" value={addressFields.country} onChange={e => setAddressFields({ ...addressFields, country: e.target.value })} className="w-full px-4 py-2 border border-secondary-200 rounded-lg" required />
        </div>
      </div>
      {/* Action row: use renderActions if provided, else default */}
      {renderActions ? (
        renderActions({
          onSubmit: handleSubmit,
          onCancel,
        })
      ) : (
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-secondary-700 hover:text-secondary-900 font-medium"
          >
            Skip for now
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200"
          >
            Add Client
          </button>
        </div>
      )}
    </form>
  )
}

export default OnboardingClientForm 