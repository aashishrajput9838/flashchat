import { db } from './firebase';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction
} from 'firebase/firestore';

// STUN servers for WebRTC
export const rtcConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ]
};

// Improved rate limiting with more reasonable thresholds
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const MAX_CALLS_PER_WINDOW = 3; // Allow 3 calls per window

// Check rate limit based on recent call attempts
export const checkRateLimit = async (userId) => {
  try {
    const callsRef = collection(db, 'calls');
    const tenSecondsAgo = new Date(Date.now() - RATE_LIMIT_WINDOW);
    
    // Query for recent calls initiated by this user
    const q = query(
      callsRef,
      where('callerUid', '==', userId),
      where('createdAt', '>', tenSecondsAgo),
      orderBy('createdAt', 'desc'),
      limit(MAX_CALLS_PER_WINDOW)
    );
    
    const querySnapshot = await getDocs(q);
    
    // If we have reached the limit, reject the call
    if (querySnapshot.size >= MAX_CALLS_PER_WINDOW) {
      const oldestCall = querySnapshot.docs[querySnapshot.docs.length - 1];
      const oldestCallData = oldestCall.data();
      const timeSinceOldestCall = Date.now() - oldestCallData.createdAt.toDate().getTime();
      const timeLeft = RATE_LIMIT_WINDOW - timeSinceOldestCall;
      
      if (timeLeft > 0) {
        console.warn(`Rate limit exceeded. Please wait ${Math.ceil(timeLeft / 1000)} seconds.`);
        return { allowed: false, timeLeft: Math.ceil(timeLeft / 1000) };
      }
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // In case of error, allow the call to proceed
    return { allowed: true };
  }
};

// Create a call document with proper lifecycle state tracking
export async function createCallDocument(callerUid, calleeUid) {
  const rateCheck = await checkRateLimit(callerUid);
  if (!rateCheck.allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${rateCheck.timeLeft} seconds.`);
  }
  
  const callsRef = collection(db, 'calls');
  const callDocRef = await addDoc(callsRef, {
    callerUid,
    calleeUid,
    createdAt: serverTimestamp(),
    status: 'initiated',
    endedAt: null
  });
  return callDocRef.id;
}

export async function setOffer(callId, offer) {
  const callRef = doc(db, 'calls', callId);
  await updateDoc(callRef, { 
    offer, 
    status: 'ringing',
    ringingAt: serverTimestamp()
  });
}

export async function setAnswer(callId, answer) {
  const callRef = doc(db, 'calls', callId);
  await updateDoc(callRef, { 
    answer, 
    status: 'accepted',
    acceptedAt: serverTimestamp()
  });
}

export function listenForAnswer(callId, callback) {
  const callRef = doc(db, 'calls', callId);
  return onSnapshot(callRef, (snapshot) => {
    const data = snapshot.data();
    if (data && data.answer) {
      callback(data.answer);
    }
  }, (error) => {
    console.error('Error listening for answer:', error);
  });
}

export function listenForOffer(callId, callback) {
  const callRef = doc(db, 'calls', callId);
  return onSnapshot(callRef, (snapshot) => {
    const data = snapshot.data();
    if (data && data.offer) {
      callback(data.offer);
    }
  }, (error) => {
    console.error('Error listening for offer:', error);
  });
}

// Listen for call status changes with error handling
export function listenForCallStatus(callId, callback) {
  const callRef = doc(db, 'calls', callId);
  return onSnapshot(callRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback(data);
    }
  }, (error) => {
    console.error('Error listening for call status:', error);
    // Call the callback with an ended status to clean up
    callback({ status: 'ended' });
  });
}

// Function to update call status with transaction for atomicity
export async function updateCallStatus(callId, status, additionalData = {}) {
  try {
    const callRef = doc(db, 'calls', callId);
    
    await runTransaction(db, async (transaction) => {
      const callDoc = await transaction.get(callRef);
      if (!callDoc.exists()) {
        throw new Error('Call document not found');
      }
      
      const updateData = { status, ...additionalData };
      
      // Add timestamp based on status
      if (status === 'ended') {
        updateData.endedAt = serverTimestamp();
      } else if (status === 'accepted') {
        updateData.acceptedAt = serverTimestamp();
      } else if (status === 'ringing') {
        updateData.ringingAt = serverTimestamp();
      }
      
      transaction.update(callRef, updateData);
    });
    
    return true;
  } catch (error) {
    console.error('Error updating call status:', error);
    return false;
  }
}

// Function to end a call and update status
export async function endCall(callId) {
  try {
    return await updateCallStatus(callId, 'ended');
  } catch (error) {
    console.error('Error ending call:', error);
    return false;
  }
}

// Function to decline a call
export async function declineCall(callId) {
  try {
    return await updateCallStatus(callId, 'declined');
  } catch (error) {
    console.error('Error declining call:', error);
    return false;
  }
}

// Function to clean up call signaling data
export async function cleanupCallData(callId) {
  try {
    // Delete ICE candidate subcollections
    const offerCandidatesRef = collection(doc(db, 'calls', callId), 'offerCandidates');
    const answerCandidatesRef = collection(doc(db, 'calls', callId), 'answerCandidates');
    
    // Get and delete offer candidates
    const offerCandidatesSnapshot = await getDocs(offerCandidatesRef);
    const deleteOfferPromises = offerCandidatesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    
    // Get and delete answer candidates
    const answerCandidatesSnapshot = await getDocs(answerCandidatesRef);
    const deleteAnswerPromises = answerCandidatesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    
    // Wait for all deletions
    await Promise.all([...deleteOfferPromises, ...deleteAnswerPromises]);
    
    // Finally delete the call document itself
    await deleteDoc(doc(db, 'calls', callId));
  } catch (error) {
    console.error('Error cleaning up call data:', error);
  }
}

export function offerCandidatesCollection(callId) {
  return collection(doc(db, 'calls', callId), 'offerCandidates');
}

export function answerCandidatesCollection(callId) {
  return collection(doc(db, 'calls', callId), 'answerCandidates');
}

export function listenForIceCandidates(candidatesRef, onCandidate) {
  return onSnapshot(candidatesRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        onCandidate(data);
      }
    });
  }, (error) => {
    console.error('Error listening for ICE candidates:', error);
  });
}

export async function addIceCandidate(candidatesRef, candidate) {
  try {
    await addDoc(candidatesRef, candidate);
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
}