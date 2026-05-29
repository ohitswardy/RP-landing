import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ease = [0.25, 1, 0.5, 1] as const;

// ─── Content ────────────────────────────────────────────────────────────────

const TERMS_CONTENT = {
  title: 'Terms & Conditions',
  lastUpdated: 'Effective 1 January 2025',
  sections: [
    {
      heading: 'Acceptance of Terms',
      body: `By accessing or using any services provided by Regis Partners, Inc. ("Regis Partners", "we", "us", or "our"), you agree to be bound by these Terms and Conditions and all applicable laws and regulations of the Republic of the Philippines. If you do not agree with any of these terms, you are prohibited from using or accessing this site and our services.`,
    },
    {
      heading: 'Regulatory Standing',
      body: `Regis Partners, Inc. is a registered corporation and licensed broker-dealer under the Securities Regulation Code of the Philippines (Republic Act No. 8799). We are regulated by the Securities and Exchange Commission (SEC) and are a licensed trading participant of the Philippine Stock Exchange (PSE). Our operations are subject to the rules and regulations of the Bangko Sentral ng Pilipinas (BSP) where applicable.\n\nSEC Registration No.: AS-099-XXXXX\nPSE Trading Participant License No.: [XXXXX]`,
    },
    {
      heading: 'Investment Risk Disclosure',
      body: `All securities trading and investment advisory services involve risk. Past performance is not indicative of future results. The value of investments and any income derived from them can fall as well as rise. You may not get back the amount originally invested.\n\nThis website and its contents do not constitute an offer to sell or a solicitation to buy any security in any jurisdiction where such offer or solicitation would be unlawful. Research reports and investment recommendations published by Regis Partners are for informational purposes only and should not be construed as investment advice within the meaning of Republic Act No. 8799 and its Implementing Rules and Regulations.`,
    },
    {
      heading: 'Intellectual Property',
      body: `All content on this website, including but not limited to research reports, market data analyses, proprietary indices, text, graphics, logos, and software, is the exclusive property of Regis Partners, Inc. and is protected under the Intellectual Property Code of the Philippines (Republic Act No. 8293).\n\nNo portion of this website may be reproduced, distributed, or transmitted in any form without prior written consent from Regis Partners, Inc. Unauthorized reproduction may constitute a violation of Republic Act No. 8293 and subject the infringing party to civil and criminal liability.`,
    },
    {
      heading: 'Prohibited Conduct',
      body: `You agree not to use our services or website to:\n\n• Violate Republic Act No. 8799 (Securities Regulation Code), including prohibitions on insider trading and market manipulation\n• Engage in conduct prohibited under Republic Act No. 9160 (Anti-Money Laundering Act) as amended by Republic Act No. 10365 and Republic Act No. 11521\n• Transmit any material that infringes upon the rights of third parties under Republic Act No. 8293 (Intellectual Property Code)\n• Engage in any activity that violates Republic Act No. 10175 (Cybercrime Prevention Act of 2012)\n• Circumvent or attempt to circumvent any security measure implemented by Regis Partners`,
    },
    {
      heading: 'Client Classification & Suitability',
      body: `Regis Partners serves qualified institutional investors, professional investors, and eligible clients as defined under the Securities Regulation Code and SEC regulations. Access to certain services and research may be restricted to clients who meet applicable qualification thresholds. By accessing our research portal or requesting services, you represent and warrant that you meet the applicable eligibility requirements under Philippine law and regulation.`,
    },
    {
      heading: 'Limitation of Liability',
      body: `To the maximum extent permitted by applicable Philippine law, Regis Partners, Inc. shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, arising out of or in connection with your use of our services or this website, even if advised of the possibility of such damages.\n\nOur total liability to you for any claim arising from these Terms shall not exceed the fees paid by you to Regis Partners in the twelve (12) months immediately preceding the claim.`,
    },
    {
      heading: 'Anti-Money Laundering Compliance',
      body: `Regis Partners is a covered institution under Republic Act No. 9160 (Anti-Money Laundering Act of 2001), as amended. We are required to perform customer due diligence, report suspicious transactions, and cooperate with the Anti-Money Laundering Council (AMLC). By engaging our services, you consent to the collection and processing of information required under AMLA and its implementing rules for compliance purposes.`,
    },
    {
      heading: 'Governing Law & Dispute Resolution',
      body: `These Terms and Conditions shall be governed by and construed in accordance with the laws of the Republic of the Philippines. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the proper courts of Makati City, Metro Manila, Philippines, without prejudice to the right of Regis Partners to seek injunctive relief in any appropriate jurisdiction.`,
    },
    {
      heading: 'Amendments',
      body: `Regis Partners reserves the right to amend these Terms and Conditions at any time. Amendments shall be effective upon posting on this website. Continued use of our services after the posting of any amendment constitutes your acceptance of the revised Terms. We encourage you to review these Terms periodically.`,
    },
    {
      heading: 'Contact',
      body: `For any queries regarding these Terms and Conditions, please contact our Compliance Department:\n\nRegis Partners, Inc.\nCompliance Department\n[Address], Makati City, Metro Manila 1200\ncompliance@regispartners.com.ph`,
    },
  ],
};

