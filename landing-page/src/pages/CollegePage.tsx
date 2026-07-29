import CollegeHero from '../components/college/CollegeHero';
import ForStudents from '../components/college/ForStudents';
import ForOrganizers from '../components/college/ForOrganizers';
import InterCollegeLeaderboard from '../components/college/InterCollegeLeaderboard';
import ContestGallery from '../components/college/ContestGallery';
import ProblemShowcase from '../components/college/ProblemShowcase';
import TemplateGallery from '../components/college/TemplateGallery';
import CertificatePreview from '../components/college/CertificatePreview';
import PlacementConnect from '../components/college/PlacementConnect';
import CollegeCTA from '../components/college/CollegeCTA';
import LiveJudgeSpeed from '../components/shared/LiveJudgeSpeed';

export default function CollegePage() {
  return (
    <div className="bg-black text-white">
      <CollegeHero />
      <ForStudents />
      <ForOrganizers />
      <InterCollegeLeaderboard />
      <LiveJudgeSpeed />
      <ContestGallery />
      <ProblemShowcase />
      <TemplateGallery />
      <CertificatePreview />
      <PlacementConnect />
      <CollegeCTA />

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-black font-black text-sm">⚡</div>
              <span className="font-bold text-white tracking-tight">ContestOS</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
              {['Features', 'Pricing', 'Docs', 'Blog', 'Privacy', 'Terms'].map(l => (
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
