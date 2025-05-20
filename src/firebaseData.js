import { db } from './firebase';
import { doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';

// Helper function to add timeout to Firestore queries
const withTimeout = (promise, timeout = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
    )
  ]);
};

// AGENT CONFIG
export async function getAgentConfig(uid) {
  try {
    // Validate input
    if (!uid) {
      console.error('Firebase: Missing user ID for getAgentConfig');
      return null;
    }
    
    console.log('Firebase: Fetching agent config for user:', uid);
    const ref = doc(db, 'users', uid, 'agentConfig', 'main');
    const snap = await withTimeout(getDoc(ref));
    const data = snap.exists() ? snap.data() : null;
    console.log('Firebase: Retrieved agent config data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching agent config:', error);
    // Return empty config instead of failing
    return null;
  }
}

export async function setAgentConfig(uid, config) {
  try {
    console.log('Firebase: Setting agent config for user:', uid, 'with config:', config);
    const ref = doc(db, 'users', uid, 'agentConfig', 'main');
    await withTimeout(setDoc(ref, config));
    console.log('Firebase: Successfully saved agent config');
    return true;
  } catch (error) {
    console.error('Error setting agent config:', error);
    throw error;
  }
}

// CLIENTS
export async function getClients(uid) {
  try {
    console.log('Fetching clients for user:', uid);
    const ref = collection(db, 'users', uid, 'clients');
    const snap = await withTimeout(getDocs(ref));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching clients:', error);
    // Return empty array instead of failing
    return [];
  }
}

export async function addClient(uid, client) {
  try {
    const ref = collection(db, 'users', uid, 'clients');
    const clientWithNormalizedStatus = { ...client, status: client.status ? client.status.toLowerCase() : 'active' };
    const docRef = await withTimeout(addDoc(ref, clientWithNormalizedStatus));
    return { id: docRef.id, ...clientWithNormalizedStatus };
  } catch (error) {
    console.error('Error adding client:', error);
    throw error;
  }
}

export async function updateClient(uid, client) {
  try {
    const ref = doc(db, 'users', uid, 'clients', client.id);
    const clientWithNormalizedStatus = { ...client, status: client.status ? client.status.toLowerCase() : 'active' };
    await withTimeout(updateDoc(ref, clientWithNormalizedStatus));
    return true;
  } catch (error) {
    console.error('Error updating client:', error);
    throw error;
  }
}

export async function deleteClient(uid, clientId) {
  try {
    const ref = doc(db, 'users', uid, 'clients', clientId);
    await withTimeout(deleteDoc(ref));
    return true;
  } catch (error) {
    console.error('Error deleting client:', error);
    throw error;
  }
}

// Get clients with next invoice date matching today's date
export async function getClientsWithInvoicesToday(uid) {
  try {
    const today = new Date().toISOString().slice(0, 10); // Format as YYYY-MM-DD
    console.log('Fetching clients with nextInvoiceDate:', today);
    
    const ref = collection(db, 'users', uid, 'clients');
    const q = query(ref, where('nextInvoiceDate', '==', today), where('onHold', '==', false));
    
    const snap = await withTimeout(getDocs(q));
    return snap.docs.map(doc => ({ 
      id: doc.id, 
      userId: uid, // Add userId so we know which user owns this client
      ...doc.data() 
    }));
  } catch (error) {
    console.error('Error fetching clients with invoices due today:', error);
    return [];
  }
}

// Update client data after invoicing
export async function updateClientAfterInvoicing(uid, clientId, updates) {
  try {
    const ref = doc(db, 'users', uid, 'clients', clientId);
    await withTimeout(updateDoc(ref, updates));
    return true;
  } catch (error) {
    console.error('Error updating client after invoicing:', error);
    throw error;
  }
}

// INVOICES
export async function getInvoices(uid) {
  try {
    console.log('Fetching invoices for user:', uid);
    const ref = collection(db, 'users', uid, 'invoices');
    const snap = await withTimeout(getDocs(ref));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching invoices:', error);
    // Return empty array instead of failing
    return [];
  }
}

export async function addInvoice(uid, invoice) {
  try {
    // Validate required input
    if (!uid) {
      console.error('Error: Missing user ID for addInvoice');
      throw new Error('Missing user ID for addInvoice');
    }
    
    if (!invoice) {
      console.error('Error: Missing invoice data for addInvoice');
      throw new Error('Missing invoice data for addInvoice');
    }
    
    // Modified duplicate check logic - only check if the invoice has the exact same properties
    // This allows creating multiple invoices for the same client on the same day as long as they have different amounts, etc.
    if (invoice.clientId) {
      console.log(`Creating new invoice for client ${invoice.clientId} with amount ${invoice.amount}`);
    }
    
    // Add creation timestamp
    const invoiceWithTimestamp = {
      ...invoice,
      createdAt: new Date().toISOString(),
    };
    
    // Create the new invoice
    const ref = collection(db, 'users', uid, 'invoices');
    const docRef = await withTimeout(addDoc(ref, invoiceWithTimestamp));
    return { id: docRef.id, ...invoiceWithTimestamp };
  } catch (error) {
    console.error('Error adding invoice:', error);
    throw error;
  }
}

