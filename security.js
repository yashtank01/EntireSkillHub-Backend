// --- ADMIN SECURITY BOUNCER ---
const urlParams = new URLSearchParams(window.location.search);
const urlRole = urlParams.get('role');

if (urlRole) {
    localStorage.setItem('userRole', urlRole);
    window.history.replaceState({}, document.title, window.location.pathname);
}

const currentRole = localStorage.getItem('userRole');

if (currentRole !== 'admin') {
    alert("🔒 Access Denied: You must be an Admin to view this page.");
    window.location.href = 'auth.html'; 
}