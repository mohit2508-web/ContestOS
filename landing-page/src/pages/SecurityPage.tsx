import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { portalLink } from '../lib/portal';

const SECURITY_FEATURES = [
  { icon: '🔐', title: 'End-to-End Encryption', desc: 'AES-256 encryption at rest, TLS 1.3 in transit. Your data never touches unencrypted storage.', color: '#3B82F6' },
  { icon: '🛡️', title: 'SOC 2 Type II', desc: 'Audited annually by independent third parties. Full audit reports available under NDA.', color: '#8B5CF6' },
  { icon: '🌍', title: 'GDPR Compliant', desc: 'Full data residency controls. EU candidates stay in EU data centers. Right to deletion honored.', color: '#10B981' },
  { icon: '🔑', title: 'SSO / SAML', desc: 'Enterprise SSO integration with Okta, Azure AD, Google Workspace. One-click team provisioning.', color: '#F59E0B' },
  { icon: '📋', title: 'Audit Logs', desc: 'Every action logged with timestamps. Full traceability for compliance and incident response.', color: '#EC4899' },
  { icon: '🚨', title: 'Incident Response', desc: '24-hour SLA for critical vulnerabilities. Dedicated security team on-call around the clock.', color: '#EF4444' },
  { icon: '🏗️', title: 'Isolated Infrastructure', desc: 'Multi-tenant isolation with dedicated VPCs. No noisy neighbors. No cross-contamination.', color: '#6366F1' },
];

const COMPLIANCE_BADGES = [
  { name: 'SOC 2', desc: 'Type II Certified', color: '#3B82F6' },
  { name: 'ISO 27001', desc: 'Information Security', color: '#8B5CF6' },
  { name: 'GDPR', desc: 'Data Protection', color: '#10B981' },
  { name: 'CCPA', desc: 'Privacy Rights', color: '#F59E0B' },
];

const FEATURE_DETAILS = [
  {
    title: 'Data Encryption',
    items: ['AES-256 at rest', 'TLS 1.3 in transit', 'Key rotation every 90 days', 'HSM-backed key management'],
  },
  {
    title: 'Access Control',
    items: ['Role-based access (RBAC)', 'SSO / SAML / OIDC', 'Multi-factor authentication', 'IP allowlisting'],
  },
  {
    title: 'Infrastructure',
    items: ['AWS + GCP multi-cloud', '99.9% uptime SLA', 'Automated failover', 'DDoS protection'],
  },
  {
    title: 'Compliance',
    items: ['SOC 2 Type II', 'ISO 27001', 'GDPR + CCPA', 'Annual pen testing'],
  },
];

