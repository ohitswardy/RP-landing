<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],


    /*
    |--------------------------------------------------------------------------
    | Microsoft Graph (Email desk)
    |--------------------------------------------------------------------------
    |
    | Blasts leave from the staff member's own Regis mailbox (users.outlook_email)
    | through POST /users/{sender}/sendMail, authenticated as an Azure AD app
    | registration holding the Mail.Send *application* permission. Scope that
    | app to the desk's mailboxes with an Exchange ApplicationAccessPolicy;
    | sender_domain is the belt to that brace on our side.
    |
    */

    'graph' => [
        'tenant' => env('MS_GRAPH_TENANT_ID'),
        'client_id' => env('MS_GRAPH_CLIENT_ID'),
        'client_secret' => env('MS_GRAPH_CLIENT_SECRET'),
        'sender_domain' => env('MS_GRAPH_SENDER_DOMAIN', 'regis.ph'),
        // Exchange Online caps one message at 500 recipients; BCC batches never exceed it.
        'batch_size' => (int) env('MS_GRAPH_BATCH_SIZE', 500),
        // Graph's inline fileAttachment ceiling. Larger PDFs go out as a link.
        'attachment_max_bytes' => 3 * 1024 * 1024,
    ],

];
