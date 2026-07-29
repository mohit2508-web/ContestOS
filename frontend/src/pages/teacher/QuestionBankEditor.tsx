import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Globe,
  Building,
  Plus,
  Search,
  Copy,
  Edit2,
  Trash2,
  Lock,
  Sparkles,
  Layers,
  Code2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileCode,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotify } from '../../components/notifications';

interface TestCaseItem {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

interface ProblemItem {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  category: string;
  problemType: string;
  isPublic: boolean;
  organizationId: string | null;
  createdById?: string;
  organization?: { name: string };
  testCases?: TestCaseItem[];
  starterCode?: any;
  referenceSolution?: string;
  _count?: { testCases: number; contestProblems: number };
}

export const QuestionBankEditor: React.FC = () => {
  const { user } = useAuth();
  const notify = useNotify();
  const userHierarchy = user?.hierarchyLevel ?? 5; // 1 = super_admin, 2 = org_admin, 3 = org_member
  const isSuperAdmin = userHierarchy === 1;

  const [activeTab, setActiveTab] = useState<'private' | 'public'>('private');
  const [problems, setProblems] = useState<ProblemItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingProblem, setEditingProblem] = useState<ProblemItem | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDifficulty, setFormDifficulty] = useState('Medium');
  const [formCategory, setFormCategory] = useState('Algorithms');
  const [formProblemType, setFormProblemType] = useState('code');
  const [formIsPublic, setFormIsPublic] = useState(false);
  const [formJavaStarter, setFormJavaStarter] = useState('class Solution {\n    public int solve() {\n        return 0;\n    }\n}');
  const [formCppStarter, setFormCppStarter] = useState('class Solution {\npublic:\n    int solve() {\n        return 0;\n    }\n};');
  const [formPyStarter, setFormPyStarter] = useState('class Solution:\n    def solve(self):\n        return 0');
  const [formJsStarter, setFormJsStarter] = useState('function solve() {\n    return 0;\n}');
  const [formTestCases, setFormTestCases] = useState<TestCaseItem[]>([
    { input: '1 2', expectedOutput: '3', isHidden: false },
    { input: '5 10', expectedOutput: '15', isHidden: true },
  ]);
  const [saving, setSaving] = useState(false);

  // Map to Contest State
  const [showMapModal, setShowMapModal] = useState<boolean>(false);
  const [mappingProblem, setMappingProblem] = useState<ProblemItem | null>(null);
  const [userContests, setUserContests] = useState<any[]>([]);
  const [fetchingContests, setFetchingContests] = useState<boolean>(false);
  const [attachingContestId, setAttachingContestId] = useState<string | null>(null);

  useEffect(() => {
    fetchProblems();
  }, [activeTab, search, difficultyFilter, categoryFilter]);

  const handleOpenMapModal = async (prob: ProblemItem) => {
    setMappingProblem(prob);
    setShowMapModal(true);
    setFetchingContests(true);
    try {
      const res = await api.getTeacherManagedContests();
      setUserContests(res.contests || []);
    } catch (err) {
      notify.toast.error('Failed to load contests for question mapping');
    } finally {
      setFetchingContests(false);
    }
  };

  const handleAttachToContest = async (contestId: string) => {
    if (!mappingProblem) return;
    setAttachingContestId(contestId);
    try {
      await api.attachContestProblem(contestId, { problemId: mappingProblem.id, points: 100 });
      notify.toast.success(`Question "${mappingProblem.title}" mapped to contest! 🚀`);
      setShowMapModal(false);
    } catch (err: any) {
      notify.toast.error(err?.response?.data?.error || 'Failed to map problem to contest');
    } finally {
      setAttachingContestId(null);
    }
  };

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const res = await api.getProblems({
        bank: activeTab,
        search,
        difficulty: difficultyFilter !== 'all' ? difficultyFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
      });
      setProblems(res.problems || []);
    } catch (err) {
      console.error(err);
      notify.toast.error('Failed to load question bank');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingProblem(null);
    setFormTitle('');
    setFormDescription('');
    setFormDifficulty('Medium');
    setFormCategory('Algorithms');
    setFormProblemType('code');
    setFormIsPublic(activeTab === 'public' && isSuperAdmin);
    setFormTestCases([
      { input: '1 2', expectedOutput: '3', isHidden: false },
      { input: '5 10', expectedOutput: '15', isHidden: true },
    ]);
    setShowModal(true);
  };

  const handleOpenEditModal = async (prob: ProblemItem) => {
    try {
      const detailRes = await api.getProblem(prob.id);
      const fullProblem = detailRes.problem || prob;
      setEditingProblem(fullProblem);
      setFormTitle(fullProblem.title);
      setFormDescription(fullProblem.description || '');
      setFormDifficulty(fullProblem.difficulty || 'Medium');
      setFormCategory(fullProblem.category || 'Algorithms');
      setFormProblemType(fullProblem.problemType || 'code');
      setFormIsPublic(Boolean(fullProblem.isPublic));

      if (fullProblem.starterCode) {
        setFormJavaStarter(fullProblem.starterCode.java || '');
        setFormCppStarter(fullProblem.starterCode.cpp || '');
        setFormPyStarter(fullProblem.starterCode.python || '');
        setFormJsStarter(fullProblem.starterCode.javascript || '');
      }

      if (Array.isArray(fullProblem.testCases) && fullProblem.testCases.length > 0) {
        setFormTestCases(fullProblem.testCases);
      }

      setShowModal(true);
    } catch {
      notify.toast.error('Failed to fetch problem details for editing');
    }
  };

  const handleSaveProblem = async () => {
    if (!formTitle.trim() || !formDescription.trim()) {
      notify.toast.error('Title and Description are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formTitle,
        description: formDescription,
        difficulty: formDifficulty,
        category: formCategory,
        problemType: formProblemType,
        isPublic: formIsPublic,
        starterCode: {
          java: formJavaStarter,
          cpp: formCppStarter,
          python: formPyStarter,
          javascript: formJsStarter,
        },
        testCases: formTestCases,
      };

      if (editingProblem) {
        await api.updateProblem(editingProblem.id, payload);
        notify.toast.success('Problem updated successfully!');
      } else {
        await api.createProblem(payload);
        notify.toast.success('Problem created successfully!');
      }

      setShowModal(false);
      fetchProblems();
    } catch (err: any) {
      notify.toast.error(err?.response?.data?.error || 'Failed to save problem');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyProblem = async (probId: string) => {
    try {
      await api.copyPublicProblem(probId);
      notify.toast.success('Copied to your organization private bank! 🎉');
      if (activeTab === 'private') fetchProblems();
    } catch (err: any) {
      notify.toast.error(err?.response?.data?.error || 'Failed to copy problem');
    }
  };

  const handleDeleteProblem = async (probId: string) => {
    if (!confirm('Are you sure you want to delete this problem from the question bank?')) return;
    try {
      await api.deleteProblem(probId);
      notify.toast.success('Problem deleted');
      fetchProblems();
    } catch (err: any) {
      notify.toast.error(err?.response?.data?.error || 'Failed to delete problem');
    }
  };

  const handleAddTestCase = () => {
    setFormTestCases([...formTestCases, { input: '', expectedOutput: '', isHidden: false }]);
  };

  const handleRemoveTestCase = (index: number) => {
    setFormTestCases(formTestCases.filter((_, idx) => idx !== index));
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-white p-6 space-y-6">
      {/* Header Cockpit */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 rounded-xl border border-cyan-500/30 text-cyan-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">Question Bank Repository</h1>
              <p className="text-xs text-gray-400">Manage private institutional problems and platform public templates</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center space-x-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-500/20 transition-all text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Problem</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('private')}
            className={`flex items-center space-x-2.5 px-4 py-2.5 rounded-xl font-medium text-xs tracking-wide transition-all ${
              activeTab === 'private'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-inner'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Organization Private Bank</span>
          </button>

          <button
            onClick={() => setActiveTab('public')}
            className={`flex items-center space-x-2.5 px-4 py-2.5 rounded-xl font-medium text-xs tracking-wide transition-all ${
              activeTab === 'public'
                ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/40 shadow-inner'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Platform Public Bank</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="Search problems..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="all">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Problems Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
        </div>
      ) : problems.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10 space-y-3">
          <FileCode className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="text-base font-medium text-gray-300">No Problems Found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {activeTab === 'private'
              ? 'Your organization private question bank is currently empty.'
              : 'No platform public questions match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {problems.map((prob) => (
            <div
              key={prob.id}
              className="bg-white/5 border border-white/10 hover:border-cyan-500/30 rounded-2xl p-5 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                      prob.difficulty === 'Easy'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : prob.difficulty === 'Medium'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {prob.difficulty}
                  </span>

                  <span className="text-[10px] text-gray-400 font-mono px-2 py-0.5 bg-white/5 rounded-md border border-white/10">
                    {prob.category}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                    {prob.title}
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mt-1">slug: {prob.slug}</p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3 text-gray-400 font-mono text-[11px]">
                  <span>{prob._count?.testCases || 0} Testcases</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleOpenMapModal(prob)}
                    title="Map / Attach Question to Contest"
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Map</span>
                  </button>

                  {prob.isPublic && activeTab === 'public' && (
                    <button
                      onClick={() => handleCopyProblem(prob.id)}
                      title="Clone to Organization Private Bank"
                      className="p-2 hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-300 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenEditModal(prob)}
                    title="Edit Problem"
                    className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteProblem(prob.id)}
                    title="Delete Problem"
                    className="p-2 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Problem Creation / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0e121b] border border-white/15 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <Code2 className="w-5 h-5 text-cyan-400" />
                <span>{editingProblem ? 'Edit Problem' : 'Create Question Bank Problem'}</span>
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Title & Difficulty */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-gray-400 font-medium">Problem Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Two Sum III - Data Structure Design"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Difficulty</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Problem Statement (Markdown Supported) *</label>
                <textarea
                  rows={5}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Given an array of integers nums and an integer target, return indices..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
                />
              </div>

              {/* Bank Scope Toggle */}
              {isSuperAdmin && (
                <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-xl border border-white/10">
                  <input
                    type="checkbox"
                    id="isPublicCheck"
                    checked={formIsPublic}
                    onChange={(e) => setFormIsPublic(e.target.checked)}
                    className="rounded border-white/20 bg-black text-cyan-500 focus:ring-0"
                  />
                  <label htmlFor="isPublicCheck" className="text-gray-300 cursor-pointer select-none">
                    Make this problem available in the <strong className="text-purple-400">Platform Public Bank</strong> (All Organizations can view/copy)
                  </label>
                </div>
              )}

              {/* Test Cases Editor */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-gray-300 font-semibold">Test Cases ({formTestCases.length})</label>
                  <button
                    type="button"
                    onClick={handleAddTestCase}
                    className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Test Case</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {formTestCases.map((tc, idx) => (
                    <div key={idx} className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-400 font-mono">Test Case #{idx + 1}</span>
                        <div className="flex items-center space-x-3">
                          <label className="flex items-center space-x-1 cursor-pointer text-gray-400">
                            <input
                              type="checkbox"
                              checked={tc.isHidden}
                              onChange={(e) => {
                                const copy = [...formTestCases];
                                copy[idx].isHidden = e.target.checked;
                                setFormTestCases(copy);
                              }}
                              className="rounded border-white/20 bg-black text-amber-500 focus:ring-0"
                            />
                            <span>Hidden Test Case</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveTestCase(idx)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Input (e.g. 2 7 11 15\n9)"
                          value={tc.input}
                          onChange={(e) => {
                            const copy = [...formTestCases];
                            copy[idx].input = e.target.value;
                            setFormTestCases(copy);
                          }}
                          className="bg-black/60 border border-white/10 rounded-lg p-2 text-white font-mono text-[11px]"
                        />
                        <input
                          type="text"
                          placeholder="Expected Output (e.g. [0, 1])"
                          value={tc.expectedOutput}
                          onChange={(e) => {
                            const copy = [...formTestCases];
                            copy[idx].expectedOutput = e.target.value;
                            setFormTestCases(copy);
                          }}
                          className="bg-black/60 border border-white/10 rounded-lg p-2 text-white font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3 border-t border-white/10 pt-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-medium text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProblem}
                disabled={saving}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-medium text-xs shadow-lg shadow-cyan-500/20"
              >
                {saving ? 'Saving...' : 'Save Problem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAP QUESTION TO CONTEST MODAL */}
      {showMapModal && mappingProblem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0e121b] border border-white/15 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Map Question to Contest</h2>
                  <p className="text-xs text-gray-400 font-mono mt-0.5 line-clamp-1">{mappingProblem.title}</p>
                </div>
              </div>
              <button
                onClick={() => setShowMapModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {fetchingContests ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-400"></div>
              </div>
            ) : userContests.length === 0 ? (
              <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                <p className="text-gray-300 font-medium text-sm">No Active Contests Found</p>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Create a contest first in Contest Management before mapping questions to it.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                <p className="text-xs text-gray-400">Select an assessment contest below to attach this question:</p>
                {userContests.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 bg-white/5 border border-white/10 hover:border-emerald-500/40 rounded-2xl flex items-center justify-between transition-all"
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-sm">{c.title}</h4>
                      <div className="flex items-center space-x-3 text-[11px] font-mono text-gray-400">
                        <span>Duration: {c.duration} mins</span>
                        <span>•</span>
                        <span>{c._count?.problems || 0} Questions Mapped</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAttachToContest(c.id)}
                      disabled={attachingContestId === c.id}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all disabled:opacity-40 shrink-0"
                    >
                      {attachingContestId === c.id ? 'Mapping...' : 'Attach Question'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end border-t border-white/10 pt-4">
              <button
                onClick={() => setShowMapModal(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-medium text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBankEditor;
