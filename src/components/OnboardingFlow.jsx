import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import OnboardingIllustrations from './OnboardingIllustrations'
import OnboardingClientForm from './OnboardingClientForm'
import { addClient, setAgentConfig, addInvoice, updateClient } from '../firebaseData'
import { format } from 'date-fns'
import {
  WelcomeIllustration,
  AIAgentIllustration,
  ClientsIllustration,
  GetPaidIllustration,
  Billie
} from './OnboardingIllustrations'
import PersonWave from '../assets/person-wave.png'
import { invoiceGenerationService } from '../services/invoiceGenerationService'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

// Simplified steps focused on key workflows
const steps = [
  {
    id: 'welcome',
    title: 'Welcome to Billie',
    description: 'Your invoice automation assistant.',
    illustration: 'welcome',
    showStepCounter: true,
    isWelcome: true,
  },
  {
    id: 'first-name',
    title: 'Tell us more about you',
    description: '',
    illustration: 'wave',
    showStepCounter: true,
    inputFields: [
      { name: 'firstName', label: 'First Name', placeholder: 'Enter your first name' },
      { name: 'lastName', label: 'Last Name', placeholder: 'Enter your last name' },
      { name: 'phone', label: 'Phone Number', placeholder: 'Enter your phone number' },
      { name: 'companyName', label: 'Company Name', placeholder: 'Enter your company name' },
    ],
  },
  {
    id: 'first-client',
    title: 'Add Your First Client',
    description: 'Let\'s create your first client to get started with invoicing.',
    illustration: 'first-client',
    showClientForm: true,
    showStepCounter: true,
  },
];

