// Simple wrapper to start the backend server
console.log('Starting backend server...');

// Import the backend server
import('./backend/index.js')
  .then(() => {
    console.log('Backend server started successfully');
  })
  .catch((error) => {
    console.error('Error starting backend server:', error);
    // Log the full error stack
    console.error('Error stack:', error.stack);
  });

// Add a simple health check endpoint
console.log('Server wrapper running');