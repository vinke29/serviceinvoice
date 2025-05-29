import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import Clients from './components/Clients'
import Invoices from './components/Invoices'
import AIAgent from './components/AIAgent'
import ReminderOpsDashboard from './components/ReminderOpsDashboard'
import UserProfile from './components/UserProfile'
import Login from './components/Login'
import OnboardingFlow from './components/OnboardingFlow'
import InvoiceGeneratedNotification from './components/InvoiceGeneratedNotification'
import StatusChangeModalDemo from './components/StatusChangeModalDemo'
import AuthTest from './components/AuthTest'
import { auth } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { invoiceGenerationService } from './services/invoiceGenerationService'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './App.css'
import { VERSION } from './version.js'
import { InvoicesProvider } from './components/InvoicesContext'
import LandingPage from './components/LandingPage'
import Navigation from './components/Navigation'

// Custom toast styles - will override default react-toastify styling
import './toast.css'

// PrivateRoute wrapper to protect routes that require authentication
function PrivateRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/signin" replace />;
  }
  
  return children;
}

// Wrapper for the AppContent to have access to navigate
function AppWithRouting() {
  const navigate = useNavigate();
  
  return <AppContent navigateTo={navigate} />;
}

function AppContent({ navigateTo }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Start the invoice generation service when the app loads
  useEffect(() => {
    // Start the invoice generation service
    invoiceGenerationService.start();
    
    // Stop the service when the component unmounts
    return () => {
      invoiceGenerationService.stop();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setAuthLoading(false)
      
      // Check if user is new or needs onboarding
      if (user) {
        const hasCompletedOnboarding = localStorage.getItem(`onboarding_completed_${user.uid}`)
        if (!hasCompletedOnboarding) {
          setShowOnboarding(true)
        }
      }
    })
    return () => unsubscribe()
  }, [])

  const handleOnboardingComplete = async (agentConfig) => {
    setShowOnboarding(false)
    if (user) {
      // Save that onboarding is completed
      localStorage.setItem(`onboarding_completed_${user.uid}`, 'true')
      
      // Save the AI agent configuration if provided
      if (agentConfig) {
        // Format the agent config to match the expected structure used by AIAgent component
        const formattedConfig = {
          initialReminderDays: agentConfig.reminderDaysBefore,
          followUpIntervalDays: agentConfig.followupInterval,
          maxFollowUps: agentConfig.maxFollowups,
          escalationThresholdDays: agentConfig.escalationDays,
          useEmail: true,
          useSMS: false,
          templates: {
            initial: "Dear {clientName}, this is a friendly reminder that your invoice #{invoiceNumber} for ${amount} is due on {dueDate}. Please ensure timely payment to avoid any late fees.",
            followUp: "Dear {clientName}, your invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. Please process the payment as soon as possible.",
            escalation: "Dear {clientName}, your invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. This is our final notice before we take further action. Please contact us immediately to resolve this matter."
          }
        };
        localStorage.setItem(`agent_config_${user.uid}`, JSON.stringify(formattedConfig));
      }
      
      // Navigate to dashboard after onboarding is complete
      navigateTo('/dashboard');
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-lg text-secondary-600">Loading...</div>
  }

  // If showing onboarding, render the onboarding flow
  if (showOnboarding && user) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }
  
  return (
    <InvoicesProvider>
      <div className="app-container min-h-screen bg-gray-50 overflow-x-hidden">
        <Routes>
          {/* Public routes - don't require authentication */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={
            user ? <Navigate to="/dashboard" replace /> : <Login onAuth={() => setUser(auth.currentUser)} />
          } />
          <Route path="/signup" element={
            user ? <Navigate to="/dashboard" replace /> : <Login signupMode={true} onAuth={() => setUser(auth.currentUser)} />
          } />
          
          {/* Protected routes - require authentication */}
          <Route path="/dashboard" element={
            <PrivateRoute user={user}>
              <>
                <Navigation user={user} />
                <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 overflow-y-auto">
                  <Dashboard />
                </main>
              </>
            </PrivateRoute>
          } />
          <Route path="/clients" element={
            <PrivateRoute user={user}>
              <>
                <Navigation user={user} />
                <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 overflow-y-auto">
                  <Clients />
                </main>
              </>
            </PrivateRoute>
          } />
          <Route path="/invoices" element={
            <PrivateRoute user={user}>
              <>
                <Navigation user={user} />
                <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 overflow-y-auto">
                  <Invoices />
                </main>
              </>
            </PrivateRoute>
          } />
          <Route path="/reminders" element={
            <PrivateRoute user={user}>
              <>
                <Navigation user={user} />
                <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 overflow-y-auto">
                  <ReminderOpsDashboard />
                </main>
              </>
            </PrivateRoute>
          } />
          <Route path="/ai-agent" element={
            <PrivateRoute user={user}>
              <>
                <Navigation user={user} />
                <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 overflow-y-auto">
                  <AIAgent />
                </main>
              </>
            </PrivateRoute>
          } />
          <Route path="/profile" element={
            <PrivateRoute user={user}>
              <>
                <Navigation user={user} />
                <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 overflow-y-auto">
                  <UserProfile key={user?.uid} />
                </main>
              </>
            </PrivateRoute>
          } />
          <Route path="/modal-demo" element={
            <PrivateRoute user={user}>
              <>
                <Navigation user={user} />
                <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 overflow-y-auto">
                  <StatusChangeModalDemo />
                </main>
              </>
            </PrivateRoute>
          } />
          <Route path="/auth-test" element={
            <PrivateRoute user={user}>
              <>
                <Navigation user={user} />
                <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 overflow-y-auto">
                  <AuthTest />
                </main>
              </>
            </PrivateRoute>
          } />
        </Routes>
        <InvoiceGeneratedNotification />
        <footer className="w-full text-center text-xs text-secondary-400 py-2 bg-transparent fixed bottom-0 left-0 z-40 pointer-events-none select-none">
          Version {VERSION}
        </footer>
      </div>
    </InvoicesProvider>
  );
}

// Main App component
function App() {
  return (
    <Router>
      <ToastContainer 
        position="top-center" 
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss={false}
        draggable={true}
        pauseOnHover
        theme="light"
        className="toast-container"
        icon={true}
      />
      <AppWithRouting />
    </Router>
  )
}

export default App