const PRIVACY_CONTENT = {
  title: 'Privacy & Cookies Policy',
  lastUpdated: 'Effective 1 January 2025',
  sections: [
    {
      heading: 'Data Privacy Act Compliance',
      body: `Regis Partners, Inc. is committed to protecting and upholding your right to data privacy in accordance with Republic Act No. 10173 (Data Privacy Act of 2012) and its Implementing Rules and Regulations (IRR), as enforced by the National Privacy Commission (NPC) of the Philippines.\n\nWe are registered with the National Privacy Commission as a Personal Information Controller (PIC). Our Data Protection Officer (DPO) can be reached at dpo@regispartners.com.ph.`,
    },
    {
      heading: 'Information We Collect',
      body: `We collect personal information necessary to deliver our services and comply with applicable regulations, including:\n\n• Identification information: full name, date of birth, nationality, government-issued ID numbers\n• Contact information: email address, telephone number, mailing and business address\n• Financial information: investment profile, risk tolerance, source of funds declarations required under AMLA\n• Transaction data: order history, account activity, portfolio records\n• Technical data: IP address, browser type, device identifiers, cookies and usage data\n• Communications: records of correspondence with our team, meeting notes, and research requests`,
    },
    {
      heading: 'Lawful Basis for Processing',
      body: `Under the Data Privacy Act of 2012, we process your personal data on the following lawful bases:\n\n• Contractual necessity: processing required to deliver brokerage and advisory services under our client agreement\n• Legal obligation: compliance with the Securities Regulation Code (RA 8799), Anti-Money Laundering Act (RA 9160 as amended), Tax Code, and regulations of the SEC, PSE, and AMLC\n• Legitimate interests: fraud prevention, security monitoring, and improvement of our services\n• Consent: marketing communications and non-essential cookies (where applicable)`,
    },
    {
      heading: 'How We Use Your Information',
      body: `Your personal data is used to:\n\n• Onboard you as a client and verify your identity in compliance with KYC requirements\n• Execute securities transactions and provide settlement services\n• Deliver research reports, market commentary, and investment recommendations\n• Comply with regulatory reporting obligations to the SEC, PSE, AMLC, and BIR\n• Communicate material changes to our services or your account\n• Detect and prevent fraud, money laundering, and other illicit activities\n• Analyse and improve the quality and relevance of our services`,
    },
    {
      heading: 'Data Sharing & Disclosure',
      body: `We do not sell your personal data. We may share your information only with:\n\n• Regulatory authorities: SEC, PSE, AMLC, BIR, and other government bodies as required by law\n• Service providers: third-party processors (clearing houses, custodians, technology vendors) bound by data processing agreements consistent with the DPA\n• Professional advisers: lawyers, auditors, and compliance consultants under confidentiality obligations\n• Affiliated entities: within the Regis Partners group for operational and compliance purposes\n\nAny cross-border data transfer shall comply with Section 21 of the DPA and relevant NPC issuances regarding cross-border data flow.`,
    },
    {
      heading: 'Cookies & Tracking Technologies',
      body: `We use cookies and similar tracking technologies on this website. Cookies are small text files placed on your device that help us operate and improve our website.\n\nEssential Cookies — Required for the website to function. These cannot be disabled.\n\nAnalytics Cookies — Help us understand how visitors interact with our website (e.g., pages visited, session duration). We use this data only in aggregate, anonymised form.\n\nFunctional Cookies — Remember your preferences to personalise your experience on the research portal.\n\nYou may configure your browser to refuse cookies, though this may limit the functionality of certain areas of this website. Our use of cookies is in accordance with Republic Act No. 10175 (Cybercrime Prevention Act) and relevant NPC advisories.`,
    },
    {
      heading: 'Data Retention',
      body: `We retain personal data for as long as necessary to fulfil the purposes for which it was collected, or as required by law:\n\n• Client account records: minimum ten (10) years from account closure, in accordance with SEC regulations and BSP circulars\n• Transaction records: minimum ten (10) years, in compliance with the Anti-Money Laundering Act\n• Communication records: five (5) years\n• Website usage data: up to twenty-four (24) months\n\nUpon expiry of the applicable retention period, data is securely disposed of in accordance with NPC guidelines.`,
    },
    {
      heading: 'Your Rights as a Data Subject',
      body: `Under the Data Privacy Act of 2012, you have the following rights:\n\n• Right to be Informed — to know what personal data we collect and how it is used\n• Right of Access — to request a copy of your personal data held by us\n• Right to Object — to object to processing based on legitimate interests\n• Right to Erasure or Blocking — to request deletion of data no longer necessary for the stated purpose, subject to legal retention requirements\n• Right to Rectification — to have inaccurate or incomplete data corrected\n• Right to Data Portability — to receive your data in a structured, machine-readable format\n• Right to Damages — to be indemnified for damages sustained due to unauthorised processing\n\nTo exercise any of these rights, please submit a written request to dpo@regispartners.com.ph. We will respond within fifteen (15) working days in accordance with NPC guidelines.`,
    },
    {
      heading: 'Security Measures',
      body: `Regis Partners implements physical, technical, and organisational security measures to protect your personal data against unauthorised access, disclosure, alteration, and destruction. Our security programme is designed in accordance with NPC Circular No. 16-01 and industry best practices, and includes access controls, encryption of data in transit and at rest, periodic security assessments, and mandatory data privacy training for all staff.\n\nIn the event of a personal data breach that may cause serious harm to data subjects, we will notify the NPC within seventy-two (72) hours of discovery, and affected data subjects as required under the DPA.`,
    },
    {
      heading: 'Contact & Complaints',
      body: `If you have questions about this Privacy Policy or wish to file a complaint regarding how we handle your personal data, contact our Data Protection Officer:\n\nData Protection Officer\nRegis Partners, Inc.\n[Address], Makati City, Metro Manila 1200\ndpo@regispartners.com.ph\n\nYou also have the right to lodge a complaint with the National Privacy Commission (NPC) at www.privacy.gov.ph.`,
    },
  ],
};

