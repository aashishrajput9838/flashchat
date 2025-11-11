// Debug Firebase Configuration
(function() {
  console.log('=== Firebase Debug Information ===');
  
  // Check environment variables
  console.log('VITE_FIREBASE_PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID);
  console.log('All Firebase env vars:');
  Object.keys(import.meta.env).filter(key => key.includes('FIREBASE') || key.includes('FCM')).forEach(key => {
    console.log(`  ${key}:`, import.meta.env[key]);
  });
  
  // Check if we're using the correct project
  const expectedProjectId = 'web-socket-2e05f';
  const actualProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  
  if (actualProjectId && actualProjectId !== expectedProjectId) {
    console.warn('WARNING: Project ID mismatch!');
    console.warn(`Expected: ${expectedProjectId}`);
    console.warn(`Actual: ${actualProjectId}`);
  } else if (!actualProjectId) {
    console.warn('WARNING: VITE_FIREBASE_PROJECT_ID not found in environment variables');
    console.warn('Using default value:', expectedProjectId);
  } else {
    console.log('Project ID check: OK');
  }
  
  // Check for the problematic project ID
  const problematicProjectId = 'ai-reasoning-validation-system';
  if (actualProjectId === problematicProjectId) {
    console.error('ERROR: Using problematic project ID:', problematicProjectId);
  }
  
  console.log('=== End Firebase Debug ===');
})();