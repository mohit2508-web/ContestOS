import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeacherProblemListPage } from './ProblemList';

interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  scope: 'PLATFORM_GLOBAL' | 'TENANT_PRIVATE' | 'SHARED_CONTRIBUTED';
  organizationId?: string | null;
  _count?: { questions: number };
}

export const QuestionBankPage: React.FC = () => {
  const [mainType, setMainType] = useState<'CODING' | 'MCQ'>('CODING');
  const [activeTab, setActiveTab] = useState<'TENANT_PRIVATE' | 'PLATFORM_GLOBAL' | 'SHARED_CONTRIBUTED'>('TENANT_PRIVATE');
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/governance/banks');
      const data = await res.json();
      if (data.success && Array.isArray(data.banks) && data.banks.length > 0) {
        setBanks(data.banks);
      } else {
        // Fallback default banks
        setBanks([
          {
            id: 'bank-1',
            name: 'Organization Technical Question Bank',
            description: 'Private technical MCQs & interactive questions for CS, IT & Engineering hiring rounds.',
            scope: 'TENANT_PRIVATE',
            organizationId: 'org-iitd',
            _count: { questions: 42 },
          },
          {
            id: 'bank-2',
            name: 'ContestOS Standard Aptitude & Verbal Bank',
            description: 'Platform-curated & psychometrically validated aptitude & reasoning bank.',
            scope: 'PLATFORM_GLOBAL',
            organizationId: null,
            _count: { questions: 250 },
          },
          {
            id: 'bank-3',
            name: 'Shared Community Contributed Pool',
            description: 'Anonymized community-contributed technical questions shared across tenants.',
            scope: 'SHARED_CONTRIBUTED',
            organizationId: null,
            _count: { questions: 88 },
          },
        ]);
      }
    } catch {
      setBanks([
        {
          id: 'bank-1',
          name: 'Organization Technical Question Bank',
          description: 'Private technical MCQs & interactive questions for CS, IT & Engineering hiring rounds.',
          scope: 'TENANT_PRIVATE',
          organizationId: 'org-iitd',
          _count: { questions: 42 },
        },
        {
          id: 'bank-2',
          name: 'ContestOS Standard Aptitude & Verbal Bank',
          description: 'Platform-curated & psychometrically validated aptitude & reasoning bank.',
          scope: 'PLATFORM_GLOBAL',
          organizationId: null,
          _count: { questions: 250 },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  const filteredBanks = banks.filter((b) => b.scope === activeTab);

  return (
    <div className="p-6">
      {/* Top Switcher: Coding (DSA/SQL/WebDev) vs MCQ Governance */}
      <div className="flex items-center space-x-3 mb-6 border-b border-white/10 pb-4">
        <button
          type="button"
          onClick={() => setMainType('CODING')}
          className={`px-5 py-2 text-sm font-bold rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
            mainType === 'CODING'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>💻</span>
          <span>DSA, SQL & WebDev Coding Problems</span>
        </button>

        <button
          type="button"
          onClick={() => setMainType('MCQ')}
          className={`px-5 py-2 text-sm font-bold rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
            mainType === 'MCQ'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>📝</span>
          <span>MCQ & Multi-Tenant Question Banks</span>
        </button>
      </div>

      {mainType === 'CODING' ? (
        <TeacherProblemListPage />
      ) : (
        <>
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-1">
                Multi-Tenant Question Banks<span className="text-[var(--accent-green)]">.</span>
              </h2>
              <p className="text-gray-400 font-medium text-xs">
                Role-based multi-tenant repositories, platform-curated banks & contributed question pools.
              </p>
            </div>
            <Link
              to="/governance/authoring"
              className="px-4 py-2 bg-[var(--accent-green)] text-white font-semibold rounded-lg hover:opacity-90 transition flex items-center gap-2 text-xs"
            >
              <span>+</span>
              <span>New Question Draft</span>
            </Link>
          </div>

          {/* Scope Navigation Tabs */}
          <div className="flex items-center gap-1 mb-6 bg-[var(--bg-card)] border border-white/10 rounded-lg p-1 w-fit">
            {[
              { id: 'TENANT_PRIVATE', label: 'Tenant Private Bank', count: banks.filter((b) => b.scope === 'TENANT_PRIVATE').length },
              { id: 'PLATFORM_GLOBAL', label: 'Platform Global Bank', count: banks.filter((b) => b.scope === 'PLATFORM_GLOBAL').length },
              { id: 'SHARED_CONTRIBUTED', label: 'Shared Contributed Pool', count: banks.filter((b) => b.scope === 'SHARED_CONTRIBUTED').length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[var(--accent-blue)] text-white font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-60">({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Bank Cards Grid */}
          {loading ? (
            <div className="bg-white/5 rounded-lg h-64 animate-pulse" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBanks.map((bank) => (
                <div
                  key={bank.id}
                  className="bg-[var(--bg-card)] border border-white/10 rounded-xl p-5 hover:border-white/20 transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs px-2 py-0.5 rounded font-bold border border-blue-500/30 text-blue-400 bg-blue-500/10">
                        {bank.scope.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                        {bank._count?.questions || 0} Questions
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white tracking-tight">{bank.name}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">{bank.description}</p>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-gray-500">RBAC Scoped Isolation</span>
                    <Link
                      to="/governance/authoring"
                      className="text-xs font-semibold px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition"
                    >
                      Manage Bank →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
