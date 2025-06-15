import admin from 'firebase-admin';
import * as fs from 'fs';


if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT env variable is not set. Please check your .env file.');
}
// read file from process.env.GOOGLE_SERVICE_ACCOUNT  async
const serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT, 'utf8'));
// Firebase config
const firebaseConfig = {
    credential: admin.credential.cert(serviceAccount),
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId:  process.env.FIREBASE_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
admin.initializeApp(firebaseConfig);

export { admin };

