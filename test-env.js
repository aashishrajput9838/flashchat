// Test script to verify environment variables
console.log('VITE_BACKEND_URL:', process.env.VITE_BACKEND_URL);
console.log('All env vars:', Object.keys(process.env).filter(key => key.includes('VITE_')));