import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { portalLink } from '../lib/portal';
import { KryptaviaLogo } from '../../components/common/KryptaviaLogo';

const TIERS = [
  {
    name: 'Starter',
    price: 'Free',
    period: 'forever',
    desc: 'Perfect for small college fest or first-time organizers.',
    color: '#10B981',
    features: [
      'Up to 25 candidates',
      '5 contests/month',
      'Basic proctoring (tab-switch + clipboard)',
      'Auto-grading for MCQ + coding',
      'Leaderboard',
      'Community support',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Growth',
    price: '₹4,999',
    period: '/month',
    desc: 'For growing teams running regular hiring assessments.',
    color: '#3B82F6',
    features: [
      'Up to 200 candidates',
      'Unlimited contests',
      'Full 7-layer proctoring',
      'AI code similarity detection',
      'Custom branding',
      'Priority support',
      'CSV export & API access',
      'Email notifications',
    ],
    cta: 'Start 14-Day Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For large organizations with complex assessment needs.',
    color: '#8B5CF6',
    features: [
      'Unlimited candidates',
      'Unlimited contests',
      'Full 7-layer proctoring',
      'SSO / SAML integration',
      'Dedicated instance',
      'Custom problem domains',
      'SLA guarantee (99.9%)',
      'Dedicated account manager',
      'On-premise deployment option',
    ],
    cta: 'Talk to Sales',
    highlighted: false,
  },
];

const FAQS = [
  { q: 'Is there a free tier?', a: 'Yes. The Starter plan is free forever with up to 25 candidates and 5 contests per month. No credit card required.' },
  { q: 'Can I switch plans anytime?', a: 'Absolutely. Upgrade or downgrade at any time. If you downgrade, you keep your current plan until the end of the billing cycle.' },
  { q: 'Do you offer academic discounts?', a: 'Yes! Colleges and universities get 50% off all paid plans. Contact us with your .edu email to apply.' },
  { q: 'What payment methods do you accept?', a: 'We accept UPI, all major credit/debit cards, net banking, and wire transfers for enterprise plans.' },
  { q: 'How does the 14-day trial work?', a: 'Full access to all Growth plan features for 14 days. No credit card required. Cancel anytime during the trial.' },
];

export default function PricingPage() {
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const inView1 = useInView(ref1, { once: true, margin: '-100px' });
  const inView2 = useInView(ref2, { once: true, margin: '-100px' });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="bg-black text-white">
      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-center justify-center px-4 pt-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_60%)]" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/20 bg-blue-500/5 mb-8">
              <span className="text-sm font-mono text-blue-400">Simple Pricing</span>
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15 }}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[0.95] mb-6"
          >
            Pay for what<br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              you actually use.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed"
          >
            No hidden fees. No per-question charges. Start free, scale when ready.
          </motion.p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section ref={ref1} className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIERS.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 40 }}
                animate={inView1 ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.1 + i * 0.15 }}
                className={`relative rounded-2xl border p-8 flex flex-col ${
                  tier.highlighted
                    ? 'border-blue-500/30 bg-gradient-to-b from-blue-500/10 to-transparent'
                    : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-blue-500 text-xs font-bold text-white">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-1">{tier.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{tier.desc}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">{tier.price}</span>
                    {tier.period && <span className="text-sm text-gray-500">{tier.period}</span>}
                  </div>
                </div>

                <div className="flex-1 space-y-3 mb-8">
                  {tier.features.map(f => (
                    <div key={f} className="flex items-start gap-2.5">
                      <span className="text-xs mt-0.5" style={{ color: tier.color }}>✓</span>
                      <span className="text-sm text-gray-300">{f}</span>
                    </div>
                  ))}
                </div>

                <motion.a
                  href={portalLink(tier.highlighted ? '/register' : tier.name === 'Enterprise' ? '/register' : '/register')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`block w-full py-3 rounded-full font-bold text-sm cursor-pointer transition-colors text-center ${
                    tier.highlighted
                      ? 'bg-blue-500 hover:bg-blue-400 text-white'
                      : 'border border-white/15 text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tier.cta}
                </motion.a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section ref={ref2} className="py-24 px-4 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={inView2 ? { opacity: 1, y: 0 } : {}} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">Frequently asked questions</h2>
            <p className="text-gray-400">Can't find what you're looking for? <a href="#" className="text-blue-400 hover:underline">Contact us</a></p>
          </motion.div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={inView2 ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="backdrop-blur-xl bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left cursor-pointer"
                >
                  <span className="text-sm font-medium text-white">{faq.q}</span>
                  <motion.span
                    animate={{ rotate: openFaq === i ? 45 : 0 }}
                    className="text-gray-500 text-lg ml-4"
                  >
                    +
                  </motion.span>
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: openFaq === i ? 'auto' : 0, opacity: openFaq === i ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 text-sm text-gray-400 leading-relaxed">{faq.a}</p>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black mb-4">Need something specific?</h2>
            <p className="text-gray-400">Tell us about your use case and we'll put together a custom plan.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="backdrop-blur-xl bg-white/[0.03] rounded-2xl border border-white/[0.08] p-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Name</label>
                <input className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40 transition-colors" placeholder="Your name" />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Email</label>
                <input className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40 transition-colors" placeholder="you@company.com" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">I am a...</label>
              <div className="flex gap-3">
                <button className="flex-1 py-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm font-medium cursor-pointer">Company / Hiring Team</button>
                <button className="flex-1 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-gray-400 text-sm font-medium cursor-pointer hover:border-white/15 hover:text-gray-300 transition-colors">College / Organizer</button>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Message</label>
              <textarea className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40 transition-colors h-28 resize-none" placeholder="Tell us about your needs..." />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl font-bold text-sm text-white cursor-pointer"
            >
              Send Message
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <KryptaviaLogo size="sm" />
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
              {['Features', 'Pricing', 'Docs', 'Blog', 'Privacy', 'Terms'].map(l => (
                <a key={l} href="#" className="hover:text-white transition-colors">{l}</a>
              ))}
            </div>
            <p className="text-xs text-gray-600">© 2026 Kryptavia OS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