function OnboardingFlow({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [currentSubstep, setCurrentSubstep] = useState(0)
  const [userName, setUserName] = useState('')
  const [clientAdded, setClientAdded] = useState(false)
  const [addedClient, setAddedClient] = useState(null)
  const [customValueMode, setCustomValueMode] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [customValueActive, setCustomValueActive] = useState({})
  const [agentConfig, setAgentConfig] = useState({
    netDays: 14,
    reminderDaysBefore: 3,
    followupInterval: 3,
    maxFollowups: 3,
    escalationDays: 14
  })
  const [userInfo, setUserInfo] = useState({ firstName: '', lastName: '', phone: '', companyName: '' });
  const [clientFormData, setClientFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    customerSince: new Date().toISOString().slice(0, 10),
    status: 'Active'
  });
  const navigate = useNavigate()
  
  useEffect(() => {
    // Get user's name from email or authentication
    const user = auth.currentUser
    if (user) {
      const name = user.displayName || user.email.split('@')[0]
      // Capitalize first letter
      setUserName(name.charAt(0).toUpperCase() + name.slice(1))
    }
  }, [])

  // Apply logic constraints on values
  useEffect(() => {
    let updatedConfig = {...agentConfig};
    const changed = {};
    
    // Ensure reminderDaysBefore is less than netDays
    if (updatedConfig.reminderDaysBefore >= updatedConfig.netDays) {
      updatedConfig.reminderDaysBefore = Math.max(1, updatedConfig.netDays - 1);
      changed.reminderDaysBefore = true;
    }
    
    // Ensure escalationDays is greater than the total follow-up period
    const totalFollowupDays = updatedConfig.followupInterval * updatedConfig.maxFollowups;
    if (updatedConfig.escalationDays <= totalFollowupDays) {
      updatedConfig.escalationDays = totalFollowupDays + 1;
      changed.escalationDays = true;
    }
    
    // Only update if changes were made to avoid an infinite loop
    if (Object.keys(changed).length > 0) {
      setAgentConfig(updatedConfig);
    }
  }, [agentConfig.netDays, agentConfig.reminderDaysBefore, 
      agentConfig.followupInterval, agentConfig.maxFollowups, 
      agentConfig.escalationDays]);

  // Add a handler for going back
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setCurrentSubstep(0);
      setCustomValueMode(false);
    }
  };

  // Update handleNext to work for user info steps
  const handleNext = () => {
    const step = steps[currentStep];
    if (step.inputFields) {
      // Require all fields to be filled
      for (const field of step.inputFields) {
        if (!userInfo[field.name]) return;
      }
      
      // If we're on the user info step, save the data to Firestore
      if (step.id === 'first-name') {
        const saveUserInfo = async () => {
          try {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            
            // Save user info to Firestore
            const userDocRef = doc(db, 'users', uid);
            await setDoc(userDocRef, {
              firstName: userInfo.firstName,
              lastName: userInfo.lastName,
              phone: userInfo.phone,
              companyName: userInfo.companyName, // Use companyName consistently
              name: `${userInfo.firstName} ${userInfo.lastName}`, // Add full name field
              email: auth.currentUser.email // Make sure email is set
            }, { merge: true });
            
            console.log('Successfully saved user info to Firestore:', userInfo);
          } catch (error) {
            console.error('Error saving user info to Firestore:', error);
          }
        };
        
        saveUserInfo();
      }
    }
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    // Save agent config to Firebase before completing
    saveAgentConfigToFirebase();
    // Also save user info to Firestore again as a safety measure
    saveUserInfoToFirestore();
    onComplete(agentConfig)
  }

  const handleAction = (path) => {
    // Save agent config to Firebase before completing
    saveAgentConfigToFirebase();
    // Also save user info to Firestore again as a safety measure
    saveUserInfoToFirestore();
    onComplete(agentConfig)
    navigate(path)
  }

  const saveAgentConfigToFirebase = async () => {
    try {
      const uid = auth.currentUser?.uid
      if (!uid) return;
      
      console.log("OnboardingFlow: Saving agent config to Firebase with netDays =", agentConfig.netDays);
      
      // Make a deep copy of the config to avoid any potential reference issues
      const configCopy = JSON.parse(JSON.stringify(agentConfig));
      
      // Ensure all numeric values are integers
      const netDays = parseInt(configCopy.netDays, 10);
      const reminderDaysBefore = parseInt(configCopy.reminderDaysBefore, 10);
      const followupInterval = parseInt(configCopy.followupInterval, 10);
      const maxFollowups = parseInt(configCopy.maxFollowups, 10);
      const escalationDays = parseInt(configCopy.escalationDays, 10);
      
      // Format the config to match what the AIAgent component expects
      const formattedConfig = {
        initialReminderDays: reminderDaysBefore,
        followUpIntervalDays: followupInterval,
        maxFollowUps: maxFollowups,
        escalationThresholdDays: escalationDays,
        netDays: netDays, // Explicitly set netDays
        useEmail: true,
        useSMS: false,
        templates: {
          initial: "Dear {clientName}, this is a friendly reminder that your invoice #{invoiceNumber} for ${amount} is due on {dueDate}. Please ensure timely payment to avoid any late fees.",
          followUp: "Dear {clientName}, your invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. Please process the payment as soon as possible.",
          escalation: "Dear {clientName}, your invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. This is our final notice before we take further action. Please contact us immediately to resolve this matter."
        }
      };
      
      console.log("OnboardingFlow: Formatted config for Firebase with netDays =", formattedConfig.netDays);
      
      // Also include the component-style field names for consistency in the UI
      const completeConfig = {
        ...formattedConfig,
        reminderDaysBefore: reminderDaysBefore,
        followupInterval: followupInterval,
        maxFollowups: maxFollowups,
        escalationDays: escalationDays,
        reminderEnabled: true
      };
      
      console.log("OnboardingFlow: Complete config for localStorage with netDays =", completeConfig.netDays);
      
      // First save to Firebase to make sure it persists
      try {
        await setAgentConfig(uid, formattedConfig);
        console.log("OnboardingFlow: Successfully saved agent config to Firebase");
        
        // Then save to local storage as a backup (AIAgent will use this if available)
        localStorage.setItem(`agent_config_${uid}`, JSON.stringify(completeConfig));
        console.log("OnboardingFlow: Successfully saved agent config to localStorage");
      } catch (error) {
        console.error("Error saving agent config to Firebase:", error);
        // Save to localStorage even if Firebase fails, as a fallback
        localStorage.setItem(`agent_config_${uid}`, JSON.stringify(completeConfig));
        console.log("OnboardingFlow: Saved to localStorage as fallback after Firebase error");
      }
    } catch (error) {
      console.error("Error in saveAgentConfigToFirebase:", error);
    }
  };

  // Helper function to save user info
  const saveUserInfoToFirestore = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid || !userInfo.firstName) return;
      
      // Save user info to Firestore
      const userDocRef = doc(db, 'users', uid);
      await setDoc(userDocRef, {
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        phone: userInfo.phone,
        companyName: userInfo.companyName, // Use companyName consistently
        name: `${userInfo.firstName} ${userInfo.lastName}`, // Add full name field
        email: auth.currentUser.email // Make sure email is set
      }, { merge: true });
      
      console.log('Final save of user info to Firestore successful:', userInfo);
    } catch (error) {
      console.error('Error in final save of user info to Firestore:', error);
    }
  };

  const handleOptionSelect = (field, value) => {
    setAgentConfig({
      ...agentConfig,
      [field]: value
    });
    // If a standard option is selected, turn off custom mode for this field
    if (customValueActive[field]) {
      setCustomValueActive(prev => ({...prev, [field]: false}));
    }
  }

  const handleCustomValueInput = (field) => {
    setCustomValueMode(true);
    setCustomValue(agentConfig[field].toString());
  }

  const handleCustomValueChange = (e) => {
    setCustomValue(e.target.value);
  }

  const handleCustomValueSubmit = (field) => {
    const numValue = parseInt(customValue, 10);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 90) {
      setAgentConfig({
        ...agentConfig,
        [field]: numValue
      });
      setCustomValueMode(false);
      setCustomValueActive(prev => ({...prev, [field]: true}));
    }
  }

  const handleClientSubmit = async (clientData) => {
    try {
      const uid = auth.currentUser?.uid
      if (!uid) throw new Error("User not authenticated")
      
      // Use clientData directly without adding billing info
      const clientToAdd = { ...clientData }
      
      // No billing/invoice calculation needed here
      
      const client = await addClient(uid, clientToAdd)
      setClientAdded(true)
      setAddedClient(client)
      
      // Skip invoice generation code since we're not setting up billing during onboarding
      
      if (currentStep === steps.length - 1) {
        onComplete();
      } else {
        setCurrentStep(currentStep + 1);
      }
    } catch (error) {
      console.error("Error adding client:", error)
      // You could add error handling here
    }
  }

  const handleSkipClient = () => {
    if (currentStep === steps.length - 1) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  }

  const step = steps[currentStep]
  if (!step) return null;
  const substep = step.showSubsteps ? step.substeps[currentSubstep] : null

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      return format(new Date(dateString), 'MMMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  }

  // Get constraints messages
  const getConstraintMessage = (field) => {
    if (field === 'reminderDaysBefore' && agentConfig.reminderDaysBefore >= agentConfig.netDays) {
      return `Reminder days must be less than the payment terms (${agentConfig.netDays} days)`;
    }
    if (field === 'escalationDays') {
      const totalFollowupDays = agentConfig.followupInterval * agentConfig.maxFollowups;
      if (agentConfig.escalationDays <= totalFollowupDays) {
        return `Final notice must be after all follow-ups (>${totalFollowupDays} days)`;
      }
    }
    return null;
  }

  // Function to display the current value (including custom values)
  const getCurrentValueDisplay = (field) => {
    if (!customValueActive[field]) return null;
    return agentConfig[field];
  }

  // Step counter logic
  const totalSteps = steps.length;
  const stepNumber = currentStep + 1;

  return (
    <div className="relative min-h-screen w-full">
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-blue-100 via-blue-200 to-blue-500 w-full h-full" />
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center mt-8 mb-12 p-8 rounded-2xl shadow-xl bg-white/70">
        {/* Step Counter */}
        {step.showStepCounter && (
          <div className="mb-6 text-blue-700 font-semibold text-lg w-full text-left">
            Step {stepNumber} of {totalSteps}
          </div>
        )}
        {/* Welcome screen redesign: horizontal flex */}
        {step.isWelcome ? (
          <div className="w-full flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="flex-shrink-0 flex items-center justify-center w-full md:w-1/2">
              <div className="rounded-full bg-blue-200 flex items-center justify-center" style={{ width: 220, height: 220 }}>
                <img src={PersonWave} alt="Person waving" style={{ width: 180, height: 180, borderRadius: '50%', objectFit: 'cover', background: 'white' }} />
              </div>
            </div>
            <div className="w-full md:w-1/2 flex flex-col items-start justify-center text-left">
              <h1 className="text-4xl font-extrabold text-blue-900 mb-4">Welcome to Billie</h1>
              <p className="text-xl text-blue-800 mb-4 font-medium">Your invoice automation assistant.</p>
              <p className="text-lg text-blue-900 mb-8">Just a few quick questions and we'll have Billie up and running for you.</p>
              <button onClick={handleNext} className="px-8 py-3 rounded-lg bg-blue-700 text-white text-lg font-bold shadow-lg hover:bg-blue-800 transition">Next</button>
            </div>
          </div>
        ) : step.inputFields ? (
          <div className="w-full max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">{step.title}</h2>
            <form onSubmit={e => { e.preventDefault(); handleNext(); }}>
              {step.inputFields.map(field => (
                <div key={field.name} className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                  <input
                    type="text"
                    value={userInfo[field.name]}
                    onChange={e => setUserInfo(prev => ({ ...prev, [field.name]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-blue-50 text-blue-900"
                  />
                </div>
              ))}
              <div className="flex flex-row gap-3 justify-between mt-6 w-full">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-4 py-2 rounded-lg bg-gray-200 text-blue-900 font-bold hover:bg-gray-300 transition flex items-center"
                  >
                    <span className="mr-1">←</span> Back
                  </button>
                )}
                <div className="flex gap-3 w-full justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-700 text-white rounded-lg font-bold shadow-lg hover:bg-blue-800 transition"
                    disabled={step.inputFields.some(field => !userInfo[field.name])}
                  >
                    Next
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : step.showClientForm ? (
          <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center">
            <div className="w-full bg-white rounded-2xl shadow-xl pt-12 pb-8 px-8">
              <h2 className="text-2xl font-bold text-blue-900 mb-4">{step.title}</h2>
              <OnboardingClientForm 
                onSubmit={handleClientSubmit} 
                onCancel={handleSkipClient}
                renderActions={({ onSubmit, onCancel }) => (
                  <div className="flex flex-row gap-3 justify-between mt-6 w-full">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="px-4 py-2 rounded-lg bg-gray-200 text-blue-900 font-bold hover:bg-gray-300 transition flex items-center"
                    >
                      <span className="mr-1">←</span> Back
                    </button>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-secondary-700 hover:text-secondary-900 font-medium"
                      >
                        Skip for now
                      </button>
                      <button
                        type="submit"
                        onClick={onSubmit}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200"
                      >
                        Add Client
                      </button>
                    </div>
                  </div>
                )}
                formData={clientFormData}
                setFormData={setClientFormData}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="mt-3 text-secondary-600">{step.description}</p>
            
            {step.id === 'get-paid' && addedClient && (
              <div className="mt-4 bg-primary-50 p-4 rounded-lg">
                <p className="text-secondary-800">
                  <span className="font-semibold">{addedClient.name}</span> has been added as your client. 
                </p>
                <p className="text-secondary-600 mt-2 text-sm">
                  You can add more clients and manage your invoices from the dashboard.
                </p>
              </div>
            )}
            
            <div className="mt-8 flex justify-end">
              {step.action ? (
                <button
                  onClick={() => handleAction(step.action.path)}
                  className="px-6 py-3 rounded-lg bg-primary-600 text-white hover:bg-primary-700 font-medium"
                >
                  {step.action.label}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-6 py-3 rounded-lg bg-primary-600 text-white hover:bg-primary-700 font-medium"
                >
                  {step.actionLabel || "Next"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default OnboardingFlow 