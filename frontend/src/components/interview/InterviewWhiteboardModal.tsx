import React, { useRef, useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { X, Eraser, Edit3, Trash2, Download } from 'lucide-react';

interface InterviewWhiteboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  socket: Socket | null;
  sessionId: string;
}

export const InterviewWhiteboardModal: React.FC<InterviewWhiteboardModalProps> = ({
  isOpen,
  onClose,
  socket,
  sessionId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#06b6d4');
  const [lineWidth, setLineWidth] = useState(3);
  const [mode, setMode] = useState<'pen' | 'eraser'>('pen');
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background dark
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [isOpen]);

  useEffect(() => {
    if (!socket) return;

    const handleRemoteStroke = (data: { stroke: any }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { x0, y0, x1, y1, strokeColor, strokeWidth } = data.stroke;
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };

    const handleCleared = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    socket.on('interview:whiteboard-stroke-received', handleRemoteStroke);
    socket.on('interview:whiteboard-cleared', handleCleared);

    return () => {
      socket.off('interview:whiteboard-stroke-received', handleRemoteStroke);
      socket.off('interview:whiteboard-cleared', handleCleared);
    };
  }, [socket]);

  if (!isOpen) return null;

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    lastPosRef.current = { x, y };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPosRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const strokeColor = mode === 'eraser' ? '#09090b' : color;
    const strokeWidth = mode === 'eraser' ? lineWidth * 4 : lineWidth;

    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Broadcast stroke
    if (socket) {
      socket.emit('interview:whiteboard-stroke', {
        sessionId,
        stroke: {
          x0: lastPosRef.current.x,
          y0: lastPosRef.current.y,
          x1: x,
          y1: y,
          strokeColor,
          strokeWidth,
        },
      });
    }

    lastPosRef.current = { x, y };
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (socket) {
      socket.emit('interview:whiteboard-clear', { sessionId });
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `interview-whiteboard-${sessionId}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-4xl w-full flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-sm">Interactive Pair Whiteboard</h3>
            <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              REAL-TIME SYNC
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            {/* Mode selector */}
            <button
              onClick={() => setMode('pen')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all ${
                mode === 'pen' ? 'bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/20' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> Pen
            </button>
            <button
              onClick={() => setMode('eraser')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all ${
                mode === 'eraser' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" /> Eraser
            </button>
          </div>

          {/* Color palette */}
          {mode === 'pen' && (
            <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              {['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ffffff', '#a855f7'].map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white' : 'opacity-80 hover:opacity-100'}`}
                />
              ))}
            </div>
          )}

          {/* Stroke size */}
          <div className="flex items-center gap-2 text-zinc-400">
            <span>Size:</span>
            <input
              type="range"
              min="1"
              max="10"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="accent-cyan-500 w-24"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={clearCanvas}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-300 font-semibold flex items-center gap-1.5 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
            <button
              onClick={downloadCanvas}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-semibold flex items-center gap-1.5 transition-all border border-cyan-500/20"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="p-4 bg-zinc-950 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={800}
            height={480}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="rounded-xl border border-zinc-800 cursor-crosshair shadow-inner bg-zinc-950"
          />
        </div>
      </div>
    </div>
  );
};
