import React, { useState, useRef, useEffect } from 'react'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
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

  const autocompleteRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault()
    // Combine firstName and lastName into name field for submission
    const submissionData = {
      ...data,
      name: `${data.firstName} ${data.lastName}`.trim()
    };
    // Remove firstName and lastName from final submission
    delete submissionData.firstName;
    delete submissionData.lastName;
    onSubmit(submissionData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" id="onboarding-client-form">
      {/* Name fields: stack vertically on mobile, grid on md+ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-base font-medium text-secondary-700 mb-2">First Name</label>
          <input
            type="text"
            value={data.firstName}
            onChange={(e) => setData({ ...data, firstName: e.target.value })}
            className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
            required
            placeholder="John"
          />
        </div>
        <div>
          <label className="block text-base font-medium text-secondary-700 mb-2">Last Name</label>
          <input
            type="text"
            value={data.lastName}
            onChange={(e) => setData({ ...data, lastName: e.target.value })}
            className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
            required
            placeholder="Smith"
          />
        </div>
      </div>
      <div>
        <label className="block text-base font-medium text-secondary-700 mb-2">Email</label>
        <input
          type="email"
          value={data.email}
          onChange={(e) => setData({ ...data, email: e.target.value })}
          className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
          required
          placeholder="client@example.com"
        />
      </div>
      <div>
        <label className="block text-base font-medium text-secondary-700 mb-2">Phone</label>
        <PhoneInput
          country={'us'}
          value={data.phone}
          onChange={phone => setData({ ...data, phone })}
          inputClass="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
          containerClass="w-full"
        />
      </div>
      <div>
        <label className="block text-base font-medium text-secondary-700 mb-2">Street Name</label>
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
              setData({
                ...data,
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
              value={data.street}
              onChange={e => setData({ ...data, street: e.target.value })}
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
              required
              placeholder="Start typing address..."
            />
          </Autocomplete>
        ) : (
          <input
            type="text"
            value={data.street}
            onChange={e => setData({ ...data, street: e.target.value })}
            className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
            required
            placeholder="Street address"
          />
        )}
      </div>
      {/* Address fields: stack vertically on mobile, grid on md+ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-2">
        <div>
          <label className="block text-base font-medium text-secondary-700 mb-2">City</label>
          <input type="text" value={data.city} onChange={e => setData({ ...data, city: e.target.value })} className="w-full px-4 py-3 border border-secondary-200 rounded-xl text-base" required />
        </div>
        <div>
          <label className="block text-base font-medium text-secondary-700 mb-2">State</label>
          <input type="text" value={data.state} onChange={e => setData({ ...data, state: e.target.value })} className="w-full px-4 py-3 border border-secondary-200 rounded-xl text-base" required />
        </div>
        <div>
          <label className="block text-base font-medium text-secondary-700 mb-2">Postal Code</label>
          <input type="text" value={data.postalCode} onChange={e => setData({ ...data, postalCode: e.target.value })} className="w-full px-4 py-3 border border-secondary-200 rounded-xl text-base" required />
        </div>
        <div>
          <label className="block text-base font-medium text-secondary-700 mb-2">Country</label>
          <input type="text" value={data.country} onChange={e => setData({ ...data, country: e.target.value })} className="w-full px-4 py-3 border border-secondary-200 rounded-xl text-base" required />
        </div>
      </div>
      {/* Action row: use renderActions if provided, else default */}
      {renderActions ? (
        renderActions({
          onSubmit: handleSubmit,
          onCancel,
        })
      ) : (
        <div className="flex flex-col gap-3 pt-4 w-full">
          <button
            type="submit"
            className="w-full px-4 py-4 bg-primary-600 text-white rounded-xl font-bold text-lg hover:bg-primary-700 transition-colors duration-200 shadow-md"
          >
            Add Client
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full px-4 py-4 text-secondary-700 font-medium bg-secondary-100 rounded-xl text-lg hover:text-secondary-900 hover:bg-secondary-200 transition-colors duration-200 shadow"
          >
            Skip for now
          </button>
        </div>
      )}
    </form>
  )
}

export default OnboardingClientForm 