<?php

namespace App\Support;

use App\Models\PortalToken;
use App\Models\User;
use App\Services\GraphMailException;
use App\Services\MicrosoftGraphMailer;
use Illuminate\Support\Facades\Log;

/**
 * The self-service "forgot password" email, sent from the shared desk
 * mailbox through Microsoft Graph. When Graph is not configured the link is
 * still issued and the fact is logged and audited, so an administrator can
 * see the request and hand the link over by other means.
 */
class PasswordResetMail
{
    public const RESULT_SENT = 'sent';

    public const RESULT_UNCONFIGURED = 'unconfigured';

    public const RESULT_FAILED = 'failed';

    public function __construct(private readonly MicrosoftGraphMailer $mailer) {}

    /**
     * Send the link for a freshly issued token. Returns one of the RESULT_*
     * constants; never throws, since the caller must answer 200 regardless.
     */
    public function send(User $user, PortalToken $token): string
    {
        $registration = $token->purpose === PortalToken::REGISTRATION;
        $what = $registration ? 'registration link' : 'password reset link';

        if (! $this->mailer->enabled()) {
            Log::warning("Password reset: Microsoft Graph is not configured; {$what} for {$user->email} was issued but not emailed.");
            Audit::log(ucfirst($what).' issued (email not sent: mail not configured)', $user->email, $user->name);

            return self::RESULT_UNCONFIGURED;
        }

        $sender = $this->mailer->defaultSender();
        if (! $sender || ! $this->mailer->senderAllowed($sender)) {
            Log::warning("Password reset: no sending mailbox (MS_GRAPH_SENDER) is configured; {$what} for {$user->email} was issued but not emailed.");
            Audit::log(ucfirst($what).' issued (email not sent: no sending mailbox)', $user->email, $user->name);

            return self::RESULT_UNCONFIGURED;
        }

        try {
            $this->mailer->send($sender, [
                'subject' => $registration ? 'Complete your Regis Partners portal registration' : 'Reset your Regis Partners password',
                'body' => ['contentType' => 'HTML', 'content' => $this->html($user, $token)],
                'toRecipients' => [['emailAddress' => ['address' => $user->email, 'name' => $user->name]]],
            ]);
        } catch (GraphMailException $e) {
            Log::error("Password reset: Graph refused the {$what} email for {$user->email}: ".$e->getMessage());
            Audit::log(ucfirst($what).' issued (email failed)', $user->email, $user->name);

            return self::RESULT_FAILED;
        }

        Audit::log(ucfirst($what).' emailed', $user->email, $user->name);

        return self::RESULT_SENT;
    }

    /** A short, brand-true HTML body: drenched navy header, amber tick, one button. */
    public function html(User $user, PortalToken $token): string
    {
        $registration = $token->purpose === PortalToken::REGISTRATION;
        $url = htmlspecialchars($token->url(), ENT_QUOTES, 'UTF-8');
        $name = htmlspecialchars($user->name, ENT_QUOTES, 'UTF-8');
        $area = $user->isStaff() ? 'staff CMS' : 'client portal';
        $hours = max(1, (int) round(now()->diffInHours($token->expires_at, false)));
        $expiry = $hours >= 48 ? intdiv($hours, 24).' days' : $hours.' hours';

        $heading = $registration ? 'Complete your registration' : 'Reset your password';
        $lead = $registration
            ? "Your {$area} account is ready for you to set a password. Use the button below to finish registering."
            : "We received a request to reset the password on your {$area} account. Use the button below to choose a new one.";
        $button = $registration ? 'Complete registration' : 'Choose a new password';
        $ignore = $registration
            ? 'If you did not expect this email, you can ignore it.'
            : 'If you did not ask for this, you can ignore this email; your password stays as it is.';

        return '<!doctype html>'
            .'<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>'
            .'<body style="margin:0;padding:0;background:#f4f5f7;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0b1a33;">'
            .'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;"><tr><td align="center">'
            .'<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e3e6ec;">'
            .'<tr><td style="background:#0b1a33;padding:22px 32px;">'
            .'<span style="display:inline-block;width:10px;height:10px;background:#e8a33d;margin-right:10px;vertical-align:middle;"></span>'
            .'<span style="color:#ffffff;font-size:14px;letter-spacing:0.18em;text-transform:uppercase;vertical-align:middle;">Regis Partners</span>'
            .'</td></tr>'
            .'<tr><td style="padding:32px;">'
            ."<h1 style=\"margin:0 0 16px;font-size:22px;font-weight:600;color:#0b1a33;\">{$heading}</h1>"
            ."<p style=\"margin:0 0 12px;font-size:15px;line-height:1.55;\">Hello {$name},</p>"
            ."<p style=\"margin:0 0 24px;font-size:15px;line-height:1.55;\">{$lead}</p>"
            .'<p style="margin:0 0 24px;">'
            ."<a href=\"{$url}\" style=\"display:inline-block;background:#0b1a33;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-left:4px solid #e8a33d;\">{$button}</a>"
            .'</p>'
            ."<p style=\"margin:0 0 12px;font-size:13px;line-height:1.55;color:#4a5568;\">This link is single-use and expires in {$expiry}. If the button does not open, paste this address into your browser:<br>"
            ."<a href=\"{$url}\" style=\"color:#0b1a33;word-break:break-all;\">{$url}</a></p>"
            ."<p style=\"margin:0;font-size:13px;line-height:1.55;color:#4a5568;\">{$ignore}</p>"
            .'</td></tr>'
            .'<tr><td style="padding:16px 32px;border-top:1px solid #e3e6ec;font-size:11px;color:#7a8494;line-height:1.5;">'
            .'Regis Partners, Inc. &middot; Institutional brokerage &middot; Manila. This is an automated message from the Regis research portal; replies are not monitored.'
            .'</td></tr></table></td></tr></table></body></html>';
    }
}
