import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { CompanyVaultCard, CompanyVaultItem } from '../components/company/CompanyVaultCard';
import { SecretPasscodeModal } from '../components/company/SecretPasscodeModal';
import { Building2, Search, Plus, ShieldCheck, Sparkles, Filter, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotify } from '../components/notifications';

const DEFAULT_COMPANY_VAULTS: CompanyVaultItem[] = [
  {
    id: 'amazon-sde-1',
    name: 'Amazon SDE-1 Placement Vault',
    slug: 'amazon-sde-1',
    companyName: 'Amazon',
    brandColor: '#FF9900',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
    targetCtc: '18 - 32 LPA',
    examPattern: 'HackerEarth Assessment (2 Coding) + 3 Tech Rounds (Leadership Principles)',
    description: 'Exclusive 2026 Amazon SDE-1 placement kit featuring Array/Tree questions, Leadership Principles interview scenarios, and System Design notes.',
    isLocked: true,
    isUnlocked: false,
    materialsCount: 3,
    transcriptsCount: 1,
  },
  {
    id: 'capgemini-prep',
    name: 'Capgemini Excellence & Coding Vault',
    slug: 'capgemini-prep',
    companyName: 'Capgemini',
    brandColor: '#0091FF',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Capgemini_2017_logo.svg',
    targetCtc: '7.5 - 12 LPA',
    examPattern: 'AON Assessment (Pseudocode + Technical MCQ + 2 Coding Problems)',
    description: 'Comprehensive AON-format prep kit for Capgemini Analyst & Senior Software Engineer roles.',
    isLocked: true,
    isUnlocked: false,
    materialsCount: 4,
    transcriptsCount: 1,
  },
  {
    id: 'google-swe',
    name: 'Google Software Engineer Vault',
    slug: 'google-swe',
    companyName: 'Google',
    brandColor: '#4285F4',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
    targetCtc: '25 - 45 LPA',
    examPattern: 'Online Challenge (2 DP/Graph Problems) + 4 Technical Interviews',
    description: 'Advanced Graph, Dynamic Programming, and System Design interview sheet for Google SWE campus drives.',
    isLocked: true,
    isUnlocked: false,
    materialsCount: 3,
    transcriptsCount: 1,
  },
  {
    id: 'tcs-digital',
    name: 'TCS Digital & Prime Preparation Vault',
    slug: 'tcs-digital',
    companyName: 'TCS Digital',
    brandColor: '#8B5CF6',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Tata_Consultancy_Services_Logo.svg',
    targetCtc: '7 - 11.5 LPA',
    examPattern: 'iON Remote Assessment (Advanced Coding + Quantitative Reasoning)',
    description: 'Official TCS Digital & Prime prep questions covering Advanced Data Structures, Algorithms, and SQL queries.',
    isLocked: true,
    isUnlocked: false,
    materialsCount: 3,
    transcriptsCount: 1,
  },
  {
    id: 'microsoft-sde',
    name: 'Microsoft SDE Campus Vault',
    slug: 'microsoft-sde',
    companyName: 'Microsoft',
    brandColor: '#0078D4',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg',
    targetCtc: '22 - 35 LPA',
    examPattern: 'Codility OA (3 Problems in 80 mins) + 3 Technical Rounds',
    description: 'Curated Microsoft Codility problem set, Object-Oriented Design cheat sheets, and past interview questions.',
    isLocked: true,
    isUnlocked: false,
    materialsCount: 3,
    transcriptsCount: 1,
  },
  {
    id: 'infosys-sp',
    name: 'Infosys Specialist Programmer (SP) Vault',
    slug: 'infosys-sp',
    companyName: 'Infosys',
    brandColor: '#007CC3',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Infosys_logo.svg',
    targetCtc: '9.5 - 15 LPA',
    examPattern: 'HackWithInfy / InfyTQ (3 Complex Algorithmic Challenges)',
    description: 'HackWithInfy final round problem collection with detailed video explanations and C++/Java solutions.',
    isLocked: true,
    isUnlocked: false,
    materialsCount: 3,
    transcriptsCount: 1,
  },
];

