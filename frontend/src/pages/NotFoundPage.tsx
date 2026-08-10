import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorState } from '../components/common/ErrorState';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black p-6">
      <div className="w-full max-w-lg">
        <ErrorState
          variant="notFound"
          onAction={() => navigate('/portal')}
          ctaLabel="Back to Dashboard"
        />
      </div>
    </div>
  );
}

export default NotFoundPage;
