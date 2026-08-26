<?php

namespace App\Support;

/**
 * The two legal documents behind the footer links and every login portal.
 *
 * They live in `page_blocks` so the CMS Legal module can edit them: one row
 * holding the whole document, plus a row carrying the effective-date line.
 * Inside the document a line beginning `## ` opens a clause; the public site
 * renders those as the headings. This class is the shipped starting point —
 * the seeder and the legal migrations both plant it, and the public site keeps
 * a bundled copy of the same text for when the API is unreachable.
 */
class LegalDefaults
{
    public const TERMS = 'Terms & Conditions';
    public const PRIVACY = 'Privacy & Cookies Policy';

    /** Reserved field name: the dateline printed under the document title. */
    public const EFFECTIVE = 'Effective date';

    /** Reserved field name: the document itself, edited as one body of text. */
    public const DOCUMENT = 'Document';

    /** Document title => the key the public site addresses it by. */
    public static function keys(): array
    {
        return [self::TERMS => 'terms', self::PRIVACY => 'privacy'];
    }

    /** @return list<string> */
    public static function titles(): array
    {
        return array_keys(self::keys());
    }

    /**
     * The two rows each document keeps in `page_blocks`: its dateline, then
     * the document itself.
     *
     * @return list<array{page: string, field: string, value: string, position: int}>
     */
    public static function blocks(): array
    {
        $rows = [];

        foreach (self::documents() as $page => $doc) {
            $rows[] = ['page' => $page, 'field' => self::EFFECTIVE, 'value' => $doc['effective'], 'position' => 0];
            $rows[] = ['page' => $page, 'field' => self::DOCUMENT, 'value' => self::compose($doc['sections']), 'position' => 1];
        }

        return $rows;
    }

    /** Clauses into one body of text, each opened by a `## ` heading line. */
    private static function compose(array $sections): string
    {
        return implode("\n\n", array_map(
            fn (array $section) => "## {$section[0]}\n\n{$section[1]}",
            $sections,
        ));
    }

