export const PORTAL_URL = '';

export const portalLink = (path: string) => `${PORTAL_URL}${path.startsWith('/') ? path : '/' + path}`;

