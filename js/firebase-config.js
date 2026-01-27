// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDaP9kgtOieCrnJFnzcfwWzCvlT_Kxzvj0",
    authDomain: "helios-5f4dd.firebaseapp.com",
    databaseURL: "https://helios-5f4dd-default-rtdb.firebaseio.com",
    projectId: "helios-5f4dd",
    storageBucket: "helios-5f4dd.firebasestorage.app",
    messagingSenderId: "337586930750",
    appId: "1:337586930750:web:6dfdc795e0452216a97d6f",
    measurementId: "G-10T3NRBPV1"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const storage = firebase.storage();
