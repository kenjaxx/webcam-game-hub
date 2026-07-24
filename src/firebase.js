import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBvIHBRNvuE3YWz8i_XUwfgB4iRyyJYXcg",
  authDomain: "webcam-game-hub.firebaseapp.com",
  projectId: "webcam-game-hub",
  storageBucket: "webcam-game-hub.firebasestorage.app",
  messagingSenderId: "896215805845",
  appId: "1:896215805845:web:332b1dbbf9911592d7d09c",
  measurementId: "G-SWDWV3CBGC"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);