// ─── Component ───────────────────────────────────────────────────────────────

type ModalType = 'terms' | 'privacy' | null;

interface LegalModalProps {
  open: ModalType;
  onClose: () => void;
}

export default function LegalModal({ open, onClose }: LegalModalProps) {
  const content = open === 'terms' ? TERMS_CONTENT : open === 'privacy' ? PRIVACY_CONTENT : null;

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && content && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(10, 12, 20, 0.72)', backdropFilter: 'blur(4px)' }}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.32, ease }}
            role="dialog"
            aria-modal="true"
            aria-label={content.title}
            className="fixed inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[720px] lg:w-[800px] top-[5vh] bottom-[5vh] z-50 flex flex-col"
            style={{
              background: 'var(--color-paper)',
              border: '1px solid color-mix(in oklab, var(--color-ink) 12%, transparent)',
              boxShadow: '0 24px 64px rgba(10,12,20,0.18)',
            }}
          >
            {/* Amber conviction bar */}
            <div
              className="h-[2px] shrink-0"
              style={{ background: 'linear-gradient(90deg, var(--color-amber) 0%, var(--color-amber-deep) 55%, transparent 100%)' }}
            />

            {/* Header */}
            <div
              className="shrink-0 flex items-start justify-between px-8 pt-8 pb-6"
              style={{ borderBottom: '1px solid color-mix(in oklab, var(--color-ink) 10%, transparent)' }}
            >
              <div>
                <p className="mono text-[10px] tracking-[0.22em] uppercase mb-2" style={{ color: 'var(--color-amber-deep)' }}>
                  Legal · Regis Partners
                </p>
                <h2 className="text-[1.45rem] tracking-[-0.025em] font-medium leading-tight" style={{ color: 'var(--color-ink)' }}>
                  {content.title}
                </h2>
                <p className="mono text-[10px] tracking-[0.14em] uppercase mt-1.5" style={{ color: 'var(--color-graphite)' }}>
                  {content.lastUpdated}
                </p>
              </div>

              <button
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 ml-6 mt-0.5 w-8 h-8 flex items-center justify-center transition-colors duration-150"
                style={{
                  border: '1px solid color-mix(in oklab, var(--color-ink) 18%, transparent)',
                  color: 'var(--color-graphite)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-amber)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-amber-deep)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'color-mix(in oklab, var(--color-ink) 18%, transparent)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-graphite)';
                }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M1 1l10 10M11 1L1 11" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-8 py-7 space-y-8" style={{ scrollbarWidth: 'thin', scrollbarColor: 'color-mix(in oklab, var(--color-ink) 15%, transparent) transparent' }}>
              {content.sections.map((sec, i) => (
                <div key={i}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="shrink-0 block h-[1.5px] w-5" style={{ background: 'var(--color-amber)' }} />
                    <h3 className="mono text-[10.5px] tracking-[0.18em] uppercase" style={{ color: 'var(--color-navy)' }}>
                      {sec.heading}
                    </h3>
                  </div>
                  <div
                    className="text-[13.5px] leading-[1.8] pl-8 whitespace-pre-line"
                    style={{ color: 'var(--color-slate)' }}
                  >
                    {sec.body}
                  </div>
                </div>
              ))}

              {/* Bottom padding so last item isn't flush */}
              <div className="h-4" />
            </div>

            {/* Footer bar */}
            <div
              className="shrink-0 flex items-center justify-between px-8 py-4"
              style={{
                borderTop: '1px solid color-mix(in oklab, var(--color-ink) 10%, transparent)',
                background: 'var(--color-bone)',
              }}
            >
              <span className="mono text-[10px] tracking-[0.14em] uppercase" style={{ color: 'var(--color-silver)' }}>
                © 1999–2026 Regis Partners, Inc.
              </span>
              <button
                onClick={onClose}
                className="mono text-[10px] tracking-[0.16em] uppercase transition-colors duration-150"
                style={{ color: 'var(--color-graphite)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-amber-deep)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-graphite)')}
              >
                Close ↑
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export type { ModalType };
