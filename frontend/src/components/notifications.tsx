export function useNotify() {
  return {
    toast: {
      success: (msg: string) => console.log('✅ Success:', msg),
      error: (msg: string) => console.error('❌ Error:', msg),
      info: (msg: string) => console.log('ℹ️ Info:', msg),
      warning: (msg: string) => console.warn('⚠️ Warning:', msg),
    }
  };
}
