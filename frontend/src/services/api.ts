import axios from 'axios';

export const apiAxios = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
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
      return {
        contests: [
          {
            id: 'c-1',
            contestId: 'cf-1980',
            name: 'Codeforces Round 995 (Div. 2)',
            url: 'https://codeforces.com/contests',
            platform: 'codeforces',
            startTime: new Date(Date.now() + 3600000).toISOString(),
            endTime: new Date(Date.now() + 10800000).toISOString(),
            duration: 120,
            status: 'upcoming',
            description: 'Div. 2 Competitive Coding Contest',
            participants: 12400,
            isBookmarked: false,
          },
          {
            id: 'c-2',
            contestId: 'lc-412',
            name: 'LeetCode Weekly Contest 412',
            url: 'https://leetcode.com/contest/',
            platform: 'leetcode',
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 91800000).toISOString(),
            duration: 90,
            status: 'upcoming',
            description: 'Weekly LeetCode contest',
            participants: 28000,
            isBookmarked: true,
          },
          {
            id: 'c-3',
            contestId: 'cc-starters-150',
            name: 'CodeChef Starters 150 (Rated)',
            url: 'https://www.codechef.com/contests',
            platform: 'codechef',
            startTime: new Date(Date.now() - 1800000).toISOString(),
            endTime: new Date(Date.now() + 5400000).toISOString(),
            duration: 120,
            status: 'ongoing',
            description: 'Live CodeChef Contest',
            participants: 9500,
            isBookmarked: false,
          },
        ],
      };
    }
  },
  scrapeContests: async (_platform?: string) => {
    return { success: true };
  },
  toggleContestBookmark: async (_id: string) => {
    return { success: true };
  },

  // Contest Management helpers
  getManagerContest: (id: string) => apiAxios.get(`/contests/manager/${id}`).then((res) => res.data),
  joinManagerContest: (id: string) => apiAxios.post(`/contests/manager/${id}/join`).then((res) => res.data),
  getSebToken: (id: string) => apiAxios.post(`/contests/manager/${id}/seb-token`).then((res) => res.data),
  downloadSebConfig: (id: string) => apiAxios.get(`/contests/manager/${id}/seb-config`, { responseType: 'blob' }).then((res) => res.data),
  getMyContestReport: (id: string) => apiAxios.get(`/contests/${id}/my-report`).then((res) => res.data),

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
