<?php

namespace App\Support;

/**
 * Canonical seed copy for the Contact page — every text block the page
 * renders, from the hero caption down to the office ledger. Shared by
 * the content seeder and by ContactPage::current(), so the two can
 * never drift.
 */
class ContactDefaults
{
    public static function content(): array
    {
        return [
            'hero' => [
                'eyebrow' => '',
                'title' => 'Open a conversation.',
                'image' => '/sunray.jpg',
            ],

            'inquiry' => [
                'eyebrow' => 'Inquiry',
                'heading' => "Let's start\na conversation.",
                'blurb' => 'Reach our team directly. We respond to all institutional inquiries within one business day.',
                'deskLabel' => 'Market-hours dealing',
                'deskName' => 'Trading Desk',
                'deskPhone' => '+63 2 8848 0000',
                'interests' => ['Research', 'Sales', 'Trading', 'Corporate Access', 'Other'],
                'submitLabel' => 'Send inquiry',
                'successHeading' => 'Thank you.',
                'successBody' => 'Your inquiry has been received. A confirmation has been sent to {email}. A partner will reach out within one business day. For urgent matters, call the trading desk on {desk}.',
            ],

            'offices' => [
                'eyebrow' => 'Contact Us',
                'heading' => 'Every channel. One dedicated team.',
                'addressLabel' => 'Address',
                'address' => [
                    'Regis Partners, Inc.',
                    '23/F Tower One,',
                    'Ayala Triangle, Ayala Avenue',
                    '1226 Makati City, Philippines',
                ],
                'contactLabel' => 'Contact',
                'channels' => [
                    ['label' => 'TEL', 'value' => '+63 2 8894 6600'],
                    ['label' => 'FAX', 'value' => "+63 2 8894 6605\n+63 2 8894 6622"],
                ],
                'emailLabel' => 'Email',
                'email' => 'info@regis.ph',
            ],

            'newsletter' => [
                'enabled' => true,
            ],
        ];
    }
}
