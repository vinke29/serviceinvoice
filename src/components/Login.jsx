import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import illustrationUrl from '../assets/images/login/login.png';

export default function Login({ onAuth, signupMode = false }) {
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(signupMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [animation, setAnimation] = useState('');

  useEffect(() => {
    // Add entrance animation
    setAnimation('animate-fade-in');
    
    // Clean up animation class on unmount
    return () => setAnimation('');
  }, []);

  // Trigger animation on mode switch
  useEffect(() => {
    setAnimation('');
    const timer = setTimeout(() => setAnimation('animate-fade-in'), 50);
    return () => clearTimeout(timer);
  }, [isSignup]);

  // Update isSignup if prop changes
  useEffect(() => {
    setIsSignup(signupMode);
  }, [signupMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onAuth && onAuth();
      
      // Navigate to dashboard after successful authentication
      navigate('/dashboard');
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-blue-200 to-blue-300">
      <div className="w-full max-w-5xl flex flex-col lg:flex-row items-end justify-between mx-auto px-4 lg:px-8 py-8">
        {/* Left side - Content and illustration */}
        <div className="flex-1 max-w-xl flex flex-col justify-center px-0 lg:px-8 self-end">
          {/* Logo */}
          <div className="mb-10">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-bold">B</span>
              </div>
              <span className="ml-3 text-3xl font-bold text-blue-900">Billie</span>
            </div>
          </div>
          {/* Main content */}
          <div className={`w-full ${animation}`}> 
            <h1 className="text-5xl font-extrabold text-blue-900 mb-4 leading-tight">
              Billie helps you<br />get paid. Faster.
            </h1>
            <p className="text-xl text-blue-800 mb-8 font-medium">
              Your AI-powered assistant for invoices, reminders, and payment tracking.
            </p>
            {/* Illustration and caption */}
            <div className="flex flex-col items-center bg-white/60 rounded-2xl p-5 shadow-md mb-6">
              <img 
                src={illustrationUrl} 
                alt="Invoice assistant illustration" 
                className="w-full max-w-sm h-auto object-contain mb-2" 
              />
              <p className="text-sm text-blue-900 font-medium text-center">
                Meet Billie, your smart invoice assistant
              </p>
            </div>
          </div>
        </div>
        {/* Right side - Form */}
        <div className="w-full max-w-md lg:w-[400px] bg-white rounded-2xl flex flex-col items-center justify-center shadow-2xl px-8 py-12 min-h-[540px]">
          <div className={`w-full max-w-md transition-all duration-500 ${animation}`}> 
            <div className="mb-8">
              <h2 className="text-3xl font-extrabold text-blue-900 mb-2">
                {isSignup ? 'Create Your Account' : 'Welcome Back'}
              </h2>
              <p className="text-base text-gray-600 mb-6">
                {isSignup 
                  ? "Get started with a free account today"
                  : "Sign in to access your invoicing dashboard"}
              </p>
              {error && (
                <div className="mb-6 px-4 py-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded animate-shake">
                  <p className="font-medium">Error</p>
                  <p>{error}</p>
                </div>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-blue-50 text-blue-900"
                  placeholder="name@company.com"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-blue-50 text-blue-900"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-lg bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-lg shadow-blue-100 transition-all duration-200"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isSignup ? 'Creating Account...' : 'Signing In...'}
                  </span>
                ) : (
                  <span>{isSignup ? 'Get Paid Faster' : 'Sign In'}</span>
                )}
              </button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {isSignup ? 'Already have an account?' : "Don't have an account yet?"}{' '}
                <button
                  className="text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200"
                  onClick={() => setIsSignup(!isSignup)}
                  disabled={loading}
                >
                  {isSignup ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </div>
          </div>
          {/* Free forever message below the form */}
          {isSignup && (
            <div className="mt-8 pb-10 text-center text-sm text-gray-500">
              Free forever for up to 3 clients
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 