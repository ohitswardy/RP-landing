<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Sends mail through Microsoft Graph as a named staff mailbox, so a blast
 * leaves from the analyst's own Regis address, lands in their Sent Items,
 * and inherits Exchange's SPF/DKIM standing. Authenticates with the
 * client-credentials grant (Mail.Send application permission); the token
 * is cached until shortly before it expires.
 */
class MicrosoftGraphMailer
{
    private const AUTHORITY = 'https://login.microsoftonline.com';

    private const GRAPH = 'https://graph.microsoft.com/v1.0';

    private const TOKEN_CACHE = 'graph.mail.token';

    public function __construct(private readonly array $config) {}

    /** True once tenant, client id, and secret are all present in config. */
    public function enabled(): bool
    {
        foreach (['tenant', 'client_id', 'client_secret'] as $key) {
            if (trim((string) ($this->config[$key] ?? '')) === '') {
                return false;
            }
        }

        return true;
    }

    /**
     * The shared desk mailbox, used when a staff member has no personal Outlook
     * address. Null when none is configured, which leaves the desk on the
     * Outlook hand-off unless individual profiles carry a mailbox.
     */
    public function defaultSender(): ?string
    {
        $sender = mb_strtolower(trim((string) ($this->config['sender'] ?? '')));

        return $sender === '' ? null : $sender;
    }

    /** The mailbox a given staff member sends as: their own, else the shared desk one. */
    public function senderFor(?string $personal): ?string
    {
        $personal = mb_strtolower(trim((string) $personal));

        return $personal !== '' ? $personal : $this->defaultSender();
    }

    /** The app can send as any mailbox in the tenant; we only ever send as our own domain. */
    public function senderAllowed(string $email): bool
    {
        $domain = mb_strtolower(trim((string) ($this->config['sender_domain'] ?? '')));

        return $domain === '' || str_ends_with(mb_strtolower(trim($email)), '@'.$domain);
    }

    public function batchSize(): int
    {
        return max(1, min(500, (int) ($this->config['batch_size'] ?? 500)));
    }

    public function attachmentMaxBytes(): int
    {
        return max(0, (int) ($this->config['attachment_max_bytes'] ?? 0));
    }

    /**
     * Send one message from $sender's mailbox. $message is the Graph
     * message resource (subject, body, recipients, attachments). Returns
     * Graph's request id for the delivery log.
     */
    public function send(string $sender, array $message): string
    {
        try {
            $response = Http::withToken($this->token())
                ->acceptJson()
                ->timeout(90)
                ->post(self::GRAPH.'/users/'.rawurlencode($sender).'/sendMail', [
                    'message' => $message,
                    'saveToSentItems' => true,
                ]);
        } catch (ConnectionException $e) {
            throw new GraphMailException('Microsoft Graph could not be reached: '.$e->getMessage(), transient: true, retryAfter: 60);
        }

        if ($response->status() === 202) {
            return (string) $response->header('request-id');
        }

        throw $this->failure($response, 'Microsoft Graph refused the message');
    }

    private function token(): string
    {
        $cached = Cache::get(self::TOKEN_CACHE);
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        try {
            $response = Http::asForm()
                ->acceptJson()
                ->timeout(30)
                ->post(self::AUTHORITY.'/'.rawurlencode((string) $this->config['tenant']).'/oauth2/v2.0/token', [
                    'client_id' => $this->config['client_id'],
                    'client_secret' => $this->config['client_secret'],
                    'scope' => 'https://graph.microsoft.com/.default',
                    'grant_type' => 'client_credentials',
                ]);
        } catch (ConnectionException $e) {
            throw new GraphMailException('Microsoft sign-in could not be reached: '.$e->getMessage(), transient: true, retryAfter: 60);
        }

        if (! $response->successful()) {
            throw $this->failure($response, 'Microsoft sign-in failed');
        }

        $token = (string) $response->json('access_token', '');
        if ($token === '') {
            throw new GraphMailException('Microsoft sign-in returned no access token.');
        }

        // Refresh two minutes early so a batch never starts on a dying token.
        Cache::put(self::TOKEN_CACHE, $token, max(60, ((int) $response->json('expires_in', 3600)) - 120));

        return $token;
    }

    private function failure(Response $response, string $prefix): GraphMailException
    {
        $status = $response->status();
        if ($status === 401) {
            // A revoked or stale token: drop it so the retry signs in afresh.
            Cache::forget(self::TOKEN_CACHE);
        }

        $detail = $response->json('error.message')
            ?? $response->json('error_description')
            ?? $response->body();
        // Graph answers sendMail with a bare 401 (no body) when the sender is not a
        // mailbox in this tenant, or the app is not allowed to send as it. That never
        // heals on retry, unlike a stale token, which comes back with an error body.
        $bareUnauthorized = $status === 401 && trim((string) $detail) === '';
        if ($bareUnauthorized) {
            $detail = 'the sender is not a licensed mailbox in this tenant, or the app is not allowed to send as it';
        }
        $transient = ! $bareUnauthorized && in_array($status, [401, 429, 500, 502, 503, 504], true);
        $retryAfter = $transient ? max(30, (int) $response->header('Retry-After')) : null;

        return new GraphMailException(
            sprintf('%s (HTTP %d): %s', $prefix, $status, mb_substr(trim((string) $detail), 0, 500)),
            transient: $transient,
            retryAfter: $retryAfter,
        );
    }
}
