import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC03a84kt4mC2S609cyVdradzV77_2sX-Y",
  authDomain: "dinebuddy-960c8.firebaseapp.com",
  projectId: "dinebuddy-960c8",
  storageBucket: "dinebuddy-960c8.firebasestorage.app",
  messagingSenderId: "693544297002",
  appId: "1:693544297002:web:30273898d55415e37a5953",
  measurementId: "G-M489FM8CSP"
};

// Initialize Firebase App & Auth
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export { RecaptchaVerifier, signInWithPhoneNumber };
