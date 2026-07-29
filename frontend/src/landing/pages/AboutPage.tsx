import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { portalLink } from '../lib/portal';

const VALUES = [
  { icon: '⚖️', title: 'Integrity over convenience', desc: "We'd rather flag a suspicious submission than pretend proctoring is perfect.", color: '#3B82F6' },
  { icon: '💻', title: 'Real code over resumes', desc: 'Skill shows up in what someone builds under pressure, not in a document.', color: '#10B981' },
  { icon: '⚡', title: 'Speed matters', desc: 'A judge result that takes a day is a judge result nobody trusts.', color: '#F59E0B' },
  { icon: '🔍', title: 'Transparency with organizers', desc: 'Every score comes with the data behind it — not a black-box number.', color: '#8B5CF6' },
];

const TEAM = [
  {
    name: 'Mohit',
    role: 'Co-founder',
    detail: 'Product & Engineering',
    color: '#3B82F6',
  },
  {
    name: 'Surbhi Rajput',
    role: 'Co-founder',
    detail: 'Operations & Outreach',
    color: '#8B5CF6',
  },
];

const NUMBERS = [
  { value: '150+', label: 'Contests Run' },
  { value: '50K+', label: 'Submissions Judged' },
  { value: '15K+', label: 'Active Competitors' },
  { value: '98.5%', label: 'Judge Uptime' },
];

export default function AboutPage() {
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const ref4 = useRef<HTMLDivElement>(null);
  const ref5 = useRef<HTMLDivElement>(null);
  const inView1 = useInView(ref1, { once: true, margin: '-100px' });
  const inView2 = useInView(ref2, { once: true, margin: '-100px' });
  const inView3 = useInView(ref3, { once: true, margin: '-100px' });
  const inView4 = useInView(ref4, { once: true, margin: '-100px' });
  const inView5 = useInView(ref5, { once: true, margin: '-100px' });

  return (
    <div className="bg-black text-white">
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center justify-center px-4 pt-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.08),transparent_60%)]" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/20 bg-purple-500/5 mb-8">
              <span className="text-sm font-mono text-purple-400">About Us</span>
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15 }}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[0.95] mb-6"
          >
            We're building the fairest way<br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
              to prove skill.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed"
          >
            No resumes, no guesswork — just real code, judged in real time.
          </motion.p>
        </div>
      </section>

      {/* Origin Story */}
      <section ref={ref1} className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={inView1 ? { opacity: 1, y: 0 } : {}} className="mb-12">
            <h2 className="text-3xl md:text-5xl font-black mb-4">How ContestOS started</h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView1 ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15 }}
            className="space-y-6 text-gray-400 text-lg leading-relaxed"
          >
            <p>
              ContestOS didn't start as its own product. It began as a piece of{' '}
              <span className="text-white font-medium">TalentOS</span> — a talent
              assessment platform where the contest and judging engine kept turning
              out to be the part people cared about most.
            </p>
            <p>
              Recruiters didn't want another applicant tracker. They wanted to know,
              in minutes, whether a candidate could actually write working code.
              Colleges didn't want a static quiz tool — they wanted something that
              felt like a real contest, with a live leaderboard and instant judging,
              that students would actually get excited about.
            </p>
            <p>
              So we pulled that piece out, rebuilt it as a standalone platform, and
              gave it one job:{' '}
              <span className="text-white font-medium">run contests</span> — for
              hiring, for campuses, for anyone who wants to judge skill by what
              someone can build, not what's written on a page.
            </p>
            <p className="text-white font-bold text-xl">That's ContestOS.</p>
          </motion.div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section ref={ref2} className="py-24 px-4 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={inView2 ? { opacity: 1, y: 0 } : {}} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">Mission & Vision</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={inView2 ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.15 }}
              className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.06] p-8"
            >
              <div className="text-xs font-mono text-blue-400 uppercase tracking-wider mb-4">Mission</div>
              <p className="text-2xl font-bold text-white leading-snug">
                Judge people on real code, not credentials.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={inView2 ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.25 }}
              className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.06] p-8"
            >
              <div className="text-xs font-mono text-purple-400 uppercase tracking-wider mb-4">Vision</div>
              <p className="text-lg text-gray-300 leading-relaxed">
                A world where every campus contest and every hiring test runs on a
                platform built for fairness — real-time, tamper-proof, and honest
                about what it can and can't guarantee.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section ref={ref3} className="py-24 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={inView3 ? { opacity: 1, y: 0 } : {}} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">What we believe</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">These aren't aspirational values. They're architectural decisions.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {VALUES.map((val, i) => (
              <motion.div
                key={val.title}
                initial={{ opacity: 0, y: 30 }}
                animate={inView3 ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                className="group relative backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.06] p-8 hover:border-white/10 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle at center, ${val.color}10, transparent 70%)` }} />
                <div className="relative z-10 flex items-start gap-4">
                  <div className="text-2xl flex-shrink-0 mt-1">{val.icon}</div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">{val.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{val.desc}</p>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 w-0 h-0.5 group-hover:w-full transition-all duration-700" style={{ backgroundColor: val.color }} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section ref={ref4} className="py-24 px-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={inView4 ? { opacity: 1, y: 0 } : {}} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">Who's building this</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {TEAM.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 30 }}
                animate={inView4 ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
                className="group relative backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.06] p-8 text-center hover:border-white/10 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle at center, ${member.color}15, transparent 70%)` }} />
                <div className="relative z-10">
                  <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: `${member.color}15`, border: `1px solid ${member.color}33` }}>
                    <span className="text-3xl font-black" style={{ color: member.color }}>{member.name[0]}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{member.name}</h3>
                  <p className="text-sm font-medium text-gray-400 mb-1">{member.role}</p>
                  <p className="text-xs text-gray-500">{member.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* By the Numbers */}
      <section ref={ref5} className="py-24 px-4 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={inView5 ? { opacity: 1, y: 0 } : {}} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">By the numbers</h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {NUMBERS.map((num, i) => (
              <motion.div
                key={num.label}
                initial={{ opacity: 0, y: 20 }}
                animate={inView5 ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-black bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2">{num.value}</div>
                <div className="text-xs text-gray-500 uppercase tracking-widest">{num.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="backdrop-blur-xl bg-white/[0.03] rounded-3xl border border-white/10 p-12 md:p-16"
          >
            <h2 className="text-4xl md:text-5xl font-black mb-6">
              Want to see it in action?
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10">
              Run a free assessment or host your next contest — set up in minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.a
                href={portalLink('/register')}
                whileHover={{ scale: 1.03, boxShadow: '0 0 50px rgba(59,130,246,0.3)' }}
                whileTap={{ scale: 0.97 }}
                className="px-10 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full font-bold text-lg text-white cursor-pointer inline-block"
              >
                Book a Demo
              </motion.a>
              <motion.a
                href={portalLink('/register')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-10 py-4 border border-white/15 rounded-full font-bold text-lg text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors inline-block"
              >
                Host a Contest
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>

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