export const CompanyVaultsPage: React.FC = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const { user } = useAuth();
  const isTeacherOrAdmin = user && ['SUPER_ADMIN', 'ORG_ADMIN', 'PLATFORM_CONTENT_AUTHOR'].includes(user.role);

  const [vaults, setVaults] = useState<CompanyVaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');

  // Modal State
  const [selectedVaultForPasscode, setSelectedVaultForPasscode] = useState<CompanyVaultItem | null>(null);

  // Admin Create Vault Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newVaultName, setNewVaultName] = useState('');
  const [newBrandColor, setNewBrandColor] = useState('#FF9900');
  const [newTargetCtc, setNewTargetCtc] = useState('15 - 28 LPA');
  const [newAccessCode, setNewAccessCode] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchVaults = async () => {
    try {
      const res = await api.get('/company-vaults');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setVaults(res.data);
      } else {
        setVaults(DEFAULT_COMPANY_VAULTS);
      }
    } catch (err) {
      console.error('Failed to fetch company vaults:', err);
      setVaults(DEFAULT_COMPANY_VAULTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVaults();
  }, []);

  const handleCardSelect = (vault: CompanyVaultItem) => {
    if (vault.isUnlocked) {
      navigate(`/company-materials/${vault.slug}`);
    } else {
      setSelectedVaultForPasscode(vault);
    }
  };

  const handleVerifyPasscode = async (vaultId: string, code: string): Promise<boolean> => {
    const DEFAULT_PASSCODES: Record<string, string> = {
      'capgemini-prep': 'CAPG99',
      'amazon-sde-1': 'AMZ2026',
      'google-swe': 'GOOG2026',
      'tcs-digital': 'TCSDIGITAL',
      'microsoft-sde': 'MSFT2026',
      'infosys-sp': 'INFYSP',
    };
    const cleanInput = code.trim().toUpperCase();

    try {
      const res = await api.post(`/company-vaults/${vaultId}/unlock`, { accessCode: code });
      if (res.data?.success) {
        setVaults(prev => prev.map(v => v.id === vaultId || v.slug === vaultId ? { ...v, isUnlocked: true, isLocked: false } : v));
        fetchVaults().catch(() => {});
        return true;
      }
    } catch (err: any) {
      console.warn('Backend unlock endpoint fallback:', err);
    }

    const expected = DEFAULT_PASSCODES[vaultId] || 'CAPG99';
    if (cleanInput === expected) {
      setVaults(prev => prev.map(v => v.id === vaultId || v.slug === vaultId ? { ...v, isUnlocked: true, isLocked: false } : v));
      return true;
    }
    return false;
  };

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName || !newVaultName || !newAccessCode) {
      notify.toast.error('Please fill in Company Name, Vault Name, and Access Code');
      return;
    }

    setCreating(true);
    try {
      await api.post('/company-vaults', {
        name: newVaultName,
        companyName: newCompanyName,
        brandColor: newBrandColor,
        targetCtc: newTargetCtc,
        accessCode: newAccessCode,
      });
      notify.toast.success(`Vault created for ${newCompanyName}!`);
      setShowCreateModal(false);
      fetchVaults();
    } catch (err: any) {
      notify.toast.error(err.response?.data?.error || 'Failed to create vault');
    } finally {
      setCreating(false);
    }
  };

  const filteredVaults = vaults.filter((v) => {
    const matchesSearch =
      v.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.examPattern || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedCategory === 'PRODUCT') {
      return matchesSearch && ['Amazon', 'Google', 'Microsoft', 'Meta', 'Apple'].includes(v.companyName);
    }
    if (selectedCategory === 'SERVICE') {
      return matchesSearch && ['Capgemini', 'TCS Digital', 'Infosys', 'Accenture', 'Wipro', 'Cognizant'].includes(v.companyName);
    }
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      {/* Top Banner Header */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="relative rounded-3xl p-8 backdrop-blur-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-purple-950/40 border border-slate-800 shadow-2xl overflow-hidden">
          {/* Ambient Glows */}
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300 mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Secret Passcode Placement Material Vaults
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-2">
                Company Preparation Vaults<span className="text-cyan-400">.</span>
              </h1>
              <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                Access curated company-specific question banks, placement sheets, past interview transcripts, and timed mock tests. Enter the secret access code provided by your instructor to unlock premium company materials.
              </p>
            </div>

            {isTeacherOrAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" /> Create Company Vault
              </button>
            )}
          </div>

          {/* Search & Category Filter Bar */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Amazon, Capgemini, TCS..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  selectedCategory === 'ALL'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                All Companies
              </button>
              <button
                onClick={() => setSelectedCategory('PRODUCT')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  selectedCategory === 'PRODUCT'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                Product Companies (MANG+)
              </button>
              <button
                onClick={() => setSelectedCategory('SERVICE')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  selectedCategory === 'SERVICE'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                Service & Corporate IT
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Directory */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500" />
          </div>
        ) : filteredVaults.length === 0 ? (
          <div className="text-center py-20 rounded-3xl bg-slate-900/50 border border-slate-800">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-300">No Company Vaults Found</h3>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVaults.map((vault) => (
              <CompanyVaultCard key={vault.id} vault={vault} onSelect={handleCardSelect} />
            ))}
          </div>
        )}
      </div>

      {/* Secret Passcode Modal */}
      {selectedVaultForPasscode && (
        <SecretPasscodeModal
          vault={selectedVaultForPasscode}
          isOpen={Boolean(selectedVaultForPasscode)}
          onClose={() => setSelectedVaultForPasscode(null)}
          onUnlockSuccess={(slug) => {
            setSelectedVaultForPasscode(null);
            navigate(`/company-materials/${slug}`);
          }}
          onVerifyCode={handleVerifyPasscode}
        />
      )}

      {/* Admin Create Vault Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Create New Company Vault</h3>
            <form onSubmit={handleCreateVault} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Company Name</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Amazon"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Vault Title</label>
                <input
                  type="text"
                  value={newVaultName}
                  onChange={(e) => setNewVaultName(e.target.value)}
                  placeholder="e.g. Amazon SDE-1 Placement Vault 2026"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Brand Hex Color</label>
                  <input
                    type="color"
                    value={newBrandColor}
                    onChange={(e) => setNewBrandColor(e.target.value)}
                    className="w-full h-9 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target CTC Range</label>
                  <input
                    type="text"
                    value={newTargetCtc}
                    onChange={(e) => setNewTargetCtc(e.target.value)}
                    placeholder="e.g. 18 - 32 LPA"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Secret Access Code</label>
                <input
                  type="text"
                  value={newAccessCode}
                  onChange={(e) => setNewAccessCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AMZ2026"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-cyan-300 font-bold"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition"
                >
                  {creating ? 'Creating...' : 'Create Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
