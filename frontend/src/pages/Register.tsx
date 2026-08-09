import { useState, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import { CinematicAuthBackground } from "../components/common/CinematicAuthBackground";

// ─── Password Strength ───────────────────────────────────────────────────────
function getPasswordStrength(pwd: string): { score: number; label: string; color: string; hint: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (pwd.length >= 16) score++;
  const common = ['password','123456','qwerty','admin','letmein','welcome'];
  if (common.some(c => pwd.toLowerCase().includes(c))) score = Math.max(0, score - 2);

  if (score <= 1) return { score, label: 'Weak', color: '#ef4444', hint: 'Add numbers, symbols and more length' };
  if (score <= 2) return { score, label: 'Fair', color: '#f97316', hint: 'Add uppercase letters or symbols' };
  if (score <= 4) return { score, label: 'Strong', color: '#eab308', hint: 'Good! Try adding more length' };
  return { score, label: 'Very Strong', color: '#22c55e', hint: 'Excellent password!' };
}

function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { score, label, color, hint } = getPasswordStrength(password);
  const pct = Math.min(100, (score / 6) * 100);
  return (
    <div className="mt-2 space-y-1">
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
        <span className="text-[10px] text-gray-500">{hint}</span>
      </div>
    </div>
  );
}

// ─── Step Indicator ──────────────────────────────────────────────────────────
function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
                done ? 'bg-emerald-500 text-white' : active ? 'bg-amber-500 text-black' : 'bg-white/10 text-gray-500'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider hidden sm:block whitespace-nowrap ${
                active ? 'text-amber-400' : done ? 'text-emerald-400' : 'text-gray-600'
              }`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 sm:w-10 h-0.5 mx-1 mb-4 transition-all duration-300 ${
                done ? 'bg-emerald-500' : 'bg-white/10'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Form Input ───────────────────────────────────────────────────────────────
function Field({
  label, required, children, hint, error
}: { label: string; required?: boolean; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <div>
      <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1.5">
        {label}{required && <span className="text-amber-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[10px] text-rose-400 font-semibold mt-1">{error}</p>}
      {hint && !error && <p className="text-[10px] text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 focus:shadow-sm focus:shadow-amber-400/10 text-sm transition placeholder-gray-600";
const selectCls = `${inputCls} cursor-pointer`;

// ─── India States ─────────────────────────────────────────────────────────────
const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands',
  'Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir',
  'Ladakh','Lakshadweep','Puducherry',
];

const COUNTRIES = [
  'India','United States','United Kingdom','Canada','Australia','Germany','France','Singapore',
  'UAE','Saudi Arabia','Japan','South Korea','Bangladesh','Pakistan','Sri Lanka','Nepal',
  'Other',
];

// ─── Main Component ───────────────────────────────────────────────────────────
const RegisterPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'participant' | 'organization'>('participant');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Participant State ──────────────────────────────────────────────────────
  const [pStep, setPStep] = useState(0); // 0 or 1
  const [pForm, setPForm] = useState({
    name: '', username: '', email: '', password: '', confirmPassword: '', phone: '',
  });
  const [pConsent, setPConsent] = useState({ terms: false, gdpr: false, marketing: false });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [pErrors, setPErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [pSubmitSuccess, setPSubmitSuccess] = useState(false);
  const [formStartTime] = useState(Date.now());

  // ── Org State ─────────────────────────────────────────────────────────────
  const [oStep, setOStep] = useState(0); // 0–4
  const [oErrors, setOErrors] = useState<Record<string, string>>({});
  const [showOrgPwd, setShowOrgPwd] = useState(false);
  const [showOrgConfirm, setShowOrgConfirm] = useState(false);
  const [orgSubmitted, setOrgSubmitted] = useState<{ orgName: string; contactEmail: string; requestId: string } | null>(null);
  const [domainMatchStatus, setDomainMatchStatus] = useState<'match' | 'mismatch' | 'unknown'>('unknown');

  // Org form — all 5 steps
  const [oForm, setOForm] = useState({
    // Step 1
    orgName: '', orgType: '', industry: '', orgSize: '', websiteUrl: '', linkedinOrgUrl: '',
    // Step 2
    country: 'India', state: '', city: '', address: '', pincode: '',
    gstNumber: '', panNumber: '', cinNumber: '', regNumber: '', taxId: '',
    aisheCode: '', nirfRanking: '', affiliatedTo: '',
    // Step 3
    contactName: '', contactDesignation: '', contactEmail: '', contactPhone: '',
    contactAlternateEmail: '', domainMismatchReason: '',
    // Step 4
    useCases: [] as string[], expectedCandidates: '', preferredFormat: [] as string[],
    reason: '', hearAboutUs: '', referralCode: '',
    // Step 5
    password: '', confirmPassword: '',
    dpaAgreed: false, certifiedRepresentative: false, termsAgreed: false,
  });

  // ── Username debounce check ────────────────────────────────────────────────
  const checkUsername = useCallback(async (username: string) => {
    if (username.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    // Simulate API check (replace with real endpoint when available)
    await new Promise(r => setTimeout(r, 500));
    // Mocked: usernames ending with 'taken' are taken
    if (username.toLowerCase().includes('taken')) {
      setUsernameStatus('taken');
    } else {
      setUsernameStatus('available');
    }
  }, []);

  useEffect(() => {
    if (!pForm.username) { setUsernameStatus('idle'); return; }
    const t = setTimeout(() => checkUsername(pForm.username), 600);
    return () => clearTimeout(t);
  }, [pForm.username, checkUsername]);

  // ── Domain match check ────────────────────────────────────────────────────
  useEffect(() => {
    if (!oForm.contactEmail || !oForm.websiteUrl) { setDomainMatchStatus('unknown'); return; }
    try {
      const emailDomain = oForm.contactEmail.split('@')[1]?.toLowerCase();
      const webDomain = new URL(oForm.websiteUrl).hostname.replace(/^www\./, '').toLowerCase();
      setDomainMatchStatus(emailDomain && webDomain && emailDomain === webDomain ? 'match' : 'mismatch');
    } catch { setDomainMatchStatus('unknown'); }
  }, [oForm.contactEmail, oForm.websiteUrl]);

  // ── Participant Step Validation ────────────────────────────────────────────
  const validatePStep0 = () => {
    const errs: Record<string, string> = {};
    if (!pForm.name.trim()) errs.name = 'Full name is required';
    if (!pForm.username.trim()) errs.username = 'Username is required';
    else if (!/^[a-zA-Z0-9_]{3,20}$/.test(pForm.username)) errs.username = '3–20 chars, letters/numbers/underscore only';
    else if (usernameStatus === 'taken') errs.username = 'This username is already taken';
    if (!pForm.email.trim()) errs.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pForm.email)) errs.email = 'Enter a valid email address';
    if (!pForm.password) errs.password = 'Password is required';
    else if (pForm.password.length < 8) errs.password = 'At least 8 characters required';
    else if (!/[0-9]/.test(pForm.password)) errs.password = 'Include at least one number';
    else if (!/[^A-Za-z0-9]/.test(pForm.password)) errs.password = 'Include at least one special character';
    if (!pForm.confirmPassword) errs.confirmPassword = 'Please confirm your password';
    else if (pForm.password !== pForm.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setPErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validatePStep1 = () => {
    const errs: Record<string, string> = {};
    if (!pConsent.terms) errs.terms = 'You must agree to the Terms of Service';
    if (!pConsent.gdpr) errs.gdpr = 'GDPR consent is required';
    if (honeypot) errs.bot = 'Bot detected'; // anti-bot
    const timeOnForm = Date.now() - formStartTime;
    if (timeOnForm < 4000) errs.bot = 'Please take a moment to review the form';
    setPErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePNext = () => {
    setError('');
    if (pStep === 0 && validatePStep0()) setPStep(1);
  };

  const handleParticipantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validatePStep1()) return;
    setLoading(true);
    try {
      await api.register({ name: pForm.name, username: pForm.username, email: pForm.email, password: pForm.password, phone: pForm.phone || undefined });
      setPSubmitSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Org Step Validation ────────────────────────────────────────────────────
  const validateOStep = (step: number) => {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!oForm.orgName.trim()) errs.orgName = 'Organization name is required';
      if (!oForm.orgType) errs.orgType = 'Select an organization type';
      if (!oForm.industry) errs.industry = 'Select an industry / sector';
      if (!oForm.orgSize) errs.orgSize = 'Select organization size';
      if (!oForm.websiteUrl.trim()) errs.websiteUrl = 'Official website URL is required';
      else if (!/^https?:\/\//.test(oForm.websiteUrl)) errs.websiteUrl = 'URL must start with http:// or https://';
    }
    if (step === 1) {
      if (!oForm.country) errs.country = 'Country is required';
      if (!oForm.state.trim()) errs.state = 'State / Province is required';
      if (!oForm.city.trim()) errs.city = 'City is required';
      if (!oForm.address.trim()) errs.address = 'Registered address is required';
      if (!oForm.pincode.trim()) errs.pincode = 'Pincode / ZIP is required';
      if (oForm.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(oForm.gstNumber.toUpperCase()))
        errs.gstNumber = 'Invalid GST format (e.g., 22AAAAA0000A1Z5)';
      if (oForm.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(oForm.panNumber.toUpperCase()))
        errs.panNumber = 'Invalid PAN format (e.g., ABCDE1234F)';
    }
    if (step === 2) {
      if (!oForm.contactName.trim()) errs.contactName = 'Contact person name is required';
      if (!oForm.contactDesignation.trim()) errs.contactDesignation = 'Designation / title is required';
      if (!oForm.contactEmail.trim()) errs.contactEmail = 'Official contact email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(oForm.contactEmail)) errs.contactEmail = 'Enter a valid email address';
      if (!oForm.contactPhone.trim()) errs.contactPhone = 'Mobile number is required';
      if (domainMatchStatus === 'mismatch' && !oForm.domainMismatchReason.trim())
        errs.domainMismatchReason = 'Please explain why your email domain differs from your website';
    }
    if (step === 3) {
      if (oForm.useCases.length === 0) errs.useCases = 'Select at least one primary use case';
      if (!oForm.expectedCandidates) errs.expectedCandidates = 'Expected candidate volume is required';
      if (oForm.preferredFormat.length === 0) errs.preferredFormat = 'Select at least one contest format';
      if (!oForm.reason.trim() || oForm.reason.trim().length < 50) errs.reason = 'Please provide at least 50 characters describing your use case';
    }
    if (step === 4) {
      if (!oForm.password) errs.password = 'Admin password is required';
      else if (oForm.password.length < 8) errs.password = 'At least 8 characters required';
      else if (!/[0-9]/.test(oForm.password)) errs.password = 'Include at least one number';
      else if (!/[^A-Za-z0-9]/.test(oForm.password)) errs.password = 'Include at least one special character';
      if (!oForm.confirmPassword) errs.confirmPassword = 'Please confirm your password';
      else if (oForm.password !== oForm.confirmPassword) errs.confirmPassword = 'Passwords do not match';
      if (!oForm.termsAgreed) errs.termsAgreed = 'You must agree to the Terms of Service';
      if (!oForm.dpaAgreed) errs.dpaAgreed = 'Data Processing Agreement is required';
      if (!oForm.certifiedRepresentative) errs.certifiedRepresentative = 'You must certify your authorization';
    }
    setOErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleONext = () => {
    setError('');
    if (validateOStep(oStep)) setOStep(s => s + 1);
  };

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateOStep(4)) return;
    setLoading(true);
    try {
      const res = await api.submitOrgRequest({
        // Original
        orgName: oForm.orgName, orgType: oForm.orgType,
        contactName: oForm.contactName, contactEmail: oForm.contactEmail,
        contactPhone: oForm.contactPhone || undefined,
        websiteUrl: oForm.websiteUrl || undefined,
        reason: oForm.reason,
        preferredPassword: oForm.password,
        // Extended
        industry: oForm.industry, orgSize: oForm.orgSize, linkedinOrgUrl: oForm.linkedinOrgUrl || undefined,
        address: oForm.address, city: oForm.city, state: oForm.state,
        country: oForm.country, pincode: oForm.pincode,
        gstNumber: oForm.gstNumber || undefined, panNumber: oForm.panNumber || undefined,
        cinNumber: oForm.cinNumber || undefined, regNumber: oForm.regNumber || undefined,
        taxId: oForm.taxId || undefined, aisheCode: oForm.aisheCode || undefined,
        nirfRanking: oForm.nirfRanking || undefined, affiliatedTo: oForm.affiliatedTo || undefined,
        contactDesignation: oForm.contactDesignation,
        contactAlternateEmail: oForm.contactAlternateEmail || undefined,
        domainMismatchReason: oForm.domainMismatchReason || undefined,
        useCases: oForm.useCases, expectedCandidates: oForm.expectedCandidates,
        preferredFormat: oForm.preferredFormat,
        hearAboutUs: oForm.hearAboutUs || undefined, referralCode: oForm.referralCode || undefined,
        dpaAgreed: oForm.dpaAgreed, certifiedRepresentative: oForm.certifiedRepresentative,
      } as any);
      setOrgSubmitted({
        orgName: oForm.orgName,
        contactEmail: oForm.contactEmail,
        requestId: res.requestId || `REQ-${Date.now().toString(36).toUpperCase()}`,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const oUpdate = (field: string, value: any) => setOForm(p => ({ ...p, [field]: value }));
  const toggleOArray = (field: 'useCases' | 'preferredFormat', val: string) => {
    setOForm(p => {
      const arr = p[field] as string[];
      return { ...p, [field]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] };
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <CinematicAuthBackground maxWidthClass="max-w-2xl">
      <div className="p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black tracking-tight logo-shimmer">
            <span className="text-white">Contest</span><span className="text-amber-400">OS</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">Enterprise Assessment & Contest Platform</p>
        </div>

            {/* Tab Navigation */}
            <div className="flex bg-black/40 rounded-xl p-1 border border-white/8 mb-6">
              {(['participant', 'organization'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setError(''); setPStep(0); setOStep(0); }}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all ${
                    activeTab === tab
                      ? tab === 'participant' ? 'bg-amber-500 text-black shadow-lg' : 'bg-blue-600 text-white shadow-lg'
                      : 'text-gray-500 hover:text-white'
                  }`}
                >
                  {tab === 'participant' ? '👤 Join as Participant' : '🏢 Register Organization'}
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs font-bold text-center mb-4">
                ⚠️ {error}
              </div>
            )}

            {/* ════════════════════════════════════════════
                PARTICIPANT TAB
            ════════════════════════════════════════════ */}
            {activeTab === 'participant' && (
              pSubmitSuccess ? (
                <div className="bg-gradient-to-b from-zinc-900 to-black border border-emerald-500/30 rounded-2xl p-6 space-y-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-3xl mx-auto">🎉</div>
                  <div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">Account Created Successfully</span>
                    <h2 className="text-lg font-black text-white mt-1">Welcome to ContestOS!</h2>
                    <p className="text-xs text-zinc-400 mt-1">Check your inbox to verify your email address, then sign in to start competing.</p>
                  </div>
                  <button onClick={() => navigate('/login')} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm rounded-xl transition cursor-pointer">
                    Go to Sign In →
                  </button>
                </div>
              ) : (
                <div>
                  <StepIndicator steps={['Account', 'Consent']} current={pStep} />

                  {/* ── Step 0: Credentials ── */}
                  {pStep === 0 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Full Name" required error={pErrors.name}>
                          <input className={inputCls} type="text" placeholder="e.g. Arjun Sharma" value={pForm.name}
                            onChange={e => setPForm(p => ({ ...p, name: e.target.value }))} />
                        </Field>
                        <Field label="Username" required error={pErrors.username}
                          hint={usernameStatus === 'available' ? undefined : usernameStatus === 'checking' ? 'Checking...' : undefined}>
                          <div className="relative">
                            <input className={inputCls} type="text" placeholder="e.g. arjun_dev" value={pForm.username}
                              onChange={e => setPForm(p => ({ ...p, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }))} />
                            {usernameStatus === 'available' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 text-sm">✓</span>}
                            {usernameStatus === 'taken' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-400 text-sm">✗</span>}
                            {usernameStatus === 'checking' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-pulse">...</span>}
                          </div>
                          {usernameStatus === 'available' && <p className="text-[10px] text-emerald-400 mt-1">✓ Username is available</p>}
                        </Field>
                      </div>

                      <Field label="Email Address" required error={pErrors.email}>
                        <input className={inputCls} type="email" placeholder="e.g. arjun@college.edu.in" value={pForm.email}
                          onChange={e => setPForm(p => ({ ...p, email: e.target.value }))} />
                      </Field>

                      <Field label="Password" required error={pErrors.password}>
                        <div className="relative">
                          <input className={inputCls} type={showPwd ? 'text' : 'password'}
                            placeholder="Min 8 chars, 1 number, 1 special" value={pForm.password}
                            onChange={e => setPForm(p => ({ ...p, password: e.target.value }))} />
                          <button type="button" onClick={() => setShowPwd(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm transition">
                            {showPwd ? '🙈' : '👁️'}
                          </button>
                        </div>
                        <PasswordStrengthMeter password={pForm.password} />
                      </Field>

                      <Field label="Confirm Password" required error={pErrors.confirmPassword}>
                        <div className="relative">
                          <input className={inputCls} type={showConfirm ? 'text' : 'password'}
                            placeholder="Re-enter your password" value={pForm.confirmPassword}
                            onChange={e => setPForm(p => ({ ...p, confirmPassword: e.target.value }))} />
                          <button type="button" onClick={() => setShowConfirm(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm transition">
                            {showConfirm ? '🙈' : '👁️'}
                          </button>
                        </div>
                        {pForm.confirmPassword && pForm.password === pForm.confirmPassword && (
                          <p className="text-[10px] text-emerald-400 mt-1">✓ Passwords match</p>
                        )}
                      </Field>

                      <Field label="Phone Number (Optional)" hint="+91 XXXXX XXXXX">
                        <input className={inputCls} type="tel" placeholder="e.g. +91 98765 43210" value={pForm.phone}
                          onChange={e => setPForm(p => ({ ...p, phone: e.target.value }))} />
                      </Field>

                      <button onClick={handlePNext}
                        className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold text-sm rounded-xl hover:from-amber-400 hover:to-yellow-400 transition shadow-lg shadow-amber-500/20 cursor-pointer">
                        Continue →
                      </button>
                    </div>
                  )}

                  {/* ── Step 1: Consent ── */}
                  {pStep === 1 && (
                    <form onSubmit={handleParticipantSubmit} className="space-y-5">
                      {/* Honeypot */}
                      <input type="text" name="website_url" tabIndex={-1} aria-hidden="true"
                        className="absolute opacity-0 pointer-events-none h-0" value={honeypot}
                        onChange={e => setHoneypot(e.target.value)} />

                      <div className="bg-zinc-900/60 border border-white/8 rounded-2xl p-5 space-y-4">
                        <p className="text-xs font-bold text-white">Please read and agree to the following:</p>

                        {[
                          { key: 'terms', required: true, label: <>I have read and agree to the <a href="/terms" target="_blank" rel="noopener" className="text-amber-400 underline">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener" className="text-amber-400 underline">Privacy Policy</a></> },
                          { key: 'gdpr', required: true, label: 'I consent to my personal data being processed for assessment and contest purposes as described in the Privacy Policy (GDPR Art. 6)' },
                          { key: 'marketing', required: false, label: 'I\'d like to receive contest alerts, results, and platform updates via email (optional)' },
                        ].map(({ key, required, label }) => (
                          <label key={key} className={`flex items-start gap-3 cursor-pointer group`}>
                            <input type="checkbox" checked={(pConsent as any)[key]}
                              onChange={e => setPConsent(p => ({ ...p, [key]: e.target.checked }))}
                              className="mt-0.5 w-4 h-4 rounded accent-amber-500 cursor-pointer flex-shrink-0" />
                            <span className="text-xs text-gray-400 group-hover:text-gray-300 transition leading-relaxed">
                              {required && <span className="text-amber-400 mr-1">*</span>}
                              {label}
                            </span>
                          </label>
                        ))}

                        {pErrors.terms && <p className="text-[10px] text-rose-400 font-semibold">⚠️ {pErrors.terms}</p>}
                        {pErrors.gdpr && <p className="text-[10px] text-rose-400 font-semibold">⚠️ {pErrors.gdpr}</p>}
                        {pErrors.bot && <p className="text-[10px] text-rose-400 font-semibold">⚠️ {pErrors.bot}</p>}
                      </div>

                      <div className="flex gap-3">
                        <button type="button" onClick={() => setPStep(0)}
                          className="px-5 py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-sm font-bold rounded-xl transition cursor-pointer">
                          ← Back
                        </button>
                        <button type="submit" disabled={loading}
                          className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold text-sm rounded-xl hover:from-amber-400 hover:to-yellow-400 transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50">
                          {loading ? 'Creating Account...' : '🚀 Create Account'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )
            )}

            {/* ════════════════════════════════════════════
                ORGANIZATION TAB
            ════════════════════════════════════════════ */}
            {activeTab === 'organization' && (
              orgSubmitted ? (
                <div className="bg-gradient-to-b from-zinc-900 to-black border border-emerald-500/30 rounded-2xl p-6 space-y-4 shadow-2xl shadow-emerald-500/10 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-2xl mx-auto">🏛️</div>
                  <div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">Official Institutional Dossier Generated</span>
                    <h2 className="text-lg font-black text-white mt-1">Verification Application Received</h2>
                    <p className="text-xs text-zinc-400 mt-2">Your application for <strong className="text-white">{orgSubmitted.orgName}</strong> has been dispatched to Platform Super Admin for verification.</p>
                  </div>
                  <div className="p-3 bg-black/60 border border-white/10 rounded-xl text-left space-y-2 font-mono text-xs">
                    {[
                      ['Tracking Reference', orgSubmitted.requestId, 'text-amber-400'],
                      ['Contact Officer', orgSubmitted.contactEmail, 'text-white'],
                      ['Verification SLA', '24 – 48 Business Hours ✓', 'text-emerald-400'],
                    ].map(([k, v, cls]) => (
                      <div key={k} className="flex justify-between border-b border-white/5 pb-1 last:border-0 last:pb-0">
                        <span className="text-zinc-500">{k}:</span>
                        <span className={`font-bold ${cls}`}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-left text-[11px] text-zinc-300 space-y-1.5">
                    <p className="font-bold text-blue-400">🛡️ What happens next:</p>
                    <p className="text-zinc-400">1. Super Admin verifies your domain, legal details & contact identity.</p>
                    <p className="text-zinc-400">2. Risk assessment completed based on submitted data.</p>
                    <p className="text-zinc-400">3. On approval → ORG_ADMIN portal provisioned, welcome email sent.</p>
                  </div>
                  <button onClick={() => navigate('/login')} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl transition cursor-pointer">
                    Done · Proceed to Sign In
                  </button>
                </div>
              ) : (
                <div>
                  <StepIndicator
                    steps={['Identity', 'Legal', 'Contact', 'Requirements', 'Sign']}
                    current={oStep}
                  />

                  {/* ── Org Step 0: Identity ── */}
                  {oStep === 0 && (
                    <div className="space-y-4">
                      <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                        🏢 Provide your organization's legal identity. All fields marked <span className="text-amber-400 font-bold">*</span> are required.
                      </div>

                      <Field label="Organization Legal Name" required error={oErrors.orgName}>
                        <input className={inputCls} placeholder="e.g. IIT Delhi · Infosys Limited · Ministry of Education"
                          value={oForm.orgName} onChange={e => oUpdate('orgName', e.target.value)} />
                      </Field>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Organization Type" required error={oErrors.orgType}>
                          <select className={selectCls} value={oForm.orgType} onChange={e => oUpdate('orgType', e.target.value)}>
                            <option value="">Select type...</option>
                            {[['COLLEGE','🎓 College / University'],['COMPANY','🏢 Corporate / Company'],['GOVERNMENT','🏛️ Government / PSU'],['NGO','🌱 NGO / Non-Profit'],['EDTECH','📚 Coaching / Ed-Tech'],['RESEARCH','🔬 Research Lab'],['OTHER','⚙️ Other']].map(([v,l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Industry / Sector" required error={oErrors.industry}>
                          <select className={selectCls} value={oForm.industry} onChange={e => oUpdate('industry', e.target.value)}>
                            <option value="">Select industry...</option>
                            {['Technology / IT','Finance / BFSI','Healthcare / Pharma','Education','Manufacturing','FMCG / Retail','Consulting / Advisory','Government / Defense','Media / Entertainment','Other'].map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Organization Size" required error={oErrors.orgSize}>
                          <select className={selectCls} value={oForm.orgSize} onChange={e => oUpdate('orgSize', e.target.value)}>
                            <option value="">Select size...</option>
                            {[['SOLO','Solo / Startup (1–10)'],['SMALL','Small (11–50)'],['MEDIUM','Medium (51–200)'],['LARGE','Large (201–1000)'],['ENTERPRISE','Enterprise (1001–5000)'],['MEGA','Mega (5000+)']].map(([v,l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Official Website URL" required error={oErrors.websiteUrl} hint="Must start with https://">
                          <input className={inputCls} type="url" placeholder="https://iitd.ac.in"
                            value={oForm.websiteUrl} onChange={e => oUpdate('websiteUrl', e.target.value)} />
                        </Field>
                      </div>

                      <Field label="LinkedIn Organization Page (Optional)" hint="Helps verify organization authenticity">
                        <input className={inputCls} type="url" placeholder="https://linkedin.com/company/iit-delhi"
                          value={oForm.linkedinOrgUrl} onChange={e => oUpdate('linkedinOrgUrl', e.target.value)} />
                      </Field>
                    </div>
                  )}

                  {/* ── Org Step 1: Legal & Location ── */}
                  {oStep === 1 && (
                    <div className="space-y-4">
                      <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
                        🔒 Legal information is used for identity verification and fraud prevention. All data is encrypted and secure.
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Country" required error={oErrors.country}>
                          <select className={selectCls} value={oForm.country} onChange={e => oUpdate('country', e.target.value)}>
                            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </Field>

                        <Field label="State / Province" required error={oErrors.state}>
                          {oForm.country === 'India' ? (
                            <select className={selectCls} value={oForm.state} onChange={e => oUpdate('state', e.target.value)}>
                              <option value="">Select state...</option>
                              {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <input className={inputCls} placeholder="State / Province" value={oForm.state} onChange={e => oUpdate('state', e.target.value)} />
                          )}
                        </Field>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="City" required error={oErrors.city}>
                          <input className={inputCls} placeholder="e.g. New Delhi" value={oForm.city} onChange={e => oUpdate('city', e.target.value)} />
                        </Field>
                        <Field label="Pincode / ZIP" required error={oErrors.pincode}>
                          <input className={inputCls} placeholder="e.g. 110016" value={oForm.pincode} onChange={e => oUpdate('pincode', e.target.value)} />
                        </Field>
                      </div>

                      <Field label="Official Registered Address" required error={oErrors.address}>
                        <textarea className={`${inputCls} resize-none`} rows={2}
                          placeholder="Building name, street, area, landmark..."
                          value={oForm.address} onChange={e => oUpdate('address', e.target.value)} />
                      </Field>

                      {/* India-specific legal numbers */}
                      {oForm.country === 'India' && (
                        <div className="space-y-3 pt-1">
                          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">🇮🇳 India Legal Registration Numbers (Optional — improves approval speed)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="GST Number" error={oErrors.gstNumber} hint="15-char format: 22AAAAA0000A1Z5">
                              <input className={inputCls} placeholder="22AAAAA0000A1Z5"
                                value={oForm.gstNumber} onChange={e => oUpdate('gstNumber', e.target.value.toUpperCase())} maxLength={15} />
                            </Field>
                            <Field label="PAN Number" error={oErrors.panNumber} hint="10-char format: ABCDE1234F">
                              <input className={inputCls} placeholder="ABCDE1234F"
                                value={oForm.panNumber} onChange={e => oUpdate('panNumber', e.target.value.toUpperCase())} maxLength={10} />
                            </Field>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="CIN / Company Registration No.">
                              <input className={inputCls} placeholder="For Pvt/Public Ltd companies"
                                value={oForm.cinNumber} onChange={e => oUpdate('cinNumber', e.target.value)} />
                            </Field>
                            {['COLLEGE','EDTECH'].includes(oForm.orgType) && (
                              <Field label="AISHE / UGC / AICTE Code" hint="For recognized colleges">
                                <input className={inputCls} placeholder="e.g. C-11174"
                                  value={oForm.aisheCode} onChange={e => oUpdate('aisheCode', e.target.value)} />
                              </Field>
                            )}
                          </div>
                          {['COLLEGE','EDTECH'].includes(oForm.orgType) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Field label="NIRF Ranking (if applicable)">
                                <input className={inputCls} type="number" placeholder="e.g. 23"
                                  value={oForm.nirfRanking} onChange={e => oUpdate('nirfRanking', e.target.value)} />
                              </Field>
                              <Field label="Affiliated To">
                                <input className={inputCls} placeholder="e.g. Delhi University, AICTE"
                                  value={oForm.affiliatedTo} onChange={e => oUpdate('affiliatedTo', e.target.value)} />
                              </Field>
                            </div>
                          )}
                        </div>
                      )}

                      {/* International */}
                      {oForm.country !== 'India' && (
                        <div className="space-y-3 pt-1">
                          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">🌐 International Registration Numbers (Optional)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Company Registration Number">
                              <input className={inputCls} placeholder="Business / Company reg. no."
                                value={oForm.regNumber} onChange={e => oUpdate('regNumber', e.target.value)} />
                            </Field>
                            <Field label="Tax ID / EIN / VAT Number">
                              <input className={inputCls} placeholder="Tax identification number"
                                value={oForm.taxId} onChange={e => oUpdate('taxId', e.target.value)} />
                            </Field>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Org Step 2: Contact Officer ── */}
                  {oStep === 2 && (
                    <div className="space-y-4">
                      <div className="bg-purple-500/8 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-300">
                        👤 This person will become the Organization Admin (ORG_ADMIN) upon approval. They must be an authorized representative.
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Contact Person Full Name" required error={oErrors.contactName}>
                          <input className={inputCls} placeholder="e.g. Dr. Priya Sharma"
                            value={oForm.contactName} onChange={e => oUpdate('contactName', e.target.value)} />
                        </Field>
                        <Field label="Designation / Title" required error={oErrors.contactDesignation} hint="e.g. Dean, HR Director, CTO, Principal">
                          <input className={inputCls} placeholder="e.g. Dean of Academics"
                            value={oForm.contactDesignation} onChange={e => oUpdate('contactDesignation', e.target.value)} />
                        </Field>
                      </div>

                      <Field label="Official Contact Email" required error={oErrors.contactEmail}
                        hint={domainMatchStatus === 'match' ? '✅ Email domain matches your organization website' : domainMatchStatus === 'mismatch' ? undefined : 'Use your official organizational email address'}>
                        <input className={`${inputCls} ${domainMatchStatus === 'match' ? 'border-emerald-500/40' : domainMatchStatus === 'mismatch' ? 'border-amber-500/40' : ''}`}
                          type="email" placeholder="e.g. priya@iitd.ac.in"
                          value={oForm.contactEmail} onChange={e => oUpdate('contactEmail', e.target.value)} />
                        {domainMatchStatus === 'match' && <p className="text-[10px] text-emerald-400 mt-1">✅ Email domain matches your organization website</p>}
                        {domainMatchStatus === 'mismatch' && <p className="text-[10px] text-amber-400 mt-1">⚠️ Email domain differs from website domain. Please explain below.</p>}
                      </Field>

                      {domainMatchStatus === 'mismatch' && (
                        <Field label="Domain Mismatch Explanation" required error={oErrors.domainMismatchReason}
                          hint="Why is your email domain different from your website? (e.g., using a personal email, subsidiary domain)">
                          <textarea className={`${inputCls} resize-none`} rows={2}
                            placeholder="Explain why your email domain differs from your organization website..."
                            value={oForm.domainMismatchReason} onChange={e => oUpdate('domainMismatchReason', e.target.value)} />
                        </Field>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Mobile Number" required error={oErrors.contactPhone} hint="Include country code">
                          <input className={inputCls} type="tel" placeholder="+91 98765 43210"
                            value={oForm.contactPhone} onChange={e => oUpdate('contactPhone', e.target.value)} />
                        </Field>
                        <Field label="Alternate / Secondary Email (Optional)">
                          <input className={inputCls} type="email" placeholder="backup@domain.com"
                            value={oForm.contactAlternateEmail} onChange={e => oUpdate('contactAlternateEmail', e.target.value)} />
                        </Field>
                      </div>
                    </div>
                  )}

                  {/* ── Org Step 3: Platform Requirements ── */}
                  {oStep === 3 && (
                    <div className="space-y-5">
                      <div className="bg-cyan-500/8 border border-cyan-500/20 rounded-xl p-3 text-xs text-cyan-300">
                        📋 Tell us how you plan to use ContestOS so we can provision the right features for your organization.
                      </div>

                      <Field label="Primary Use Case" required error={oErrors.useCases} hint="Select all that apply">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          {[
                            ['CAMPUS_PLACEMENT','🎓 Campus Placement & Recruitment'],
                            ['INTERNAL_ASSESSMENT','📋 Internal Assessments & Exams'],
                            ['CODING_CONTESTS','💻 Coding Contests & Hackathons'],
                            ['HR_PRESCREENING','🔍 HR Pre-Screening & Aptitude Tests'],
                            ['TRAINING_CERTIFICATION','📜 Training & Certification'],
                            ['OPEN_COMPETITIONS','🏆 Open / Public Competitions'],
                            ['GOVT_EXAM','⚖️ Government Exam / PSU Recruitment'],
                            ['OTHER','⚙️ Other'],
                          ].map(([val, label]) => (
                            <label key={val} className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                              oForm.useCases.includes(val) ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/8 bg-white/3 hover:border-white/20'
                            }`}>
                              <input type="checkbox" checked={oForm.useCases.includes(val)}
                                onChange={() => toggleOArray('useCases', val)}
                                className="accent-amber-500 w-3.5 h-3.5 flex-shrink-0" />
                              <span className="text-xs text-gray-300">{label}</span>
                            </label>
                          ))}
                        </div>
                      </Field>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Expected Candidates / Month" required error={oErrors.expectedCandidates}>
                          <select className={selectCls} value={oForm.expectedCandidates} onChange={e => oUpdate('expectedCandidates', e.target.value)}>
                            <option value="">Select volume...</option>
                            {[['LT100','< 100'],['100_500','100 – 500'],['500_2K','500 – 2,000'],['2K_10K','2,000 – 10,000'],['10K_50K','10,000 – 50,000'],['GT50K','50,000+']].map(([v,l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </Field>

                        <Field label="How did you hear about us? (Optional)">
                          <select className={selectCls} value={oForm.hearAboutUs} onChange={e => oUpdate('hearAboutUs', e.target.value)}>
                            <option value="">Select...</option>
                            {['Google Search','LinkedIn','Twitter / X','Colleague Referral','Conference / Event','News Article','Partner / Agency','Other'].map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      <Field label="Preferred Contest Format" required error={oErrors.preferredFormat} hint="Select all that apply">
                        <div className="flex flex-wrap gap-2 mt-1">
                          {['MCQ / Quiz','Coding Challenges','Web Dev Challenges','Mixed (MCQ + Coding)','SQL / Database Tests','All Formats'].map(v => (
                            <label key={v} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-xs transition ${
                              oForm.preferredFormat.includes(v) ? 'border-blue-500/50 bg-blue-500/10 text-blue-300' : 'border-white/8 text-gray-400 hover:border-white/20'
                            }`}>
                              <input type="checkbox" checked={oForm.preferredFormat.includes(v)}
                                onChange={() => toggleOArray('preferredFormat', v)}
                                className="accent-blue-500 w-3 h-3" />
                              {v}
                            </label>
                          ))}
                        </div>
                      </Field>

                      <Field label="Why do you want to use ContestOS?" required error={oErrors.reason}
                        hint={`${oForm.reason.length}/500 characters (min 50)`}>
                        <textarea className={`${inputCls} resize-none`} rows={3}
                          placeholder="Describe your specific assessment needs, challenges you're trying to solve, or goals you want to achieve..."
                          value={oForm.reason} onChange={e => oUpdate('reason', e.target.value.slice(0, 500))} />
                      </Field>

                      <Field label="Referral Code (Optional)">
                        <input className={inputCls} placeholder="e.g. PARTNER2025"
                          value={oForm.referralCode} onChange={e => oUpdate('referralCode', e.target.value.toUpperCase())} />
                      </Field>
                    </div>
                  )}

                  {/* ── Org Step 4: Password + Agreements ── */}
                  {oStep === 4 && (
                    <form onSubmit={handleOrgSubmit} className="space-y-5">
                      <div className="bg-rose-500/8 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-300">
                        🔐 Set your admin password and confirm legal agreements. These are binding upon submission.
                      </div>

                      <Field label="Preferred Admin Password" required error={oErrors.password}>
                        <div className="relative">
                          <input className={inputCls} type={showOrgPwd ? 'text' : 'password'}
                            placeholder="Min 8 chars, 1 number, 1 special"
                            value={oForm.password} onChange={e => oUpdate('password', e.target.value)} />
                          <button type="button" onClick={() => setShowOrgPwd(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm transition">
                            {showOrgPwd ? '🙈' : '👁️'}
                          </button>
                        </div>
                        <PasswordStrengthMeter password={oForm.password} />
                      </Field>

                      <Field label="Confirm Password" required error={oErrors.confirmPassword}>
                        <div className="relative">
                          <input className={inputCls} type={showOrgConfirm ? 'text' : 'password'}
                            placeholder="Re-enter your password"
                            value={oForm.confirmPassword} onChange={e => oUpdate('confirmPassword', e.target.value)} />
                          <button type="button" onClick={() => setShowOrgConfirm(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm transition">
                            {showOrgConfirm ? '🙈' : '👁️'}
                          </button>
                        </div>
                        {oForm.confirmPassword && oForm.password === oForm.confirmPassword && (
                          <p className="text-[10px] text-emerald-400 mt-1">✓ Passwords match</p>
                        )}
                      </Field>

                      <div className="bg-zinc-900/60 border border-white/8 rounded-2xl p-5 space-y-4">
                        <p className="text-xs font-bold text-white">Legal Agreements — All required:</p>
                        {[
                          { key: 'termsAgreed', label: <>I have read and agree to ContestOS <a href="/terms" target="_blank" rel="noopener" className="text-amber-400 underline">Terms of Service</a></>, err: oErrors.termsAgreed },
                          { key: 'dpaAgreed', label: <>I agree to the <a href="/dpa" target="_blank" rel="noopener" className="text-amber-400 underline">Data Processing Agreement (DPA)</a> covering GDPR Article 28 obligations</>, err: oErrors.dpaAgreed },
                          { key: 'certifiedRepresentative', label: 'I certify that I am an authorized representative of the above organization and that all information provided is accurate and truthful', err: oErrors.certifiedRepresentative },
                        ].map(({ key, label, err }) => (
                          <div key={key}>
                            <label className="flex items-start gap-3 cursor-pointer group">
                              <input type="checkbox" checked={(oForm as any)[key]}
                                onChange={e => oUpdate(key, e.target.checked)}
                                className="mt-0.5 w-4 h-4 rounded accent-amber-500 cursor-pointer flex-shrink-0" />
                              <span className="text-xs text-gray-400 group-hover:text-gray-300 transition leading-relaxed">
                                <span className="text-amber-400 mr-1">*</span>{label}
                              </span>
                            </label>
                            {err && <p className="text-[10px] text-rose-400 font-semibold mt-1 ml-7">⚠️ {err}</p>}
                          </div>
                        ))}
                      </div>
                    </form>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex gap-3 mt-6">
                    {oStep > 0 && (
                      <button type="button" onClick={() => setOStep(s => s - 1)}
                        className="px-5 py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-sm font-bold rounded-xl transition cursor-pointer">
                        ← Back
                      </button>
                    )}
                    {oStep < 4 && (
                      <button type="button" onClick={handleONext}
                        className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-extrabold text-sm rounded-xl hover:from-blue-500 hover:to-cyan-500 transition shadow-lg shadow-blue-500/20 cursor-pointer">
                        Continue →
                      </button>
                    )}
                    {oStep === 4 && (
                      <button type="button" onClick={handleOrgSubmit} disabled={loading}
                        className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-extrabold text-sm rounded-xl hover:from-blue-500 hover:to-cyan-500 transition shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-50">
                        {loading ? 'Submitting Request...' : '🏛️ Submit Verification Request'}
                      </button>
                    )}
                  </div>
                </div>
              )
            )}

            {/* Footer */}
            <p className="text-gray-500 text-center text-xs pt-5 border-t border-white/5 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-amber-400 font-bold hover:underline">Sign In</Link>
            </p>
          </div>
    </CinematicAuthBackground>
  );
};

export default RegisterPage;
