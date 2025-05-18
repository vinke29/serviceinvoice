import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

// Your web app's Firebase configuration
// Replace these placeholders with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCqPcb1pp9f70GaWvw1OysFExahu7iysbI",
  authDomain: "service-b4786.firebaseapp.com",
  projectId: "service-b4786",
  storageBucket: "service-b4786.firebasestorage.app",
  messagingSenderId: "917635766136",
  appId: "1:917635766136:web:fbbc96ae7314119b209a8d",
  measurementId: "G-DLTKNPQ5JW"
};

// IMPORTANT: You must replace the placeholder values above with your actual Firebase project credentials
// from the Firebase console at https://console.firebase.google.com/

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Firebase Functions with region
export const functions = getFunctions(app, 'us-central1');

// Enable Firebase Functions emulator in development
if (process.env.NODE_ENV === 'development') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

// Export httpsCallable for direct use in components
export { httpsCallable } from 'firebase/functions';

// Authentication functions
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing in: ", error);
    throw error;
  }
};

export const signUp = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing up: ", error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out: ", error);
    throw error;
  }
};

// Firestore functions
export const saveClient = async (userId, clientId, clientData) => {
  try {
    const clientRef = doc(db, 'users', userId, 'clients', clientId);
    await setDoc(clientRef, clientData);
    return true;
  } catch (error) {
    console.error("Error saving client: ", error);
    throw error;
  }
};

export const getClients = async (userId) => {
  try {
    const clientsRef = collection(db, 'users', userId, 'clients');
    const querySnapshot = await getDocs(clientsRef);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error getting clients: ", error);
    throw error;
  }
};

export const saveInvoice = async (userId, invoiceId, invoiceData) => {
  try {
    const invoiceRef = doc(db, 'users', userId, 'invoices', invoiceId);
    await setDoc(invoiceRef, invoiceData);
    return true;
  } catch (error) {
    console.error("Error saving invoice: ", error);
    throw error;
  }
};

export const getInvoices = async (userId) => {
  try {
    const invoicesRef = collection(db, 'users', userId, 'invoices');
    const querySnapshot = await getDocs(invoicesRef);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error getting invoices: ", error);
    throw error;
  }
};

export const saveAIConfig = async (userId, config) => {
  try {
    const configRef = doc(db, 'users', userId, 'config', 'ai');
    await setDoc(configRef, config);
    return true;
  } catch (error) {
    console.error("Error saving AI config: ", error);
    throw error;
  }
};

export const getAIConfig = async (userId) => {
  try {
    const configRef = doc(db, 'users', userId, 'config', 'ai');
    const docSnap = await getDoc(configRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error("Error getting AI config: ", error);
    throw error;
  }
};

// Mock Firestore functions for mood data
export const saveMoodEntry = async (userId, date, moodData) => {
  try {
    console.log(`Mock saving mood entry for user ${userId} on ${date}:`, moodData);
    // In a real app, this would save to Firestore
    return true;
  } catch (error) {
    console.error("Error saving mood entry: ", error);
    throw error;
  }
};

export const getMoodEntries = async (userId) => {
  try {
    console.log(`Mock getting mood entries for user ${userId}`);
    // Return some mock mood data for testing
    return {
      "2023-05-01": { level: 8, notes: "Had a great day!" },
      "2023-05-05": { level: 6, notes: "Pretty normal day" },
      "2023-05-10": { level: 3, notes: "Feeling down today" },
      "2023-05-15": { level: 9, notes: "Amazing day!" }
    };
  } catch (error) {
    console.error("Error getting mood entries: ", error);
    throw error;
  }
};

export const deleteMoodEntry = async (userId, date) => {
  try {
    console.log(`Mock deleting mood entry for user ${userId} on ${date}`);
    // In a real app, this would delete from Firestore
    return true;
  } catch (error) {
    console.error("Error deleting mood entry: ", error);
    throw error;
  }
}; 