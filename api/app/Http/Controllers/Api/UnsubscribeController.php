<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subscriber;
use App\Support\Audit;
use Illuminate\Http\Response;

/**
 * The one-click opt-out every subscriber blast carries. A GET that mutates
 * is deliberate: the link has to work straight from a mail client, with no
 * form to submit. Unsubscribing clears `verified`, which is what every
 * recipient pool filters on, so the address drops out of future blasts.
 */
class UnsubscribeController extends Controller
{
    public function __invoke(string $token): Response
    {
        $subscriber = Subscriber::where('unsubscribe_token', $token)->first();

        if (! $subscriber) {
            return response()->view('newsletter.unsubscribed', ['found' => false], 404);
        }

        $already = ! $subscriber->verified && $subscriber->unsubscribed_at !== null;
        if (! $already) {
            $subscriber->forceFill(['verified' => false, 'unsubscribed_at' => now()])->save();
            Audit::log('Subscriber unsubscribed', $subscriber->email, actor: 'Subscriber');
        }

        return response()->view('newsletter.unsubscribed', [
            'found' => true,
            'already' => $already,
            'email' => $subscriber->email,
        ]);
    }
}
