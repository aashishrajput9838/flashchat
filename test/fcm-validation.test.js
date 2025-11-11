// FCM Validation Tests
// Tests for the FCM validation utilities

import { validateVapidKey } from '../src/utils/fcmDebug';

describe('FCM Validation Utilities', () => {
  describe('validateVapidKey', () => {
    it('should reject missing VAPID key', () => {
      const result = validateVapidKey(null);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('VAPID key is missing');
    });

    it('should reject non-string VAPID key', () => {
      const result = validateVapidKey(12345);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('VAPID key must be a string');
    });

    it('should reject short VAPID key', () => {
      const result = validateVapidKey('short_key');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('VAPID key is too short (minimum 64 characters)');
    });

    it('should reject invalid base64 VAPID key', () => {
      const result = validateVapidKey('this is not a valid base64 string!@#$%^&*()');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('VAPID key does not appear to be a valid base64 string');
    });

    it('should accept valid base64 VAPID key', () => {
      // This is a valid base64 string of appropriate length
      const validKey = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz01';
      const result = validateVapidKey(validKey);
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('VAPID key format is valid');
    });
  });
});