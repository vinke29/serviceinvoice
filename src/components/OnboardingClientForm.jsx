import { useState } from 'react'

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
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-1">Address</label>
        <textarea
          value={data.address}
          onChange={(e) => setData({ ...data, address: e.target.value })}
          className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          rows="3"
          required
          placeholder="123 Main St, Anytown, CA 12345"
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