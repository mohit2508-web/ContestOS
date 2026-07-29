import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";

const RegisterPage = () => {
  const [activeTab, setActiveTab] = useState("participant");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Participant Form State
  const [participantForm, setParticipantForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: ""
  });

  // Organization Request Form State
  const [orgForm, setOrgForm] = useState({
    orgName: "",
    orgType: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    websiteUrl: "",
    domain: "",
    reason: ""
  });

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) return 'Password must contain at least one special character';
    return null;
  };

  const handleParticipantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const pwdError = validatePassword(participantForm.password);
    if (pwdError) {
      setError(pwdError);
      return;
    }

    setLoading(true);
    try {
      await api.register(participantForm);
      alert('Account created! You can now login.');
      navigate('/login');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!participantForm.password) {
      setError('Please provide your preferred password for account creation');
      return;
    }
    const pwdError = validatePassword(participantForm.password);
    if (pwdError) {
      setError(pwdError);
      return;
    }

    setLoading(true);
    try {
      await api.submitOrgRequest(orgForm);
      alert('Organization request submitted! Our team will review and get back to you within 24-48 hours.');
      // Reset forms and switch to participant tab showing success
      setActiveTab('participant');
      setParticipantForm(prev => ({ ...prev, password: '' }));
      setOrgForm({
        orgName: '', orgType: '', contactName: '', contactEmail: '',
        contactPhone: '', websiteUrl: '', domain: '', reason: ''
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 relative selection:bg-amber-500/20">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl space-y-6 relative overflow-hidden z-10">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-500" />

        <div className="text-center">
          <h1 className="text-3xl font-black text-white tracking-tight">
            Contest<span className="text-amber-400">OS</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">Join the assessment platform</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-zinc-900/50 rounded-xl p-1 border border-white/10">
          <button
            onClick={() => setActiveTab('participant')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'participant'
                ? 'bg-amber-500 text-black shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Join as Participant
          </button>
          <button
            onClick={() => setActiveTab('organization')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'organization'
                ? 'bg-amber-500 text-black shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Register Organization
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-bold text-center">
            {error}
          </div>
        )}

        {/* Participant Tab */}
        {activeTab === 'participant' && (
          <form onSubmit={handleParticipantSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Full Name</label>
              <input
                type="text"
                value={participantForm.name}
                onChange={(e) => setParticipantForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition"
                placeholder="e.g. John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                type="email"
                value={participantForm.email}
                onChange={(e) => setParticipantForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition"
                placeholder="e.g. student@iitd.ac.in"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password"
                value={participantForm.password}
                onChange={(e) => setParticipantForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition"
                placeholder="Min 8 chars, 1 number, 1 special"
                required
              />
              <p className="text-[10px] text-gray-500 mt-1">Min 8 characters, at least 1 number and 1 special character</p>
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Phone (Optional)</label>
              <input
                type="tel"
                value={participantForm.phone}
                onChange={(e) => setParticipantForm(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition"
                placeholder="e.g. +91 9876543210"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold text-sm rounded-xl hover:from-amber-400 hover:to-yellow-400 transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Participant Account'}
            </button>
          </form>
        )}

        {/* Organization Tab */}
        {activeTab === 'organization' && (
          <form onSubmit={handleOrgSubmit} className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
              <h3 className="text-amber-400 font-bold text-sm mb-2">Organization Request Process</h3>
              <p className="text-xs text-gray-400">After submission, our team will review and approve. Once approved, you'll receive an email with signup link to create your organization admin account.</p>
              <p className="text-xs text-amber-400 mt-2 font-medium">* You'll need to create a separate account for yourself as participant.</p>
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Organization Name</label>
              <input
                type="text"
                value={orgForm.orgName}
                onChange={(e) => setOrgForm(prev => ({ ...prev, orgName: e.target.value }))}
                className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition"
                placeholder="e.g., IIT Delhi Computer Science"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Organization Type</label>
              <select
                value={orgForm.orgType}
                onChange={(e) => setOrgForm(prev => ({ ...prev, orgType: e.target.value }))}
                className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition"
                required
              >
                <option value="">Select type...</option>
                <option value="COLLEGE">College</option>
                <option value="COMPANY">Company</option>
                <option value="INSTITUTE">Institute</option>
                <option value="UNIVERSITY">University</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Contact Person Name</label>
              <input
                type="text"
                value={orgForm.contactName}
                onChange={(e) => setOrgForm(prev => ({ ...prev, contactName: e.target.value }))}
                className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition"
                placeholder="e.g., Dr. Priya Sharma"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Contact Email</label>
              <input
                type="email"
                value={orgForm.contactEmail}
                onChange={(e) => setOrgForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition"
                placeholder="e.g. priya@iitd.ac.in"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Contact Phone (Optional)</label>
              <input
                type="tel"
                value={orgForm.contactPhone}
                onChange={(e) => setOrgForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition"
                placeholder="e.g. +91 9876543210"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Your Preferred Password</label>
              <input
                type="password"
                value={participantForm.password}
                onChange={(e) => setParticipantForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition"
                placeholder="Min 8 chars, 1 number, 1 special"
                required
              />
              <p className="text-[10px] text-gray-500 mt-1">This will be your login password</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-extrabold text-sm rounded-xl hover:from-blue-400 hover:to-cyan-400 transition shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Submitting Request...' : 'Submit Organization Request'}
            </button>
          </form>
        )}

        <p className="text-gray-400 text-center text-xs pt-2">
          Already have an account?{' '}
          <Link to="/login" className="text-amber-400 font-bold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
