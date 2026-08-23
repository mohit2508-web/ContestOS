import React from 'react';
import { AiAssistedPlaygroundPage } from '../../pages/AiAssistedPlaygroundPage';

interface InContestAiWorkspaceProps {
  contest: any;
  problemItem: any;
  currentSection?: any;
  sectionTimeRemaining?: number | null;
  onBack: () => void;
  onSubmitted: (score: number) => void;
}

export const InContestAiWorkspace: React.FC<InContestAiWorkspaceProps> = ({
  contest,
  problemItem,
  currentSection,
  sectionTimeRemaining,
  onBack,
  onSubmitted,
}) => {
  return (
    <div className="flex flex-col h-screen bg-[#0d0f17] text-white overflow-hidden z-[99999] fixed inset-0">
      <AiAssistedPlaygroundPage
        isContestMode={true}
        contest={contest}
        problemItem={problemItem}
        currentSection={currentSection}
        sectionTimeRemaining={sectionTimeRemaining}
        onBack={onBack}
        onSubmitted={onSubmitted}
      />
    </div>
  );
};
