import { useState, useEffect, useRef } from 'react';
import { Phone, Mic, MicOff, Video, VideoOff, X } from 'lucide-react';
import { getCurrentUser } from '@/lib/userService';
import {
  rtcConfiguration,
  offerCandidatesCollection,
  answerCandidatesCollection,
  addIceCandidate,
  listenForIceCandidates,
  listenForOffer,
  listenForAnswer,
  listenForCallStatus,
  setOffer,
  setAnswer,
  endCall as endCallService
} from '@/lib/callService';

export function VideoCall({ selectedChat, onClose, onCallEnd, role = 'caller', callId }) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState('Connecting...');
  const notificationSentRef = useRef(false);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const unsubscribersRef = useRef([]);
  
  const user = getCurrentUser();
  const chatTitle = selectedChat 
    ? selectedChat.name 
    : "FlashChat";

  // Initialize media devices and set up signaling
  useEffect(() => {
    startCall();
    return () => {
      // On unmount (including React StrictMode dev double-invoke),
      // only clean resources; do not signal parent to close.
      cleanupMedia();
      unsubscribersRef.current.forEach((u) => {
        try { u && u(); } catch {}
      });
      unsubscribersRef.current = [];
    };
  }, []);

  const startCall = async () => {
    try {
      // Access media devices
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      localStreamRef.current = stream;
      setIsCallActive(true);
      setCallStatus('Ringing...');

      // Create RTCPeerConnection
      const pc = new RTCPeerConnection(rtcConfiguration);
      peerConnectionRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Remote track handler
      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Firestore signaling
      const offerCandidatesRef = offerCandidatesCollection(callId);
      const answerCandidatesRef = answerCandidatesCollection(callId);

      // Listen for call status changes
      const unsubStatus = listenForCallStatus(callId, async (data) => {
        if (data.status === 'ended') {
          setCallStatus('Call ended by other party');
          setTimeout(() => {
            endCall();
          }, 2000);
        }
      });
      unsubscribersRef.current.push(unsubStatus);

      if (role === 'caller') {
        // Push ICE candidates to offerCandidates
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            await addIceCandidate(offerCandidatesRef, event.candidate.toJSON());
          }
        };

        // Create and set local offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await setOffer(callId, { sdp: offer.sdp, type: offer.type });

        // Listen for remote answer
        const unsubAnswer = listenForAnswer(callId, async (answer) => {
          const rtcAnswer = new RTCSessionDescription(answer);
          if (!pc.currentRemoteDescription) {
            await pc.setRemoteDescription(rtcAnswer);
            setCallStatus('Call in progress');
          }
        });
        unsubscribersRef.current.push(unsubAnswer);

        // Listen for callee ICE
        const unsubAnsCand = listenForIceCandidates(answerCandidatesRef, async (c) => {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (err) {
            console.error('Error adding answer ICE', err);
          }
        });
        unsubscribersRef.current.push(unsubAnsCand);
      } else {
        // Callee role
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            await addIceCandidate(answerCandidatesRef, event.candidate.toJSON());
          }
        };

        // Wait for offer then answer
        const unsubOffer = listenForOffer(callId, async (offer) => {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await setAnswer(callId, { sdp: answer.sdp, type: answer.type });
            setCallStatus('Call in progress');
          } catch (err) {
            console.error('Error handling offer', err);
          }
        });
        unsubscribersRef.current.push(unsubOffer);

        // Listen for caller ICE
        const unsubOffCand = listenForIceCandidates(offerCandidatesRef, async (c) => {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (err) {
            console.error('Error adding offer ICE', err);
          }
        });
        unsubscribersRef.current.push(unsubOffCand);
      }
    } catch (error) {
      console.error('Error starting call:', error);
      setCallStatus('Failed to start call');
    }
  };

  const cleanupMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = !isVideoOff;
        setIsVideoOff(!isVideoOff);
      }
    }
  };

  const endCall = async () => {
    cleanupMedia();
    setIsCallActive(false);
    
    // Update call status to missed if call was not connected
    if (callStatus === 'Ringing...' || callStatus === 'Connecting...') {
      setCallStatus('Call missed');
    } else {
      setCallStatus('Call ended');
    }
    
    // Notify the other party that the call has ended
    try {
      await endCallService(callId);
    } catch (error) {
      console.error('Error ending call:', error);
    }
    
    // Cleanup signaling listeners
    unsubscribersRef.current.forEach((u) => {
      try { u && u(); } catch {}
    });
    unsubscribersRef.current = [];
    
    if (onCallEnd) {
      onCallEnd();
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[80vh] bg-card rounded-xl border flex flex-col">
        {/* Call header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">{chatTitle}</h3>
            <p className="text-sm text-muted-foreground">{callStatus}</p>
          </div>
          <button
            onClick={endCall}
            className="grid h-10 w-10 place-items-center rounded-full bg-destructive hover:bg-destructive/90"
            aria-label="End call">
            <Phone className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Video area */}
        <div className="flex-1 relative flex flex-col md:flex-row gap-4 p-4">
          {/* Remote video or recipient info during ringing */}
          <div className="flex-1 bg-muted rounded-lg overflow-hidden relative">
            {isCallActive ? (
              <video 
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              // Show recipient profile during ringing
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
                <div className="bg-secondary rounded-full w-32 h-32 flex items-center justify-center mb-6">
                  {selectedChat?.photoURL ? (
                    <img 
                      src={selectedChat.photoURL} 
                      alt={chatTitle} 
                      className="w-32 h-32 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-bold">
                      {chatTitle?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-semibold mb-2">{chatTitle}</h2>
                <p className="text-muted-foreground mb-6">
                  {callStatus === 'Ringing...' ? 'Calling...' : callStatus}
                </p>
                <div className="flex items-center justify-center">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mx-1 animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full mx-1 animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full mx-1 animate-bounce" style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
            )}
          </div>

          {/* Local video */}
          <div className="md:w-1/3 bg-muted rounded-lg overflow-hidden relative">
            <video 
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <VideoOff className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Call controls */}
        <div className="p-4 border-t">
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={toggleMute}
              className={`grid h-12 w-12 place-items-center rounded-full ${isMuted ? 'bg-destructive' : 'bg-secondary'} hover:opacity-90`}
              aria-label={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
            
            <button
              onClick={toggleVideo}
              className={`grid h-12 w-12 place-items-center rounded-full ${isVideoOff ? 'bg-destructive' : 'bg-secondary'} hover:opacity-90`}
              aria-label={isVideoOff ? "Turn on camera" : "Turn off camera"}>
              {isVideoOff ? (
                <VideoOff className="h-5 w-5" />
              ) : (
                <Video className="h-5 w-5" />
              )}
            </button>
            
            <button
              onClick={endCall}
              className="grid h-12 w-12 place-items-center rounded-full bg-destructive hover:bg-destructive/90"
              aria-label="End call">
              <Phone className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}