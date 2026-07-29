import { useState, useRef, useCallback, useEffect } from 'react';
import Editor from "@monaco-editor/react";

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Web Playground</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>Hello, World!</h1>
  <p>Edit the HTML to see live changes.</p>
</body>
</html>`;

export function WebPlayground({ onRegisterRun }: { onRegisterRun?: (fn: () => void) => void }) {
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [previewUrl, setPreviewUrl] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [editorWidth, setEditorWidth] = useState(50);
  const [isDrag, setIsDrag] = useState(false);

  useEffect(() => {
    if (!isDrag) return;
    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('.middle-column');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setEditorWidth(Math.max(20, Math.min(80, pct)));
    };
    const handleMouseUp = () => setIsDrag(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDrag]);

  const runPreview = useCallback(() => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [html]);

  useEffect(() => { onRegisterRun?.(runPreview); }, [onRegisterRun, runPreview]);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex-1 flex">
        <div className="flex flex-col" style={{ width: `${editorWidth}%` }}>
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1a] border-b border-white/5">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">HTML</span>
          </div>
          <div className="flex-1">
            <Editor
              height="100%"
              language="html"
              value={html}
              onChange={(value) => setHtml(value || '')}
              theme="vs-dark"
              options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: 'on', lineNumbers: 'on', folding: true, scrollBeyondLastLine: false }}
            />
          </div>
        </div>
        <div
          onMouseDown={e => { e.preventDefault(); setIsDrag(true); }}
          className="w-1.5 cursor-col-resize bg-[#2D2D2D] hover:bg-[#4CAF50] transition-colors flex-none"
        />
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex items-center px-3 py-1.5 bg-[#1a1a1a] border-b border-white/5">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Preview</span>
          </div>
          <div className="flex-1 bg-white">
            {previewUrl ? (
              <iframe ref={iframeRef} src={previewUrl} className="w-full h-full border-0" title="Preview" />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                Click "Run" to see your page
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
