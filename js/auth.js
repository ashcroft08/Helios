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
        // Set persistence to SESSION (cleared when tab/window closes)
        await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

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
        const errorCode = error.code || '';
        const errorMessage = error.message || '';

        // Si el error es un JSON (a veces Firebase devuelve strings JSON en el mensaje)
        if (errorMessage.includes('{')) {
            try {
                const parsedError = JSON.parse(errorMessage.match(/\{.*\}/)[0]);
                if (parsedError.error && parsedError.error.message) {
                    const internalCode = parsedError.error.message;
                    if (internalCode === 'INVALID_LOGIN_CREDENTIALS') {
                        return { success: false, message: 'Credenciales inválidas. Verifica tu correo y contraseña' };
                    }
                }
            } catch (e) {
                // Si falla el parseo, seguimos con el flujo normal
            }
        }

        switch (errorCode) {
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
            case 'INVALID_LOGIN_CREDENTIALS':
                message = 'Credenciales inválidas. Verifica tu correo y contraseña';
                break;
            case 'auth/network-request-failed':
                message = 'Error de conexión. Verifica tu internet';
                break;
            case 'auth/user-disabled':
                message = 'Tu cuenta ha sido desactivada';
                break;
            default:
                // Si el mensaje contiene el código técnico directamente
                if (errorMessage.includes('INVALID_LOGIN_CREDENTIALS')) {
                    message = 'Credenciales inválidas. Verifica tu correo y contraseña';
                } else if (errorMessage.length > 100) {
                    // Si el mensaje es muy largo probablemente es un error técnico crudo
                    message = 'Error inesperado al validar tus datos. Inténtalo de nuevo.';
                } else {
                    message = errorMessage || message;
                }
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
 * Send password reset email
 */
async function resetPassword(email) {
    try {
        await auth.sendPasswordResetEmail(email);
        return { success: true, message: 'Correo de restablecimiento enviado. Revisa tu bandeja de entrada.' };
    } catch (error) {
        let message = 'Error al enviar el correo';
        switch (error.code) {
            case 'auth/invalid-email':
                message = 'Correo electrónico inválido';
                break;
            case 'auth/user-not-found':
                message = 'No existe una cuenta con ese correo';
                break;
            default:
                message = error.message || message;
        }
        return { success: false, message };
    }
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