export default function SecurityPage() {
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const ref4 = useRef<HTMLDivElement>(null);
  const inView1 = useInView(ref1, { once: true, margin: '-100px' });
  const inView2 = useInView(ref2, { once: true, margin: '-100px' });
  const inView3 = useInView(ref3, { once: true, margin: '-100px' });
  const inView4 = useInView(ref4, { once: true, margin: '-100px' });
  const [incidentEmail, setIncidentEmail] = useState('');

  return (
    <div className="bg-black text-white">
      {/* Hero */}
      <section className="relative min-h-[65vh] flex items-center justify-center px-4 pt-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_60%)]" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/20 bg-green-500/5 mb-8">
              <div className="relative">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping" />
              </div>
              <span className="text-sm font-mono text-green-400">All Systems Operational</span>
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15 }}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[0.95] mb-6"
          >
            Enterprise-grade<br />
            <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              security.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed"
          >
            Your candidates' data is sensitive. We treat it that way. SOC 2, ISO 27001, GDPR — not promises, certifications.
          </motion.p>
        </div>
      </section>

      {/* Security Feature Cards */}
      <section ref={ref1} className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={inView1 ? { opacity: 1, y: 0 } : {}} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">Security architecture</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">Every layer, from infrastructure to application, is designed with security first.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {SECURITY_FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 30 }}
                animate={inView1 ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.07 }}
                className="group relative backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.06] p-6 hover:border-white/10 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle at center, ${feat.color}15, transparent 70%)` }} />
                <div className="relative z-10">
                  <div className="text-2xl mb-3">{feat.icon}</div>
                  <h3 className="text-base font-bold text-white mb-2">{feat.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{feat.desc}</p>
                </div>
                <div className="absolute bottom-0 left-0 w-0 h-0.5 group-hover:w-full transition-all duration-700" style={{ backgroundColor: feat.color }} />
              </motion.div>
            ))}

            {/* Status card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={inView1 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="group relative rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-emerald-500/5 p-6 flex flex-col justify-center"
            >
              <div className="absolute top-4 right-4">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping" />
                </div>
              </div>
              <div className="relative z-10">
                <div className="text-sm font-mono text-green-400 mb-2">STATUS</div>
                <div className="text-lg font-bold text-white mb-1">All Systems Operational</div>
                <p className="text-xs text-gray-500">Last incident: 127 days ago (resolved in 23 minutes)</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Feature Breakdown */}
      <section ref={ref2} className="py-24 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={inView2 ? { opacity: 1, y: 0 } : {}} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">How we protect your data</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">Defense in depth — every layer independently secured.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FEATURE_DETAILS.map((detail, i) => (
              <motion.div
                key={detail.title}
                initial={{ opacity: 0, y: 30 }}
                animate={inView2 ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.06] p-8"
              >
                <h3 className="text-lg font-bold text-white mb-4">{detail.title}</h3>
                <div className="space-y-3">
                  {detail.items.map(item => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="text-green-400 text-xs">●</span>
                      <span className="text-sm text-gray-300">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Badges */}
      <section ref={ref3} className="py-24 px-4 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={inView3 ? { opacity: 1, y: 0 } : {}} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">Certifications & compliance</h2>
            <p className="text-gray-400 text-lg">Independently verified. Not self-claimed.</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {COMPLIANCE_BADGES.map((badge, i) => (
              <motion.div
                key={badge.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={inView3 ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.06] p-6 text-center hover:border-white/10 transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: `${badge.color}15`, border: `1px solid ${badge.color}33` }}>
                  <span className="text-xl font-black" style={{ color: badge.color }}>{badge.name}</span>
                </div>
                <p className="text-xs text-gray-500">{badge.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Incident Reporting */}
      <section ref={ref4} className="py-24 px-4 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={inView4 ? { opacity: 1, y: 0 } : {}} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Report a security incident</h2>
            <p className="text-gray-400">Discovered a vulnerability? We take security reports seriously. Respond within 24 hours.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView4 ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15 }}
            className="backdrop-blur-xl bg-white/[0.03] rounded-2xl border border-white/[0.08] p-8"
          >
            <div className="mb-4">
              <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Your Email</label>
              <input
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/40 transition-colors"
                placeholder="security-researcher@company.com"
                value={incidentEmail}
                onChange={e => setIncidentEmail(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Severity</label>
              <div className="flex gap-3">
                <button className="flex-1 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-medium cursor-pointer">Critical</button>
                <button className="flex-1 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-gray-400 text-sm font-medium cursor-pointer hover:border-white/15 transition-colors">Medium</button>
                <button className="flex-1 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-gray-400 text-sm font-medium cursor-pointer hover:border-white/15 transition-colors">Low</button>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Description</label>
              <textarea
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/40 transition-colors h-32 resize-none"
                placeholder="Describe the vulnerability or incident..."
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl font-bold text-sm text-white cursor-pointer"
            >
              Report Incident
            </motion.button>
            <p className="text-xs text-gray-600 text-center mt-3">We respond within 24 hours for critical issues.</p>
          </motion.div>
        </div>
      </section>

      {/* Enterprise CTA */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="backdrop-blur-xl bg-white/[0.03] rounded-3xl border border-white/10 p-12 md:p-16"
          >
            <h2 className="text-4xl md:text-5xl font-black mb-6">
              Security isn't a feature.<br />
              <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">It's the foundation.</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10">
              Need a security assessment or have compliance questions? Our security team is ready.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: '0 0 50px rgba(16,185,129,0.3)' }}
                whileTap={{ scale: 0.97 }}
                className="px-10 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full font-bold text-lg text-white cursor-pointer"
              >
                Request Security Assessment
              </motion.button>
              <motion.a
                href={portalLink('/login')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-10 py-4 border border-white/15 rounded-full font-bold text-lg text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors inline-block"
              >
                Download Security Whitepaper
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
              {['Features', 'Pricing', 'Security', 'Docs', 'Privacy', 'Terms'].map(l => (
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
