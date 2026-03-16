import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { auth, googleProvider } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

const BACKEND_URL = 'http://localhost:3001';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [activeTab, setActiveTab] = useState('verify');
  const [medicineId, setMedicineId] = useState('');
  const [result, setResult] = useState(null);
  const [name, setName] = useState('');
  const [batch, setBatch] = useState('');
  const [addResult, setAddResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ total: 0, authentic: 0, fake: 0 });
  const [scannerOpen, setScannerOpen] = useState(false);
  const scannerRef = useRef(null);

  // Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('verifyHistory');
    if (saved) setHistory(JSON.parse(saved));
    const savedStats = localStorage.getItem('stats');
    if (savedStats) setStats(JSON.parse(savedStats));
  }, []);

  // QR Scanner
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
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      const msgs = {
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/email-already-in-use': 'This email is already in use',
        'auth/weak-password': 'Password must be at least 6 characters long!',
        'auth/invalid-email': 'Invalid email',
        'auth/invalid-credential': 'Email or password is incorrect!',
      };
      setAuthError(msgs[e.code] || e.message);
    }
    setAuthBusy(false);
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setAuthError('Google login failed!');
    }
    setAuthBusy(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setResult(null);
    setAddResult(null);
    setHistory([]);
  };

  const saveHistory = (id, isAuthentic, message) => {
    const entry = { id, isAuthentic, message, time: new Date().toLocaleTimeString() };
    const newHistory = [entry, ...history].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('verifyHistory', JSON.stringify(newHistory));
    const newStats = {
      total: stats.total + 1,
      authentic: stats.authentic + (isAuthentic ? 1 : 0),
      fake: stats.fake + (!isAuthentic ? 1 : 0)
    };
    setStats(newStats);
    localStorage.setItem('stats', JSON.stringify(newStats));
  };

  const verifyMedicine = async () => {
    if (!medicineId) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/verify/${medicineId}`);
      setResult(res.data);
      saveHistory(medicineId, res.data.isAuthentic, res.data.message);
    } catch {
      setResult({ isAuthentic: false, message: 'Server Error!' });
    }
    setLoading(false);
  };

  const addMedicine = async () => {
    if (!name || !batch) return;
    setLoading(true);
    setAddResult(null);
    try {
      const expiryDate = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);
      const res = await axios.post(`${BACKEND_URL}/api/medicine/add`, {
        name, batchNumber: batch, expiryDate
      });
      setAddResult(res.data);
      setName('');
      setBatch('');
    } catch (err) {
      setAddResult({ error: err.message });
    }
    setLoading(false);
  };

  const inputStyle = {
    width: '100%', padding: '14px 18px', borderRadius: '12px',
    border: '1px solid #333', background: '#ffffff10', color: '#fff',
    fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', marginBottom: '12px'
  };

  const btnStyle = (color) => ({
    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
    background: color || 'linear-gradient(90deg, #00d2ff, #7b2ff7)',
    color: '#fff', cursor: 'pointer', fontWeight: '700',
    fontSize: '1rem', fontFamily: 'inherit', marginBottom: '10px'
  });

  // Loading screen
  if (authLoading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a, #1a1a2e)',
      color: '#fff', fontSize: '1.5rem'
    }}>
      ⏳ Loading...
    </div>
  );

  // LOGIN PAGE
  if (!user) return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
      fontFamily: "'Segoe UI', sans-serif", color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '60px' }}>💊</div>
          <h1 style={{
            fontSize: '2rem', fontWeight: '700',
            background: 'linear-gradient(90deg, #00d2ff, #7b2ff7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: '8px 0'
          }}>MediChain Tracker</h1>
          <p style={{ color: '#888' }}>Blockchain-Powered Medicine Verification</p>
        </div>

        {/* Auth Card */}
        <div style={{
          background: '#ffffff08', border: '1px solid #ffffff15',
          borderRadius: '20px', padding: '30px'
        }}>
          {/* Toggle */}
          <div style={{
            display: 'flex', background: '#ffffff10',
            borderRadius: '10px', padding: '4px', marginBottom: '24px'
          }}>
            {['login', 'signup'].map(mode => (
              <button key={mode} onClick={() => { setAuthMode(mode); setAuthError(''); }}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  background: authMode === mode ? 'linear-gradient(90deg, #00d2ff, #7b2ff7)' : 'transparent',
                  color: '#fff', cursor: 'pointer', fontWeight: '600',
                  fontFamily: 'inherit', fontSize: '0.9rem'
                }}>
                {mode === 'login' ? '🔑 Login' : '📝 Sign Up'}
              </button>
            ))}
          </div>

          {/* Email/Password */}
          <input
            type="email" placeholder="Email address"
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
            style={inputStyle}
          />
          <input
            type="password" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
            style={inputStyle}
          />

          {authError && (
            <div style={{
              padding: '10px 14px', borderRadius: '10px',
              background: '#ff004420', border: '1px solid #ff0044',
              color: '#ff4466', fontSize: '0.85rem', marginBottom: '12px'
            }}>❌ {authError}</div>
          )}

          <button onClick={handleEmailLogin} disabled={authBusy} style={btnStyle()}>
            {authBusy ? '⏳ Please wait...' : authMode === 'login' ? '🔑 Login' : '📝 Sign Up'}
          </button>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px'
          }}>
            <div style={{ flex: 1, height: '1px', background: '#333' }} />
            <span style={{ color: '#666', fontSize: '0.85rem' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: '#333' }} />
          </div>

          {/* Google Login */}
          <button onClick={handleGoogleLogin} disabled={authBusy} style={{
            ...btnStyle('#ffffff15'),
            border: '1px solid #333',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '10px', marginBottom: 0
          }}>
            <span style={{ fontSize: '1.2rem' }}>🔵</span>
            Sign in with Google
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <span style={{
            display: 'inline-block', background: '#00ff8820',
            border: '1px solid #00ff88', borderRadius: '20px',
            padding: '4px 16px', fontSize: '0.75rem', color: '#00ff88'
          }}>● LIVE ON SEPOLIA TESTNET</span>
        </div>
      </div>
    </div>
  );

  // MAIN APP
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
      fontFamily: "'Segoe UI', sans-serif", color: '#fff'
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
          <div style={{ fontSize: '40px' }}>💊</div>
          <h1 style={{
            fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: '700',
            background: 'linear-gradient(90deg, #00d2ff, #7b2ff7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '6px 0'
          }}>MediChain Tracker</h1>
        </div>

        {/* User Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#ffffff08', border: '1px solid #7b2ff740',
          borderRadius: '12px', padding: '12px 16px', marginBottom: '16px',
          flexWrap: 'wrap', gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {user.photoURL ? (
              <img src={user.photoURL} alt="avatar"
                style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
            ) : (
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(90deg, #00d2ff, #7b2ff7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '700'
              }}>
                {user.email?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>
                {user.displayName || user.email?.split('@')[0]}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>{user.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            padding: '6px 14px', borderRadius: '8px',
            border: '1px solid #ff4466', background: 'transparent',
            color: '#ff4466', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit'
          }}>🚪 Logout</button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px', marginBottom: '16px'
        }}>
          {[
            { label: 'Total Scans', value: stats.total, color: '#00d2ff' },
            { label: 'Authentic', value: stats.authentic, color: '#00ff88' },
            { label: 'Fake', value: stats.fake, color: '#ff4466' },
          ].map((s, i) => (
            <div key={i} style={{
              background: '#ffffff08', border: '1px solid #ffffff15',
              borderRadius: '12px', padding: '12px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.7rem', color: '#888' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '8px', marginBottom: '16px',
          flexWrap: 'wrap', justifyContent: 'center'
        }}>
          {[
            { key: 'verify', label: '🔍 Verify' },
            { key: 'register', label: '➕ Register' },
            { key: 'history', label: '📋 History' },
            { key: 'about', label: 'ℹ️ About' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '8px 16px', borderRadius: '30px',
              border: activeTab === tab.key ? 'none' : '1px solid #333',
              background: activeTab === tab.key
                ? 'linear-gradient(90deg, #00d2ff, #7b2ff7)' : 'transparent',
              color: '#fff', cursor: 'pointer', fontWeight: '600',
              fontSize: '0.85rem', fontFamily: 'inherit'
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Main Card */}
        <div style={{
          background: '#ffffff08', border: '1px solid #ffffff15',
          borderRadius: '20px', padding: '24px'
        }}>

          {/* VERIFY */}
          {activeTab === 'verify' && (
            <div>
              <h2 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>🔍 Verify Medicine 💊</h2>
              <input
                type="number" placeholder="💊 Enter Medicine ID..."
                value={medicineId} onChange={e => setMedicineId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verifyMedicine()}
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <button onClick={verifyMedicine} disabled={loading} style={{
                  ...btnStyle(), flex: 1, marginBottom: 0
                }}>{loading ? '⏳' : '🔍 Verify'}</button>
                <button onClick={() => setScannerOpen(!scannerOpen)} style={{
                  ...btnStyle('#e67e22'), flex: 1, marginBottom: 0
                }}>{scannerOpen ? '❌ Close' : '📷 QR Scan'}</button>
              </div>

              {scannerOpen && (
                <div style={{
                  marginTop: '15px', padding: '15px', borderRadius: '12px',
                  background: '#ffffff08', border: '1px solid #e67e22'
                }}>
                  <p style={{ color: '#e67e22', marginBottom: '10px', fontWeight: '600' }}>
                    📷 Scan QR Code
                  </p>
                  <div id="qr-reader" style={{ width: '100%' }}></div>
                </div>
              )}

              {result && (
                <div style={{
                  marginTop: '20px', padding: '20px', borderRadius: '14px',
                  background: result.isAuthentic ? '#00ff8815' : '#ff004415',
                  border: `1px solid ${result.isAuthentic ? '#00ff88' : '#ff0044'}`,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '3rem' }}>{result.isAuthentic ? '✅' : '❌'}</div>
                  <h3 style={{
                    color: result.isAuthentic ? '#00ff88' : '#ff0044',
                    fontSize: '1.5rem', margin: '8px 0'
                  }}>{result.isAuthentic ? 'AUTHENTIC!' : 'FAKE!'}</h3>
                  <p style={{ color: '#aaa' }}>{result.message}</p>
                </div>
              )}
            </div>
          )}

          {/* REGISTER */}
          {activeTab === 'register' && (
            <div>
              <h2 style={{ marginBottom: '20px', fontSize: '1.2rem' }}> ➕ Register Medicine 💊</h2>
              <input placeholder="Enter Medicine Name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
              <input placeholder="Batch number" value={batch} onChange={e => setBatch(e.target.value)} style={inputStyle} />
              <button onClick={addMedicine} disabled={loading} style={btnStyle('#27ae60')}>
                {loading ? '⏳ Saving to the blockchain...' : '🚀 Register Medicine'}
              </button>

              {addResult?.medicineId && (
                <div style={{
                  padding: '20px', borderRadius: '14px',
                  background: '#00ff8815', border: '1px solid #00ff88', textAlign: 'center'
                }}>
                  <p style={{ color: '#00ff88', fontWeight: '700', marginBottom: '15px' }}>
                    ✅ Registered! ID: #{addResult.medicineId}
                  </p>
                  <QRCodeSVG value={`Medicine ID: ${addResult.medicineId}`}
                    size={150} bgColor="transparent" fgColor="#00d2ff" />
                  <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '10px' }}>
                    Attach this QR code to the medicine.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* HISTORY */}
          {activeTab === 'history' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>📋 History</h2>
                {history.length > 0 && (
                  <button onClick={() => { setHistory([]); setStats({ total: 0, authentic: 0, fake: 0 }); localStorage.clear(); }}
                    style={{
                      padding: '6px 14px', borderRadius: '8px',
                      border: '1px solid #ff4466', background: 'transparent',
                      color: '#ff4466', cursor: 'pointer', fontSize: '0.8rem'
                    }}>🗑️ Clear</button>
                )}
              </div>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#888', padding: '40px 0' }}>
                  <div style={{ fontSize: '3rem' }}>📭</div>
                  <p>Koi verification nahi hua!</p>
                </div>
              ) : history.map((entry, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', borderRadius: '12px', background: '#ffffff08',
                  marginBottom: '8px',
                  border: `1px solid ${entry.isAuthentic ? '#00ff8830' : '#ff004430'}`
                }}>
                  <span style={{ fontSize: '1.5rem' }}>{entry.isAuthentic ? '✅' : '❌'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600' }}>ID: #{entry.id}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>{entry.message}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>{entry.time}</div>
                </div>
              ))}
            </div>
          )}

          {/* ABOUT */}
          {activeTab === 'about' && (
            <div>
              <h2 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>ℹ️ Project Info</h2>
              {[
                { icon: '🔗', title: 'Blockchain', desc: 'Ethereum Sepolia Testnet' },
                { icon: '📝', title: 'Smart Contract', desc: '0x89479b4De...F358' },
                { icon: '⚡', title: 'Backend', desc: 'Node.js + Express' },
                { icon: '🎨', title: 'Frontend', desc: 'React + Vite' },
                { icon: '📷', title: 'QR Scanner', desc: 'Camera se scan karo' },
                { icon: '🔐', title: 'Auth', desc: 'Firebase Email + Google Login' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '15px',
                  padding: '12px', borderRadius: '12px',
                  background: '#ffffff08', marginBottom: '8px'
                }}>
                  <span style={{ fontSize: '1.8rem' }}>{item.icon}</span>
                  <div>
                    <div style={{ fontWeight: '700' }}>{item.title}</div>
                    <div style={{ color: '#888', fontSize: '0.8rem' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#444', marginTop: '20px', fontSize: '0.8rem' }}>
          Built with ❤️ using Solidity + React + Firebase + Node.js
        </p>
      </div>
    </div>
  );
}