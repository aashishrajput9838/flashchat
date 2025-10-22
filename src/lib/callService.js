import { db } from './firebase';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';

// STUN servers for WebRTC
export const rtcConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ]
};

// Add rate limiting variables
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_OPERATIONS_PER_WINDOW = 100; // Increased limit for better user experience
let operationCount = 0;
let windowStartTime = Date.now();

// Helper function to check rate limit
const checkRateLimit = () => {
  const now = Date.now();
  
  // Reset window if it's been more than the window time
  if (now - windowStartTime > RATE_LIMIT_WINDOW) {
    operationCount = 0;
    windowStartTime = now;
  }
  
  // Check if we've exceeded the limit
  if (operationCount >= MAX_OPERATIONS_PER_WINDOW) {
    const timeLeft = RATE_LIMIT_WINDOW - (now - windowStartTime);
    console.warn(`Rate limit exceeded. Please wait ${Math.ceil(timeLeft / 1000)} seconds.`);
    return false;
  }
  
  // Increment operation count
  operationCount++;
  return true;
};

// Create a call document and associated subcollections for ICE candidates
export async function createCallDocument(callerUid, calleeUid) {
  // Check rate limit before proceeding
  if (!checkRateLimit()) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  const callsRef = collection(db, 'calls');
  const callDocRef = await addDoc(callsRef, {
    callerUid,
    calleeUid,
    createdAt: serverTimestamp(),
    status: 'initiated'
  });
  return callDocRef.id;
}

export async function setOffer(callId, offer) {
  // Check rate limit before proceeding
  if (!checkRateLimit()) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  const callRef = doc(db, 'calls', callId);
  await updateDoc(callRef, { offer, status: 'offer-set' });
}

export async function setAnswer(callId, answer) {
  // Check rate limit before proceeding
  if (!checkRateLimit()) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  const callRef = doc(db, 'calls', callId);
  await updateDoc(callRef, { answer, status: 'answer-set' });
}

export function listenForAnswer(callId, callback) {
  const callRef = doc(db, 'calls', callId);
  return onSnapshot(callRef, (snapshot) => {
    const data = snapshot.data();
    if (data && data.answer) {
      callback(data.answer);
    }
  });
}

export function listenForOffer(callId, callback) {
  const callRef = doc(db, 'calls', callId);
  return onSnapshot(callRef, (snapshot) => {
    const data = snapshot.data();
    if (data && data.offer) {
      callback(data.offer);
    }
  });
}

// Listen for call status changes
export function listenForCallStatus(callId, callback) {
  const callRef = doc(db, 'calls', callId);
  return onSnapshot(callRef, (snapshot) => {
    const data = snapshot.data();
    if (data) {
      callback(data);
    }
  });
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
  });
}

export async function addIceCandidate(candidatesRef, candidate) {
  // Check rate limit before proceeding
  if (!checkRateLimit()) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  await addDoc(candidatesRef, candidate);
}

export async function endCall(callId) {
  // Check rate limit before proceeding
  if (!checkRateLimit()) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  const callRef = doc(db, 'calls', callId);
  await updateDoc(callRef, { status: 'ended', endedAt: serverTimestamp() });
}