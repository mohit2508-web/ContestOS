import axios from 'axios';

export const apiAxios = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || 'demo-jwt-token';
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const api = {
  get: (url: string) => apiAxios.get(url).then((res) => res.data),
  post: (url: string, data?: any) => apiAxios.post(url, data).then((res) => res.data),
  put: (url: string, data?: any) => apiAxios.put(url, data).then((res) => res.data),
  delete: (url: string) => apiAxios.delete(url).then((res) => res.data),

  // Contest Board helpers
  getExternalContests: async (platform?: string, status?: string) => {
    try {
      const res = await apiAxios.get('/contests');
      let list = res.data.contests || [];
      if (platform && platform !== 'all') {
        list = list.filter((c: any) => c.platform === platform);
      }
      if (status && status !== 'all') {
        list = list.filter((c: any) => c.status === status);
      }
      return { contests: list };
    } catch {
      return { contests: [] };
    }
  },
  scrapeContests: async (_platform?: string) => {
    return { success: true };
  },
  toggleContestBookmark: async (_id: string) => {
    return { success: true };
  },

  // Contest Management & Zone helpers
  getManagerContest: async (id: string) => {
    try {
      return await apiAxios.get(`/contests/manager/${id}`).then((res) => res.data);
    } catch {
      // Fallback demo contest if specific ID not found in database
      return {
        contest: {
          id,
          title: 'IIT Delhi Grand Coding Championship 2026',
          description: 'Official proctored speed programming contest featuring algorithms, data structures & SEB security.',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date(Date.now() + 86400000).toISOString(),
          duration: 180,
          difficulty: 'Hard',
          isPublic: true,
          requireSeb: false,
          requireFullscreen: true,
          preventTabSwitch: true,
          enableProctoring: true,
          maxWarnings: 3,
          problems: [
            {
              id: 'cp-1',
              order: 1,
              points: 100,
              problem: {
                id: 'p-1',
                title: 'Two Sum Problem',
                slug: 'two-sum',
                difficulty: 'Easy',
                category: 'Algorithms',
                problemType: 'code',
                description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
              },
            },
            {
              id: 'cp-2',
              order: 2,
              points: 200,
              problem: {
                id: 'p-2',
                title: 'Longest Substring Without Repeating Characters',
                slug: 'longest-substring',
                difficulty: 'Medium',
                category: 'Strings',
                problemType: 'code',
                description: 'Given a string s, find the length of the longest substring without repeating characters.',
              },
            },
          ],
          _count: { participants: 42, problems: 2 },
        },
        isJoined: true,
        participant: { id: 'reg-1', status: 'REGISTERED', score: 0 },
      };
    }
  },
  joinManagerContest: (id: string) => apiAxios.post(`/contests/manager/${id}/join`).then((res) => res.data),
  getSebToken: (id: string) => apiAxios.post(`/contests/manager/${id}/seb-token`).then((res) => res.data),
  downloadSebConfig: (id: string) => apiAxios.get(`/contests/manager/${id}/seb-config`, { responseType: 'blob' }).then((res) => res.data),
  getMyContestReport: (id: string) => apiAxios.get(`/contests/${id}/my-report`).then((res) => res.data),

  getContestLeaderboard: async (contestId: string) => {
    try {
      const res = await apiAxios.get(`/leaderboard/contest/${contestId}`);
      return res.data;
    } catch {
      return { leaderboard: [] };
    }
  },

  getMyContestLogs: async (contestId: string) => {
    try {
      const res = await apiAxios.get(`/guard/logs/${contestId}`);
      return res.data;
    } catch {
      return { logs: [] };
    }
  },

  // Leaderboard helpers
  getGlobalLeaderboard: async (_limit = 50) => {
    try {
      const res = await apiAxios.get('/leaderboard');
      return res.data;
    } catch {
      return { leaderboard: [] };
    }
  },
  getPlatformLeaderboard: async (platform: string, _limit = 50) => {
    try {
      const res = await apiAxios.get(`/leaderboard?platform=${platform}`);
      return res.data;
    } catch {
      return { leaderboard: [] };
    }
  },
  getCategoryLeaderboard: async (category: string) => {
    try {
      const res = await apiAxios.get(`/leaderboard?category=${category}`);
      return res.data;
    } catch {
      return { leaderboard: [] };
    }
  },
  getDepartmentLeaderboard: async (department: string, _limit = 50) => {
    try {
      const res = await apiAxios.get(`/leaderboard?department=${department}`);
      return res.data;
    } catch {
      return { leaderboard: [] };
    }
  },
  getLeetcodeLeaderboard: async () => {
    try {
      const res = await apiAxios.get('/leaderboard?platform=leetcode');
      return res.data;
    } catch {
      return { leaderboard: [] };
    }
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
  syncAllPlatforms: async () => {
    return { success: true };
  },
  getDepartments: async () => {
    return { departments: ['Computer Science & Engineering', 'Information Technology', 'Artificial Intelligence', 'Electronics'] };
  },
};

export default api;
