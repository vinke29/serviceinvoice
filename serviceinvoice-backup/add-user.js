import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';

// Read the service account key file
const serviceAccountStr = await readFile('./serviceAccountKey.json', 'utf8');
const serviceAccount = JSON.parse(serviceAccountStr);

// Initialize Firebase
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Replace with the email you verified in SendGrid
const userEmail = 'vinke29@gmail.com';
// User ID from the logs
const userId = 'aTxH7B6qmpcoTR58q7DcBJEpDYp1';

// User data
const userData = {
  name: 'Vinke29', // Replace with your name
  email: userEmail,
  createdAt: FieldValue.serverTimestamp()
};

try {
  // Add the user document
  await db.collection('users').doc(userId).set(userData);
  console.log(`User document successfully created for ${userId}`);
  process.exit(0);
} catch (error) {
  console.error("Error creating user document: ", error);
  process.exit(1);
} 