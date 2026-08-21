import React, { useState } from 'react';

interface InsertInEditorButtonProps {
  code: string;
  onInsert: (code: string) => void;
}

export const InsertInEditorButton: React.FC<InsertInEditorButtonProps> = ({ code, onInsert }) => {
  const [inserted, setInserted] = useState(false);

  const handleClick = () => {
    onInsert(code);
    setInserted(true);
    setTimeout(() => setInserted(false), 2500);
  };

  return (
    <button
      onClick={handleClick}
      className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer shadow-sm ${
        inserted
          ? 'bg-emerald-600 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      }`}
    >
      {inserted ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Inserted into Editor!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Insert in Editor
        </>
      )}
    </button>
  );
};
