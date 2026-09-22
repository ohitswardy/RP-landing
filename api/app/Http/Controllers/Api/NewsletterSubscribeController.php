<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subscriber;
use App\Services\GraphMailException;
use App\Services\MicrosoftGraphMailer;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The public newsletter sign-up. Double opt-in: the address is filed
 * unverified, a confirmation link goes out through Graph, and only the
 * click flips `verified` — the flag every recipient pool filters on.
 * Subscribe always answers the same 200, so the form cannot be used to
 * discover which addresses are on the list.
 */
class NewsletterSubscribeController extends Controller
{
    public const NEUTRAL = 'Thanks. If that address is new to us, a confirmation email is on its way.';

    public function subscribe(Request $request, MicrosoftGraphMailer $mailer): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:190'],
            'name' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $email = mb_strtolower(trim($data['email']));
        $firm = trim((string) ($data['name'] ?? ''));

        $subscriber = Subscriber::where('email', $email)->first();

        if ($subscriber && $subscriber->verified) {
            // Already on the list: nothing to do, and nothing to reveal.
            return response()->json(['ok' => true, 'message' => self::NEUTRAL]);
        }

        if (! $subscriber) {
            $subscriber = Subscriber::create([
                'email' => $email,
                'firm' => $firm,
                'joined' => now()->toDateString(),
                'source' => Subscriber::SOURCE_PUBLIC,
                'verified' => false,
            ]);
            Audit::log('Subscriber signed up', $email, actor: 'Public site');
        } else {
            // Unverified or unsubscribed: reactivate pending confirmation.
            $subscriber->forceFill([
                'firm' => $firm !== '' ? $firm : $subscriber->firm,
                'joined' => now()->toDateString(),
                'source' => Subscriber::SOURCE_PUBLIC,
                'verified' => false,
            ])->save();
            Audit::log('Subscriber re-signed up', $email, actor: 'Public site');
        }

        $subscriber->issueVerifyToken();
        $this->sendConfirmation($subscriber, $mailer);

        return response()->json(['ok' => true, 'message' => self::NEUTRAL]);
    }

    /** The confirmation link: flips verified, clears any earlier opt-out. */
    public function verify(string $token): JsonResponse
    {
        $subscriber = Subscriber::where('verify_token', $token)->first();
        if (! $subscriber) {
            return response()->json(['ok' => false, 'message' => 'That confirmation link is not valid.'], 404);
        }

        if (! $subscriber->verified) {
            $subscriber->forceFill([
                'verified' => true,
                'verified_at' => now(),
                'unsubscribed_at' => null,
            ])->save();
            Audit::log('Subscriber confirmed', $subscriber->email, actor: 'Subscriber');
        }

        return response()->json(['ok' => true, 'email' => $subscriber->email]);
    }

    /**
     * The confirmation mail leaves from the shared desk mailbox. When Graph
     * is not configured (or refuses), the sign-up still stands: the desk
     * can verify the address by hand, and the log says why it had to.
     */
    private function sendConfirmation(Subscriber $subscriber, MicrosoftGraphMailer $mailer): void
    {
        $sender = $mailer->defaultSender();
        if (! $mailer->enabled() || ! $sender) {
            Log::warning('Newsletter confirmation not sent: Microsoft Graph is not configured.', ['email' => $subscriber->email]);

            return;
        }

        $url = $subscriber->verifyUrl();
        $html = view('email.subscribe-confirm', ['url' => $url, 'email' => $subscriber->email])->render();

        try {
            $mailer->send($sender, [
                'subject' => 'Confirm your Regis Partners newsletter subscription',
                'body' => ['contentType' => 'HTML', 'content' => $html],
                'toRecipients' => [['emailAddress' => ['address' => $subscriber->email]]],
            ]);
        } catch (GraphMailException|Throwable $e) {
            Log::warning('Newsletter confirmation not sent: '.$e->getMessage(), ['email' => $subscriber->email]);
        }
    }
}