    /** @return array<string, array{effective: string, sections: list<array{0: string, 1: string}>}> */
    private static function documents(): array
    {
        return [
            self::TERMS => [
                'effective' => 'Effective 1 January 2025',
                'sections' => [
                    ['Acceptance of Terms', <<<'TXT'
                        By accessing or using any services provided by Regis Partners, Inc. ("Regis Partners", "we", "us", or "our"), you agree to be bound by these Terms and Conditions and all applicable laws and regulations of the Republic of the Philippines. If you do not agree with any of these terms, you are prohibited from using or accessing this site and our services.
                        TXT],
                    ['Regulatory Standing', <<<'TXT'
                        Regis Partners, Inc. is a registered corporation and licensed broker-dealer under the Securities Regulation Code of the Philippines (Republic Act No. 8799). We are regulated by the Securities and Exchange Commission (SEC) and are a licensed trading participant of the Philippine Stock Exchange (PSE). Our operations are subject to the rules and regulations of the Bangko Sentral ng Pilipinas (BSP) where applicable.

                        SEC Registration No.: AS-099-XXXXX
                        PSE Trading Participant License No.: [XXXXX]
                        TXT],
                    ['Investment Risk Disclosure', <<<'TXT'
                        All securities trading and investment advisory services involve risk. Past performance is not indicative of future results. The value of investments and any income derived from them can fall as well as rise. You may not get back the amount originally invested.

                        This website and its contents do not constitute an offer to sell or a solicitation to buy any security in any jurisdiction where such offer or solicitation would be unlawful. Research reports and investment recommendations published by Regis Partners are for informational purposes only and should not be construed as investment advice within the meaning of Republic Act No. 8799 and its Implementing Rules and Regulations.
                        TXT],
                    ['Intellectual Property', <<<'TXT'
                        All content on this website, including but not limited to research reports, market data analyses, proprietary indices, text, graphics, logos, and software, is the exclusive property of Regis Partners, Inc. and is protected under the Intellectual Property Code of the Philippines (Republic Act No. 8293).

                        No portion of this website may be reproduced, distributed, or transmitted in any form without prior written consent from Regis Partners, Inc. Unauthorized reproduction may constitute a violation of Republic Act No. 8293 and subject the infringing party to civil and criminal liability.
                        TXT],
                    ['Prohibited Conduct', <<<'TXT'
                        You agree not to use our services or website to:

                        • Violate Republic Act No. 8799 (Securities Regulation Code), including prohibitions on insider trading and market manipulation
                        • Engage in conduct prohibited under Republic Act No. 9160 (Anti-Money Laundering Act) as amended by Republic Act No. 10365 and Republic Act No. 11521
                        • Transmit any material that infringes upon the rights of third parties under Republic Act No. 8293 (Intellectual Property Code)
                        • Engage in any activity that violates Republic Act No. 10175 (Cybercrime Prevention Act of 2012)
                        • Circumvent or attempt to circumvent any security measure implemented by Regis Partners
                        TXT],
                    ['Client Classification & Suitability', <<<'TXT'
                        Regis Partners serves qualified institutional investors, professional investors, and eligible clients as defined under the Securities Regulation Code and SEC regulations. Access to certain services and research may be restricted to clients who meet applicable qualification thresholds. By accessing our research portal or requesting services, you represent and warrant that you meet the applicable eligibility requirements under Philippine law and regulation.
                        TXT],
                    ['Limitation of Liability', <<<'TXT'
                        To the maximum extent permitted by applicable Philippine law, Regis Partners, Inc. shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, arising out of or in connection with your use of our services or this website, even if advised of the possibility of such damages.

                        Our total liability to you for any claim arising from these Terms shall not exceed the fees paid by you to Regis Partners in the twelve (12) months immediately preceding the claim.
                        TXT],
                    ['Anti-Money Laundering Compliance', <<<'TXT'
                        Regis Partners is a covered institution under Republic Act No. 9160 (Anti-Money Laundering Act of 2001), as amended. We are required to perform customer due diligence, report suspicious transactions, and cooperate with the Anti-Money Laundering Council (AMLC). By engaging our services, you consent to the collection and processing of information required under AMLA and its implementing rules for compliance purposes.
                        TXT],
                    ['Governing Law & Dispute Resolution', <<<'TXT'
                        These Terms and Conditions shall be governed by and construed in accordance with the laws of the Republic of the Philippines. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the proper courts of Makati City, Metro Manila, Philippines, without prejudice to the right of Regis Partners to seek injunctive relief in any appropriate jurisdiction.
                        TXT],
                    ['Amendments', <<<'TXT'
                        Regis Partners reserves the right to amend these Terms and Conditions at any time. Amendments shall be effective upon posting on this website. Continued use of our services after the posting of any amendment constitutes your acceptance of the revised Terms. We encourage you to review these Terms periodically.
                        TXT],
                    ['Contact', <<<'TXT'
                        For any queries regarding these Terms and Conditions, please contact our Compliance Department:

                        Regis Partners, Inc.
                        Compliance Department
                        [Address], Makati City, Metro Manila 1200
                        compliance@regispartners.com.ph
                        TXT],
                ],
            ],

            self::PRIVACY => [
                'effective' => 'Effective 1 January 2025',
                'sections' => [
                    ['Data Privacy Act Compliance', <<<'TXT'
                        Regis Partners, Inc. is committed to protecting and upholding your right to data privacy in accordance with Republic Act No. 10173 (Data Privacy Act of 2012) and its Implementing Rules and Regulations (IRR), as enforced by the National Privacy Commission (NPC) of the Philippines.

                        We are registered with the National Privacy Commission as a Personal Information Controller (PIC). Our Data Protection Officer (DPO) can be reached at dpo@regispartners.com.ph.
                        TXT],
                    ['Information We Collect', <<<'TXT'
                        We collect personal information necessary to deliver our services and comply with applicable regulations, including:

                        • Identification information: full name, date of birth, nationality, government-issued ID numbers
                        • Contact information: email address, telephone number, mailing and business address
                        • Financial information: investment profile, risk tolerance, source of funds declarations required under AMLA
                        • Transaction data: order history, account activity, portfolio records
                        • Technical data: IP address, browser type, device identifiers, cookies and usage data
                        • Communications: records of correspondence with our team, meeting notes, and research requests
                        TXT],
                    ['Lawful Basis for Processing', <<<'TXT'
                        Under the Data Privacy Act of 2012, we process your personal data on the following lawful bases:

                        • Contractual necessity: processing required to deliver brokerage and advisory services under our client agreement
                        • Legal obligation: compliance with the Securities Regulation Code (RA 8799), Anti-Money Laundering Act (RA 9160 as amended), Tax Code, and regulations of the SEC, PSE, and AMLC
                        • Legitimate interests: fraud prevention, security monitoring, and improvement of our services
                        • Consent: marketing communications and non-essential cookies (where applicable)
                        TXT],
                    ['How We Use Your Information', <<<'TXT'
                        Your personal data is used to:

                        • Onboard you as a client and verify your identity in compliance with KYC requirements
                        • Execute securities transactions and provide settlement services
                        • Deliver research reports, market commentary, and investment recommendations
                        • Comply with regulatory reporting obligations to the SEC, PSE, AMLC, and BIR
                        • Communicate material changes to our services or your account
                        • Detect and prevent fraud, money laundering, and other illicit activities
                        • Analyse and improve the quality and relevance of our services
                        TXT],
                    ['Data Sharing & Disclosure', <<<'TXT'
                        We do not sell your personal data. We may share your information only with:

                        • Regulatory authorities: SEC, PSE, AMLC, BIR, and other government bodies as required by law
                        • Service providers: third-party processors (clearing houses, custodians, technology vendors) bound by data processing agreements consistent with the DPA
                        • Professional advisers: lawyers, auditors, and compliance consultants under confidentiality obligations
                        • Affiliated entities: within the Regis Partners group for operational and compliance purposes

                        Any cross-border data transfer shall comply with Section 21 of the DPA and relevant NPC issuances regarding cross-border data flow.
                        TXT],
                    ['Cookies & Tracking Technologies', <<<'TXT'
                        We use cookies and similar tracking technologies on this website. Cookies are small text files placed on your device that help us operate and improve our website.

                        Essential Cookies — Required for the website to function. These cannot be disabled.

                        Analytics Cookies — Help us understand how visitors interact with our website (e.g., pages visited, session duration). We use this data only in aggregate, anonymised form.

                        Functional Cookies — Remember your preferences to personalise your experience on the research portal.

                        You may configure your browser to refuse cookies, though this may limit the functionality of certain areas of this website. Our use of cookies is in accordance with Republic Act No. 10175 (Cybercrime Prevention Act) and relevant NPC advisories.
                        TXT],
                    ['Data Retention', <<<'TXT'
                        We retain personal data for as long as necessary to fulfil the purposes for which it was collected, or as required by law:

                        • Client account records: minimum ten (10) years from account closure, in accordance with SEC regulations and BSP circulars
                        • Transaction records: minimum ten (10) years, in compliance with the Anti-Money Laundering Act
                        • Communication records: five (5) years
                        • Website usage data: up to twenty-four (24) months

                        Upon expiry of the applicable retention period, data is securely disposed of in accordance with NPC guidelines.
                        TXT],
                    ['Your Rights as a Data Subject', <<<'TXT'
                        Under the Data Privacy Act of 2012, you have the following rights:

                        • Right to be Informed — to know what personal data we collect and how it is used
                        • Right of Access — to request a copy of your personal data held by us
                        • Right to Object — to object to processing based on legitimate interests
                        • Right to Erasure or Blocking — to request deletion of data no longer necessary for the stated purpose, subject to legal retention requirements
                        • Right to Rectification — to have inaccurate or incomplete data corrected
                        • Right to Data Portability — to receive your data in a structured, machine-readable format
                        • Right to Damages — to be indemnified for damages sustained due to unauthorised processing

                        To exercise any of these rights, please submit a written request to dpo@regispartners.com.ph. We will respond within fifteen (15) working days in accordance with NPC guidelines.
                        TXT],
                    ['Security Measures', <<<'TXT'
                        Regis Partners implements physical, technical, and organisational security measures to protect your personal data against unauthorised access, disclosure, alteration, and destruction. Our security programme is designed in accordance with NPC Circular No. 16-01 and industry best practices, and includes access controls, encryption of data in transit and at rest, periodic security assessments, and mandatory data privacy training for all staff.

                        In the event of a personal data breach that may cause serious harm to data subjects, we will notify the NPC within seventy-two (72) hours of discovery, and affected data subjects as required under the DPA.
                        TXT],
                    ['Contact & Complaints', <<<'TXT'
                        If you have questions about this Privacy Policy or wish to file a complaint regarding how we handle your personal data, contact our Data Protection Officer:

                        Data Protection Officer
                        Regis Partners, Inc.
                        [Address], Makati City, Metro Manila 1200
                        dpo@regispartners.com.ph

                        You also have the right to lodge a complaint with the National Privacy Commission (NPC) at www.privacy.gov.ph.
                        TXT],
                ],
            ],
        ];
    }
}
