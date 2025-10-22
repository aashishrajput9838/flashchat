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
  endCall as endCallService,
  cleanupCallData,
  updateCallStatus
} from '@/lib/callService';
import { getUserById } from '@/lib/userService';

export function VideoCall({ selectedChat, onClose, onCallEnd, role = 'caller', callId }) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isRemoteVideoConnected, setIsRemoteVideoConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState('Connecting...');
  const [remoteUser, setRemoteUser] = useState(null); // Store remote user data
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const unsubscribersRef = useRef([]);
  const cleanupTimeoutRef = useRef(null);
  const hasEndedRef = useRef(false);
  
  const user = getCurrentUser();
  // Use remote user name if available, otherwise fallback to selectedChat or default
  const chatTitle = remoteUser 
    ? remoteUser.name || remoteUser.displayName || remoteUser.email || "Unknown User"
    : (selectedChat 
        ? selectedChat.name 
        : "FlashChat");

  // Fetch remote user data based on role
  useEffect(() => {
    const fetchRemoteUserData = async () => {
      try {
        if (callId) {
          // Listen to call document to get caller/callee info
          const { listenForCallStatus } = await import('@/lib/callService');
          const unsubscribe = listenForCallStatus(callId, async (data) => {
            if (data && (data.callerUid || data.calleeUid)) {
              // Determine remote user ID based on role
              let remoteUserId;
              if (role === 'caller' && data.calleeUid) {
                remoteUserId = data.calleeUid;
              } else if (role === 'callee' && data.callerUid) {
                remoteUserId = data.callerUid;
              }
              
              // Fetch remote user data
              if (remoteUserId && remoteUserId !== user?.uid) {
                const userData = await getUserById(remoteUserId);
                if (userData) {
                  setRemoteUser(userData);
                }
              }
            }
          });
          
          unsubscribersRef.current.push(unsubscribe);
        } else if (selectedChat) {
          // For caller, use selectedChat as remote user
          setRemoteUser(selectedChat);
        }
      } catch (error) {
        console.error('Error fetching remote user data:', error);
        // Fallback to selectedChat if available
        if (selectedChat) {
          setRemoteUser(selectedChat);
        }
      }
    };
    
    fetchRemoteUserData();
  }, [callId, role, selectedChat, user?.uid]);

  // Initialize media devices and set up signaling
  useEffect(() => {
    startCall();
    
    // Listen for call ended event from socket
    const handleCallEnded = (data) => {
      console.log('Received call ended event:', data);
      setCallStatus('Call ended by other party');
      setTimeout(() => {
        endCall(true);
      }, 2000);
    };
    
    // Add socket listener if socket is available
    if (window.socket) {
      window.socket.on('call_ended', handleCallEnded);
    }
    
    // Cleanup function
    return () => {
      console.log('Cleaning up VideoCall component');
      cleanupMedia();
      cleanupListeners();
      // Clear any pending cleanup timeouts
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      
      // Remove socket listener
      if (window.socket) {
        window.socket.off('call_ended', handleCallEnded);
      }
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
      setIsRemoteVideoConnected(false);
      hasEndedRef.current = false;
      
      // Create RTCPeerConnection
      const pc = new RTCPeerConnection(rtcConfiguration);
      peerConnectionRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Remote track handler
      pc.ontrack = (event) => {
        console.log('Remote track received:', event);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsRemoteVideoConnected(true);
        }
      };

      // Firestore signaling
      const offerCandidatesRef = offerCandidatesCollection(callId);
      const answerCandidatesRef = answerCandidatesCollection(callId);

      // Listen for call status changes to detect when other party ends call
      const unsubStatus = listenForCallStatus(callId, async (data) => {
        console.log('Call status changed:', data);
        
        // Check if call has already ended to prevent duplicate handling
        if (hasEndedRef.current) {
          console.log('Call already ended, skipping status update');
          return;
        }
        
        if (data.status === 'ended' || (data.endedAt && data.endedAt !== null)) {
          setCallStatus('Call ended by other party');
          setTimeout(() => {
            endCall(true);
          }, 2000);
        } else if (data.status === 'declined') {
          setCallStatus('Call declined by other party');
          setTimeout(() => {
            endCall(true);
          }, 2000);
        } else if (data.status === 'ringing') {
          setCallStatus('Ringing...');
        } else if (data.status === 'accepted') {
          setCallStatus('Call in progress');
        }
      });
      unsubscribersRef.current.push(unsubStatus);

      if (role === 'caller') {
        setCallStatus('Ringing...');
        
        // Push ICE candidates to offerCandidates
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            try {
              await addIceCandidate(offerCandidatesRef, event.candidate.toJSON());
            } catch (err) {
              console.error('Error adding ICE candidate:', err);
            }
          }
        };

        // Track if we've already handled an answer
        let hasHandledAnswer = false;

        // Create and set local offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await setOffer(callId, { sdp: offer.sdp, type: offer.type });

        // Listen for remote answer
        const unsubAnswer = listenForAnswer(callId, async (answer) => {
          if (hasHandledAnswer) {
            console.log('Already handled answer, skipping');
            return;
          }
          
          if (pc.currentRemoteDescription) {
            console.log('Already have remote description, skipping');
            return;
          }
          
          try {
            hasHandledAnswer = true;
            
            if (!pc || pc.signalingState === 'closed') {
              console.log('Peer connection is closed, skipping answer handling');
              return;
            }
            
            const rtcAnswer = new RTCSessionDescription(answer);
            
            if (pc.signalingState !== 'have-local-offer' && pc.signalingState !== 'stable') {
              console.log('Invalid signaling state for setting remote description:', pc.signalingState);
              return;
            }
            
            await pc.setRemoteDescription(rtcAnswer);
            setCallStatus('Call in progress');
            await updateCallStatus(callId, 'accepted');
          } catch (err) {
            console.error('Error setting remote description:', err);
            setCallStatus('Failed to connect');
          }
        });
        unsubscribersRef.current.push(unsubAnswer);

        // Listen for callee ICE
        const unsubAnsCand = listenForIceCandidates(answerCandidatesRef, async (c) => {
          try {
            if (!peerConnectionRef.current) return;
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (err) {
            console.error('Error adding answer ICE', err);
          }
        });
        unsubscribersRef.current.push(unsubAnsCand);
      } else {
        setCallStatus('Connecting...');
        
        // Callee role
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            try {
              await addIceCandidate(answerCandidatesRef, event.candidate.toJSON());
            } catch (err) {
              console.error('Error adding ICE candidate:', err);
            }
          }
        };

        // Track if we've already handled an offer
        let hasHandledOffer = false;

        // Wait for offer then answer
        const unsubOffer = listenForOffer(callId, async (offer) => {
          if (hasHandledOffer) {
            console.log('Already handled offer, skipping');
            return;
          }
          
          try {
            hasHandledOffer = true;
            
            if (!pc || pc.signalingState === 'closed') {
              console.log('Peer connection is closed, skipping offer handling');
              return;
            }
            
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            
            if (pc.signalingState !== 'have-remote-offer') {
              console.log('Invalid signaling state for creating answer:', pc.signalingState);
              return;
            }
            
            const answer = await pc.createAnswer();
            
            if (pc.signalingState !== 'have-remote-offer') {
              console.log('Invalid signaling state for setting local description:', pc.signalingState);
              return;
            }
            
            await pc.setLocalDescription(answer);
            await setAnswer(callId, { sdp: answer.sdp, type: answer.type });
            setCallStatus('Call in progress');
            await updateCallStatus(callId, 'accepted');
          } catch (err) {
            console.error('Error handling offer', err);
            setCallStatus('Failed to connect');
          }
        });
        unsubscribersRef.current.push(unsubOffer);

        // Listen for caller ICE
        const unsubOffCand = listenForIceCandidates(offerCandidatesRef, async (c) => {
          try {
            if (!peerConnectionRef.current) return;
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
      setTimeout(() => {
        endCall();
      }, 3000);
    }
  };

  // Cleanup media resources
  const cleanupMedia = () => {
    console.log('Cleaning up media resources');
    
    // Stop all tracks in local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.warn('Error stopping track:', err);
        }
      });
      localStreamRef.current = null;
    }
    
    // Clear video srcObjects
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Reset video connection state
    setIsRemoteVideoConnected(false);
    
    // Close RTCPeerConnection
    if (peerConnectionRef.current) {
      try {
        if (peerConnectionRef.current.signalingState !== 'closed') {
          peerConnectionRef.current.close();
        }
      } catch (err) {
        console.warn('Error closing peer connection:', err);
      }
      peerConnectionRef.current = null;
    }
  };

  // Cleanup Firestore listeners
  const cleanupListeners = () => {
    console.log('Cleaning up listeners');
    
    // Unsubscribe all listeners
    unsubscribersRef.current.forEach((unsubscribe, index) => {
      if (typeof unsubscribe === 'function') {
        try {
          console.log(`Unsubscribing listener ${index}`);
          unsubscribe();
        } catch (err) {
          console.warn('Error unsubscribing:', index, err);
        }
      }
    });
    unsubscribersRef.current = [];
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

  const endCall = async (endedByRemote = false) => {
    console.log('Ending call, endedByRemote:', endedByRemote);
    
    if (hasEndedRef.current) {
      console.log('Call already ended, skipping');
      return;
    }
    
    hasEndedRef.current = true;
    
    // Update UI state immediately
    setIsCallActive(false);
    setIsRemoteVideoConnected(false);
    setCallStatus(endedByRemote ? 'Call ended by other party' : 'Call ended');
    
    // Cleanup media resources
    cleanupMedia();
    
    // Cleanup listeners immediately
    cleanupListeners();
    
    // Only notify Firestore if we're the ones ending the call
    if (!endedByRemote) {
      try {
        console.log('Notifying other party that call has ended');
        await endCallService(callId);
      } catch (error) {
        console.error('Error ending call:', error);
      }
    }
    
    // Schedule cleanup of Firestore data
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
    }
    
    cleanupTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('Cleaning up call data from Firestore');
        await cleanupCallData(callId);
      } catch (error) {
        console.error('Error cleaning up call data:', error);
      }
    }, 5000);
    
    // Notify parent components after a short delay to ensure UI updates
    setTimeout(() => {
      if (onCallEnd) {
        onCallEnd();
      }
      if (onClose) {
        onClose();
      }
    }, 100);
  };

  // Function to render the remote video or profile placeholder
  const renderRemoteVideo = () => {
    // Show remote video if connected, otherwise show profile placeholder
    if (isRemoteVideoConnected && remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      return (
        <video 
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      );
    }
    
    // Show profile placeholder while waiting for video or if video is not connected
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
        <div className="bg-secondary rounded-full w-32 h-32 flex items-center justify-center mb-6">
          {(remoteUser?.photoURL || selectedChat?.photoURL) ? (
            <img 
              src={remoteUser?.photoURL || selectedChat?.photoURL} 
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
    );
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
            onClick={() => endCall()}
            className="grid h-10 w-10 place-items-center rounded-full bg-destructive hover:bg-destructive/90"
            aria-label="End call">
            <Phone className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Video area */}
        <div className="flex-1 relative flex flex-col md:flex-row gap-4 p-4">
          {/* Remote video or recipient info during ringing */}
          <div className="flex-1 bg-muted rounded-lg overflow-hidden relative">
            {renderRemoteVideo()}
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
              onClick={() => endCall()}
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