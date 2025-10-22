import { useState, useEffect, useRef } from 'react';
import { Phone, Mic, MicOff, Video, VideoOff, X, Monitor, MonitorOff } from 'lucide-react';
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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState('Connecting...');
  const [callDuration, setCallDuration] = useState(0);
  const [remoteUser, setRemoteUser] = useState(null); // Store remote user data
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const unsubscribersRef = useRef([]);
  const cleanupTimeoutRef = useRef(null);
  const hasEndedRef = useRef(false);
  // Store remote stream temporarily if ref is not available yet
  const pendingRemoteStreamRef = useRef(null);
  // Track if we've already applied the remote stream
  const remoteStreamAppliedRef = useRef(false);
  // Call timer ref
  const callTimerRef = useRef(null);
  
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
      
      // Clear call timer
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      
      // Remove socket listener
      if (window.socket) {
        window.socket.off('call_ended', handleCallEnded);
      }
    };
  }, []);

  // Call duration timer
  useEffect(() => {
    if (callStatus === 'Call in progress') {
      const startTime = Date.now();
      callTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setCallDuration(elapsed);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }
    
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callStatus]);

  // Format call duration
  const formatCallDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Apply pending remote stream when remoteVideoRef becomes available
  useEffect(() => {
    if (remoteVideoRef.current && pendingRemoteStreamRef.current) {
      console.log('Applying pending remote stream to video element');
      applyRemoteStreamToVideoElement(pendingRemoteStreamRef.current);
      pendingRemoteStreamRef.current = null;
    }
  }, [remoteVideoRef.current]);

  // Ensure video element is properly sized after component mounts
  useEffect(() => {
    if (remoteVideoRef.current) {
      const videoElement = remoteVideoRef.current;
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'cover';
    }
  }, []);

  // Function to apply remote stream to video element with proper error handling
  const applyRemoteStreamToVideoElement = (stream) => {
    // Prevent applying the same stream multiple times
    if (remoteStreamAppliedRef.current) {
      console.log('Remote stream already applied, skipping');
      return;
    }
    
    if (remoteVideoRef.current) {
      console.log('Applying remote stream to video element');
      
      // Mark that we've applied the stream
      remoteStreamAppliedRef.current = true;
      
      // Ensure any existing stream is stopped
      if (remoteVideoRef.current.srcObject) {
        const tracks = remoteVideoRef.current.srcObject.getTracks();
        tracks.forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.warn('Error stopping track:', e);
          }
        });
      }
      
      // Set the new stream
      remoteVideoRef.current.srcObject = stream;
      
      // Log stream information
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      console.log('Remote stream info:', {
        id: stream.id,
        tracks: stream.getTracks(),
        videoTracks: videoTracks,
        audioTracks: audioTracks,
        videoTrackEnabled: videoTracks.length > 0 ? videoTracks[0].enabled : false
      });
      
      // Add event listeners to the video element to ensure it plays
      const videoElement = remoteVideoRef.current;
      
      // Ensure the video element has the correct styling
      videoElement.classList.remove('hidden');
      videoElement.classList.add('block');
      videoElement.style.display = 'block';
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'cover';
      
      // Handle metadata loading
      const onLoadedMetadata = () => {
        console.log('Remote video metadata loaded');
        console.log('Video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
      };
      
      // Handle play events
      const onPlay = () => {
        console.log('Remote video started playing');
        console.log('Video playing state:', videoElement.paused, videoElement.ended);
      };
      
      // Handle playing events
      const onPlaying = () => {
        console.log('Remote video is now playing');
        console.log('Video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        
        // Check if video actually has content
        if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
          console.warn('Video has no dimensions - might be an issue with the stream');
        }
        
        // Update state to show remote video is connected
        setIsRemoteVideoConnected(true);
      };
      
      // Handle errors
      const onError = (e) => {
        console.error('Remote video error:', e);
      };
      
      // Add event listeners
      videoElement.onloadedmetadata = onLoadedMetadata;
      videoElement.onplay = onPlay;
      videoElement.onplaying = onPlaying;
      videoElement.onerror = onError;
      
      // Try to play the video with proper error handling
      const playVideo = async () => {
        try {
          // Wait a bit for the element to be ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if (videoElement.paused) {
            await videoElement.play();
            console.log('Remote video play successful');
          }
        } catch (error) {
          // Handle AbortError specifically
          if (error.name === 'AbortError') {
            console.warn('Video play was aborted, retrying...');
            // Retry once after a short delay
            setTimeout(async () => {
              try {
                if (videoElement.paused) {
                  await videoElement.play();
                  console.log('Remote video play retry successful');
                }
              } catch (retryError) {
                console.error('Video play failed after retry:', retryError);
                // Even if play fails, we still want to show the video element
                setIsRemoteVideoConnected(true);
              }
            }, 300);
          } else {
            console.error('Video play failed:', error);
            // Even if play fails, we still want to show the video element
            setIsRemoteVideoConnected(true);
          }
        }
      };
      
      // Play the video
      playVideo();
      
      console.log('Remote video connected, stream tracks:', stream.getTracks());
    } else {
      console.warn('Remote video ref not available when trying to apply stream');
    }
  };

  // Cleanup media resources
  const cleanupMedia = () => {
    console.log('Cleaning up media resources');
    
    // Reset all refs and state
    remoteStreamAppliedRef.current = false;
    pendingRemoteStreamRef.current = null;
    
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
      console.log('Clearing remote video srcObject');
      // Stop all tracks in remote stream
      if (remoteVideoRef.current.srcObject) {
        const tracks = remoteVideoRef.current.srcObject.getTracks();
        tracks.forEach(track => {
          try {
            track.stop();
          } catch (err) {
            console.warn('Error stopping track:', err);
          }
        });
      }
      remoteVideoRef.current.srcObject = null;
      
      // Hide the video element
      remoteVideoRef.current.classList.remove('block');
      remoteVideoRef.current.classList.add('hidden');
      remoteVideoRef.current.style.display = 'none';
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

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing and switch back to camera
      if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach(track => track.stop());
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        localStreamRef.current = stream;
        
        // Update peer connection with new stream
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(stream.getVideoTracks()[0]);
          }
        }
        
        setIsScreenSharing(false);
      } catch (error) {
        console.error('Error switching back to camera:', error);
      }
    } else {
      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        localStreamRef.current = stream;
        
        // Update peer connection with new stream
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(stream.getVideoTracks()[0]);
          }
        }
        
        // Listen for when screen sharing stops
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          toggleScreenShare(); // Switch back to camera
        });
        
        setIsScreenSharing(true);
      } catch (error) {
        console.error('Error starting screen sharing:', error);
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
    
    // Clear call timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    
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

  const startCall = async () => {
    try {
      // Access media devices with better constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }, 
        audio: true 
      });
      
      // Log local stream information
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      console.log('Local stream info:', {
        id: stream.id,
        tracks: stream.getTracks(),
        videoTracks: videoTracks,
        audioTracks: audioTracks
      });
      
      if (videoTracks.length > 0) {
        const videoTrack = videoTracks[0];
        console.log('Local video track constraints:', videoTrack.getConstraints());
        console.log('Local video track settings:', videoTrack.getSettings());
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      localStreamRef.current = stream;
      setIsCallActive(true);
      setIsRemoteVideoConnected(false);
      // Reset the remote stream applied flag when starting a new call
      remoteStreamAppliedRef.current = false;
      hasEndedRef.current = false;
      
      // Create RTCPeerConnection with enhanced configuration
      const pc = new RTCPeerConnection(rtcConfiguration);
      peerConnectionRef.current = pc;
      
      // Add debugging for peer connection events
      pc.onconnectionstatechange = () => {
        console.log('Peer connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.error('Peer connection failed');
          setCallStatus('Connection failed');
        }
      };
      
      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          console.error('ICE connection failed');
          setCallStatus('Connection failed');
        }
      };
      
      pc.onsignalingstatechange = () => {
        console.log('Signaling state:', pc.signalingState);
      };
      
      pc.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', pc.iceGatheringState);
      };

      // Add local tracks
      stream.getTracks().forEach((track) => {
        console.log('Adding local track:', track.kind, track.id);
        pc.addTrack(track, stream);
      });

      // Remote track handler
      pc.ontrack = (event) => {
        console.log('Remote track received:', event);
        console.log('Remote video ref available:', !!remoteVideoRef.current);
        
        // Log detailed track information
        console.log('Track details:', {
          kind: event.track.kind,
          id: event.track.id,
          label: event.track.label,
          enabled: event.track.enabled,
          readyState: event.track.readyState
        });
        
        // Log detailed stream information
        if (event.streams[0]) {
          console.log('Stream details:', {
            id: event.streams[0].id,
            active: event.streams[0].active,
            trackCount: event.streams[0].getTracks().length
          });
          
          // Log each track in the stream
          event.streams[0].getTracks().forEach((track, index) => {
            console.log(`Track ${index}:`, {
              kind: track.kind,
              id: track.id,
              label: track.label,
              enabled: track.enabled,
              readyState: track.readyState
            });
          });
        }
        
        // With WebRTC, we can receive multiple track events for the same stream
        // We need to ensure we're working with the complete stream that has all tracks
        const stream = event.streams[0];
        
        // If remoteVideoRef is not available yet, store the stream temporarily
        if (!remoteVideoRef.current) {
          console.log('Storing remote stream temporarily until video ref is available');
          pendingRemoteStreamRef.current = stream;
          return;
        }
        
        // Apply the stream directly if ref is available
        applyRemoteStreamToVideoElement(stream);
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
          console.log('Call accepted, remote video should connect soon');
        }
      });

      unsubscribersRef.current.push(unsubStatus);

      if (role === 'caller') {
        setCallStatus('Ringing...');
        
        // Push ICE candidates to offerCandidates with enhanced debugging
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            console.log('Local ICE candidate (caller):', event.candidate);
            try {
              await addIceCandidate(offerCandidatesRef, event.candidate.toJSON());
              console.log('Added ICE candidate to offer collection');
            } catch (err) {
              console.error('Error adding ICE candidate:', err);
            }
          } else {
            console.log('ICE candidate gathering complete (caller)');
          }
        };

        // Track if we've already handled an answer
        let hasHandledAnswer = false;

        // Create and set local offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await setOffer(callId, { sdp: offer.sdp, type: offer.type });
        console.log('Created and set local offer:', offer);

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
            console.log('Received remote answer:', answer);
            
            if (pc.signalingState !== 'have-local-offer' && pc.signalingState !== 'stable') {
              console.log('Invalid signaling state for setting remote description:', pc.signalingState);
              return;
            }
            
            await pc.setRemoteDescription(rtcAnswer);
            setCallStatus('Call in progress');
            await updateCallStatus(callId, 'accepted');
            console.log('Set remote description from answer');
          } catch (err) {
            console.error('Error setting remote description:', err);
            setCallStatus('Failed to connect');
          }
        });
        unsubscribersRef.current.push(unsubAnswer);

        // Listen for callee ICE with enhanced debugging
        const unsubAnsCand = listenForIceCandidates(answerCandidatesRef, async (c) => {
          try {
            console.log('Received remote ICE candidate (caller):', c);
            if (!peerConnectionRef.current) return;
            await pc.addIceCandidate(new RTCIceCandidate(c));
            console.log('Added remote ICE candidate (caller)');
          } catch (err) {
            console.error('Error adding answer ICE', err);
          }
        });
        unsubscribersRef.current.push(unsubAnsCand);
      } else {
        setCallStatus('Connecting...');
        
        // Callee role - enhanced ICE candidate handling
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            console.log('Local ICE candidate (callee):', event.candidate);
            try {
              await addIceCandidate(answerCandidatesRef, event.candidate.toJSON());
              console.log('Added ICE candidate to answer collection');
            } catch (err) {
              console.error('Error adding ICE candidate:', err);
            }
          } else {
            console.log('ICE candidate gathering complete (callee)');
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
            
            console.log('Received remote offer:', offer);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            
            if (pc.signalingState !== 'have-remote-offer') {
              console.log('Invalid signaling state for creating answer:', pc.signalingState);
              return;
            }
            
            const answer = await pc.createAnswer();
            console.log('Created local answer:', answer);
            
            if (pc.signalingState !== 'have-remote-offer') {
              console.log('Invalid signaling state for setting local description:', pc.signalingState);
              return;
            }
            
            await pc.setLocalDescription(answer);
            await setAnswer(callId, { sdp: answer.sdp, type: answer.type });
            setCallStatus('Call in progress');
            await updateCallStatus(callId, 'accepted');
            console.log('Set local description from answer');
          } catch (err) {
            console.error('Error handling offer', err);
            setCallStatus('Failed to connect');
          }
        });
        unsubscribersRef.current.push(unsubOffer);

        // Listen for caller ICE with enhanced debugging
        const unsubOffCand = listenForIceCandidates(offerCandidatesRef, async (c) => {
          try {
            console.log('Received remote ICE candidate (callee):', c);
            if (!peerConnectionRef.current) return;
            await pc.addIceCandidate(new RTCIceCandidate(c));
            console.log('Added remote ICE candidate (callee)');
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

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-2">
      <div className="w-full max-w-4xl h-[90vh] bg-card rounded-2xl border border-gray-700 flex flex-col shadow-2xl">
        {/* Call header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold truncate">{chatTitle}</h3>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground truncate">{callStatus}</p>
              {callStatus === 'Call in progress' && (
                <span className="text-sm font-medium text-green-500">
                  {formatCallDuration(callDuration)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => endCall()}
            className="flex items-center justify-center h-10 w-10 rounded-full bg-destructive hover:bg-destructive/90 transition-colors"
            aria-label="End call">
            <Phone className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Video area - responsive layout */}
        <div className="flex-1 relative flex flex-col md:flex-row gap-2 p-2 overflow-hidden">
          {/* Remote video or recipient info during ringing */}
          <div className="flex-1 w-full md:w-2/3 bg-muted rounded-xl overflow-hidden relative shadow-lg">
            {/* Remote video element */}
            <video 
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full ${isRemoteVideoConnected ? 'block' : 'hidden'}`}
              style={{ objectFit: 'cover' }}
            />
          
            {/* Show profile placeholder when video is not connected */}
            {!isRemoteVideoConnected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
                <div className="bg-secondary rounded-full w-16 h-16 sm:w-24 sm:h-24 flex items-center justify-center mb-4 border-2 border-primary/30">
                  {(remoteUser?.photoURL || selectedChat?.photoURL) ? (
                    <img 
                      src={remoteUser?.photoURL || selectedChat?.photoURL} 
                      alt={chatTitle} 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xl sm:text-2xl font-bold">
                      {chatTitle?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-semibold mb-2 text-center px-2">{chatTitle}</h2>
                <p className="text-muted-foreground mb-4 text-center px-4">
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
          <div className="w-full md:w-1/3 bg-muted rounded-xl overflow-hidden relative shadow-lg">
            <video 
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                <VideoOff className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
              </div>
            )}
            
            {/* Local video label for better UX */}
            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
              You
            </div>
          </div>
        </div>

        {/* Call controls - improved responsive layout */}
        <div className="p-3 border-t border-gray-700">
          <div className="flex items-center justify-center gap-4 md:gap-6">
            <button
              onClick={toggleMute}
              className={`flex flex-col items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-full ${isMuted ? 'bg-destructive' : 'bg-secondary'} hover:opacity-90 transition-all`}
              aria-label={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? (
                <>
                  <MicOff className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-[8px] sm:text-[10px] mt-1">Unmute</span>
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-[8px] sm:text-[10px] mt-1">Mute</span>
                </>
              )}
            </button>
            
            <button
              onClick={toggleVideo}
              className={`flex flex-col items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-full ${isVideoOff ? 'bg-destructive' : 'bg-secondary'} hover:opacity-90 transition-all`}
              aria-label={isVideoOff ? "Turn on camera" : "Turn off camera"}>
              {isVideoOff ? (
                <>
                  <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-[8px] sm:text-[10px] mt-1">Video Off</span>
                </>
              ) : (
                <>
                  <Video className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-[8px] sm:text-[10px] mt-1">Video On</span>
                </>
              )}
            </button>
            
            <button
              onClick={toggleScreenShare}
              className={`flex flex-col items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-full ${isScreenSharing ? 'bg-primary' : 'bg-secondary'} hover:opacity-90 transition-all`}
              aria-label={isScreenSharing ? "Stop screen share" : "Start screen share"}>
              {isScreenSharing ? (
                <>
                  <MonitorOff className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-[8px] sm:text-[10px] mt-1">Stop Share</span>
                </>
              ) : (
                <>
                  <Monitor className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-[8px] sm:text-[10px] mt-1">Share Screen</span>
                </>
              )}
            </button>
            
            <button
              onClick={() => endCall()}
              className="flex flex-col items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-destructive hover:bg-destructive/90 transition-all"
              aria-label="End call">
              <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              <span className="text-[8px] sm:text-[10px] mt-1 text-white">End</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}