import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { showToast } from '../utils/toast.jsx';
import { GoogleMap, useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

// Google Maps JS API loader for PlaceAutocompleteElement
function loadGoogleMapsScript(apiKey) {
  if (window.google && window.google.maps && window.customElements.get('gmpx-place-autocomplete')) return;
  if (document.getElementById('google-maps-script')) return;
  const script = document.createElement('script');
  script.id = 'google-maps-script';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=beta`;
  script.async = true;
  document.body.appendChild(script);
}

function UserProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    companyName: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    website: '',
    taxId: '',
    paymentInstructions: '',
    logo: ''
  });

  const autocompleteRef = useRef(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  });

  useEffect(() => {
    loadGoogleMapsScript(apiKey);
    const checkReady = setInterval(() => {
      if (window.customElements && window.customElements.get('gmpx-place-autocomplete')) {
        setAutocompleteReady(true);
        clearInterval(checkReady);
      }
    }, 100);
    return () => clearInterval(checkReady);
  }, [apiKey]);

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

  // Fetch user profile data when component mounts
  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) return;

        console.log('Fetching profile for user:', user.uid);

        // First check localStorage for onboarding data
        const onboardingCompleted = localStorage.getItem(`onboarding_completed_${user.uid}`);
        let onboardingData = null;
        
        // Get user profile document from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('User profile loaded:', userData);
          setFormData({
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            phone: userData.phone || '',
            companyName: userData.companyName || '',
            email: userData.email || '',
            address: userData.address || '',
            city: userData.city || '',
            state: userData.state || '',
            zip: userData.zip || '',
            country: userData.country || '',
            website: userData.website || '',
            taxId: userData.taxId || '',
            paymentInstructions: userData.paymentInstructions || '',
            logo: userData.logo || ''
          });
        } else {
          console.log('No user profile found, checking for onboarding data');
          // If no user profile exists, try to use onboarding data
          if (onboardingCompleted) {
            try {
              onboardingData = JSON.parse(localStorage.getItem(`onboarding_data_${user.uid}`));
              console.log('Using onboarding data:', onboardingData);
              setFormData({
                firstName: onboardingData?.firstName || '',
                lastName: onboardingData?.lastName || '',
                companyName: onboardingData?.companyName || '',
                email: user.email || '',
                // Other fields will be empty
                phone: '',
                address: '',
                city: '',
                state: '',
                zip: '',
                country: '',
                website: '',
                taxId: '',
                paymentInstructions: '',
                logo: ''
              });
            } catch (error) {
              console.error('Error parsing onboarding data:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setSaving(true);
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Create a storage reference
      const logoRef = ref(storage, `users/${user.uid}/logo`);
      // Upload the file to Firebase Storage (will overwrite if exists)
      await uploadBytes(logoRef, file);
      // Get the download URL
      const downloadURL = await getDownloadURL(logoRef);
      console.log('Logo download URL:', downloadURL);
      // Update form data with the URL
      setFormData({
        ...formData,
        logo: downloadURL
      });
      // Save the logo URL to Firestore immediately
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { logo: downloadURL }, { merge: true });
      showToast('success', 'Logo uploaded and saved successfully!');
    } catch (error) {
      console.error('Error uploading logo:', error);
      showToast('error', 'Failed to upload logo. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Ensure name field is set for consistency
      const dataToSave = {
        ...formData,
        name: `${formData.firstName} ${formData.lastName}`
      };

      console.log('Saving profile data to Firestore:', dataToSave);

      // Save to Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, dataToSave, { merge: true });
      
      showToast('success', 'Your profile has been updated successfully!');
    } catch (error) {
      console.error('Error saving user profile:', error);
      showToast('error', 'Unable to save profile changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-primary-700 mb-6">Business Profile</h1>
      
      <div className="mb-6 text-gray-600 text-sm bg-blue-50 p-4 rounded">
        <p>This information will appear on your invoices and emails to clients.</p>
      </div>

      {/* Debug info in dev mode - will help you troubleshoot */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-6 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
          <p className="font-bold">Debug info:</p>
          <pre>{JSON.stringify({firstName: formData.firstName, lastName: formData.lastName, companyName: formData.companyName, phone: formData.phone}, null, 2)}</pre>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="col-span-2">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Profile Information</h2>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          {/* Phone Number */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <div className="flex items-center bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-primary-500 transition-all">
              <PhoneInput
                international
                defaultCountry="US"
                value={formData.phone}
                onChange={value => setFormData({ ...formData, phone: value })}
                className="flex-1 border-none outline-none focus:ring-0"
                inputComponent="input"
              />
            </div>
          </div>

          {/* Business Information */}
          <div className="col-span-2 mt-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Business Information</h2>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID / Business Number</label>
            <input
              type="text"
              name="taxId"
              value={formData.taxId}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
            <div className="flex items-center space-x-4">
              {formData.logo && (
                <img 
                  src={formData.logo} 
                  alt="Company Logo" 
                  className="w-16 h-16 object-contain border rounded"
                />
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="block w-full text-sm text-gray-500 
                  file:mr-4 file:py-2 file:px-4 
                  file:rounded-md file:border-0 
                  file:text-sm file:font-semibold 
                  file:bg-primary-50 file:text-primary-700 
                  hover:file:bg-primary-100"
                  disabled={saving}
                />
                {saving && (
                  <div className="mt-2 text-sm text-primary-600 flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading logo...
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Upload your company logo (max 5MB). This will appear on your invoices and emails.
                </p>
              </div>
            </div>
          </div>
          
          {/* Address */}
          <div className="col-span-2 mt-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Address</h2>
          </div>
          
          <div className="col-span-2 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            {isLoaded ? (
              <Autocomplete
                onLoad={ac => (autocompleteRef.current = ac)}
                onPlaceChanged={onPlaceChanged}
              >
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                    {/* Location SVG icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c1.104 0 2-.896 2-2s-.896-2-2-2-2 .896-2 2 .896 2 2 2zm0 10c-4.418 0-8-3.582-8-8 0-4.418 3.582-8 8-8s8 3.582 8 8c0 4.418-3.582 8-8 8z" /></svg>
                  </span>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    placeholder="Enter your street address..."
                  />
                </div>
              </Autocomplete>
            ) : (
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                  {/* Location SVG icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c1.104 0 2-.896 2-2s-.896-2-2-2-2 .896-2 2 .896 2 2 2zm0 10c-4.418 0-8-3.582-8-8 0-4.418 3.582-8 8-8s8 3.582 8 8c0 4.418-3.582 8-8 8z" /></svg>
                </span>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  placeholder="Enter your street address..."
                />
              </div>
            )}
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">State / Province</label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP / Postal Code</label>
            <input
              type="text"
              name="zip"
              value={formData.zip}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input
              type="text"
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          {/* Payment Information */}
          <div className="col-span-2 mt-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Payment Information</h2>
          </div>
          
          <div className="col-span-2 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Instructions</label>
            <textarea
              name="paymentInstructions"
              value={formData.paymentInstructions}
              onChange={handleInputChange}
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Example: Please make payment to Account #12345678 at Bank XYZ, or via PayPal to example@email.com"
            ></textarea>
          </div>
        </div>
        
        <div className="col-span-2 mt-6 flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 flex items-center"
            disabled={saving}
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              'Save Profile'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default UserProfile; 