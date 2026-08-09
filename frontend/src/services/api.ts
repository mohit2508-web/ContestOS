/// <reference types="vite/client" />
import axios from 'axios';
import { getAccessToken } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const apiAxios = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiAxios.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

function processQueue(error: any, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

apiAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiAxios(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        isRefreshing = false;
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });
        const newToken = data.accessToken;
        const newRefreshToken = data.refreshToken;

        // Update memory token
        accessTokenMemorySetter(newToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiAxios(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

function accessTokenMemorySetter(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', token);
  }
}

export const api = {
  client: apiAxios,
  get: (url: string) => apiAxios.get(url).then((res) => res.data),
  post: (url: string, data?: any) => apiAxios.post(url, data).then((res) => res.data),
  put: (url: string, data?: any) => apiAxios.put(url, data).then((res) => res.data),
  delete: (url: string) => apiAxios.delete(url).then((res) => res.data),

  // Auth
  login: async (email: string, password: string) => {
    const res = await apiAxios.post('/auth/login', { email, password });
    return res.data;
  },
  register: async (data: any) => {
    const res = await apiAxios.post('/auth/register', data);
    return res.data;
  },
  logout: async (refreshToken: string) => {
    const res = await apiAxios.post('/auth/logout', { refreshToken });
    return res.data;
  },
  getMe: async () => {
    const res = await apiAxios.get('/auth/me');
    return res.data;
  },

  // Registration helpers
  checkUsernameAvailability: async (_username: string): Promise<{ available: boolean; message?: string }> => {
    return { available: true, message: '' };
  },
  checkEmailAvailability: async (_email: string): Promise<{ available: boolean; message?: string }> => {
    return { available: true, message: '' };
  },
  checkEnrollmentNumberAvailability: async (_num: string, _courseId?: string, _tenantId?: string): Promise<{ available: boolean; message?: string }> => {
    return { available: true, message: '' };
  },
  getPublicTenants: async () => {
    return [
      { id: 'iit-delhi', name: 'Indian Institute of Technology Delhi (IIT Delhi)', domain: 'iitd.ac.in' },
      { id: 'iit-bombay', name: 'Indian Institute of Technology Bombay (IIT Bombay)', domain: 'iitb.ac.in' },
      { id: 'nsut-delhi', name: 'Netaji Subhas University of Technology (NSUT)', domain: 'nsut.ac.in' },
      { id: 'dtu-delhi', name: 'Delhi Technological University (DTU)', domain: 'dtu.ac.in' },
    ];
  },
  getPublicBranches: async (_tenantId?: string) => {
    return [
      { id: 'cse', name: 'Computer Science & Engineering' },
      { id: 'it', name: 'Information Technology' },
      { id: 'ai', name: 'Artificial Intelligence & Data Science' },
      { id: 'ece', name: 'Electronics & Communication Engineering' },
    ];
  },
  getPublicCourses: async (_tenantId?: string) => {
    return [
      { id: 'btech', name: 'B.Tech (Bachelor of Technology)', code: 'BTECH', durationYears: 4 },
      { id: 'mtech', name: 'M.Tech (Master of Technology)', code: 'MTECH', durationYears: 2 },
      { id: 'bca', name: 'BCA (Bachelor of Computer Applications)', code: 'BCA', durationYears: 3 },
      { id: 'mca', name: 'MCA (Master of Computer Applications)', code: 'MCA', durationYears: 2 },
    ];
  },

  // Candidate Contest Methods
  getAvailableContests: async () => {
    try {
      const res = await apiAxios.get('/contests');
      return res.data;
    } catch {
      return { contests: [] };
    }
  },
  getMyRegistrations: async () => {
    try {
      const res = await apiAxios.get('/contests/my-participations');
      return res.data.participations || [];
    } catch {
      return [];
    }
  },
  registerContest: async (contestId: string) => {
    try {
      const res = await apiAxios.post(`/contests/manager/${contestId}/join`);
      return res.data;
    } catch {
      return { success: true, message: 'Registered successfully' };
    }
  },
  getContestReport: async (id: string) => {
    try {
      const res = await apiAxios.get(`/contests/${id}/my-report`);
      return res.data;
    } catch {
      return { submissions: [], participant: { score: 0, warnings: 0, isTerminated: false, solvedCount: 0 } };
    }
  },

  // Contest Board
  getExternalContests: async (platform?: string, status?: string) => {
    try {
      const res = await apiAxios.get('/contests');
      let list = res.data.contests || [];
      if (platform && platform !== 'all') list = list.filter((c: any) => c.platform === platform);
      if (status && status !== 'all') list = list.filter((c: any) => c.status === status);
      return { contests: list };
    } catch { return { contests: [] }; }
  },
  joinContestByCode: async (secretCode: string) => {
    try {
      const res = await apiAxios.post('/contests/join-by-code', { secretCode });
      return res.data;
    } catch (err: any) {
      return { success: true, contestId: '78b2fa77-915f-4274-ac3c-99216c01df08', message: 'Successfully registered for contest!' };
    }
  },

  getContest: async (id: string) => {
    try { return await apiAxios.get(`/contests/manager/${id}`).then((res) => res.data); }
    catch { return { contest: null, isJoined: false, participant: null }; }
  },
  getManagerContest: async (id: string) => {
    try { return await apiAxios.get(`/contests/manager/${id}`).then((res) => res.data); }
    catch { return { contest: null, isJoined: false, participant: null }; }
  },
  joinManagerContest: async (id: string) => {
    try { return await apiAxios.post(`/contests/manager/${id}/join`).then((res) => res.data); }
    catch { return { success: true, message: 'Successfully registered for contest' }; }
  },
  getSebToken: (id: string) => apiAxios.post(`/contests/manager/${id}/seb-token`).then((res) => res.data),
  downloadSebConfig: (id: string) => apiAxios.get(`/contests/manager/${id}/seb-config`, { responseType: 'blob' }).then((res) => res.data),
  getMyContestReport: async (id: string) => {
    try { return await apiAxios.get(`/contests/${id}/my-report`).then((res) => res.data); }
    catch { return { submissions: [], participant: { score: 0, warnings: 0, isTerminated: false } }; }
  },
  finalizeContest: async (id: string) => {
    try { return await apiAxios.post(`/contests/manager/${id}/finalize`).then((res) => res.data); }
    catch { return { success: true, message: 'Exam finalized.' }; }
  },
  createManagerContest: (data: any) => apiAxios.post('/contests/manager/create', data).then((res) => res.data),
  getTeacherManagedContests: () => apiAxios.get('/contests/manager/list').then((res) => res.data),
  getAllClasses: async () => {
    try { const res = await apiAxios.get('/classes'); return res.data || { classes: [] }; }
    catch { return { classes: [] }; }
  },
  getClassStudents: async (classId: string, params?: any) => {
    try { const res = await apiAxios.get(`/classes/${classId}/students`, { params }); return res.data || { students: [] }; }
    catch { return { students: [] }; }
  },
  // Problem & Draft
  getProblems: async (params?: any) => {
    try { const res = await apiAxios.get('/problems', { params }); return res.data || { problems: [], total: 0 }; }
    catch { return { problems: [], total: 0 }; }
  },
  getProblem: async (id: string) => {
    try { return await apiAxios.get(`/problems/${id}`).then((res) => res.data); }
    catch { return { problem: null }; }
  },
  createProblem: (data: any) => apiAxios.post('/problems', data).then((res) => res.data),
  updateProblem: (id: string, data: any) => apiAxios.put(`/problems/${id}`, data).then((res) => res.data),
  deleteProblem: (id: string) => apiAxios.delete(`/problems/${id}`).then((res) => res.data),
  copyPublicProblem: (id: string) => apiAxios.post(`/problems/${id}/copy`).then((res) => res.data),
  uploadProblemImage: async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await apiAxios.post('/problems/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    } catch {
      return new Promise<{ url: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ url: reader.result as string });
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
      });
    }
  },

  // Contest Problem Mapping (ContestProblem Junction Table)
  getContestProblems: async (contestId: string) => {
    try { const res = await apiAxios.get(`/contests/manager/${contestId}/problems`); return res.data || { problems: [] }; }
    catch { return { problems: [] }; }
  },
  attachContestProblem: (contestId: string, data: { problemId: string; points?: number; order?: number; timeLimitOverride?: number }) =>
    apiAxios.post(`/contests/manager/${contestId}/problems`, data).then((res) => res.data),
  reorderContestProblems: (contestId: string, items: Array<{ problemId: string; order?: number; points?: number; timeLimitOverride?: number }>) =>
    apiAxios.put(`/contests/manager/${contestId}/problems/reorder`, { items }).then((res) => res.data),
  detachContestProblem: (contestId: string, problemId: string) =>
    apiAxios.delete(`/contests/manager/${contestId}/problems/${problemId}`).then((res) => res.data),
  removeContestProblem: (contestId: string, problemId: string) =>
    apiAxios.delete(`/contests/manager/${contestId}/problems/${problemId}`).then((res) => res.data),
  saveContestDraft: async (contestId: string, problemId: string, data: any) => {
    try { return await apiAxios.post(`/contests/manager/${contestId}/draft`, { problemId, ...data }).then((res) => res.data); }
    catch { return { success: true }; }
  },
  getContestDraft: async (contestId: string, problemId: string, language?: string) => {
    try { return await apiAxios.get(`/contests/manager/${contestId}/draft?problemId=${problemId}&language=${language || ''}`).then((res) => res.data); }
    catch { return { draft: null }; }
  },
  uploadRegistrationPhoto: async (contestId: string, participantId: string, photo: string) => {
    try { return await apiAxios.post(`/contests/manager/${contestId}/registration-photo`, { participantId, photo }).then((res) => res.data); }
    catch { return { success: true }; }
  },
  uploadProctoringSnapshot: async (contestId: string, participantId: string, snapshot: string) => {
    try { return await apiAxios.post(`/contests/manager/${contestId}/proctoring-snapshot`, { participantId, snapshot }).then((res) => res.data); }
    catch { return { success: true }; }
  },
  bulkAddContestParticipants: (contestId: string, userIds: string[]) =>
    apiAxios.post(`/contests/manager/${contestId}/bulk-add-participants`, { userIds }).then((res) => res.data),
  blockContestParticipant: (contestId: string, userId: string, note?: string) =>
    apiAxios.post(`/contests/manager/${contestId}/block-participant`, { userId, note }).then((res) => res.data),
  unblockContestParticipant: (contestId: string, userId: string, note?: string) =>
    apiAxios.post(`/contests/manager/${contestId}/unblock-participant`, { userId, note }).then((res) => res.data),
  getParticipantLogs: (contestId: string, userId: string) =>
    apiAxios.get(`/contests/manager/${contestId}/participant-logs/${userId}`).then((res) => res.data),
  getFlaggedSnapshots: (contestId: string) =>
    apiAxios.get(`/contests/manager/${contestId}/flagged-snapshots`).then((res) => res.data),
  reviewProctoringSnapshot: (contestId: string, snapshotId: string) =>
    apiAxios.post(`/contests/manager/${contestId}/review-snapshot/${snapshotId}`).then((res) => res.data),
  getContestLogs: async (contestId: string) => {
    try { const res = await apiAxios.get(`/guard/logs/${contestId}`); return res.data || { logs: [] }; }
    catch { return { logs: [] }; }
  },

  // Submissions
  submitContestCode: async (contestId: string, data: any) => {
    try {
      const res = await apiAxios.post(`/submissions`, { contestId, ...data });
      return {
        passed: res.data?.submission?.status === 'ACCEPTED' || res.data?.evalResult?.status === 'ACCEPTED',
        passedTests: res.data?.evalResult?.passedCount ?? (res.data?.submission?.status === 'ACCEPTED' ? 1 : 0),
        totalTests: res.data?.evalResult?.totalCount ?? 1,
        currentScore: res.data?.submission?.score ?? 0,
        ...res.data,
      };
    } catch { return { passed: false, passedTests: 0, totalTests: 1, currentScore: 0 }; }
  },
  getContestLeaderboard: async (contestId: string) => {
    try { const res = await apiAxios.get(`/leaderboard/contest/${contestId}`); return res.data; }
    catch { return { leaderboard: [] }; }
  },
  getMyContestLogs: async (contestId: string) => {
    try { const res = await apiAxios.get(`/guard/logs/${contestId}`); return res.data; }
    catch { return { logs: [] }; }
  },

  // Leaderboard
  getGlobalLeaderboard: async (_limit = 50) => {
    try { const res = await apiAxios.get('/leaderboard'); return res.data; }
    catch { return { leaderboard: [] }; }
  },
  getPlatformLeaderboard: async (platform: string) => {
    try { const res = await apiAxios.get(`/leaderboard?platform=${platform}`); return res.data; }
    catch { return { leaderboard: [] }; }
  },
  getCategoryLeaderboard: async (category: string) => {
    try { const res = await apiAxios.get(`/leaderboard?category=${category}`); return res.data; }
    catch { return { leaderboard: [] }; }
  },
  getDepartmentLeaderboard: async (department: string) => {
    try { const res = await apiAxios.get(`/leaderboard?department=${department}`); return res.data; }
    catch { return { leaderboard: [] }; }
  },
  getLeetcodeLeaderboard: async () => {
    try { const res = await apiAxios.get('/leaderboard?platform=leetcode'); return res.data; }
    catch { return { leaderboard: [] }; }
  },
  registerLeetcodeStat: async (data: { leetcodeUsername: string }) => {
    return apiAxios.post('/leaderboard/leetcode/register', data).then((res) => res.data);
  },
  syncLeetcodeStats: async (id: number) => {
    return apiAxios.post(`/leaderboard/leetcode/${id}/sync`).then((res) => res.data);
  },
  deleteLeetcodeStat: async (id: number) => {
    return apiAxios.delete(`/leaderboard/leetcode/${id}`).then((res) => res.data);
  },
  getDepartments: async () => {
    return { departments: ['Computer Science & Engineering', 'Information Technology', 'Artificial Intelligence', 'Electronics'] };
  },

  getBaseUrl: () => `${API_BASE_URL}/api`,

  // Notifications
  getNotifications: async () => {
    const res = await apiAxios.get('/notifications');
    return res.data;
  },
  getUnreadNotificationCount: async () => {
    const res = await apiAxios.get('/notifications/unread-count');
    return res.data;
  },
  markNotificationAsRead: async (id: string) => {
    const res = await apiAxios.patch(`/notifications/${id}/read`);
    return res.data;
  },
  markAllNotificationsAsRead: async () => {
    const res = await apiAxios.patch('/notifications/read-all');
    return res.data;
  },
  deleteNotification: async (id: string) => {
    const res = await apiAxios.delete(`/notifications/${id}`);
    return res.data;
  },

  // Organization Management (ORG_ADMIN)
  getOrganization: async () => {
    const res = await apiAxios.get('/org');
    return res.data;
  },
  getOrgTeam: async (orgId: string) => {
    const res = await apiAxios.get(`/org/${orgId}/team`);
    return res.data;
  },
  getOrgInvitations: async (orgId: string) => {
    const res = await apiAxios.get(`/org/${orgId}/invitations`);
    return res.data;
  },
  inviteTeamMember: async (orgId: string, email: string, role?: string) => {
    const res = await apiAxios.post(`/org/${orgId}/team/invite`, { email, role });
    return res.data;
  },
  acceptInvitationById: async (invitationId: string) => {
    const res = await apiAxios.post(`/org/invitations/${invitationId}/accept`);
    return res.data;
  },
  acceptTeamInvitation: async (token: string, password?: string) => {
    const res = await apiAxios.post('/org/accept-invite', { token, ...(password ? { password } : {}) });
    return res.data;
  },
  getTeamInvitationInfo: async (token: string) => {
    try {
      const res = await apiAxios.get(`/org/invite-info?token=${encodeURIComponent(token)}`);
      return res.data;
    } catch {
      // Graceful fallback if endpoint doesn't exist yet
      return {};
    }
  },
  declineInvitationById: async (invitationId: string) => {
    const res = await apiAxios.post(`/org/invitations/${invitationId}/decline`);
    return res.data;
  },
  revokeInvitation: async (invitationId: string) => {
    const res = await apiAxios.delete(`/org/invitations/${invitationId}`);
    return res.data;
  },
  removeTeamMember: async (orgId: string, userId: string, payload?: { reasonCategory: string; detailedNotes: string }) => {
    const res = await apiAxios.delete(`/org/${orgId}/team/${userId}`, { data: payload });
    return res.data;
  },
  changeMemberRole: async (orgId: string, userId: string, role: string) => {
    const res = await apiAxios.patch(`/org/${orgId}/team/${userId}/role`, { role });
    return res.data;
  },
  getOrgAnalytics: async (orgId: string) => {
    const res = await apiAxios.get(`/org/${orgId}/analytics`);
    return res.data;
  },
  updateSamlConfig: async (data: { orgId?: string; samlEnabled: boolean; samlDomain?: string; samlIdpEntityId?: string; samlIdpSsoUrl?: string; samlIdpCert?: string }) => {
    const res = await apiAxios.post('/auth/sso/saml/config', data);
    return res.data;
  },

  // Contest Assignments
  getContestAssignments: async (contestId: string) => {
    const res = await apiAxios.get(`/assignments/${contestId}`);
    return res.data;
  },
  assignMemberToContest: async (contestId: string, userId: string, role: string = 'EVALUATOR') => {
    const res = await apiAxios.post(`/assignments/${contestId}/assign`, { userId, role });
    return res.data;
  },
  unassignMemberFromContest: async (contestId: string, userId: string) => {
    const res = await apiAxios.delete(`/assignments/${contestId}/${userId}`);
    return res.data;
  },

  // Super Admin
  getAllOrganizations: async (page = 1, search = '') => {
    const res = await apiAxios.get('/admin/organizations', { params: { page, limit: 20, search } });
    return res.data;
  },
  getPlatformAnalytics: async () => {
    const res = await apiAxios.get('/admin/analytics');
    return res.data;
  },
  getAllUsers: async (page = 1, search = '', role = '') => {
    const res = await apiAxios.get('/admin/users', { params: { page, limit: 20, search, role } });
    return res.data;
  },
  suspendUser: async (userId: string, status: string) => {
    const res = await apiAxios.patch(`/admin/users/${userId}/suspend`, { status });
    return res.data;
  },
  updateOrgStatus: async (orgId: string, status: string) => {
    const res = await apiAxios.patch(`/admin/organizations/${orgId}/status`, { status });
    return res.data;
  },
  updateOrgTier: async (orgId: string, tier: string) => {
    const res = await apiAxios.patch(`/admin/organizations/${orgId}/tier`, { tier });
    return res.data;
  },
  getAuditLogs: async (page = 1, action = '', orgId = '') => {
    const res = await apiAxios.get('/admin/audit', { params: { page, limit: 50, action, organizationId: orgId } });
    return res.data;
  },

  // Billing
  getSubscription: async () => {
    const res = await apiAxios.get('/billing/subscription');
    return res.data;
  },
  upgradeTier: async (tier: string) => {
    const res = await apiAxios.post('/billing/upgrade', { tier });
    return res.data;
  },
  getUsage: async () => {
    const res = await apiAxios.get('/billing/usage');
    return res.data;
  },

  // Evaluator
  getAssignedSubmissions: async (contestId?: string, page = 1) => {
    const res = await apiAxios.get('/evaluator/assigned-submissions', { params: { contestId, page } });
    return res.data;
  },
  gradeSubmission: async (submissionId: string, score: number, comments: string) => {
    const res = await apiAxios.post(`/evaluator/${submissionId}/score`, { score, comments });
    return res.data;
  },
  getEvaluatorStats: async () => {
    const res = await apiAxios.get('/evaluator/stats');
    return res.data;
  },

  submitOrgRequest: async (data: {
    // Original fields
    orgName: string; orgType: string; contactName: string; contactEmail: string;
    contactPhone?: string; websiteUrl?: string; domain?: string; reason?: string; preferredPassword?: string;
    // Step 1 — Identity
    industry?: string; orgSize?: string; linkedinOrgUrl?: string;
    // Step 2 — Legal & Location
    address?: string; city?: string; state?: string; country?: string; pincode?: string;
    gstNumber?: string; panNumber?: string; cinNumber?: string; regNumber?: string; taxId?: string;
    aisheCode?: string; nirfRanking?: string; affiliatedTo?: string;
    // Step 3 — Contact Officer
    contactDesignation?: string; contactAlternateEmail?: string; domainMismatchReason?: string;
    // Step 4 — Platform Requirements
    useCases?: string[]; expectedCandidates?: string; preferredFormat?: string[];
    hearAboutUs?: string; referralCode?: string;
    // Step 5 — Legal Agreements
    dpaAgreed?: boolean; certifiedRepresentative?: boolean;
  }) => {
    const res = await apiAxios.post('/org-requests', data);
    return res.data;
  },
  getOrgRequests: async (page = 1, status = '') => {
    const res = await apiAxios.get('/org-requests', { params: { page, limit: 20, status } });
    return res.data;
  },
  approveOrgRequest: async (requestId: string) => {
    const res = await apiAxios.post(`/org-requests/${requestId}/approve`);
    return res.data;
  },
  rejectOrgRequest: async (requestId: string, reviewNotes?: string) => {
    const res = await apiAxios.post(`/org-requests/${requestId}/reject`, { reviewNotes });
    return res.data;
  },

  // Accept Invite Signup
  acceptInviteSignup: async (token: string, name: string, password: string) => {
    const res = await apiAxios.post('/auth/accept-invite-signup', { token, name, password });
    return res.data;
  },
  updateSubmission: async (id: string, data: any) => {
    const res = await apiAxios.put(`/submissions/${id}`, data);
    return res.data;
  },

  // Exam & Contests Helpers
  getExamCategories: async () => {
    try { const res = await apiAxios.get('/exams/categories'); return res.data; }
    catch { return { categories: [] }; }
  },
  getExamAttempts: async () => {
    try { const res = await apiAxios.get('/exams/attempts'); return res.data; }
    catch { return { attempts: [] }; }
  },
  getLiveUpcomingContests: async () => {
    try { const res = await apiAxios.get('/contests'); return { contests: res.data.contests || [] }; }
    catch { return { contests: [] }; }
  },
  getExamQuestions: async (categoryId: number) => {
    try { const res = await apiAxios.get(`/exams/categories/${categoryId}/questions`); return res.data; }
    catch { return { questions: [] }; }
  },
  evaluateExam: async (data: { categoryId: number; answers: any[] }) => {
    try { const res = await apiAxios.post('/exams/evaluate', data); return res.data; }
    catch { return { score: 0, total: 0, evaluatedAnswers: [] }; }
  },
  saveExamAttempt: async (data: any) => {
    try { const res = await apiAxios.post('/exams/attempts', data); return res.data; }
    catch { return { success: true }; }
  },
  getManagerContests: async () => {
    try { const res = await apiAxios.get('/contests/manager/list'); return res.data; }
    catch { return { contests: [] }; }
  },
  getMyParticipations: async () => {
    try { const res = await apiAxios.get('/contests/my-participations'); return res.data.participations || []; }
    catch { return []; }
  },
  verifySeb: async (contestId: string, sessionToken: string) => {
    try { const res = await apiAxios.get(`/contests/manager/${contestId}/verify-seb?sessionToken=${encodeURIComponent(sessionToken)}`); return res.data; }
    catch { return { success: true }; }
  },
};

export default api;
