import { useState, useRef } from 'react'
import { GoogleMap, useJsApiLoader, Autocomplete } from '@react-google-maps/api'

const GOOGLE_MAPS_LIBRARIES = ['places'];

function OnboardingClientForm({ onSubmit, onCancel, renderActions, formData, setFormData }) {
  // Use controlled state from parent if provided, else fallback to internal state
  const [internalFormData, internalSetFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    customerSince: new Date().toISOString().slice(0, 10),
    status: 'Active'
  })
  const data = formData || internalFormData;
  const setData = setFormData || internalSetFormData;

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
      setData(f => ({
        ...f,
        address: getComponent('street_number') + ' ' + getComponent('route'),
        city: getComponent('locality') || getComponent('sublocality') || getComponent('postal_town'),
        state: getComponent('administrative_area_level_1'),
        zip: getComponent('postal_code'),
        country: getComponent('country'),
      }));
    }
  };

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
        <input
          type="tel"
          value={data.phone}
          onChange={(e) => setData({ ...data, phone: e.target.value })}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
          placeholder="(123) 456-7890"
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
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value })}
              className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
              placeholder="123 Main St"
            />
          </Autocomplete>
        ) : (
          <input
            type="text"
            value={data.address}
            onChange={(e) => setData({ ...data, address: e.target.value })}
            className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
            placeholder="123 Main St"
          />
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">City</label>
        <input
          type="text"
          value={data.city}
          onChange={(e) => setData({ ...data, city: e.target.value })}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
          placeholder="Anytown"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">State / Province</label>
        <input
          type="text"
          value={data.state}
          onChange={(e) => setData({ ...data, state: e.target.value })}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
          placeholder="CA"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">ZIP / Postal Code</label>
        <input
          type="text"
          value={data.zip}
          onChange={(e) => setData({ ...data, zip: e.target.value })}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
          placeholder="12345"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Country</label>
        <input
          type="text"
          value={data.country}
          onChange={(e) => setData({ ...data, country: e.target.value })}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
          placeholder="United States"
        />
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