import { storage } from '@/config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Uploads a file to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} userId - The ID of the user uploading the file
 * @returns {Promise<Object>} - Object containing file metadata and download URL
 */
export const uploadFile = async (file, userId) => {
  try {
    // Validate file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size exceeds 10MB limit');
    }

    // Validate file type (basic validation)
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'application/pdf',
      'text/plain',
      'video/mp4', 'video/quicktime',
      'audio/mpeg', 'audio/wav'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error('File type not allowed');
    }

    // Create a storage reference with a unique path
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}_${userId}.${fileExtension}`;
    const storageRef = ref(storage, `chat-files/${userId}/${fileName}`);

    // Upload file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return {
      url: downloadURL,
      name: file.name,
      type: file.type,
      size: file.size,
      path: snapshot.ref.fullPath
    };
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