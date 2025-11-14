/**
 * Uploads a file to local storage
 * @param {File} file - The file to upload
 * @returns {Promise<Object>} - Object containing file metadata and URL
 */
export const uploadFile = async (file) => {
  try {
    // Validate file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size exceeds 10MB limit');
    }

    // Create FormData object
    const formData = new FormData();
    formData.append('file', file);

    // Determine backend URL (Railway in production, localhost in dev)
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

    // Upload file to backend server
    const response = await fetch(`${backendUrl}/api/upload-file`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('File upload failed');
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'File upload failed');
    }

    return result.file;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Creates a file message object for sending in chat
 * @param {Object} fileData - File metadata from uploadFile
 * @returns {Object} - Formatted message object for file sharing
 */
export const createFileMessage = (fileData) => {
  return {
    type: 'file',
    file: {
      url: fileData.url,
      name: fileData.name,
      type: fileData.type,
      size: fileData.size
    },
    text: `📎 File: ${fileData.name}`
  };
};