import { safeParseIntPositive } from "./safeParseInt";

export interface PageParams {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export function parsePageParams(query: { page?: string; limit?: string }, defaultLimit = 20): PageParams {
  const page = safeParseIntPositive(query.page, 1);
  const limit = Math.min(safeParseIntPositive(query.limit, defaultLimit), 200);
  const skip = (page - 1) * limit;
  return { skip, take: limit, page, limit };
}
