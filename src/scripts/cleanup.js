import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';

// Initialize admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: "service-b4786.appspot.com"
});

const auth = admin.auth();
const db = admin.firestore();
const bucket = getStorage().bucket();

async function deleteAllUsers() {
  console.log('Deleting all users...');
  try {
    const listUsersResult = await auth.listUsers();
    for (const userRecord of listUsersResult.users) {
      await auth.deleteUser(userRecord.uid);
      console.log(`Deleted user: ${userRecord.email}`);
    }
  } catch (error) {
    console.error('Error deleting users:', error);
  }
}

async function deleteAllFirestoreData() {
  console.log('Deleting all Firestore data...');
  try {
    const collections = await db.listCollections();
    for (const collection of collections) {
      const documents = await collection.listDocuments();
      for (const doc of documents) {
        await doc.delete();
        console.log(`Deleted document: ${collection.id}/${doc.id}`);
      }
    }
  } catch (error) {
    console.error('Error deleting Firestore data:', error);
  }
}

async function deleteAllStorageFiles() {
  console.log('Deleting all Storage files...');
  try {
    const [files] = await bucket.getFiles({ prefix: 'users/' });
    for (const file of files) {
      await file.delete();
      console.log(`Deleted file: ${file.name}`);
    }
  } catch (error) {
    console.error('Error deleting storage files:', error);
  }
}

async function cleanup() {
  console.log('Starting cleanup...');
  await deleteAllUsers();
  await deleteAllFirestoreData();
  await deleteAllStorageFiles();
  console.log('Cleanup complete!');
  process.exit(0);
}

cleanup(); 