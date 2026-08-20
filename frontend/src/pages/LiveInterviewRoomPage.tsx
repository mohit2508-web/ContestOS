import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { io, Socket } from 'socket.io-client';
import {
  Play,
  Video,
  Mic,
  MicOff,
  VideoOff,
  MessageSquare,
  Sparkles,
  Award,
  CheckCircle,
  Clock,
  Code2,
  Send,
  Lock,
  UserCheck,
  Star,
  RefreshCw,
  AlertCircle,
  Monitor,
  Volume2,
  VolumeX,
  Radio,
  User,
  RotateCw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { InterviewJoinModal } from '../components/interview/InterviewJoinModal';
import { InterviewLoader } from '../components/interview/InterviewLoader';
import api from '../services/api';

interface ChatMessage {
  senderName: string;
  message: string;
  timestamp: number;
  isObserverOnly?: boolean;
}

export const LiveInterviewRoomPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Gate Check State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'INTERVIEWER' | 'CANDIDATE' | 'OBSERVER'>('CANDIDATE');

  // Socket state
  const socketRef = useRef<Socket | null>(null);
  const [activeParticipants, setActiveParticipants] = useState<any[]>([]);
  const [currentPhase, setCurrentPhase] = useState<'UNDERSTAND' | 'PLAN' | 'CODE' | 'OPTIMIZE' | 'COMPLETED'>('UNDERSTAND');

  // WebRTC Video & Audio Stream Refs & State
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isRemoteConnected, setIsRemoteConnected] = useState(false);
  const [remoteParticipantName, setRemoteParticipantName] = useState<string>('Remote Peer');
  const [remoteSocketId, setRemoteSocketId] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // IDE State
  const [code, setCode] = useState<string>('// Start pair programming here...\nfunction solution() {\n  \n}\n');
  const [language, setLanguage] = useState('javascript');
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [codeOutput, setCodeOutput] = useState<string | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputChat, setInputChat] = useState('');

  // Interviewer Scorecard Rubric State
  const [scoreProblem, setScoreProblem] = useState(3);
  const [scoreAlgo, setScoreAlgo] = useState(3);
  const [scoreCodeQuality, setScoreCodeQuality] = useState(3);
  const [scoreComm, setScoreComm] = useState(3);
  const [scoreEdgeCases, setScoreEdgeCases] = useState(3);
  const [recommendation, setRecommendation] = useState<'STRONG_HIRE' | 'HIRE' | 'LEAN_HIRE' | 'NO_HIRE'>('HIRE');
  const [privateNotes, setPrivateNotes] = useState('');
  const [candidateFeedback, setCandidateFeedback] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackSavedToast, setFeedbackSavedToast] = useState(false);

  // Fetch Session Details
  useEffect(() => {
    if (!sessionId) return;
    fetchSessionDetails();
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/interviews/session/${sessionId}`);
      setSessionData(data.session);
      setCurrentPhase(data.session.currentPhase || 'UNDERSTAND');

      if (data.session.problem?.starterCode) {
        const starter = data.session.problem.starterCode;
        if (typeof starter === 'string') setCode(starter);
        else if (starter.javascript) setCode(starter.javascript);
      }

      if (user && data.session.interviewerId === user.id) {
        setUserRole('INTERVIEWER');
        setIsAuthenticated(true);
      } else {
        const storedToken = sessionStorage.getItem(`interview_token_${sessionId}`);
        if (storedToken) {
          setIsAuthenticated(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch session:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Canvas Stream Fallback Generator (for 1-Machine 2-Tab Testing)
  // ─────────────────────────────────────────────────────────────
  const createFallbackStream = (label: string): MediaStream => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    let step = 0;
    const draw = () => {
      if (!ctx) return;
      step += 0.05;
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, 640, 360);

      // Glowing circle avatar
      ctx.beginPath();
      ctx.arc(320, 160 + Math.sin(step) * 8, 48, 0, Math.PI * 2);
      ctx.fillStyle = userRole === 'INTERVIEWER' ? '#06b6d4' : '#10b981';
      ctx.fill();

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, 320, 250);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '13px sans-serif';
      ctx.fillText('WebRTC Live Stream', 320, 280);
    };

    setInterval(draw, 1000 / 30);
    const canvasStream = canvas.captureStream(30);

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const dst = audioCtx.createMediaStreamDestination();
      osc.connect(dst);
      osc.start();
      const audioTrack = dst.stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
        canvasStream.addTrack(audioTrack);
      }
    } catch (e) {
      console.warn('AudioContext fallback error:', e);
    }

    return canvasStream;
  };

  // ─────────────────────────────────────────────────────────────
  // WebRTC & Media Stream Setup
  // ─────────────────────────────────────────────────────────────
  const initMediaDevices = async (): Promise<MediaStream> => {
    try {
      setMediaError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { max: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err: any) {
      console.warn('Camera/Mic permission or device lock error:', err);
      // Fallback to simulated canvas stream so 2 tabs on 1 laptop still connect WebRTC video!
      const fallback = createFallbackStream(`${userRole === 'INTERVIEWER' ? 'Interviewer' : 'Candidate'} Live Stream`);
      localStreamRef.current = fallback;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = fallback;
      }
      setMediaError('Webcam locked by another tab. Using simulated stream fallback.');
      return fallback;
    }
  };

  const createPeerConnection = (targetSocketId: string) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    pendingIceCandidatesRef.current = [];

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ],
    });

    peerConnectionRef.current = pc;

    // Attach local stream tracks to WebRTC PeerConnection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming remote stream tracks
    pc.ontrack = (event) => {
      console.log('WebRTC remote track received:', event.kind, event.streams);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play().catch((e) => console.warn('Video playback error:', e));
        setIsRemoteConnected(true);
      }
    };

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('interview:rtc-ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setIsRemoteConnected(true);
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setIsRemoteConnected(false);
      }
    };

    return pc;
  };

  // Process any buffered ICE candidates after Remote Description is set
  const processPendingIceCandidates = async () => {
    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) return;
    while (pendingIceCandidatesRef.current.length > 0) {
      const candidate = pendingIceCandidatesRef.current.shift();
      if (candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Failed to add buffered ICE candidate:', e);
        }
      }
    }
  };

  // Trigger Manual WebRTC Call Offer to Peer
  const initiateCallWithPeer = async (targetId: string) => {
    if (!targetId || !socketRef.current) return;
    try {
      const pc = createPeerConnection(targetId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit('interview:rtc-offer', { targetSocketId: targetId, sdp: offer });
    } catch (err) {
      console.error('Failed to initiate RTC call offer:', err);
    }
  };

  // Toggle Audio Mute
  const handleToggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = isAudioMuted));
      setIsAudioMuted(!isAudioMuted);
    }
  };

  // Toggle Video Off
  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((t) => (t.enabled = isVideoOff));
      setIsVideoOff(!isVideoOff);
    }
  };

  // Toggle Screen Sharing
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      const stream = await initMediaDevices();
      if (stream && peerConnectionRef.current) {
        const videoTrack = stream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          initMediaDevices();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.warn('Screen share canceled or failed:', err);
      }
    }
  };

  // Main Socket & WebRTC Lifecycle
  useEffect(() => {
    if (!isAuthenticated || !sessionId) return;

    let isMounted = true;

    const startInterviewSession = async () => {
      // 1. Initialize Media Devices FIRST before connecting socket!
      await initMediaDevices();

      if (!isMounted) return;

      // 2. Connect Socket.IO
      const socket = io('/interview', {
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;

      socket.emit('interview:join', {
        sessionId,
        userId: user?.id || `guest-${Date.now()}`,
        name: user?.name || (userRole === 'INTERVIEWER' ? 'Interviewer' : 'Candidate'),
        role: userRole,
      });

      socket.on('interview:room-state', (data: any) => {
        setActiveParticipants(data.participants || []);
        const other = data.participants.find((p: any) => p.socketId !== socket.id);
        if (other) {
          setRemoteParticipantName(other.name);
          setRemoteSocketId(other.socketId);
        }
      });

      socket.on('interview:user-joined', async (data: any) => {
        setActiveParticipants(data.participants || []);
        if (data.socketId !== socket.id) {
          setRemoteParticipantName(data.name);
          setRemoteSocketId(data.socketId);
          // Initiate Call Offer
          await initiateCallWithPeer(data.socketId);
        }
      });

      socket.on('interview:user-left', (data: any) => {
        setActiveParticipants((prev) => prev.filter((p) => p.socketId !== data.socketId));
        if (data.socketId === remoteSocketId) {
          setIsRemoteConnected(false);
          setRemoteSocketId(null);
        }
      });

      // Handle Incoming RTC Offer
      socket.on('interview:rtc-offer-received', async (data: { callerSocketId: string; sdp: any }) => {
        try {
          setRemoteSocketId(data.callerSocketId);
          const pc = createPeerConnection(data.callerSocketId);
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await processPendingIceCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('interview:rtc-answer', { targetSocketId: data.callerSocketId, sdp: answer });
        } catch (e) {
          console.error('Failed to handle RTC offer:', e);
        }
      });

      // Handle Incoming RTC Answer
      socket.on('interview:rtc-answer-received', async (data: { responderSocketId: string; sdp: any }) => {
        try {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
            await processPendingIceCandidates();
          }
        } catch (e) {
          console.error('Failed to handle RTC answer:', e);
        }
      });

      // Handle Incoming ICE Candidate
      socket.on('interview:rtc-ice-candidate-received', async (data: { senderSocketId: string; candidate: any }) => {
        try {
          if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
            pendingIceCandidatesRef.current.push(data.candidate);
          }
        } catch (e) {
          console.error('Failed to add ICE candidate:', e);
        }
      });

      socket.on('interview:phase-updated', (data: any) => {
        setCurrentPhase(data.phase);
      });

      socket.on('interview:code-updated', (data: any) => {
        if (data.code !== undefined) setCode(data.code);
      });

      socket.on('interview:language-updated', (data: any) => {
        setLanguage(data.language);
      });

      socket.on('interview:chat-message-received', (msg: ChatMessage) => {
        setChatMessages((prev) => [...prev, msg]);
      });
    };

    startInterviewSession();

    return () => {
      isMounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [isAuthenticated, sessionId, user, userRole]);

  // Handle Code Change broadcast
  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    setCode(value);
    socketRef.current?.emit('interview:code-change', { sessionId, code: value });
  };

  // Handle Phase Switch (Interviewer only)
  const handlePhaseChange = (phase: any) => {
    setCurrentPhase(phase);
    socketRef.current?.emit('interview:phase-change', { sessionId, phase });
  };

  // Handle Language Switch
  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    socketRef.current?.emit('interview:language-change', { sessionId, language: newLang });
  };

  // Handle Chat Submit
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputChat.trim()) return;

    socketRef.current?.emit('interview:chat-message', {
      sessionId,
      senderName: user?.name || (userRole === 'INTERVIEWER' ? 'Interviewer' : 'Candidate'),
      message: inputChat.trim(),
    });
    setInputChat('');
  };

  // Execute Code in Sandbox
  const handleRunCode = async () => {
    try {
      setIsRunningCode(true);
      setCodeOutput('Executing code against problem test cases...');

      const data = await api.post('/code/run', {
        code,
        language,
        problemId: sessionData?.problem?.id,
      });

      setCodeOutput(data.output || JSON.stringify(data.testResults, null, 2) || 'Execution completed with no output.');
    } catch (err: any) {
      setCodeOutput(`Execution Error: ${err?.response?.data?.error || err.message}`);
    } finally {
      setIsRunningCode(false);
    }
  };

  // Save Interviewer Feedback
  const handleSaveFeedback = async () => {
    try {
      setSavingFeedback(true);
      await api.post(`/interviews/session/${sessionId}/feedback`, {
        problemUnderstandingScore: scoreProblem,
        algorithmDesignScore: scoreAlgo,
        codeQualityScore: scoreCodeQuality,
        communicationScore: scoreComm,
        edgeCaseHandlingScore: scoreEdgeCases,
        recommendation,
        privateNotes,
        candidateFeedback,
      });

      setFeedbackSavedToast(true);
      setTimeout(() => setFeedbackSavedToast(false), 3000);
    } catch (err) {
      console.error('Failed to save feedback:', err);
    } finally {
      setSavingFeedback(false);
    }
  };

  // End Interview Session
  const handleEndInterview = async () => {
    if (!window.confirm('Are you sure you want to end this interview session? Room will be locked.')) return;
    try {
      await api.post(`/interviews/session/${sessionId}/end`, {});
      handlePhaseChange('COMPLETED');
      navigate('/interview/dashboard');
    } catch (err) {
      console.error('Failed to end interview:', err);
    }
  };

  // If candidate is not authenticated via passcode gate yet
  if (!loading && !isAuthenticated) {
    return (
      <InterviewJoinModal
        sessionId={sessionId || ''}
        sessionTitle={sessionData?.title}
        interviewerName={sessionData?.interviewer?.name}
        onSuccess={() => setIsAuthenticated(true)}
      />
    );
  }

  if (loading) {
    return <InterviewLoader mode="full" message="Connecting WebRTC streams & Monaco editor..." />;
  }

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden">
      {/* ── TOP HEADER BAR ── */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900/90 px-4 flex items-center justify-between shrink-0">
        {/* Left: Title & Host */}
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              {sessionData?.title || 'Live Interview Room'}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {userRole} MODE
              </span>
            </h1>
            <p className="text-[10px] text-zinc-400">
              Host: {sessionData?.interviewer?.name} | Active Participants: {activeParticipants.length}
            </p>
          </div>
        </div>

        {/* Center: Phase Timer Steps */}
        <div className="hidden md:flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          {(['UNDERSTAND', 'PLAN', 'CODE', 'OPTIMIZE'] as const).map((ph, idx) => (
            <button
              key={ph}
              onClick={() => userRole === 'INTERVIEWER' && handlePhaseChange(ph)}
              disabled={userRole !== 'INTERVIEWER'}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                currentPhase === ph
                  ? 'bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {idx + 1}. {ph}
            </button>
          ))}
        </div>

        {/* Right: Media Controls & Actions */}
        <div className="flex items-center gap-2">
          {/* Mute Mic button */}
          <button
            onClick={handleToggleAudio}
            title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            className={`p-2 rounded-xl border transition-colors ${
              isAudioMuted
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
            }`}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Camera toggle button */}
          <button
            onClick={handleToggleVideo}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            className={`p-2 rounded-xl border transition-colors ${
              isVideoOff
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          {/* Screen Share button */}
          <button
            onClick={handleToggleScreenShare}
            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            className={`p-2 rounded-xl border transition-colors ${
              isScreenSharing
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 animate-pulse'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4" />
          </button>

          {/* Reconnect WebRTC Call */}
          {remoteSocketId && (
            <button
              onClick={() => initiateCallWithPeer(remoteSocketId)}
              title="Reconnect Video/Audio Stream"
              className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors flex items-center gap-1 text-xs font-semibold"
            >
              <RotateCw className="w-4 h-4" /> Connect Video
            </button>
          )}

          {userRole === 'INTERVIEWER' && (
            <button
              onClick={handleEndInterview}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-semibold text-xs border border-rose-500/20 transition-all"
            >
              End Interview
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN WORKSPACE 3-PANEL LAYOUT ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: Live WebRTC Video Tiles + Problem Statement + Chat (320px) */}
        <div className="w-[320px] lg:w-[360px] border-r border-zinc-800 bg-zinc-900/40 flex flex-col shrink-0">
          
          {/* 🔴 LIVE WEBRTC 1-ON-1 VIDEO STREAMING GRID */}
          <div className="p-3 border-b border-zinc-800 bg-zinc-950 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 animate-pulse text-rose-500" />
                <span>WebRTC Live Video Call</span>
              </span>
              <div className="flex items-center gap-2">
                {remoteSocketId && (
                  <button
                    onClick={() => initiateCallWithPeer(remoteSocketId)}
                    className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <RotateCw className="w-3 h-3" /> Connect
                  </button>
                )}
                <span className="text-[10px] text-zinc-500 font-mono">720p HD</span>
              </div>
            </div>

            {mediaError && (
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] flex items-center justify-between gap-2">
                <span>{mediaError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {/* Local Participant Tile (You) */}
              <div className="relative aspect-video rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden group">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : 'block'}`}
                />

                {isVideoOff && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-600 space-y-1">
                    <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-cyan-400 font-bold text-xs">
                      {user?.name ? user.name.charAt(0) : 'U'}
                    </div>
                    <span className="text-[10px] text-zinc-500">Camera Off</span>
                  </div>
                )}

                {/* Bottom Overlay Label */}
                <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-[10px] text-white">
                  <span className="font-semibold truncate max-w-[80px]">You ({userRole})</span>
                  <div className="flex items-center gap-1">
                    {isAudioMuted ? <MicOff className="w-3 h-3 text-rose-400" /> : <Mic className="w-3 h-3 text-emerald-400" />}
                  </div>
                </div>
              </div>

              {/* Remote Peer Tile (Candidate or Host) */}
              <div className="relative aspect-video rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden group">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${isRemoteConnected ? 'block' : 'hidden'}`}
                />

                {!isRemoteConnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-600 space-y-1.5 p-2 text-center">
                    <div className="w-9 h-9 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] text-zinc-400 font-medium">{remoteParticipantName}</span>
                    {remoteSocketId && (
                      <button
                        onClick={() => initiateCallWithPeer(remoteSocketId)}
                        className="px-2 py-0.5 rounded bg-cyan-500 text-zinc-950 font-bold text-[10px]"
                      >
                        Start Stream
                      </button>
                    )}
                  </div>
                )}

                {/* Bottom Overlay Label */}
                <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-[10px] text-white">
                  <span className="font-semibold truncate max-w-[90px]">{remoteParticipantName}</span>
                  {isRemoteConnected ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-zinc-600" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Problem Details */}
          <div className="p-4 border-b border-zinc-800 flex-1 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                Problem Statement
              </span>
              {sessionData?.problem?.difficulty && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  {sessionData.problem.difficulty}
                </span>
              )}
            </div>

            <h2 className="text-base font-bold text-white">
              {sessionData?.problem?.title || 'General Pair Programming Challenge'}
            </h2>

            <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {sessionData?.problem?.description ||
                'Collaborate with your interviewer to write and optimize an algorithm.'}
            </div>

            {/* Test cases preview */}
            {sessionData?.problem?.testCases && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-medium text-zinc-400">Sample Test Cases:</span>
                {sessionData.problem.testCases
                  .filter((tc: any) => !tc.isHidden)
                  .map((tc: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono space-y-1">
                      <div className="text-zinc-400">Input: <span className="text-zinc-200">{tc.input}</span></div>
                      <div className="text-zinc-400">Output: <span className="text-emerald-400">{tc.expectedOutput}</span></div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Live Chat Panel */}
          <div className="h-[220px] border-t border-zinc-800 flex flex-col bg-zinc-950">
            <div className="px-3 py-2 border-b border-zinc-800/80 text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span>Live Room Chat</span>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
              {chatMessages.length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic text-center py-4">No messages yet. Say hello!</p>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                    <span className="font-semibold text-cyan-400 text-[11px]">{msg.senderName}: </span>
                    <span className="text-zinc-200">{msg.message}</span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendChat} className="p-2 border-t border-zinc-800 flex gap-2">
              <input
                type="text"
                placeholder="Type message..."
                value={inputChat}
                onChange={(e) => setInputChat(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button type="submit" className="p-1.5 rounded-lg bg-cyan-500 text-zinc-950 font-bold">
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* CENTER PANEL: Monaco Editor & Output (Flex 1) */}
        <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
          {/* Editor Header Bar */}
          <div className="h-10 px-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Code2 className="w-3.5 h-3.5" />
                <span>Pair Code Editor (Live Sync)</span>
              </span>
            </div>

            {/* Language Selector & Run Code */}
            <div className="flex items-center gap-3">
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
              </select>

              <button
                onClick={handleRunCode}
                disabled={isRunningCode}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition-colors shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isRunningCode ? 'Running...' : 'Run Code'}</span>
              </button>
            </div>
          </div>

          {/* Monaco Editor Component */}
          <div className="flex-1 relative">
            <Editor
              height="100%"
              language={language}
              theme="vs-dark"
              value={code}
              onChange={handleEditorChange}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                automaticLayout: true,
              }}
            />
          </div>

          {/* Code Output Window */}
          {codeOutput && (
            <div className="h-[140px] border-t border-zinc-800 bg-zinc-950 p-3 overflow-y-auto font-mono text-xs text-zinc-300 shrink-0">
              <div className="flex items-center justify-between text-zinc-500 text-[10px] mb-1 font-sans">
                <span>EXECUTION CONSOLE OUTPUT</span>
                <button onClick={() => setCodeOutput(null)} className="hover:text-white">Clear</button>
              </div>
              <pre className="text-emerald-400 whitespace-pre-wrap">{codeOutput}</pre>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Interviewer Live Scorecard Rubric (TEACHER ONLY) (280px) */}
        {userRole === 'INTERVIEWER' && (
          <div className="w-[280px] border-l border-zinc-800 bg-zinc-900/50 p-4 flex flex-col justify-between overflow-y-auto shrink-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  <span>Evaluation Scorecard</span>
                </span>
              </div>

              {/* Rubric Star Ratings */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1">Problem Understanding ({scoreProblem}/5)</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={scoreProblem}
                    onChange={(e) => setScoreProblem(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Algorithm Design ({scoreAlgo}/5)</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={scoreAlgo}
                    onChange={(e) => setScoreAlgo(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Code Quality ({scoreCodeQuality}/5)</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={scoreCodeQuality}
                    onChange={(e) => setScoreCodeQuality(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Communication ({scoreComm}/5)</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={scoreComm}
                    onChange={(e) => setScoreComm(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Edge Case Handling ({scoreEdgeCases}/5)</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={scoreEdgeCases}
                    onChange={(e) => setScoreEdgeCases(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>
              </div>

              {/* Recommendation Dropdown */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Final Recommendation</label>
                <select
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="STRONG_HIRE">⭐ Strong Hire</option>
                  <option value="HIRE">✅ Hire</option>
                  <option value="LEAN_HIRE">⚠️ Lean Hire</option>
                  <option value="NO_HIRE">🚫 No Hire</option>
                </select>
              </div>

              {/* Private Notes */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Private Interviewer Notes</label>
                <textarea
                  rows={3}
                  placeholder="Candidate demonstrated clean O(N) approach..."
                  value={privateNotes}
                  onChange={(e) => setPrivateNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Save Feedback Button */}
            <div className="pt-4 border-t border-zinc-800">
              {feedbackSavedToast && (
                <p className="text-[11px] text-emerald-400 font-semibold text-center mb-2">Scorecard Saved!</p>
              )}
              <button
                onClick={handleSaveFeedback}
                disabled={savingFeedback}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold text-xs transition-colors shadow-lg shadow-cyan-500/20"
              >
                {savingFeedback ? 'Saving...' : 'Save Evaluation Scorecard'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
