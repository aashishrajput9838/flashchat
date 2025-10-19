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

// Create a call document and associated subcollections for ICE candidates
export async function createCallDocument(callerUid, calleeUid) {
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
  const callRef = doc(db, 'calls', callId);
  await updateDoc(callRef, { offer, status: 'offer-set' });
}

export async function setAnswer(callId, answer) {
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
  await addDoc(candidatesRef, candidate);
}

export async function endCall(callId) {
  const callRef = doc(db, 'calls', callId);
  await updateDoc(callRef, { status: 'ended', endedAt: serverTimestamp() });
}


