export const securityLogger = {
  warn: (message: string, meta: any) => {
    console.warn(JSON.stringify({
      level: 'WARN',
      timestamp: new Date().toISOString(),
      message,
      ...(meta ? { meta } : {}),
    }));
  },

  error: (message: string, meta: any) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      message,
      ...(meta ? { meta } : {}),
    }));
  },

  info: (message: string, meta: any) => {
    console.info(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      message,
      ...(meta ? { meta } : {}),
    }));
  },

  critical: (message: string, meta: any) => {
    console.error(JSON.stringify({
      level: 'CRITICAL',
      timestamp: new Date().toISOString(),
      message,
      ...(meta ? { meta } : {}),
    }));
  },
};
