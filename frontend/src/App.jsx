import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { auth, googleProvider, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, collection,
  query, where, getDocs
} from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const BACKEND_URL = 'https://blockchain-medicine-tracker-production.up.railway.app';
const ADMIN_EMAILS = [
  'singhkalyani6205@gmail.com',
  'kalyanisingh843328@gmail.com'
];

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [selectedRole, setSelectedRole] = useState('patient');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [medicineId, setMedicineId] = useState('');
  const [result, setResult] = useState(null);
  const [name, setName] = useState('');
  const [batch, setBatch] = useState('');
  const [loading, setLoading] = useState(false);
  const [myMedicines, setMyMedicines] = useState([]);
  const [adminMedicines, setAdminMedicines] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const scannerRef = useRef(null);

  const getUserRole = async (u) => {
    if (ADMIN_EMAILS.includes(u.email)) return 'admin';
    const snap = await getDoc(doc(db, 'users', u.uid));
    if (snap.exists()) return snap.data().role;
    return 'patient';
  };

  const loadMyMedicines = async (uid) => {
    try {
      const q = query(collection(db, 'medicines'), where('registeredBy', '==', uid));
      const snap = await getDocs(q);
      setMyMedicines(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.log('Error:', e); }
  };

  const loadAdminData = async () => {
  try {
    // Firestore se lo — naam, batch sab milega
    const medSnap = await getDocs(collection(db, 'medicines'));
    setAdminMedicines(medSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const userSnap = await getDocs(collection(db, 'users'));
    setAdminUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { console.log('Admin data error:', e); }
};

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userRole = await getUserRole(u);
        setRole(userRole);
        if (userRole === 'manufacturer') loadMyMedicines(u.uid);
        if (userRole === 'admin') loadAdminData();
        if (userRole === 'distributor' || userRole === 'pharmacy') loadAdminData();
      } else {
        setUser(null);
        setRole(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (scannerOpen) {
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 });
        scanner.render((text) => {
          const match = text.match(/\d+/);
          if (match) {
            setMedicineId(match[0]);
            scanner.clear();
            setScannerOpen(false);
          }
        }, console.log);
        scannerRef.current = scanner;
      }, 100);
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [scannerOpen]);

  const handleEmailLogin = async () => {
    setAuthError('');
    setAuthBusy(true);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCred.user.uid), {
          email, role: selectedRole, createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      const msgs = {
        'auth/user-not-found': 'Email not found!',
        'auth/wrong-password': 'Wrong password!',
        'auth/email-already-in-use': 'Email already in use!',
        'auth/weak-password': 'Password must be 6+ characters!',
        'auth/invalid-credential': 'Invalid email or password!',
      };
      setAuthError(msgs[e.code] || e.message);
    }
    setAuthBusy(false);
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setAuthBusy(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const snap = await getDoc(doc(db, 'users', res.user.uid));
      if (!snap.exists() && !ADMIN_EMAILS.includes(res.user.email)) {
        await setDoc(doc(db, 'users', res.user.uid), {
          email: res.user.email, role: selectedRole, createdAt: new Date().toISOString()
        });
      }
    } catch { setAuthError('Google login failed!'); }
    setAuthBusy(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setResult(null);
    setMyMedicines([]);
    setAdminMedicines([]);
    setAdminUsers([]);
  };

  const verifyMedicine = async () => {
    if (!medicineId) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/verify/${medicineId}`);
      
      // Firestore se medicines load karo supply history ke liye
      const medSnap = await getDocs(collection(db, 'medicines'));
      const allMeds = medSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAdminMedicines(allMeds);
      
      setResult(res.data);
    } catch { setResult({ isAuthentic: false, message: 'Server Error!' }); }
    setLoading(false);
  };

  const addMedicine = async () => {
    if (!name || !batch) return;
    setLoading(true);
    try {
      const expiryDate = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);
      const res = await axios.post(`${BACKEND_URL}/api/medicine/add`, {
        name, batchNumber: batch, expiryDate
      });
      if (res.data.medicineId) {
        await setDoc(doc(db, 'medicines', res.data.medicineId.toString()), {
          medicineId: res.data.medicineId.toString(),
          name, batch,
          registeredBy: user.uid,
          registeredByEmail: user.email,
          registeredAt: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        });
        await loadMyMedicines(user.uid);
        setName(''); setBatch('');
        alert(`✅ Medicine Registered! ID: #${res.data.medicineId}`);
      }
    } catch (err) { alert('Error: ' + err.message); }
    setLoading(false);
  };

  const colors = {
    admin: { primary: '#ff9f43', gradient: 'linear-gradient(135deg, #ff9f43, #ff6b6b)' },
    manufacturer: { primary: '#00d2ff', gradient: 'linear-gradient(135deg, #00d2ff, #7b2ff7)' },
    distributor: { primary: '#7b2ff7', gradient: 'linear-gradient(135deg, #7b2ff7, #ff6b6b)' },
    pharmacy: { primary: '#ff9f43', gradient: 'linear-gradient(135deg, #ff9f43, #ff6b6b)' },
    patient: { primary: '#00ff88', gradient: 'linear-gradient(135deg, #00ff88, #00b4d8)' },
  };
  const roleColor = role ? colors[role] : colors.patient;

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '10px',
    border: '1px solid #333', background: '#ffffff10', color: '#fff',
    fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', marginBottom: '12px'
  };

  const btnStyle = (color) => ({
    width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
    background: color || roleColor.gradient,
    color: '#fff', cursor: 'pointer', fontWeight: '700',
    fontSize: '0.95rem', fontFamily: 'inherit', marginBottom: '10px'
  });

  if (authLoading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0a0a0a', color: '#fff', fontSize: '1.5rem'
    }}>⏳ Loading...</div>
  );

  // LOGIN PAGE
  if (!user) return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
      fontFamily: "'Segoe UI', sans-serif", color: '#fff'
    }}>
      {/* Navbar */}
      <nav style={{
        background: '#ffffff08', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #ffffff15', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '64px', position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.8rem' }}>💊</span>
          <span style={{
            fontWeight: '800', fontSize: '1.2rem',
            background: 'linear-gradient(90deg, #00d2ff, #7b2ff7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>MediChain</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setAuthMode('login')} style={{
            padding: '8px 20px', borderRadius: '8px', border: '1px solid #333',
            background: authMode === 'login' ? 'linear-gradient(90deg, #00d2ff, #7b2ff7)' : 'transparent',
            color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600'
          }}>Login</button>
          <button onClick={() => setAuthMode('signup')} style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none',
            background: authMode === 'signup' ? 'linear-gradient(90deg, #00d2ff, #7b2ff7)' : '#ffffff15',
            color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600'
          }}>Sign Up</button>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{ textAlign: 'center', padding: '60px 20px 40px' }}>
        <div style={{ fontSize: '5rem', marginBottom: '16px' }}>💊</div>
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: '800',
          background: 'linear-gradient(90deg, #00d2ff, #7b2ff7)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: '16px', lineHeight: 1.2
        }}>MediChain Tracker</h1>
        <p style={{ color: '#888', fontSize: 'clamp(0.9rem, 2vw, 1.1rem)', maxWidth: '500px', margin: '0 auto 40px' }}>
          Blockchain-powered fake medicine detection system. Verify medicine authenticity instantly.
        </p>

        {/* Features */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px', maxWidth: '700px', margin: '0 auto 50px', padding: '0 20px'
        }}>
          {[
            { icon: '🔗', title: 'Blockchain Secured', desc: 'Tamper-proof records' },
            { icon: '📷', title: 'QR Scanner', desc: 'Instant verification' },
            { icon: '🛡️', title: '100% Authentic', desc: 'Real-time check' },
          ].map((f, i) => (
            <div key={i} style={{
              background: '#ffffff08', border: '1px solid #ffffff15',
              borderRadius: '16px', padding: '20px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{f.icon}</div>
              <div style={{ fontWeight: '700', marginBottom: '4px' }}>{f.title}</div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Auth Card */}
      <div style={{ maxWidth: '420px', margin: '0 auto', padding: '0 16px 40px' }}>
        <div style={{
          background: '#ffffff08', border: '1px solid #ffffff15',
          borderRadius: '20px', padding: '30px'
        }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '1.3rem' }}>
            {authMode === 'login' ? '🔑 Welcome Back' : '📝 Create Account'}
          </h2>

          {authMode === 'signup' && (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '8px' }}>Select your role:</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: 'manufacturer', label: '🏭 Manufacturer' },
                  { value: 'distributor', label: '🚚 Distributor' },
                  { value: 'pharmacy', label: '💊 Pharmacy' },
                  { value: 'patient', label: '🏥 Patient' },
                ].map(r => (
                  <button key={r.value} onClick={() => setSelectedRole(r.value)} style={{
                    flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                    background: selectedRole === r.value
                      ? 'linear-gradient(90deg, #00d2ff, #7b2ff7)' : '#ffffff15',
                    color: '#fff', cursor: 'pointer', fontWeight: '600',
                    fontFamily: 'inherit', fontSize: '0.85rem'
                  }}>{r.label}</button>
                ))}
              </div>
            </div>
          )}

          <input type="email" placeholder="Email address"
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
            style={inputStyle} />
          <input type="password" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
            style={inputStyle} />

          {authError && (
            <div style={{
              padding: '10px 14px', borderRadius: '10px',
              background: '#ff004420', border: '1px solid #ff0044',
              color: '#ff4466', fontSize: '0.85rem', marginBottom: '12px'
            }}>❌ {authError}</div>
          )}

          <button onClick={handleEmailLogin} disabled={authBusy} style={btnStyle('linear-gradient(90deg, #00d2ff, #7b2ff7)')}>
            {authBusy ? '⏳ Please wait...' : authMode === 'login' ? '🔑 Login' : '📝 Sign Up'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: '#333' }} />
            <span style={{ color: '#666', fontSize: '0.85rem' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: '#333' }} />
          </div>

          <button onClick={handleGoogleLogin} disabled={authBusy} style={{
            ...btnStyle('#ffffff15'), border: '1px solid #333',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '10px', marginBottom: 0
          }}>
            <span style={{ fontSize: '1.2rem' }}>🔵</span> Continue with Google
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <span style={{
            display: 'inline-block', background: '#00ff8820',
            border: '1px solid #00ff88', borderRadius: '20px',
            padding: '4px 16px', fontSize: '0.75rem', color: '#00ff88'
          }}>● LIVE ON SEPOLIA TESTNET</span>
        </div>
      </div>
    </div>
  );

  // NAVBAR FOR LOGGED IN USERS
  const navTabs = {
    admin: [
      { key: 'dashboard', label: '📊 Dashboard' },
      { key: 'medicines', label: '💊 Medicines' },
      { key: 'users', label: '👥 Users' },
      { key: 'verify', label: '🔍 Verify' },
      { key: 'about', label: 'ℹ️ About' },
    ],
    manufacturer: [
      { key: 'dashboard', label: '📊 Dashboard' },
      { key: 'register', label: '➕ Register' },
      { key: 'myMedicines', label: '💊 My Medicines' },
      { key: 'supply', label: '🚚 Supply Chain' },
      { key: 'about', label: 'ℹ️ About' },
    ],
    distributor: [
  { key: 'dashboard', label: '📊 Dashboard' },
  { key: 'transit', label: '🚚 In Transit' },
  { key: 'about', label: 'ℹ️ About' },
],
pharmacy: [
  { key: 'dashboard', label: '📊 Dashboard' },
  { key: 'deliver', label: '💊 Deliver' },
  { key: 'verify', label: '🔍 Verify' },
  { key: 'about', label: 'ℹ️ About' },
],
    patient: [
      { key: 'verify', label: '🔍 Verify' },
      { key: 'about', label: 'ℹ️ About' },
    ],
  };

  const currentTabs = navTabs[role] || navTabs.patient;

  const roleInfo = {
    admin: { icon: '👑', label: 'Admin', color: '#ff9f43' },
    manufacturer: { icon: '🏭', label: 'Manufacturer', color: '#00d2ff' },
    distributor: { icon: '🚚', label: 'Distributor', color: '#7b2ff7' },
    pharmacy: { icon: '💊', label: 'Pharmacy', color: '#ff9f43' },
    patient: { icon: '🏥', label: 'Patient', color: '#00ff88' },
  };
  const currentRole = roleInfo[role] || roleInfo.patient;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
      fontFamily: "'Segoe UI', sans-serif", color: '#fff'
    }}>
      {/* TOP NAVBAR */}
      <nav style={{
        background: '#0d0d1a',
        borderBottom: '1px solid #ffffff15',
        padding: '0 20px',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', height: '64px'
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.6rem' }}>💊</span>
            <span style={{
              fontWeight: '800', fontSize: '1.1rem',
              background: 'linear-gradient(90deg, #00d2ff, #7b2ff7)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>MediChain</span>
          </div>

          {/* Desktop Nav Links */}
          <div style={{
            display: 'flex', gap: '4px',
            '@media (max-width: 768px)': { display: 'none' }
          }}>
            {currentTabs.map(tab => (
              <button key={tab.key} onClick={() => { setActiveTab(tab.key); setMobileMenu(false); }} style={{
                padding: '8px 14px', borderRadius: '8px',
                border: 'none',
                background: activeTab === tab.key ? roleColor.gradient : 'transparent',
                color: activeTab === tab.key ? '#fff' : '#aaa',
                cursor: 'pointer', fontWeight: '600',
                fontSize: '0.85rem', fontFamily: 'inherit',
                transition: 'all 0.2s'
              }}>{tab.label}</button>
            ))}
          </div>

          {/* User Info + Mobile Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#ffffff10', borderRadius: '10px', padding: '6px 12px'
            }}>
              <span style={{ fontSize: '1.1rem' }}>{currentRole.icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: currentRole.color, fontWeight: '700' }}>
                  {currentRole.label}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#666' }}>
                  {user.email?.split('@')[0]}
                </span>
              </div>
            </div>

            <button onClick={handleLogout} style={{
              padding: '6px 12px', borderRadius: '8px',
              border: '1px solid #ff4466', background: 'transparent',
              color: '#ff4466', cursor: 'pointer', fontSize: '0.8rem',
              fontFamily: 'inherit', fontWeight: '600'
            }}>Logout</button>

            {/* Mobile Menu Button */}
            <button onClick={() => setMobileMenu(!mobileMenu)} style={{
              display: 'none', padding: '6px', borderRadius: '8px',
              border: '1px solid #333', background: 'transparent',
              color: '#fff', cursor: 'pointer', fontSize: '1.2rem',
              '@media (max-width: 768px)': { display: 'block' }
            }}>☰</button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenu && (
          <div style={{
            borderTop: '1px solid #ffffff15', padding: '10px 0'
          }}>
            {currentTabs.map(tab => (
              <button key={tab.key} onClick={() => { setActiveTab(tab.key); setMobileMenu(false); }} style={{
                display: 'block', width: '100%', padding: '12px 20px',
                border: 'none', background: activeTab === tab.key ? '#ffffff15' : 'transparent',
                color: activeTab === tab.key ? '#fff' : '#aaa',
                cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '0.95rem', textAlign: 'left', fontWeight: '600'
              }}>{tab.label}</button>
            ))}
          </div>
        )}
      </nav>

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}>


        {/* Admin Dashboard */}
        {activeTab === 'dashboard' && role === 'admin' && (
  <div>
    <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>📊 Regulatory Monitoring Dashboard</h2>

    {/* Stats Cards */}
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: '16px', marginBottom: '24px'
    }}>
      {[
        { label: 'Total Medicines', value: adminMedicines.length, color: '#00d2ff', icon: '💊' },
        { label: 'Total Users', value: adminUsers.length, color: '#ff9f43', icon: '👥' },
        { label: 'Manufacturers', value: adminUsers.filter(u => u.role === 'manufacturer').length, color: '#00ff88', icon: '🏭' },
        { label: 'Patients', value: adminUsers.filter(u => u.role === 'patient').length, color: '#7b2ff7', icon: '🏥' },
        { 
          label: 'Expiring Soon', 
          value: adminMedicines.filter(m => {
            const exp = new Date(m.expiryDate);
            const diff = (exp - new Date()) / (1000 * 60 * 60 * 24);
            return diff > 0 && diff <= 30;
          }).length, 
          color: '#ff4466', icon: '⚠️' 
        },
        {
          label: 'Delivered',
          value: adminMedicines.filter(m => m.supplyStep === 4).length,
          color: '#00ff88', icon: '✅'
        },
      ].map((s, i) => (
        <div key={i} style={{
          background: '#ffffff08', border: '1px solid #ffffff15',
          borderRadius: '16px', padding: '20px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.8rem' }}>{s.icon}</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: s.color }}>{s.value}</div>
          <div style={{ color: '#888', fontSize: '0.78rem' }}>{s.label}</div>
        </div>
      ))}
    </div>

    {/* Suspicious Activity */}
    <div style={{
      background: '#ff004410', border: '1px solid #ff004430',
      borderRadius: '16px', padding: '20px', marginBottom: '20px'
    }}>
      <h3 style={{ color: '#ff4466', marginBottom: '14px', fontSize: '1rem' }}>
        🚨 Suspicious Activity Monitor
      </h3>
      {(() => {
        const suspicious = adminMedicines.filter(m => {
          const isExpired = new Date(m.expiryDate) < new Date();
          const isStuck = m.supplyStep !== undefined && m.supplyStep < 3;
          return isExpired || isStuck;
        });
        return suspicious.length === 0 ? (
          <div style={{ color: '#00ff88', fontSize: '0.9rem' }}>
            ✅ No suspicious activity detected. All medicines look good!
          </div>
        ) : (
          suspicious.map((med, i) => {
            const isExpired = new Date(med.expiryDate) < new Date();
            const isStuck = med.supplyStep !== undefined && med.supplyStep < 3;
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '10px 14px',
                background: '#ff004415', borderRadius: '10px',
                marginBottom: '8px', flexWrap: 'wrap', gap: '8px',
                border: '1px solid #ff004425'
              }}>
                <div>
                  <div style={{ fontWeight: '600', color: '#fff' }}>
                    💊 {med.name || 'Unknown'} — ID #{med.medicineId}
                  </div>
                  <div style={{ color: '#ff6688', fontSize: '0.78rem' }}>
                    {isExpired ? '❌ Medicine is EXPIRED' : ''}
                    {isStuck ? ' ⚠️ Supply chain stuck at early stage' : ''}
                  </div>
                </div>
                <div style={{
                  padding: '4px 12px', borderRadius: '20px',
                  background: '#ff004430', color: '#ff4466',
                  fontSize: '0.75rem', fontWeight: '700'
                }}>ALERT</div>
              </div>
            );
          })
        );
      })()}
    </div>

    {/* Expiry Warning */}
    <div style={{
      background: '#ff9f4310', border: '1px solid #ff9f4330',
      borderRadius: '16px', padding: '20px', marginBottom: '20px'
    }}>
      <h3 style={{ color: '#ff9f43', marginBottom: '14px', fontSize: '1rem' }}>
        ⏳ Expiring Within 30 Days
      </h3>
      {(() => {
        const expiringSoon = adminMedicines.filter(m => {
          const exp = new Date(m.expiryDate);
          const diff = (exp - new Date()) / (1000 * 60 * 60 * 24);
          return diff > 0 && diff <= 30;
        });
        return expiringSoon.length === 0 ? (
          <div style={{ color: '#00ff88', fontSize: '0.9rem' }}>
            ✅ No medicines expiring soon!
          </div>
        ) : expiringSoon.map((med, i) => {
          const daysLeft = Math.ceil((new Date(med.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
          return (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '10px 14px',
              background: '#ff9f4315', borderRadius: '10px',
              marginBottom: '8px', flexWrap: 'wrap', gap: '8px'
            }}>
              <div>
                <div style={{ fontWeight: '600' }}>💊 {med.name} — ID #{med.medicineId}</div>
                <div style={{ color: '#888', fontSize: '0.78rem' }}>
                  Expiry: {new Date(med.expiryDate).toLocaleDateString()}
                </div>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: '20px',
                background: '#ff9f4330', color: '#ff9f43',
                fontSize: '0.8rem', fontWeight: '700'
              }}>{daysLeft} days left</div>
            </div>
          );
        });
      })()}
    </div>

    {/* Supply Chain Overview */}
    <div style={{
      background: '#ffffff08', border: '1px solid #ffffff15',
      borderRadius: '16px', padding: '20px', marginBottom: '20px'
    }}>
      <h3 style={{ marginBottom: '14px', fontSize: '1rem' }}>🚚 Supply Chain Overview</h3>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '12px'
      }}>
        {[
          { label: 'Manufactured', step: 0, icon: '🏭', color: '#00d2ff' },
          { label: 'Packaged', step: 2, icon: '📦', color: '#ff9f43' },
          { label: 'In Transit', step: 3, icon: '🚚', color: '#7b2ff7' },
          { label: 'Delivered', step: 4, icon: '🏥', color: '#00ff88' },
        ].map((s, i) => (
          <div key={i} style={{
            background: s.color + '15', border: `1px solid ${s.color}30`,
            borderRadius: '12px', padding: '14px', textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: s.color }}>
              {adminMedicines.filter(m => (m.supplyStep ?? 2) >= s.step).length}
            </div>
            <div style={{ color: '#888', fontSize: '0.72rem' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Recent Medicines */}
    <div style={{
      background: '#ffffff08', border: '1px solid #ffffff15',
      borderRadius: '16px', padding: '20px'
    }}>
      <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>🕐 Recently Registered</h3>
      {adminMedicines.slice(-3).reverse().map((med, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', padding: '10px',
          borderRadius: '10px', background: '#ffffff08',
          marginBottom: '8px', flexWrap: 'wrap', gap: '8px'
        }}>
          <div>
            <div style={{ fontWeight: '600' }}>💊 {med.name || 'Medicine'}</div>
            <div style={{ color: '#888', fontSize: '0.8rem' }}>ID: #{med.medicineId}</div>
          </div>
          <div style={{
            padding: '4px 10px', borderRadius: '20px',
            background: '#00d2ff20', color: '#00d2ff',
            fontSize: '0.8rem', fontWeight: '600'
          }}>
            Step {(med.supplyStep ?? 2) + 1}/5
          </div>
        </div>
      ))}
      {adminMedicines.length === 0 && (
        <p style={{ color: '#888', textAlign: 'center' }}>No medicines yet!</p>
      )}
    </div>
  </div>
)}

        {/* Admin All Medicines */}
        {activeTab === 'medicines' && role === 'admin' && (
          <div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px'
            }}>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>💊 All Medicines ({adminMedicines.length})</h2>
              <input
                placeholder="🔍 Search by name or batch..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{
                  padding: '10px 16px', borderRadius: '10px',
                  border: '1px solid #333', background: '#ffffff10',
                  color: '#fff', fontSize: '0.9rem', outline: 'none',
                  fontFamily: 'inherit', width: '250px'
                }}
              />
            </div>
            <div style={{
              background: '#ffffff08', border: '1px solid #ffffff15',
              borderRadius: '16px', padding: '20px'
            }}>
              {adminMedicines
                .filter(m =>
                  m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  m.batchNumber?.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((med, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '14px', borderRadius: '12px',
                    background: '#ffffff08', marginBottom: '8px',
                    border: '1px solid #ffffff10', flexWrap: 'wrap', gap: '8px'
                  }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1rem' }}>💊 {med.name || 'N/A'}</div>
                      <div style={{ color: '#888', fontSize: '0.8rem' }}>Batch: {med.batch || med.batchNumber || 'N/A'}</div>
                      <div style={{ color: '#888', fontSize: '0.8rem' }}>
                       Expiry: {med.expiryDate ? new Date(med.expiryDate).toLocaleDateString() : 'N/A'}
 
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        background: '#00d2ff20', border: '1px solid #00d2ff',
                        borderRadius: '8px', padding: '4px 10px',
                        color: '#00d2ff', fontSize: '0.85rem', fontWeight: '700'
                      }}>ID: #{med.medicineId}</div>
                      <div style={{
  fontSize: '0.75rem', marginTop: '4px',
  color: new Date(med.expiryDate) > new Date() ? '#00ff88' : '#ff4466'
}}>
  {new Date(med.expiryDate) > new Date() ? '✅ Authentic' : '❌ Expired'}
</div>
                    </div>
                  </div>
                ))}
              {adminMedicines.length === 0 && (
                <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                  <div style={{ fontSize: '3rem' }}>📭</div>
                  <p>No medicines registered yet!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admin All Users */}
        {activeTab === 'users' && role === 'admin' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>👥 All Users ({adminUsers.length})</h2>
            <div style={{
              background: '#ffffff08', border: '1px solid #ffffff15',
              borderRadius: '16px', padding: '20px'
            }}>
              {adminUsers.map((u, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: '14px',
                  borderRadius: '12px', background: '#ffffff08',
                  marginBottom: '8px', flexWrap: 'wrap', gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>
                      {ADMIN_EMAILS.includes(u.email) ? '👑' :
                      u.role === 'manufacturer' ? '🏭' : 
                      u.role === 'distributor' ? '🚚' : 
                       u.role === 'pharmacy' ? '💊' : '🏥'}
                    </span>
                    <div>
                      <div style={{ fontWeight: '600' }}>{u.email}</div>
                      <div style={{ color: '#888', fontSize: '0.75rem' }}>
                        Joined: {new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
                    background: ADMIN_EMAILS.includes(u.email) ? '#ff9f4320' :
            u.role === 'manufacturer' ? '#00d2ff20' : 
            u.role === 'distributor' ? '#7b2ff720' : 
            u.role === 'pharmacy' ? '#ff9f4320' : '#00ff8820',
color: ADMIN_EMAILS.includes(u.email) ? '#ff9f43' :
       u.role === 'manufacturer' ? '#00d2ff' : 
       u.role === 'distributor' ? '#7b2ff7' : 
       u.role === 'pharmacy' ? '#ff9f43' : '#00ff88',
border: `1px solid ${ADMIN_EMAILS.includes(u.email) ? '#ff9f4340' :
         u.role === 'manufacturer' ? '#00d2ff40' : 
         u.role === 'distributor' ? '#7b2ff740' : 
         u.role === 'pharmacy' ? '#ff9f4340' : '#00ff8840'}`
                  }}>
                   {ADMIN_EMAILS.includes(u.email) ? '👑 Admin' :
                   u.role === 'manufacturer' ? '🏭 Manufacturer' : 
                   u.role === 'distributor' ? '🚚 Distributor' : 
                  u.role === 'pharmacy' ? '💊 Pharmacy' : '🏥 Patient'}                  </div>
                </div>
              ))}
              {adminUsers.length === 0 && (
                <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                  <div style={{ fontSize: '3rem' }}>👥</div>
                  <p>No users yet!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== MANUFACTURER TABS ===== */}

        {/* Manufacturer Dashboard */}
        {activeTab === 'dashboard' && role === 'manufacturer' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>📊 My Dashboard</h2>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px', marginBottom: '24px'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #00d2ff20, #7b2ff720)',
                border: '1px solid #00d2ff30', borderRadius: '16px',
                padding: '24px', textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#00d2ff' }}>
                  {myMedicines.length}
                </div>
                <div style={{ color: '#888' }}>Total Registered</div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #00ff8820, #00b4d820)',
                border: '1px solid #00ff8830', borderRadius: '16px',
                padding: '24px', textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#00ff88' }}>
                  {myMedicines.filter(m => new Date(m.expiryDate) > new Date()).length}
                </div>
                <div style={{ color: '#888' }}>Active Medicines</div>
              </div>
            </div>
            <button onClick={() => setActiveTab('register')} style={btnStyle()}>
              ➕ Register New Medicine
            </button>
          </div>
        )}

        {/* Manufacturer Register */}
        {activeTab === 'register' && role === 'manufacturer' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>➕ Register New Medicine</h2>
            <div style={{
              background: '#ffffff08', border: '1px solid #ffffff15',
              borderRadius: '16px', padding: '24px'
            }}>
              <input placeholder="Medicine name (e.g. Paracetamol)"
                value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
              <input placeholder="Batch number (e.g. BATCH001)"
                value={batch} onChange={e => setBatch(e.target.value)} style={inputStyle} />
              <button onClick={addMedicine} disabled={loading} style={btnStyle('#27ae60')}>
                {loading ? '⏳ Saving to blockchain...' : '🚀 Register Medicine'}
              </button>
            </div>
          </div>
        )}

        {/* Manufacturer My Medicines */}
        {activeTab === 'myMedicines' && role === 'manufacturer' && (
          <div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px'
            }}>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>
                💊 My Medicines ({myMedicines.length})
              </h2>
              <input
                placeholder="🔍 Search..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{
                  padding: '10px 16px', borderRadius: '10px',
                  border: '1px solid #333', background: '#ffffff10',
                  color: '#fff', fontSize: '0.9rem', outline: 'none',
                  fontFamily: 'inherit', width: '180px'
                }}
              />
            </div>
            <div style={{
              background: '#ffffff08', border: '1px solid #ffffff15',
              borderRadius: '16px', padding: '20px'
            }}>
              {myMedicines.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                  <div style={{ fontSize: '3rem' }}>📭</div>
                  <p>No medicines registered yet!</p>
                  <button onClick={() => setActiveTab('register')} style={{
                    ...btnStyle(), width: 'auto', padding: '10px 24px', marginTop: '16px'
                  }}>➕ Register First Medicine</button>
                </div>
              ) : myMedicines
                .filter(m =>
                  m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  m.batch?.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((med, i) => (
                  <div key={i} style={{
                    padding: '16px', borderRadius: '12px',
                    background: '#ffffff08', marginBottom: '10px',
                    border: '1px solid #ffffff10'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>💊 {med.name}</div>
                        <div style={{ color: '#888', fontSize: '0.85rem' }}>Batch: {med.batch}</div>
                        <div style={{ color: '#888', fontSize: '0.85rem' }}>
                          Registered: {new Date(med.registeredAt).toLocaleDateString()}
                        </div>
                        <div style={{ color: '#888', fontSize: '0.85rem' }}>
                          Expiry: {new Date(med.expiryDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          background: '#00d2ff20', border: '1px solid #00d2ff',
                          borderRadius: '8px', padding: '4px 12px',
                          color: '#00d2ff', fontSize: '0.85rem', fontWeight: '700'
                        }}>ID: #{med.medicineId}</div>
                        <div style={{
                          fontSize: '0.75rem', marginTop: '4px',
                          color: new Date(med.expiryDate) > new Date() ? '#00ff88' : '#ff4466'
                        }}>
                          {new Date(med.expiryDate) > new Date() ? '✅ Valid' : '❌ Expired'}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px' }}>
                      <QRCodeSVG value={`Medicine ID: ${med.medicineId}`}
                        size={80} bgColor="transparent" fgColor="#00d2ff" />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

{/* Manufacturer Supply Chain */}
{activeTab === 'supply' && role === 'manufacturer' && (
  <div>
    <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>🚚 Supply Chain</h2>

    {myMedicines.length === 0 ? (
      <div style={{
        background: '#ffffff08', border: '1px solid #ffffff15',
        borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#888'
      }}>
        <div style={{ fontSize: '3rem' }}>📭</div>
        <p>No medicines to track yet!</p>
        <button onClick={() => setActiveTab('register')} style={{
          ...btnStyle(), width: 'auto', padding: '10px 24px', marginTop: '16px'
        }}>➕ Register First Medicine</button>
      </div>
    ) : (
      <div>
        {myMedicines.map((med, i) => {
          const currentStep = med.supplyStep ?? 2; // 0=Manufactured,1=QC,2=Packaged,3=InTransit,4=Delivered

          const steps = [
            { icon: '🏭', label: 'Manufactured', desc: `Registered on ${new Date(med.registeredAt).toLocaleDateString()}`, color: '#00d2ff' },
            { icon: '🧪', label: 'Quality Check', desc: 'Passed internal QC verification', color: '#7b2ff7' },
            { icon: '📦', label: 'Packaged', desc: 'Sealed and labeled for distribution', color: '#ff9f43' },
            { icon: '🚚', label: 'In Transit', desc: 'Dispatched to distributor', color: '#00ff88' },
            { icon: '🏥', label: 'Delivered', desc: 'Arrived at pharmacy/hospital', color: '#00ff88' },
          ];

          const updateStep = async (medId, newStep) => {
            try {
              await setDoc(doc(db, 'medicines', medId), { supplyStep: newStep }, { merge: true });
              setMyMedicines(prev => prev.map(m =>
                m.medicineId === medId ? { ...m, supplyStep: newStep } : m
              ));
            } catch (e) { alert('Error updating: ' + e.message); }
          };

          return (
            <div key={i} style={{
              background: '#ffffff08', border: '1px solid #ffffff15',
              borderRadius: '16px', padding: '20px', marginBottom: '16px'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>💊 {med.name}</div>
                  <div style={{ color: '#888', fontSize: '0.85rem' }}>Batch: {med.batch} | ID: #{med.medicineId}</div>
                </div>
                <div style={{
                  padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
                  background: currentStep === 4 ? '#00ff8820' : '#ff9f4320',
                  color: currentStep === 4 ? '#00ff88' : '#ff9f43',
                  border: `1px solid ${currentStep === 4 ? '#00ff8840' : '#ff9f4340'}`
                }}>
                  {currentStep === 4 ? '✅ Delivered' : `🔄 Step ${currentStep + 1}/5`}
                </div>
              </div>

              {/* Steps */}
              {steps.map((step, si) => {
                const done = si <= currentStep;
                const isNext = si === currentStep + 1;
                return (
                  <div key={si} style={{ display: 'flex', gap: '14px', marginBottom: '4px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: done ? step.color + '30' : '#ffffff08',
                        border: `2px solid ${done ? step.color : isNext ? '#ffffff30' : '#222'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', flexShrink: 0,
                        opacity: done ? 1 : isNext ? 0.6 : 0.3
                      }}>{step.icon}</div>
                      {si < 4 && (
                        <div style={{
                          width: '2px', height: '20px',
                          background: done ? step.color + '60' : '#222',
                          margin: '2px 0'
                        }} />
                      )}
                    </div>

                    <div style={{ paddingTop: '6px', flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem', color: done ? '#fff' : isNext ? '#888' : '#444' }}>
                        {step.label}
                      </div>
                      <div style={{ color: '#555', fontSize: '0.78rem' }}>{step.desc}</div>
                    </div>

                    <div style={{ paddingTop: '6px' }}>
                      {done ? (
                        <span style={{ color: step.color, fontSize: '0.75rem', fontWeight: '700' }}>✓ Done</span>
                      ) : isNext && currentStep < 4 ? (
                        <button
                          onClick={() => updateStep(med.medicineId, si)}
                          style={{
                            padding: '4px 12px', borderRadius: '8px', border: 'none',
                            background: 'linear-gradient(90deg, #00d2ff, #7b2ff7)',
                            color: '#fff', cursor: 'pointer', fontSize: '0.75rem',
                            fontWeight: '700', fontFamily: 'inherit'
                          }}
                        >
                          Mark ✓
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    )}
  </div>
)}
{/* Map Section - Supply Chain ke andar, medicine card ke baad */}
{activeTab === 'supply' && role === 'manufacturer' && myMedicines.length > 0 && (() => {
  const med = myMedicines[0];
  const currentStep = med.supplyStep ?? 2;
  const L = window.L;

  return (
    <div style={{
      background: '#ffffff08', border: '1px solid #ffffff15',
      borderRadius: '16px', padding: '20px', marginTop: '16px'
    }}>
      <h3 style={{ color: '#00d2ff', marginBottom: '16px', fontSize: '1rem' }}>
        🗺️ Supply Chain Route Map
      </h3>

      {/* Simple Visual Map */}
      <div style={{
        background: '#0a0a1a', borderRadius: '12px',
        padding: '24px', position: 'relative', overflow: 'hidden'
      }}>
        {/* India outline hint */}
        <div style={{
          color: '#ffffff05', fontSize: '8rem', position: 'absolute',
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          pointerEvents: 'none'
        }}>🗺️</div>

        {/* Route visualization */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', position: 'relative', zIndex: 1
        }}>
          {[
            { icon: '🏭', label: 'Manufacturer', city: 'Delhi', step: 0, color: '#00d2ff' },
            { icon: '🚚', label: 'Distributor', city: 'Mumbai', step: 3, color: '#7b2ff7' },
            { icon: '💊', label: 'Pharmacy', city: 'Pune', step: 4, color: '#ff9f43' },
          ].map((loc, idx) => {
            const done = currentStep >= loc.step;
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                {/* Node */}
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: done ? loc.color + '30' : '#ffffff08',
                  border: `3px solid ${done ? loc.color : '#333'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', marginBottom: '8px',
                  boxShadow: done ? `0 0 20px ${loc.color}50` : 'none',
                  transition: 'all 0.3s'
                }}>{loc.icon}</div>

                {/* Label */}
                <div style={{ fontWeight: '700', fontSize: '0.82rem', color: done ? '#fff' : '#555' }}>
                  {loc.label}
                </div>
                <div style={{ color: done ? loc.color : '#444', fontSize: '0.72rem', fontWeight: '600' }}>
                  📍 {loc.city}
                </div>
                <div style={{
                  marginTop: '6px', padding: '2px 10px', borderRadius: '20px', fontSize: '0.68rem',
                  background: done ? loc.color + '20' : '#ffffff08',
                  color: done ? loc.color : '#444',
                  border: `1px solid ${done ? loc.color + '40' : '#333'}`
                }}>
                  {done ? '✅ Reached' : '⏳ Pending'}
                </div>

                {/* Connecting line - between nodes */}
                {idx < 2 && (
                  <div style={{
                    position: 'absolute',
                    left: `${(idx + 1) * 33 - 10}%`,
                    top: '28px',
                    width: '20%',
                    height: '3px',
                    background: currentStep >= [3, 4][idx]
                      ? `linear-gradient(90deg, ${['#00d2ff', '#7b2ff7'][idx]}, ${['#7b2ff7', '#ff9f43'][idx]})`
                      : '#333',
                    borderRadius: '2px',
                    zIndex: 0
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#888', fontSize: '0.75rem' }}>Journey Progress</span>
            <span style={{ color: '#00ff88', fontSize: '0.75rem', fontWeight: '700' }}>
              {Math.round((currentStep / 4) * 100)}%
            </span>
          </div>
          <div style={{ background: '#ffffff10', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '10px',
              width: `${(currentStep / 4) * 100}%`,
              background: 'linear-gradient(90deg, #00d2ff, #7b2ff7, #ff9f43)',
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '14px', flexWrap: 'wrap' }}>
        {[
          { color: '#00d2ff', label: '🏭 Delhi — Manufacturer' },
          { color: '#7b2ff7', label: '🚚 Mumbai — Distributor' },
          { color: '#ff9f43', label: '💊 Pune — Pharmacy' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
            <span style={{ color: '#666', fontSize: '0.75rem' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
})()}
{/* Distributor Dashboard */}
{activeTab === 'dashboard' && role === 'distributor' && (
  <div>
    <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>📊 Distributor Dashboard</h2>
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px', marginBottom: '24px'
    }}>
      {[
        { label: 'Total Medicines', value: adminMedicines.length, color: '#7b2ff7', icon: '💊' },
        { label: 'In Transit', value: adminMedicines.filter(m => (m.supplyStep ?? 2) === 3).length, color: '#00d2ff', icon: '🚚' },
        { label: 'Delivered', value: adminMedicines.filter(m => (m.supplyStep ?? 2) === 4).length, color: '#00ff88', icon: '✅' },
        { label: 'Pending', value: adminMedicines.filter(m => (m.supplyStep ?? 2) < 3).length, color: '#ff9f43', icon: '⏳' },
      ].map((s, i) => (
        <div key={i} style={{
          background: '#ffffff08', border: '1px solid #ffffff15',
          borderRadius: '16px', padding: '20px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.8rem' }}>{s.icon}</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: s.color }}>{s.value}</div>
          <div style={{ color: '#888', fontSize: '0.78rem' }}>{s.label}</div>
        </div>
      ))}
    </div>
    <button onClick={() => setActiveTab('transit')} style={btnStyle('linear-gradient(135deg, #7b2ff7, #ff6b6b)')}>
      🚚 Mark Medicines In Transit
    </button>
  </div>
)}

{/* Distributor Transit Tab */}
{activeTab === 'transit' && role === 'distributor' && (
  <div>
    <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>🚚 Mark In Transit</h2>
    {adminMedicines.filter(m => (m.supplyStep ?? 2) === 2).length === 0 ? (
      <div style={{
        background: '#ffffff08', border: '1px solid #ffffff15',
        borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#888'
      }}>
        <div style={{ fontSize: '3rem' }}>📭</div>
        <p>No medicines ready for transit!</p>
      </div>
    ) : (
      <div style={{
        background: '#ffffff08', border: '1px solid #ffffff15',
        borderRadius: '16px', padding: '20px'
      }}>
        {adminMedicines.filter(m => (m.supplyStep ?? 2) === 2).map((med, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '14px',
            borderRadius: '12px', background: '#ffffff08',
            marginBottom: '10px', flexWrap: 'wrap', gap: '8px',
            border: '1px solid #ffffff10'
          }}>
            <div>
              <div style={{ fontWeight: '700' }}>💊 {med.name}</div>
              <div style={{ color: '#888', fontSize: '0.82rem' }}>Batch: {med.batch} | ID: #{med.medicineId}</div>
              <div style={{ color: '#888', fontSize: '0.82rem' }}>
                Expiry: {new Date(med.expiryDate).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={async () => {
                await setDoc(doc(db, 'medicines', med.medicineId), { supplyStep: 3 }, { merge: true });
                const medSnap = await getDocs(collection(db, 'medicines'));
                setAdminMedicines(medSnap.docs.map(d => ({ id: d.id, ...d.data() })));
              }}
              style={{
                padding: '8px 20px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(90deg, #7b2ff7, #00d2ff)',
                color: '#fff', cursor: 'pointer', fontWeight: '700',
                fontSize: '0.85rem', fontFamily: 'inherit'
              }}
            >🚚 Mark In Transit</button>
          </div>
        ))}
      </div>
    )}
  </div>
)}

{/* Pharmacy Dashboard */}
{activeTab === 'dashboard' && role === 'pharmacy' && (
  <div>
    <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>📊 Pharmacy Dashboard</h2>
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px', marginBottom: '24px'
    }}>
      {[
        { label: 'Total Medicines', value: adminMedicines.length, color: '#ff9f43', icon: '💊' },
        { label: 'In Transit', value: adminMedicines.filter(m => (m.supplyStep ?? 2) === 3).length, color: '#00d2ff', icon: '🚚' },
        { label: 'Delivered', value: adminMedicines.filter(m => (m.supplyStep ?? 2) === 4).length, color: '#00ff88', icon: '✅' },
      ].map((s, i) => (
        <div key={i} style={{
          background: '#ffffff08', border: '1px solid #ffffff15',
          borderRadius: '16px', padding: '20px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.8rem' }}>{s.icon}</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: s.color }}>{s.value}</div>
          <div style={{ color: '#888', fontSize: '0.78rem' }}>{s.label}</div>
        </div>
      ))}
    </div>
    <button onClick={() => setActiveTab('deliver')} style={btnStyle('linear-gradient(135deg, #ff9f43, #ff6b6b)')}>
      💊 Mark Medicines Delivered
    </button>
  </div>
)}

{/* Pharmacy Deliver Tab */}
{activeTab === 'deliver' && role === 'pharmacy' && (
  <div>
    <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>💊 Mark Delivered</h2>
    {adminMedicines.filter(m => (m.supplyStep ?? 2) === 3).length === 0 ? (
      <div style={{
        background: '#ffffff08', border: '1px solid #ffffff15',
        borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#888'
      }}>
        <div style={{ fontSize: '3rem' }}>📭</div>
        <p>No medicines in transit yet!</p>
      </div>
    ) : (
      <div style={{
        background: '#ffffff08', border: '1px solid #ffffff15',
        borderRadius: '16px', padding: '20px'
      }}>
        {adminMedicines.filter(m => (m.supplyStep ?? 2) === 3).map((med, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '14px',
            borderRadius: '12px', background: '#ffffff08',
            marginBottom: '10px', flexWrap: 'wrap', gap: '8px',
            border: '1px solid #ffffff10'
          }}>
            <div>
              <div style={{ fontWeight: '700' }}>💊 {med.name}</div>
              <div style={{ color: '#888', fontSize: '0.82rem' }}>Batch: {med.batch} | ID: #{med.medicineId}</div>
              <div style={{
                color: '#00d2ff', fontSize: '0.78rem', marginTop: '4px'
              }}>🚚 Currently In Transit</div>
            </div>
            <button
              onClick={async () => {
                await setDoc(doc(db, 'medicines', med.medicineId), { supplyStep: 4 }, { merge: true });
                const medSnap = await getDocs(collection(db, 'medicines'));
                setAdminMedicines(medSnap.docs.map(d => ({ id: d.id, ...d.data() })));
              }}
              style={{
                padding: '8px 20px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(90deg, #ff9f43, #00ff88)',
                color: '#fff', cursor: 'pointer', fontWeight: '700',
                fontSize: '0.85rem', fontFamily: 'inherit'
              }}
            >✅ Mark Delivered</button>
          </div>
        ))}
      </div>
    )}
  </div>
)}
        {/* ===== VERIFY TAB (Admin + Patient) ===== */}
{activeTab === 'verify' && (
  <div>
    <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>🔍 Verify Medicine</h2>
    <div style={{
      background: '#ffffff08', border: '1px solid #ffffff15',
      borderRadius: '16px', padding: '24px'
    }}>
      <input type="number" placeholder="Enter Medicine ID..."
        value={medicineId} onChange={e => setMedicineId(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && verifyMedicine()}
        style={inputStyle} />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button onClick={verifyMedicine} disabled={loading} style={{
          ...btnStyle(), flex: 1, marginBottom: 0
        }}>{loading ? '⏳ Verifying...' : '🔍 Verify'}</button>
        <button onClick={() => setScannerOpen(!scannerOpen)} style={{
          ...btnStyle('#e67e22'), flex: 1, marginBottom: 0
        }}>{scannerOpen ? '❌ Close' : '📷 Scan QR'}</button>
      </div>

      {scannerOpen && (
        <div style={{
          marginTop: '15px', padding: '15px', borderRadius: '12px',
          background: '#ffffff08', border: '1px solid #e67e22'
        }}>
          <p style={{ color: '#e67e22', marginBottom: '10px', fontWeight: '600' }}>
            📷 Scan QR code with camera
          </p>
          <div id="qr-reader" style={{ width: '100%' }}></div>
        </div>
      )}

      {result && (
        <div>
          <div style={{
            marginTop: '20px', padding: '24px', borderRadius: '14px',
            background: result.isAuthentic ? '#00ff8815' : '#ff004415',
            border: `2px solid ${result.isAuthentic ? '#00ff88' : '#ff0044'}`,
            textAlign: 'center', marginBottom: '16px'
          }}>
            <div style={{ fontSize: '4rem' }}>{result.isAuthentic ? '✅' : '❌'}</div>
            <h3 style={{
              color: result.isAuthentic ? '#00ff88' : '#ff0044',
              fontSize: '1.8rem', margin: '8px 0', fontWeight: '800'
            }}>{result.isAuthentic ? 'AUTHENTIC!' : 'FAKE!'}</h3>
            <p style={{ color: '#aaa' }}>{result.message}</p>
          </div>

          {result.isAuthentic && (() => {
            const med = adminMedicines.find(m => m.medicineId === medicineId) ||
                        myMedicines.find(m => m.medicineId === medicineId);
            if (!med) return null;

            const currentStep = med.supplyStep ?? 2;
            const steps = [
              { icon: '🏭', label: 'Manufactured', desc: `Registered on ${new Date(med.registeredAt).toLocaleDateString()}`, color: '#00d2ff' },
              { icon: '🧪', label: 'Quality Check', desc: 'Passed internal QC verification', color: '#7b2ff7' },
              { icon: '📦', label: 'Packaged', desc: 'Sealed and labeled for distribution', color: '#ff9f43' },
              { icon: '🚚', label: 'In Transit', desc: 'Dispatched to distributor', color: '#00ff88' },
              { icon: '🏥', label: 'Delivered', desc: 'Arrived at pharmacy/hospital', color: '#00ff88' },
            ];

            return (
              <div style={{
                background: '#ffffff08', border: '1px solid #ffffff15',
                borderRadius: '16px', padding: '20px'
              }}>
                <h3 style={{ marginBottom: '16px', fontSize: '1rem', color: '#00d2ff' }}>
                  📦 Supply Chain Journey
                </h3>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ color: '#888', fontSize: '0.82rem' }}>💊 {med.name}</div>
                  <div style={{ color: '#666', fontSize: '0.75rem' }}>Batch: {med.batch} | ID: #{med.medicineId}</div>
                </div>
                {steps.map((step, si) => {
                  const done = si <= currentStep;
                  return (
                    <div key={si} style={{ display: 'flex', gap: '12px', marginBottom: '4px', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: done ? step.color + '30' : '#ffffff08',
                          border: `2px solid ${done ? step.color : '#333'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.9rem', flexShrink: 0, opacity: done ? 1 : 0.3
                        }}>{step.icon}</div>
                        {si < 4 && <div style={{ width: '2px', height: '18px', background: done ? step.color + '60' : '#222', margin: '2px 0' }} />}
                      </div>
                      <div style={{ paddingTop: '4px', flex: 1 }}>
                        <div style={{ fontWeight: '600', fontSize: '0.85rem', color: done ? '#fff' : '#444' }}>{step.label}</div>
                        <div style={{ color: '#555', fontSize: '0.75rem' }}>{step.desc}</div>
                      </div>
                      <div style={{ paddingTop: '6px' }}>
                        {done
                          ? <span style={{ color: step.color, fontSize: '0.72rem', fontWeight: '700' }}>✓ Done</span>
                          : <span style={{ color: '#444', fontSize: '0.72rem' }}>⏳ Pending</span>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  </div>
)}
        {/* ===== ABOUT TAB ===== */}
        {activeTab === 'about' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>ℹ️ About MediChain</h2>
            <div style={{
              background: '#ffffff08', border: '1px solid #ffffff15',
              borderRadius: '16px', padding: '24px', marginBottom: '16px'
            }}>
              <h3 style={{ color: '#00d2ff', marginBottom: '12px' }}>🎯 What is MediChain?</h3>
              <p style={{ color: '#aaa', lineHeight: 1.7 }}>
                MediChain is a blockchain-powered fake medicine detection system built on Ethereum.
                It allows manufacturers to register medicines on the blockchain and patients to verify
                their authenticity instantly using a Medicine ID or QR code scan.
              </p>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px', marginBottom: '16px'
            }}>
              {[
                { icon: '🔗', title: 'Blockchain', desc: 'Ethereum Sepolia Testnet — Tamper-proof records' },
                { icon: '📝', title: 'Smart Contract', desc: `0xdE69D1b...dFfA — Deployed & Verified` },
                { icon: '⚡', title: 'Backend', desc: 'Node.js + Express REST API' },
                { icon: '🎨', title: 'Frontend', desc: 'React + Vite — Responsive Design' },
                { icon: '🔐', title: 'Authentication', desc: 'Firebase — Email + Google Login' },
                { icon: '📷', title: 'QR Scanner', desc: 'Camera-based medicine verification' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '16px', borderRadius: '12px',
                  background: '#ffffff08', border: '1px solid #ffffff10'
                }}>
                  <span style={{ fontSize: '1.8rem' }}>{item.icon}</span>
                  <div>
                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>{item.title}</div>
                    <div style={{ color: '#888', fontSize: '0.82rem' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #00d2ff15, #7b2ff715)',
              border: '1px solid #00d2ff30', borderRadius: '16px', padding: '20px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#00ff88', fontWeight: '700', marginBottom: '8px' }}>
                ● LIVE ON SEPOLIA TESTNET
              </div>
              <div style={{ color: '#888', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                Contract: 0xdE69D1b209B477917110510838F72cB1C1e7dFfA
              </div>
              <div style={{ color: '#888', fontSize: '0.8rem', marginTop: '8px' }}>
                Built with ❤️ using Solidity + React + Node.js + Firebase
              </div>
            </div>
          </div>
        )}
      </div>
      {/* FOOTER */}
<footer style={{
  marginTop: '60px',
  background: 'linear-gradient(180deg, #0d0d1a 0%, #050510 100%)',
  borderTop: '1px solid #ffffff10',
  padding: '50px 20px 24px',
  fontFamily: "'Segoe UI', sans-serif",
}}>
  <div style={{ maxWidth: '900px', margin: '0 auto' }}>

    {/* 3 Column Grid */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '40px',
      marginBottom: '40px'
    }}>

      {/* Column 1 — Brand */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <span style={{ fontSize: '1.8rem' }}>💊</span>
          <span style={{
            fontWeight: '800', fontSize: '1.2rem',
            background: 'linear-gradient(90deg, #00d2ff, #7b2ff7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>MediChain</span>
        </div>
        <p style={{ color: '#666', fontSize: '0.85rem', lineHeight: 1.7, marginBottom: '16px' }}>
          Blockchain-powered fake medicine detection system. Protecting lives, one scan at a time. 🛡️
        </p>
        <div style={{
          display: 'inline-block',
          background: '#00ff8815',
          border: '1px solid #00ff8830',
          borderRadius: '20px', padding: '4px 14px',
          fontSize: '0.72rem', color: '#00ff88', fontWeight: '600'
        }}>● LIVE ON SEPOLIA TESTNET</div>
      </div>

      {/* Column 2 — Tech Stack */}
      <div>
        <h4 style={{
          color: '#fff', fontWeight: '700', fontSize: '0.95rem',
          marginBottom: '16px', paddingBottom: '8px',
          borderBottom: '1px solid #ffffff10'
        }}>⚙️ Tech Stack</h4>
        {[
          { icon: '🔗', label: 'Ethereum Sepolia', sub: 'Blockchain Network' },
          { icon: '🔐', label: 'Firebase Auth', sub: 'Authentication' },
          { icon: '⚡', label: 'Node.js + Express', sub: 'Backend API' },
          { icon: '⚛️', label: 'React + Vite', sub: 'Frontend' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            marginBottom: '12px'
          }}>
            <span style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: '#ffffff08', border: '1px solid #ffffff10',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9rem', flexShrink: 0
            }}>{item.icon}</span>
            <div>
              <div style={{ color: '#ccc', fontSize: '0.82rem', fontWeight: '600' }}>{item.label}</div>
              <div style={{ color: '#555', fontSize: '0.72rem' }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Column 3 — Developer */}
      <div>
        <h4 style={{
          color: '#fff', fontWeight: '700', fontSize: '0.95rem',
          marginBottom: '16px', paddingBottom: '8px',
          borderBottom: '1px solid #ffffff10'
        }}>👩‍💻 Developer</h4>

        <div style={{
          background: 'linear-gradient(135deg, #00d2ff10, #7b2ff710)',
          border: '1px solid #7b2ff730',
          borderRadius: '14px', padding: '16px',
          marginBottom: '14px'
        }}>
          <div style={{
            fontWeight: '800', fontSize: '1.1rem',
            background: 'linear-gradient(90deg, #00d2ff, #7b2ff7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: '4px'
          }}>✨ Kalyani Singh</div>
          <div style={{ color: '#666', fontSize: '0.78rem' }}>
            Full Stack Blockchain Developer
          </div>
        </div>

        <div style={{ color: '#555', fontSize: '0.78rem', lineHeight: 1.6 }}>
          📝 Smart Contract: <br />
          <span style={{
            fontFamily: 'monospace', color: '#7b2ff7', fontSize: '0.72rem'
          }}>0xdE69D1b...dFfA</span>
        </div>
      </div>

    </div>

    {/* Divider */}
    <div style={{
      height: '1px',
      background: 'linear-gradient(90deg, transparent, #ffffff15, transparent)',
      marginBottom: '20px'
    }} />

    {/* Bottom Bar */}
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', flexWrap: 'wrap', gap: '10px'
    }}>
      <p style={{ color: '#333', fontSize: '0.75rem', margin: 0 }}>
        © {new Date().getFullYear()} MediChain · All rights reserved
      </p>
      <p style={{ color: '#333', fontSize: '0.75rem', margin: 0 }}>
        Built with ❤️ using Solidity · React · Node.js · Firebase
      </p>
    </div>

  </div>
</footer>

    </div>
  );
}