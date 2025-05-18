import React, { useState, useEffect } from 'react';
import { auth, functions, httpsCallable } from '../firebase';

function AuthTest() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setToken(null); // Reset token when user changes
    });
    return () => unsubscribe();
  }, []);

  const getToken = async () => {
    try {
      setLoading(true);
      if (user) {
        const idToken = await user.getIdToken(true);
        setToken(idToken.substring(0, 20) + '...');
        setTestResult('Token successfully retrieved');
      } else {
        setTestResult('No user is logged in');
      }
    } catch (error) {
      setTestResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testFunction = async () => {
    try {
      setLoading(true);
      setTestResult('Testing function...');
      
      // Simple test function that doesn't need parameters
      const testFn = httpsCallable(functions, 'sendInvoiceReminder');
      const result = await testFn({
        // Use test parameters
        userId: user.uid,
        invoiceId: 'test-invoice-id',
        clientId: 'test-client-id'
      });
      
      setTestResult(`Function success: ${JSON.stringify(result.data)}`);
    } catch (error) {
      setTestResult(`Function error: ${error.code} - ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await auth.signOut();
      setTestResult('Successfully signed out');
    } catch (error) {
      setTestResult(`Error signing out: ${error.message}`);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow-md">
      <h2 className="text-xl font-bold mb-4">Firebase Authentication Test</h2>
      
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold">Current User:</h3>
        <p>{user ? `${user.email} (${user.uid})` : 'No user logged in'}</p>
      </div>
      
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold">Auth Token:</h3>
        <p className="break-all">{token || 'Not retrieved yet'}</p>
      </div>
      
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold">Test Result:</h3>
        <p className="break-all">{testResult || 'No tests run yet'}</p>
      </div>
      
      <div className="flex flex-col gap-2">
        <button 
          onClick={getToken} 
          disabled={!user || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Loading...' : 'Get Fresh Token'}
        </button>
        
        <button 
          onClick={testFunction} 
          disabled={!user || loading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          {loading ? 'Testing...' : 'Test Function Call'}
        </button>
        
        <button 
          onClick={signOut} 
          disabled={!user || loading}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default AuthTest; 