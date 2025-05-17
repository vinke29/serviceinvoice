import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import Clients from './components/Clients'
import Invoices from './components/Invoices'
import AIAgent from './components/AIAgent'
import ReminderOpsDashboard from './components/ReminderOpsDashboard'
import UserProfile from './components/UserProfile'
import Login from './components/Login'
import OnboardingFlow from './components/OnboardingFlow'
import InvoiceGeneratedNotification from './components/InvoiceGeneratedNotification'
import { auth } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { invoiceGenerationService } from './services/invoiceGenerationService'
import './App.css'

// Navigation component with active link highlighting
function Navigation({ user }) {
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);
  
  const isActive = (path) => {
    return location.pathname === path;
  };
  
  const toggleNav = () => {
    setIsNavOpen(!isNavOpen);
  };

  return (
    <nav className="bg-white fixed w-full top-0 z-[50]">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex justify-between h-16 items-center">
          <div className="flex flex-1">
            <div className="flex-shrink-0 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary-600 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
                <circle cx="9" cy="13" r="1.5" />
                <circle cx="15" cy="13" r="1.5" />
              </svg>
              <span className="font-bold text-xl text-primary-700">Billie</span>
            </div>
            {/* Desktop Navigation */}
            <div className="hidden md:ml-4 md:flex md:space-x-4">
              <Link 
                to="/" 
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive('/') 
                  ? 'text-primary-700 border-primary-600' 
                  : 'text-secondary-700 hover:text-primary-700 border-transparent hover:border-primary-600'}`}
              >
                Dashboard
              </Link>
              <Link 
                to="/clients" 
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive('/clients') 
                  ? 'text-primary-700 border-primary-600' 
                  : 'text-secondary-700 hover:text-primary-700 border-transparent hover:border-primary-600'}`}
              >
                Clients
              </Link>
              <Link 
                to="/invoices" 
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive('/invoices') 
                  ? 'text-primary-700 border-primary-600' 
                  : 'text-secondary-700 hover:text-primary-700 border-transparent hover:border-primary-600'}`}
              >
                Invoices
              </Link>
              <Link 
                to="/reminders" 
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive('/reminders') 
                  ? 'text-primary-700 border-primary-600' 
                  : 'text-secondary-700 hover:text-primary-700 border-transparent hover:border-primary-600'}`}
              >
                Reminders
              </Link>
              <Link 
                to="/ai-agent" 
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive('/ai-agent') 
                  ? 'text-primary-700 border-primary-600' 
                  : 'text-secondary-700 hover:text-primary-700 border-transparent hover:border-primary-600'}`}
              >
                AI Agent
              </Link>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2 rounded-md text-secondary-700 hover:text-primary-700 hover:bg-primary-50 focus:outline-none" 
              onClick={toggleNav}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <Link
              to="/profile"
              className="px-2 py-1.5 rounded bg-white text-secondary-700 hover:text-primary-600 border border-secondary-200 hover:border-primary-300 text-xs font-medium flex items-center transition-all duration-200 shadow-sm whitespace-nowrap mr-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Profile
            </Link>
            
            <button
              onClick={() => signOut(auth)}
              className="px-2 py-1.5 rounded bg-white text-secondary-700 hover:text-primary-600 border border-secondary-200 hover:border-primary-300 text-xs font-medium flex items-center transition-all duration-200 shadow-sm whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Log Out
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Navigation Drawer */}
      {isNavOpen && (
        <div className="md:hidden">
          <div className="pt-2 pb-3 space-y-1 bg-white shadow-lg border-t border-secondary-100">
            <Link 
              to="/" 
              className={`block px-4 py-2 text-base font-medium ${isActive('/') 
                ? 'text-primary-700 bg-primary-50' 
                : 'text-secondary-700 hover:text-primary-700 hover:bg-primary-50'}`}
              onClick={() => setIsNavOpen(false)}
            >
              Dashboard
            </Link>
            <Link 
              to="/clients" 
              className={`block px-4 py-2 text-base font-medium ${isActive('/clients') 
                ? 'text-primary-700 bg-primary-50' 
                : 'text-secondary-700 hover:text-primary-700 hover:bg-primary-50'}`}
              onClick={() => setIsNavOpen(false)}
            >
              Clients
            </Link>
            <Link 
              to="/invoices" 
              className={`block px-4 py-2 text-base font-medium ${isActive('/invoices') 
                ? 'text-primary-700 bg-primary-50' 
                : 'text-secondary-700 hover:text-primary-700 hover:bg-primary-50'}`}
              onClick={() => setIsNavOpen(false)}
            >
              Invoices
            </Link>
            <Link 
              to="/reminders" 
              className={`block px-4 py-2 text-base font-medium ${isActive('/reminders') 
                ? 'text-primary-700 bg-primary-50' 
                : 'text-secondary-700 hover:text-primary-700 hover:bg-primary-50'}`}
              onClick={() => setIsNavOpen(false)}
            >
              Reminders
            </Link>
            <Link 
              to="/ai-agent" 
              className={`block px-4 py-2 text-base font-medium ${isActive('/ai-agent') 
                ? 'text-primary-700 bg-primary-50' 
                : 'text-secondary-700 hover:text-primary-700 hover:bg-primary-50'}`}
              onClick={() => setIsNavOpen(false)}
            >
              AI Agent
            </Link>
            <Link 
              to="/profile" 
              className={`block px-4 py-2 text-base font-medium ${isActive('/profile') 
                ? 'text-primary-700 bg-primary-50' 
                : 'text-secondary-700 hover:text-primary-700 hover:bg-primary-50'}`}
              onClick={() => setIsNavOpen(false)}
            >
              Profile
            </Link>
            <div className="px-4 py-2 border-t border-secondary-100 sm:hidden">
              <span className="block text-xs text-secondary-600 mb-2">{user.email}</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function App() {
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
      
      // For testing purposes - can be removed in production
      // To reset onboarding for testing:
      // localStorage.removeItem(`onboarding_completed_${user.uid}`)
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-lg text-secondary-600">Loading...</div>
  }

  if (!user) {
    return <Login onAuth={() => setUser(auth.currentUser)} />
  }

  return (
    <Router>
      {showOnboarding ? (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      ) : (
        <div className="app-container min-h-screen bg-secondary-50 overflow-x-hidden">
          <Navigation user={user} />
          <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/reminders" element={<ReminderOpsDashboard />} />
              <Route path="/ai-agent" element={<AIAgent />} />
              <Route path="/profile" element={<UserProfile key={user.uid} />} />
            </Routes>
          </main>
          <InvoiceGeneratedNotification />
        </div>
      )}
    </Router>
  )
}

export default App
