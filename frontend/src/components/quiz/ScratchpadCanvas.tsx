import React, { useRef, useState, useEffect } from 'react';
import { renderVectorStrokePath, isPointNearStroke, StrokeData, Point } from '../../utils/vectorScratchpadEngine';
import { TypedMathInput } from './TypedMathInput';

interface ScratchpadCanvasProps {
  attemptQuestionId: string;
  isOpen: boolean;
  onClose: () => void;
  savedStrokes?: StrokeData[];
  onSaveStrokes?: (strokes: StrokeData[]) => void;
}

export const ScratchpadCanvas: React.FC<ScratchpadCanvasProps> = ({
  attemptQuestionId,
  isOpen,
  onClose,
  savedStrokes,
  onSaveStrokes,
}) => {
  const [activePage, setActivePage] = useState<number>(1);
  // Store pageStrokes: pageNumber -> StrokeData[]
  const [pagesStrokes, setPagesStrokes] = useState<Record<number, StrokeData[]>>({
    1: Array.isArray(savedStrokes) ? savedStrokes : [],
  });

  const [undoStack, setUndoStack] = useState<StrokeData[][]>([]);
  const [redoStack, setRedoStack] = useState<StrokeData[][]>([]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'text' | 'math'>('pen');
  const [color, setColor] = useState('#38bdf8'); // Cyan pen
  const [strokeSize, setStrokeSize] = useState(4);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 2 = 200% Zoom-to-Write
  const [showMathInput, setShowMathInput] = useState(false);
  const [activeTextNote, setActiveTextNote] = useState<{ x: number; y: number; text: string } | null>(null);

  const currentPointsRef = useRef<Point[]>([]);
  const activeStrokes = pagesStrokes[activePage] || [];

  // Update strokes for current page and trigger parent save callback
  const updateCurrentPageStrokes = (newStrokes: StrokeData[]) => {
    setUndoStack((prev) => [...prev, activeStrokes]);
    setRedoStack([]);
    setPagesStrokes((prev) => {
      const updated = { ...prev, [activePage]: newStrokes };
      if (activePage === 1 && onSaveStrokes) {
        onSaveStrokes(newStrokes);
      }
      return updated;
    });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prevStrokes = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, activeStrokes]);
    setUndoStack((prev) => prev.slice(0, -1));
    setPagesStrokes((prev) => ({ ...prev, [activePage]: prevStrokes }));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextStrokes = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, activeStrokes]);
    setRedoStack((prev) => prev.slice(0, -1));
    setPagesStrokes((prev) => ({ ...prev, [activePage]: nextStrokes }));
  };

  // Pointer Events API (captures pressure, stylus tilt & high-speed mouse points)
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isOpen) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    if (tool === 'eraser') {
      // Vector stroke eraser — remove stroke if tapped near it
      const filtered = activeStrokes.filter((s) => !isPointNearStroke(s, x, y, 18));
      if (filtered.length !== activeStrokes.length) {
        updateCurrentPageStrokes(filtered);
      }
      return;
    }

    if (tool === 'text') {
      setActiveTextNote({ x, y, text: '' });
      return;
    }

    setIsDrawing(true);
    currentPointsRef.current = [{ x, y, pressure }];
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || tool === 'eraser' || tool === 'text') return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    currentPointsRef.current.push({ x, y, pressure });
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPointsRef.current.length > 1) {
      const newStroke: StrokeData = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tool,
        color,
        size: strokeSize,
        points: [...currentPointsRef.current],
      };
      updateCurrentPageStrokes([...activeStrokes, newStroke]);
    }
    currentPointsRef.current = [];
  };

  const handleAddTextNote = () => {
    if (activeTextNote && activeTextNote.text.trim()) {
      const textStroke: StrokeData = {
        id: `text-${Date.now()}`,
        tool: 'text',
        color,
        size: 14,
        points: [],
        textContent: activeTextNote.text.trim(),
        textPos: { x: activeTextNote.x, y: activeTextNote.y },
      };
      updateCurrentPageStrokes([...activeStrokes, textStroke]);
    }
    setActiveTextNote(null);
  };

  const handleInsertMath = (latex: string) => {
    const mathStroke: StrokeData = {
      id: `math-${Date.now()}`,
      tool: 'math',
      color: '#38bdf8',
      size: 16,
      points: [],
      mathContent: latex,
      textPos: { x: 100, y: 100 },
    };
    updateCurrentPageStrokes([...activeStrokes, mathStroke]);
  };

  const clearCanvas = () => {
    updateCurrentPageStrokes([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#1e293b] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden w-full max-w-5xl flex flex-col h-[85vh]">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#0f172a] border-b border-[#334155]">
          <div className="flex items-center space-x-4">
            <span className="text-cyan-400 font-extrabold text-base flex items-center space-x-2">
              <span>✍️ Vector Smooth Scratchpad</span>
            </span>

            {/* Page Tabs */}
            <div className="flex items-center space-x-1 bg-[#1e293b] p-1 rounded-lg border border-[#334155]">
              {[1, 2, 3].map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setActivePage(page)}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    activePage === page ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Page {page}
                </button>
              ))}
            </div>
          </div>

          {/* Core Tools */}
          <div className="flex items-center space-x-3">
            {/* Tool Selection */}
            <div className="flex items-center space-x-1 bg-[#1e293b] p-1 rounded-lg border border-[#334155]">
              <button
                type="button"
                onClick={() => setTool('pen')}
                className={`px-3 py-1 rounded text-xs font-bold ${
                  tool === 'pen' ? 'bg-cyan-500 text-black' : 'text-slate-300 hover:text-white'
                }`}
              >
                🖊️ Pen
              </button>
              <button
                type="button"
                onClick={() => setTool('eraser')}
                className={`px-3 py-1 rounded text-xs font-bold ${
                  tool === 'eraser' ? 'bg-amber-500 text-black' : 'text-slate-300 hover:text-white'
                }`}
              >
                🧹 Vector Eraser
              </button>
              <button
                type="button"
                onClick={() => setTool('text')}
                className={`px-3 py-1 rounded text-xs font-bold ${
                  tool === 'text' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                🔤 Text
              </button>
              <button
                type="button"
                onClick={() => setShowMathInput(true)}
                className="px-3 py-1 rounded text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 hover:bg-teal-500/30"
              >
                ∑ Typed Math
              </button>
            </div>

            {/* Color Palette */}
            {tool === 'pen' && (
              <div className="flex items-center space-x-1 border-l border-[#334155] pl-3">
                {['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#ffffff'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full border transition-transform ${
                      color === c ? 'border-white scale-125' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}

            {/* Zoom-to-Write Toggle */}
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => (prev === 1 ? 2 : 1))}
              className={`px-3 py-1 rounded text-xs font-bold border transition-all ${
                zoomLevel === 2 ? 'bg-cyan-500/20 text-cyan-400 border-cyan-400' : 'bg-[#1e293b] text-slate-300 border-[#334155]'
              }`}
              title="Zoom-to-Write (+200% handwriting zoom)"
            >
              🔍 {zoomLevel === 2 ? 'Zoom 200%' : 'Zoom 100%'}
            </button>

            {/* Undo / Redo / Clear */}
            <div className="flex items-center space-x-1 border-l border-[#334155] pl-3">
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="px-2.5 py-1 rounded text-xs font-bold bg-[#1e293b] text-slate-300 border border-[#334155] disabled:opacity-40"
                title="Undo"
              >
                ↩
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="px-2.5 py-1 rounded text-xs font-bold bg-[#1e293b] text-slate-300 border border-[#334155] disabled:opacity-40"
                title="Redo"
              >
                ↪
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                className="px-3 py-1 rounded text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
              >
                🗑️ Clear
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded text-xs font-bold bg-slate-700 text-white hover:bg-slate-600 ml-2"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Canvas Body Workspace */}
        <div className="flex-1 relative bg-[#0f172a] overflow-auto cursor-crosshair">
          {/* SVG Vector Drawing Layer */}
          <svg
            className="w-full h-full touch-none min-h-[500px]"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Grid Pattern Background */}
            <defs>
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1e293b" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Render Saved Vector Strokes via perfect-freehand */}
            {activeStrokes.map((stroke) => {
              if (stroke.tool === 'text' && stroke.textPos) {
                return (
                  <text
                    key={stroke.id}
                    x={stroke.textPos.x}
                    y={stroke.textPos.y}
                    fill={stroke.color}
                    fontSize={stroke.size || 14}
                    fontFamily="sans-serif"
                    fontWeight="bold"
                  >
                    {stroke.textContent}
                  </text>
                );
              }

              if (stroke.tool === 'math' && stroke.textPos) {
                return (
                  <text
                    key={stroke.id}
                    x={stroke.textPos.x}
                    y={stroke.textPos.y}
                    fill="#38bdf8"
                    fontSize={16}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    ∑ {stroke.mathContent}
                  </text>
                );
              }

              const pathD = renderVectorStrokePath(stroke.points, stroke.size);
              if (!pathD) return null;

              return (
                <path
                  key={stroke.id}
                  d={pathD}
                  fill={stroke.color}
                  opacity={stroke.tool === 'eraser' ? 0 : 0.95}
                />
              );
            })}
          </svg>

          {/* Active Typed Text Popup */}
          {activeTextNote && (
            <div
              className="absolute z-40 bg-[#1e293b] border border-cyan-400 rounded-lg p-2 shadow-xl flex items-center space-x-2"
              style={{ left: activeTextNote.x * zoomLevel, top: activeTextNote.y * zoomLevel }}
            >
              <input
                type="text"
                autoFocus
                value={activeTextNote.text}
                onChange={(e) => setActiveTextNote({ ...activeTextNote, text: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTextNote()}
                placeholder="Type note & press Enter"
                className="bg-[#0f172a] text-xs text-white p-1 rounded border border-[#334155] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddTextNote}
                className="px-2 py-1 bg-cyan-500 text-black text-xs font-bold rounded"
              >
                Add
              </button>
            </div>
          )}

          {/* Typed Math Input Modal */}
          {showMathInput && (
            <div className="absolute top-6 left-6 z-40">
              <TypedMathInput onInsertMath={handleInsertMath} onClose={() => setShowMathInput(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
