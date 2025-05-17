import { createContext, useContext, useState, useEffect } from 'react';
import { auth, signInWithGoogle, logOut, getMoodEntries } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moodData, setMoodData] = useState({});

  useEffect(() => {
    // Instead of using onAuthStateChanged for the mock implementation,
    // we'll just initialize with no user and set loading to false
    setLoading(false);

    // This would normally subscribe to auth state changes
    return () => {};
  }, []);

  const login = async () => {
    try {
      const user = await signInWithGoogle();
      setCurrentUser(user);
      
      // Load mock mood data
      const userMoodData = await getMoodEntries(user.uid);
      setMoodData(userMoodData);
      
      return user;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await logOut();
      setCurrentUser(null);
      setMoodData({});
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  const value = {
    currentUser,
    login,
    logout,
    loading,
    moodData,
    setMoodData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 