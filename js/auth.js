/**
 * Auth Module - Firebase Authentication with Role Management
 * Roles: admin, encargado (supervisor/a)
 */

const auth = firebase.auth();

// Pre-assigned roles by email (checked on first login and on every page load)
const EMAIL_ROLES = {
    'johangracia40@gmail.com': 'admin',
    'fidelmedinam2@gmail.com': 'encargado'
};
// Backwards compat for auth-guard
const ADMIN_EMAILS = Object.keys(EMAIL_ROLES).filter(e => EMAIL_ROLES[e] === 'admin');

/**
 * Login user with email and password
 * Validates credentials and checks role in database
 */
async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Check/create user record in database
        const userData = await getUserData(user.uid);
        if (!userData) {
            // First login — check pre-assigned role from DB or config
            let autoRole = EMAIL_ROLES[user.email.toLowerCase()] || null;
            let autoNombre = user.email.split('@')[0];

            // Check roles_asignados collection in DB
            const emailKey = user.email.toLowerCase().replace(/\./g, ',');
            const pendingSnap = await db.ref(`roles_asignados/${emailKey}`).once('value');
            const pendingData = pendingSnap.val();
            if (pendingData) {
                autoRole = pendingData.rol || autoRole;
                autoNombre = pendingData.nombre || autoNombre;
                // Clean up the pending entry
                await db.ref(`roles_asignados/${emailKey}`).remove();
            }

            await db.ref(`usuarios/${user.uid}`).set({
                email: user.email,
                nombre: autoNombre,
                rol: autoRole || 'encargado',
                activo: true,
                creadoEn: new Date().toISOString()
            });
        } else if (!userData.activo) {
            // User is deactivated
            await auth.signOut();
            throw new Error('Tu cuenta ha sido desactivada. Contacta al administrador.');
        }

        return { success: true, user };
    } catch (error) {
        let message = 'Error al iniciar sesión';
        switch (error.code) {
            case 'auth/user-not-found':
                message = 'No existe una cuenta con ese correo';
                break;
            case 'auth/wrong-password':
                message = 'Contraseña incorrecta';
                break;
            case 'auth/invalid-email':
                message = 'Correo electrónico inválido';
                break;
            case 'auth/too-many-requests':
                message = 'Demasiados intentos. Intenta más tarde';
                break;
            case 'auth/invalid-credential':
                message = 'Credenciales inválidas. Verifica tu correo y contraseña';
                break;
            default:
                message = error.message || message;
        }
        return { success: false, message };
    }
}

/**
 * Logout current user
 */
async function logoutUser() {
    sessionStorage.removeItem('helios-user');
    await auth.signOut();
    window.location.href = 'login.html';
}

/**
 * Get user data from Realtime Database
 */
async function getUserData(uid) {
    const snapshot = await db.ref(`usuarios/${uid}`).once('value');
    return snapshot.val();
}

/**
 * Get current user's role
 * Returns: 'admin' | 'encargado' | null
 */
async function getCurrentUserRole() {
    const user = auth.currentUser;
    if (!user) return null;
    const data = await getUserData(user.uid);
    return data ? data.rol : null;
}

/**
 * Check if current user is admin
 */
async function isAdmin() {
    return (await getCurrentUserRole()) === 'admin';
}

/**
 * Check if current user is encargado
 */
async function isEncargado() {
    return (await getCurrentUserRole()) === 'encargado';
}

/**
 * Create a new user (Admin only)
 * Uses a secondary Firebase app to avoid logging out the admin
 */
async function crearUsuario(email, password, nombre, rol) {
    // Create secondary app instance for user creation
    const secondaryApp = firebase.apps.find(app => app.name === 'Secondary')
        || firebase.initializeApp(firebase.app().options, 'Secondary');
    const secondaryAuth = secondaryApp.auth();

    try {
        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        const newUser = userCredential.user;

        // Write user record to database
        await db.ref(`usuarios/${newUser.uid}`).set({
            email: email,
            nombre: nombre,
            rol: rol,
            activo: true,
            creadoEn: new Date().toISOString()
        });

        // Sign out from secondary app
        await secondaryAuth.signOut();

        return { success: true, uid: newUser.uid };
    } catch (error) {
        let message = 'Error al crear usuario';
        switch (error.code) {
            case 'auth/email-already-in-use':
                message = 'Ya existe una cuenta con ese correo';
                break;
            case 'auth/weak-password':
                message = 'La contraseña debe tener al menos 6 caracteres';
                break;
            case 'auth/invalid-email':
                message = 'Correo electrónico inválido';
                break;
            default:
                message = error.message || message;
        }
        return { success: false, message };
    }
}
