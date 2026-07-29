import CompanyHero from '../components/company/CompanyHero';
import TrustBar from '../components/company/TrustBar';
import ROIBlock from '../components/company/ROIBlock';
import ProctoringSection from '../components/company/ProctoringSection';
import HowItWorksCompany from '../components/company/HowItWorksCompany';
import SampleReport from '../components/company/SampleReport';
import CandidateExperience from '../components/company/CandidateExperience';
import CompanyCTA from '../components/company/CompanyCTA';
import LiveJudgeSpeed from '../components/shared/LiveJudgeSpeed';

export default function CompanyPage() {
  return (
    <div className="bg-black text-white">
      <CompanyHero />
      <TrustBar />
      <ROIBlock />
      <LiveJudgeSpeed />
      <ProctoringSection />
      <HowItWorksCompany />
      <SampleReport />
      <CandidateExperience />
      <CompanyCTA />

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-black font-black text-sm">⚡</div>
              <span className="font-bold text-white tracking-tight">ContestOS</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
              {['Features', 'Pricing', 'Docs', 'API', 'Privacy', 'Terms'].map(l => (
                <a key={l} href="#" className="hover:text-white transition-colors">{l}</a>
              ))}
            </div>
            <p className="text-xs text-gray-600">© 2026 ContestOS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