export async function updateInvoice(uid, invoice) {
  try {
    const ref = doc(db, 'users', uid, 'invoices', invoice.id);
    await withTimeout(updateDoc(ref, invoice));
    return true;
  } catch (error) {
    console.error('Error updating invoice:', error);
    throw error;
  }
}

export async function deleteInvoice(uid, invoiceId) {
  try {
    const ref = doc(db, 'users', uid, 'invoices', invoiceId);
    await withTimeout(deleteDoc(ref));
    return true;
  } catch (error) {
    console.error('Error deleting invoice:', error);
    throw error;
  }
}

// Create a test client with today's date for invoice testing
export async function createTestClientWithInvoiceToday(uid) {
  try {
    const today = new Date().toISOString().slice(0, 10); // Format as YYYY-MM-DD
    
    const testClient = {
      name: "Test Client " + Math.floor(Math.random() * 1000),
      email: "test@example.com",
      phone: "555-123-4567",
      address: "123 Test Street, Test City",
      fee: 100 + Math.floor(Math.random() * 900), // Random fee between 100-999
      billingFrequency: "monthly",
      firstInvoiceDate: today,
      nextInvoiceDate: today, // Set to today to trigger invoice generation
      customerSince: today,
      status: "Active",
      onHold: false
    };
    
    console.log("[TEST] Creating test client with invoice due today:", testClient);
    const result = await addClient(uid, testClient);
    console.log("[TEST] Created test client:", result);
    return result;
  } catch (error) {
    console.error('Error creating test client:', error);
    throw error;
  }
}

// Get a specific client
export async function getClient(uid, clientId) {
  try {
    if (!uid || !clientId) {
      console.error('Firebase: Missing parameters for getClient:', { uid, clientId });
      return null;
    }
    
    console.log(`Firebase: Getting client with ID: ${clientId}`);
    const docRef = doc(db, 'users', uid, 'clients', clientId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const clientData = {
        id: docSnap.id,
        ...docSnap.data()
      };
      return clientData;
    } else {
      console.log(`Firebase: No client found with ID: ${clientId}`);
      return null;
    }
  } catch (error) {
    console.error('Error getting client:', error);
    return null;
  }
}

// Update client status and handle scheduled invoices
export async function updateClientStatus(userId, clientId, newStatus) {
  try {
    const clientRef = doc(db, 'users', userId, 'clients', clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (!clientSnap.exists()) {
      throw new Error('Client not found');
    }

    const client = clientSnap.data();
    const updates = {
      status: newStatus,
      lastStatusChange: new Date().toISOString()
    };

    // If client is being cancelled or put on hold, delete scheduled invoices
    if (newStatus === 'cancelled' || newStatus === 'on_hold') {
      // Get all scheduled invoices for this client
      const invoicesRef = collection(db, 'users', userId, 'invoices');
      const scheduledQuery = query(
        invoicesRef,
        where('clientId', '==', clientId),
        where('status', '==', 'scheduled')
      );
      const scheduledInvoices = await getDocs(scheduledQuery);

      console.log(`[updateClientStatus] newStatus: ${newStatus}, scheduledInvoices found: ${scheduledInvoices.size}`);
      if (scheduledInvoices.size > 0) {
        console.log('Scheduled invoice IDs:', scheduledInvoices.docs.map(doc => doc.id));
      }

      // Delete each scheduled invoice
      const deletePromises = scheduledInvoices.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
    }

    // Update client status
    await updateDoc(clientRef, updates);
    return { ...client, ...updates };
  } catch (error) {
    console.error('Error updating client status:', error);
    throw error;
  }
}

// Delete a specific scheduled invoice
export async function deleteScheduledInvoice(userId, invoiceId) {
  try {
    const invoiceRef = db.collection('users').doc(userId).collection('invoices').doc(invoiceId);
    const invoiceDoc = await invoiceRef.get();
    
    if (!invoiceDoc.exists) {
      throw new Error('Invoice not found');
    }

    const invoice = invoiceDoc.data();
    if (invoice.status !== 'scheduled') {
      throw new Error('Can only delete scheduled invoices');
    }

    await invoiceRef.delete();
    return true;
  } catch (error) {
    console.error('Error deleting scheduled invoice:', error);
    throw error;
  }
} 