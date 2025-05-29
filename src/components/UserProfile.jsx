import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { showToast } from '../utils/toast.jsx';
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import { GoogleMap, useJsApiLoader, Autocomplete } from '@react-google-maps/api'

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

  const [autocomplete, setAutocomplete] = useState(null);

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
          setAddressFields({
            street: userData.street || userData.address || '',
            city: userData.city || '',
            state: userData.state || '',
            postalCode: userData.zip || userData.postalCode || '',
            country: userData.country || ''
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
        ...addressFields,
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

  async function refreshToken() {
    try {
      const user = auth.currentUser;
      if (user) {
        await user.getIdToken(true); // Force refresh the token
        console.log("Authentication token refreshed successfully");
        // Show success message
        alert("Authentication token refreshed successfully");
      } else {
        console.error("No user is currently signed in");
        alert("Please sign in to refresh your token");
      }
    } catch (error) {
      console.error("Error refreshing token:", error);
      alert("Failed to refresh token: " + error.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-transparent min-h-[calc(100vh-80px)] flex justify-center items-start py-8">
      <div className="w-full max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-primary-700 mb-4 sm:mb-6 text-left">Business Profile</h1>
        <div className="mb-6 text-gray-600 text-sm bg-blue-50 p-3 sm:p-4 rounded text-left">
          <p>This information will appear on your invoices and emails to clients.</p>
        </div>
        <div className="md:grid md:grid-cols-3 md:gap-8">
          {/* Left: Logo and summary, sticky on desktop */}
          <div className="flex flex-col items-center md:items-start md:justify-start mb-8 md:mb-0 md:col-span-1 md:sticky md:top-28">
            <div className="relative mb-2">
              {formData.logo ? (
                <img
                  src={formData.logo}
                  alt="Company Logo"
                  className="w-28 h-28 object-contain border rounded-full shadow-sm bg-white"
                />
              ) : (
                <div className="w-28 h-28 flex items-center justify-center rounded-full border bg-gray-100 text-gray-400 text-4xl font-bold">
                  {formData.companyName ? formData.companyName[0] : '?'}
                </div>
              )}
              <label className="absolute bottom-0 right-0 bg-primary-600 text-white rounded-full p-1 cursor-pointer shadow-md hover:bg-primary-700 transition" title="Change logo">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  disabled={saving}
                />
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6-6M7 17h8a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </label>
            </div>
            {saving && (
              <div className="mt-2 text-sm text-primary-600 flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading logo...
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500 text-center md:text-left mb-4">Upload your company logo (max 5MB). This will appear on your invoices and emails.</p>
            <div className="hidden md:block w-full">
              <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                <div className="font-semibold text-primary-700 text-lg mb-1">{formData.companyName || 'Company Name'}</div>
                <div className="text-sm text-gray-700 mb-1 break-all">{formData.email}</div>
                {formData.website && <div className="text-sm text-blue-600 mb-1 break-all"><a href={formData.website} target="_blank" rel="noopener noreferrer">{formData.website}</a></div>}
                {formData.phone && <div className="text-sm text-gray-700">{formData.phone}</div>}
              </div>
            </div>
          </div>
          {/* Right: Form fields, two-column grid on desktop */}
          <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8 md:col-span-2">
            {/* Profile Information */}
            <div className="bg-white rounded-lg p-6 border border-gray-100 shadow-sm mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Profile Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Phone</label>
                  <PhoneInput country={'us'} value={formData.phone} onChange={phone => setFormData({ ...formData, phone })} inputClass="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" containerClass="w-full" />
                </div>
              </div>
            </div>
            {/* Business Information */}
            <div className="bg-white rounded-lg p-6 border border-gray-100 shadow-sm mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Business Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID / Business Number</label>
                  <input type="text" name="taxId" value={formData.taxId} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input type="url" name="website" value={formData.website} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
            </div>
            {/* Address */}
            <div className="bg-white rounded-lg p-6 border border-gray-100 shadow-sm mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Address</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Street</label>
                  {isLoaded ? (
                    <Autocomplete onLoad={ac => setAutocomplete(ac)} onPlaceChanged={() => {
                      if (!autocomplete) return;
                      const place = autocomplete.getPlace();
                      const components = place && place.address_components ? place.address_components : [];
                      if (!components.length) {
                        alert('Could not extract address components from the selected place. Please try again or enter manually.');
                        return;
                      }
                      const getComponent = (type) => {
                        const comp = components.find(c => c.types.includes(type));
                        return comp ? comp.long_name : '';
                      };
                      const street = [getComponent('street_number'), getComponent('route')].filter(Boolean).join(' ').trim();
                      const city = getComponent('locality') || getComponent('sublocality') || '';
                      const state = getComponent('administrative_area_level_1');
                      const postalCode = getComponent('postal_code');
                      const country = getComponent('country');
                      setAddressFields({
                        street,
                        city,
                        state,
                        postalCode,
                        country
                      });
                      setFormData(f => ({
                        ...f,
                        zip: postalCode,
                        city,
                        state,
                        country
                      }));
                    }}>
                      <input type="text" name="street" value={addressFields.street} onChange={e => setAddressFields({ ...addressFields, street: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </Autocomplete>
                  ) : (
                    <input type="text" name="street" value={addressFields.street} onChange={e => setAddressFields({ ...addressFields, street: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">City</label>
                  <input type="text" name="city" value={addressFields.city} onChange={e => setAddressFields({ ...addressFields, city: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">State</label>
                  <input type="text" name="state" value={addressFields.state} onChange={e => setAddressFields({ ...addressFields, state: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Postal Code</label>
                  <input type="text" name="postalCode" value={addressFields.postalCode} onChange={e => setAddressFields({ ...addressFields, postalCode: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Country</label>
                  <input type="text" name="country" value={addressFields.country} onChange={e => setAddressFields({ ...addressFields, country: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
            </div>
            {/* Payment Instructions */}
            <div className="bg-white rounded-lg p-6 border border-gray-100 shadow-sm mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Payment Instructions</h2>
              <textarea name="paymentInstructions" value={formData.paymentInstructions} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[80px]" placeholder="e.g. Bank details, payment terms, etc." />
            </div>
            {/* Save Button */}
            <div>
              <button type="submit" disabled={saving} className="w-full py-3 rounded-lg bg-primary-600 text-white font-semibold text-lg shadow hover:bg-primary-700 transition disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default UserProfile; 