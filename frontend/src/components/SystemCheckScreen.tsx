import { useState, useEffect, useRef } from 'react';

interface SystemCheckScreenProps {
  onComplete: (config: { video: boolean; audio: boolean }) => void;
}

interface CheckItem {
  id: string;
  label: string;
  status: 'pending' | 'testing' | 'success' | 'error';
  error?: string;
  solution?: string;
}

const INITIAL_CHECKS: CheckItem[] = [
  { id: 'network', label: 'Network Connection', status: 'pending' },
  { id: 'camera', label: 'Camera Access', status: 'pending' },
  { id: 'mic', label: 'Microphone Access', status: 'pending' },
  { id: 'security', label: 'Security & Environment', status: 'pending' },
];

export function SystemCheckScreen({ onComplete }: SystemCheckScreenProps) {
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL_CHECKS);
  const [currentCheck, setCurrentCheck] = useState<number>(0);
  const [isFailed, setIsFailed] = useState(false);
  const [isAllPassed, setIsAllPassed] = useState(false);
  const startedRef = useRef(false);
  
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(0);

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const updateCheck = (id: string, updates: Partial<CheckItem>) => {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const runAllChecks = async (startIndex: number = 0) => {
    setIsFailed(false);
    let failed = false;
    let localStream = mediaStream;
    
    for (let i = startIndex; i < INITIAL_CHECKS.length; i++) {
      if (failed) break;
      const checkId = INITIAL_CHECKS[i].id;
      
      setCurrentCheck(i);
      updateCheck(checkId, { status: 'testing', error: undefined, solution: undefined });
      
      await new Promise(r => setTimeout(r, 1000));
      
      try {
        if (checkId === 'network') {
          if (!navigator.onLine) throw new Error('No internet connection');
          try {
            await fetch(window.location.origin, { method: 'HEAD', cache: 'no-store' });
          } catch {
            throw new Error('Cannot reach server');
          }
        } else if (checkId === 'camera') {
          // Request both video and audio upfront to avoid multiple permission popups,
          // but verify video specifically in this step.
          if (!localStream) {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setMediaStream(localStream);
          }
          if (localStream.getVideoTracks().length === 0) {
            throw new Error('No video tracks found');
          }
        } else if (checkId === 'mic') {
          if (!localStream) {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setMediaStream(localStream);
          }
          if (localStream.getAudioTracks().length === 0) {
            throw new Error('No audio tracks found');
          }
        } else if (checkId === 'security') {
          const isSuspicious = window.outerWidth - window.innerWidth > 250 || window.outerHeight - window.innerHeight > 250;
          if (isSuspicious) throw new Error('Developer tools or external app detected');
        }
        
        updateCheck(checkId, { status: 'success' });
        await new Promise(r => setTimeout(r, 500));
      } catch (error: any) {
        failed = true;
        let errorMsg = error.message || 'Unknown error';
        let solutionMsg = 'Please try again.';
        
        if (checkId === 'camera') {
          errorMsg = 'Camera access denied or no camera found.';
          solutionMsg = 'Allow camera permissions in your browser URL bar (the lock icon) and ensure your webcam is plugged in.';
        } else if (checkId === 'mic') {
          errorMsg = 'Microphone access denied or no mic found.';
          solutionMsg = 'Allow microphone permissions in your browser settings and ensure it is not muted.';
        } else if (checkId === 'network') {
          errorMsg = 'Unstable or disconnected network.';
          solutionMsg = 'Check your WiFi connection and ensure you are connected to the internet.';
        } else if (checkId === 'security') {
          errorMsg = 'Screen manipulation or developer tools detected.';
          solutionMsg = 'Close developer tools, unauthorized extensions, or screen sharing applications, then maximize your window.';
        }
        
        updateCheck(checkId, { status: 'error', error: errorMsg, solution: solutionMsg });
        setIsFailed(true);
        break;
      }
    }
    
    if (!failed) {
      setIsAllPassed(true);
    }
  };

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      runAllChecks(0);
    }
  }, []);

  // Set up video preview and audio meter
  useEffect(() => {
    if (mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(() => {});
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      
      try {
        // Some browsers need a dedicated audio-only stream for the analyser to work properly
        const audioTracks = mediaStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const audioOnlyStream = new MediaStream([audioTracks[0]]);
          const source = audioCtx.createMediaStreamSource(audioOnlyStream);
          source.connect(analyser);
          
          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
          }
          
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let animationId: number;
          
          const updateVolume = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            
            // Apply a noise floor threshold to filter out ambient silence
            const noiseFloor = 10;
            const normalizedVolume = average < noiseFloor ? 0 : average - noiseFloor;
            
            setVolume(normalizedVolume);
            animationId = requestAnimationFrame(updateVolume);
          };
          updateVolume();
          
          return () => {
            cancelAnimationFrame(animationId);
            source.disconnect();
            audioCtx.close().catch(() => {});
          };
        }
      } catch (e) {
        console.error('AudioContext setup failed', e);
      }
    }
  }, [mediaStream]);

  // Clean up streams when moving forward
  const handleComplete = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
    }
    onComplete({ video: videoEnabled, audio: audioEnabled });
  };

  const handleRetry = () => {
    runAllChecks(currentCheck);
  };

  // volume represents the average frequency magnitude minus noise floor.
  // Normal speaking average is around 10-35. Scale it accordingly.
  const volumePercentage = Math.min(100, (volume / 60) * 100);

  return (
    <div className="fixed inset-0 bg-[#08090d] z-50 flex items-center justify-center p-6 overflow-y-auto">
      <div className="max-w-4xl w-full bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col md:flex-row gap-8">
        
        {/* Left Side: Camera & Mic Preview */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="text-left mb-2 md:hidden">
            <h2 className="text-2xl font-bold text-white mb-2">System Diagnostics</h2>
            <p className="text-sm text-[var(--text-muted)]">Verifying your environment before the interview begins.</p>
          </div>
          
          <div className="w-full aspect-video bg-black rounded-xl overflow-hidden relative border border-white/10 shadow-inner">
            {mediaStream ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover transform scale-x-[-1]" 
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-muted)] bg-black">
                <svg className="w-12 h-12 mb-3 opacity-20 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Waiting for camera...</span>
              </div>
            )}
            
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${mediaStream ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
              <span className="text-xs font-bold text-white uppercase tracking-wider drop-shadow-md">Live</span>
            </div>
          </div>
          
          <div className="bg-white/5 p-5 rounded-xl border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-white font-bold">Camera &amp; Microphone Active</h3>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-4 pl-8">
              Ensure you are in a quiet, well-lit environment.
            </p>
            
            <div className="pl-8">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Voice Meter</span>
              </div>
              <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/5 mb-6">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 via-[var(--accent-yellow)] to-red-500 transition-all duration-75 ease-out" 
                  style={{ width: `${volumePercentage}%` }} 
                />
              </div>

              {isAllPassed && (
                <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-white/10">
                  <h4 className="text-sm font-bold text-white mb-1">Before you join...</h4>
                  
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${videoEnabled ? 'bg-white/10 text-white' : 'bg-red-500/20 text-red-400'}`}>
                        {videoEnabled ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-5.409l-7.5-7.5m3.568 3.568L2.25 9c0-1.24 1.01-2.25 2.25-2.25h7.5M12 9.75v-1.5" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium text-white">Camera</span>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={videoEnabled} onChange={() => setVideoEnabled(!videoEnabled)} />
                      <div className="w-11 h-6 bg-black border border-white/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-yellow)] peer-checked:border-[var(--accent-yellow)]"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${audioEnabled ? 'bg-white/10 text-white' : 'bg-red-500/20 text-red-400'}`}>
                        {audioEnabled ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L5 5m14 0v4a7 7 0 01-1 3.5M12 19a7 7 0 01-7-7V9m7 10v2m-3 0h6M9 9V5a3 3 0 016 0v2" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium text-white">Microphone</span>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={audioEnabled} onChange={() => setAudioEnabled(!audioEnabled)} />
                      <div className="w-11 h-6 bg-black border border-white/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-yellow)] peer-checked:border-[var(--accent-yellow)]"></div>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Diagnostics Checklist */}
        <div className="w-full md:w-[400px] flex flex-col justify-between">
          <div>
            <div className="hidden md:block mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">System Diagnostics</h2>
              <p className="text-sm text-[var(--text-muted)]">Verifying your environment before the interview begins.</p>
            </div>

            <div className="space-y-3">
              {checks.map((check, index) => (
                <div 
                  key={check.id} 
                  className={`flex flex-col p-4 rounded-xl border transition-all duration-300 ${
                    check.status === 'success' ? 'bg-green-500/10 border-green-500/20' :
                    check.status === 'error' ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]' :
                    check.status === 'testing' ? 'bg-white/5 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]' :
                    'bg-black/20 border-white/5 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        check.status === 'success' ? 'bg-green-500/20 text-green-400' :
                        check.status === 'error' ? 'bg-red-500/20 text-red-400' :
                        check.status === 'testing' ? 'bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)]' :
                        'bg-white/5 text-[var(--text-muted)]'
                      }`}>
                        {check.status === 'success' ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : check.status === 'error' ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : check.status === 'testing' ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="text-xs font-bold">{index + 1}</span>
                        )}
                      </div>
                      <span className={`font-medium ${
                        check.status === 'success' ? 'text-green-400' :
                        check.status === 'error' ? 'text-red-400' :
                        check.status === 'testing' ? 'text-white' :
                        'text-[var(--text-muted)]'
                      }`}>
                        {check.label}
                      </span>
                    </div>
                    
                    {check.status === 'success' && <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Passed</span>}
                    {check.status === 'error' && <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Failed</span>}
                    {check.status === 'testing' && <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider animate-pulse">Testing...</span>}
                  </div>

                  {check.status === 'error' && (
                    <div className="mt-4 pt-4 border-t border-red-500/20">
                      <p className="text-sm text-red-400 font-semibold mb-1">{check.error}</p>
                      <p className="text-xs text-[var(--text-muted)]">{check.solution}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {isFailed ? (
              <>
                <button 
                  onClick={handleRetry}
                  className="w-full py-3 px-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retry Checks
                </button>
                <p className="text-xs text-center text-[var(--text-muted)]">
                  You cannot proceed until all system checks pass.
                </p>
              </>
            ) : isAllPassed ? (
              <button 
                onClick={handleComplete}
                className="w-full py-3 px-4 btn-yellow font-bold rounded-xl shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Proceed to Interview
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            ) : (
              <p className="text-xs text-center text-[var(--text-muted)] py-4 opacity-50">
                Please wait while we verify your system...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
