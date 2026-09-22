<?php

namespace Tests\Feature\Portal;

use App\Models\PortalToken;
use App\Models\User;

/**
 * Provision → register → approve, the decline path, the admin-issued reset
 * link, and the self-service forgot-password flow for clients and staff.
 */
class PortalOnboardingTest extends PortalTestCase
{
    private function tokenFrom(string $link): string
    {
        return basename($link);
    }

    public function test_register_link_completes_to_pending_and_approval_unlocks_sign_in(): void
    {
        $admin = $this->staff('Administrator');

        $res = $this->actingAs($admin)->postJson('/api/cms/portal-clients', [
            'name' => 'Kara Villaruel',
            'email' => 'K.Villaruel@arqcapital.ph',
            'firm' => 'ARQ Capital',
            'sectorPrefs' => ['Banks'],
        ])->assertCreated()
            ->assertJsonPath('item.status', User::STATUS_INVITED)
            ->assertJsonPath('item.email', 'k.villaruel@arqcapital.ph')
            ->assertJsonStructure(['item', 'link', 'expiresAt', 'audit']);

        $link = $res->json('link');
        $this->assertStringContainsString('/portal/register/', $link);
        $token = $this->tokenFrom($link);
        $this->assertDatabaseHas('audit_entries', ['action' => 'Provisioned client access', 'target' => 'k.villaruel@arqcapital.ph']);

        // Still invited: no password exists yet, so the door cannot even match credentials.
        $this->postJson('/api/portal/login', ['identity' => 'k.villaruel@arqcapital.ph', 'password' => self::PASSWORD])
            ->assertStatus(422);

        $this->getJson("/api/portal/register/{$token}")
            ->assertOk()
            ->assertJsonPath('client.email', 'k.villaruel@arqcapital.ph')
            ->assertJsonPath('client.username', 'kvillaruel')
            ->assertJsonPath('alreadySubmitted', false);

        $this->postJson("/api/portal/register/{$token}", [
            'name' => 'Kara Villaruel',
            'firm' => 'ARQ Capital',
            'position' => 'PM',
            'password' => 'New-pass-123',
            'password_confirmation' => 'nope',
        ])->assertStatus(422);

        $this->postJson("/api/portal/register/{$token}", [
            'name' => 'Kara Villaruel',
            'firm' => 'ARQ Capital',
            'position' => 'PM',
            'password' => 'New-pass-123',
            'password_confirmation' => 'New-pass-123',
        ])->assertOk()->assertJsonPath('status', User::STATUS_PENDING);

        $client = User::where('email', 'k.villaruel@arqcapital.ph')->firstOrFail();
        $this->assertSame(User::STATUS_PENDING, $client->status);
        $this->assertNotNull($client->registered_at);
        $this->assertDatabaseHas('audit_entries', ['action' => 'Completed registration', 'actor' => 'Kara Villaruel']);

        // The link is spent.
        $this->getJson("/api/portal/register/{$token}")->assertStatus(410);
        // Pending: still refused, with the review copy.
        $this->postJson('/api/portal/login', ['identity' => 'kvillaruel', 'password' => 'New-pass-123'])
            ->assertStatus(403)->assertJsonFragment(['message' => 'Your registration is with us for review. You will receive an email once it is approved.']);

        $this->actingAs($admin)->postJson("/api/cms/portal-clients/{$client->id}/approve")
            ->assertOk()->assertJsonPath('item.status', User::STATUS_APPROVED)->assertJsonPath('audit.action', 'Approved client account');

        $this->postJson('/api/portal/login', ['identity' => 'kvillaruel', 'password' => 'New-pass-123'])
            ->assertOk()->assertJsonPath('client.username', 'kvillaruel');
    }

    public function test_approve_refuses_an_invited_client_and_decline_deletes_tokens(): void
    {
        $admin = $this->staff('Administrator');
        $invited = $this->client(['status' => User::STATUS_INVITED, 'approved_at' => null]);
        PortalToken::issue($invited, PortalToken::REGISTRATION);
        $this->actingAs($admin)->postJson("/api/cms/portal-clients/{$invited->id}/approve")->assertStatus(422);

        $pending = $this->client(['status' => User::STATUS_PENDING, 'approved_at' => null]);
        $sessionToken = $pending->createToken('portal', ['portal'])->plainTextToken;
        PortalToken::issue($pending, PortalToken::PASSWORD_RESET);
        $this->assertDatabaseCount('personal_access_tokens', 1);

        $this->actingAs($admin)->postJson("/api/cms/portal-clients/{$pending->id}/decline")
            ->assertOk()->assertJsonPath('item.status', User::STATUS_DECLINED);

        $this->assertSame(0, $pending->tokens()->count(), 'decline revokes API tokens');
        $this->withToken($sessionToken)->getJson('/api/portal/reports')->assertStatus(401);
        $this->postJson('/api/portal/login', ['identity' => $pending->email, 'password' => self::PASSWORD])
            ->assertStatus(403)->assertJsonFragment(['message' => 'This application was not approved. Contact your Regis coverage for help.']);

        // A staff account is not a portal client.
        $this->actingAs($admin)->postJson("/api/cms/portal-clients/{$admin->id}/approve")->assertStatus(422);
        // Editors do not hold access.manage.
        $this->actingAs($this->staff('Editor'))->postJson("/api/cms/portal-clients/{$pending->id}/approve")->assertStatus(403);
    }

    public function test_admin_reset_link_sets_a_new_password_and_signs_out_every_session(): void
    {
        $admin = $this->staff('Administrator');
        $client = $this->client();
        $live = $this->portalToken($client);

        $link = $this->actingAs($admin)->postJson("/api/cms/portal-clients/{$client->id}/reset-link")
            ->assertOk()->assertJsonPath('audit.action', 'Issued password reset link')->json('link');
        $this->assertStringContainsString('/portal/reset/', $link);
        $token = $this->tokenFrom($link);

        $this->getJson("/api/portal/reset/{$token}")
            ->assertOk()->assertJsonPath('kind', 'client')->assertJsonPath('client.email', $client->email);

        $this->postJson("/api/portal/reset/{$token}", ['password' => 'Fresh-pass-99', 'password_confirmation' => 'Fresh-pass-99'])
            ->assertOk()->assertJsonPath('ok', true)->assertJsonPath('kind', 'client');

        $this->withToken($live)->getJson('/api/portal/reports')->assertStatus(401);
        $this->postJson('/api/portal/login', ['identity' => $client->email, 'password' => self::PASSWORD])->assertStatus(422);
        $this->postJson('/api/portal/login', ['identity' => $client->email, 'password' => 'Fresh-pass-99'])->assertOk();

        $this->getJson("/api/portal/reset/{$token}")->assertStatus(410);
        $this->getJson('/api/portal/reset/not-a-token')->assertStatus(404);

        // Issuing a new link retires the old unused one; an expired link is dead.
        $first = PortalToken::issue($client, PortalToken::PASSWORD_RESET);
        $second = PortalToken::issue($client, PortalToken::PASSWORD_RESET);
        $this->getJson("/api/portal/reset/{$first->token}")->assertStatus(410);
        $second->forceFill(['expires_at' => now()->subMinute()])->save();
        $this->getJson("/api/portal/reset/{$second->token}")->assertStatus(410);
    }

    public function test_forgot_password_emails_a_client_reset_link(): void
    {
        $client = $this->client(['username' => 'RP-FORGOT-01']);
        $captured = null;

        $this->mailerOn()->shouldReceive('send')->once()
            ->withArgs(function (string $sender, array $message) use ($client, &$captured) {
                $captured = $message;

                return $sender === 'noreply@regis.ph'
                    && $message['toRecipients'][0]['emailAddress']['address'] === $client->email
                    && $message['body']['contentType'] === 'HTML'
                    && str_contains($message['subject'], 'Reset your Regis Partners password');
            })->andReturn('req-1');

        $this->postJson('/api/portal/forgot-password', ['identity' => 'rp-forgot-01'])
            ->assertOk()->assertJsonPath('ok', true)->assertJsonStructure(['message']);

        $record = PortalToken::where('user_id', $client->id)->where('purpose', PortalToken::PASSWORD_RESET)->firstOrFail();
        $this->assertStringContainsString("/portal/reset/{$record->token}", $captured['body']['content']);
        $this->assertStringContainsString('Regis Partners', $captured['body']['content']);
        $this->assertTrue($record->expires_at->between(now()->addHours(23), now()->addHours(25)));
        $this->assertDatabaseHas('audit_entries', ['action' => 'Requested password reset', 'target' => $client->email]);
        $this->assertDatabaseHas('audit_entries', ['action' => 'Password reset link emailed', 'target' => $client->email]);

        // The emailed link finishes the reset.
        $this->postJson("/api/portal/reset/{$record->token}", ['password' => 'Mailed-pass-77', 'password_confirmation' => 'Mailed-pass-77'])
            ->assertOk()->assertJsonPath('kind', 'client');
        $this->postJson('/api/portal/login', ['identity' => $client->email, 'password' => 'Mailed-pass-77'])->assertOk();
    }

    public function test_forgot_password_is_neutral_for_unknown_suspended_and_declined_accounts(): void
    {
        $mailer = $this->mailerOn();
        $mailer->shouldReceive('send')->never();

        $suspended = $this->client(['suspended' => true]);
        $declined = $this->client(['status' => User::STATUS_DECLINED, 'approved_at' => null]);

        $neutral = $this->postJson('/api/portal/forgot-password', ['identity' => 'nobody@example.com'])->assertOk()->json('message');
        $this->assertSame($neutral, $this->postJson('/api/portal/forgot-password', ['identity' => $suspended->email])->assertOk()->json('message'));
        $this->assertSame($neutral, $this->postJson('/api/portal/forgot-password', ['identity' => $declined->email])->assertOk()->json('message'));
        $this->assertSame($neutral, $this->postJson('/api/cms/forgot-password', ['email' => 'nobody@example.com'])->assertOk()->json('message'));

        $this->assertDatabaseCount('portal_tokens', 0);
        $this->postJson('/api/portal/forgot-password', [])->assertStatus(422);
    }

    public function test_forgot_password_resends_the_registration_link_to_an_invited_client(): void
    {
        $invited = $this->client(['status' => User::STATUS_INVITED, 'approved_at' => null]);

        $this->mailerOn()->shouldReceive('send')->once()
            ->withArgs(fn (string $sender, array $message) => str_contains($message['subject'], 'Complete your Regis Partners portal registration')
                && str_contains($message['body']['content'], '/portal/register/'))
            ->andReturn('req-2');

        $this->postJson('/api/portal/forgot-password', ['identity' => $invited->email])->assertOk();

        $this->assertDatabaseHas('portal_tokens', ['user_id' => $invited->id, 'purpose' => PortalToken::REGISTRATION]);
        $this->assertDatabaseMissing('portal_tokens', ['user_id' => $invited->id, 'purpose' => PortalToken::PASSWORD_RESET]);
    }

    public function test_forgot_password_still_issues_the_link_when_graph_is_not_configured(): void
    {
        $this->mailerOff();
        $client = $this->client();

        $this->postJson('/api/portal/forgot-password', ['identity' => $client->email])->assertOk();

        $this->assertDatabaseHas('portal_tokens', ['user_id' => $client->id, 'purpose' => PortalToken::PASSWORD_RESET]);
        $this->assertDatabaseHas('audit_entries', [
            'action' => 'Password reset link issued (email not sent: mail not configured)',
            'target' => $client->email,
        ]);
    }

    public function test_staff_forgot_password_lands_on_the_cms_door(): void
    {
        $analyst = $this->staff('Analyst');
        $live = $this->cmsToken($analyst);
        $captured = null;

        $this->mailerOn()->shouldReceive('send')->once()
            ->withArgs(function (string $sender, array $message) use ($analyst, &$captured) {
                $captured = $message;

                return $message['toRecipients'][0]['emailAddress']['address'] === $analyst->email;
            })->andReturn('req-3');

        $this->postJson('/api/cms/forgot-password', ['email' => strtoupper($analyst->email)])->assertOk();

        $record = PortalToken::where('user_id', $analyst->id)->firstOrFail();
        $this->assertStringContainsString("/cms/reset/{$record->token}", $captured['body']['content']);
        $this->assertStringNotContainsString('/portal/reset/', $captured['body']['content']);

        $this->getJson("/api/portal/reset/{$record->token}")
            ->assertOk()->assertJsonPath('kind', 'staff')->assertJsonPath('client.email', $analyst->email);
        $this->postJson("/api/portal/reset/{$record->token}", ['password' => 'Desk-pass-2026', 'password_confirmation' => 'Desk-pass-2026'])
            ->assertOk()->assertJsonPath('kind', 'staff');

        $this->withToken($live)->getJson('/api/me')->assertStatus(401);
        $this->postJson('/api/cms/login', ['email' => $analyst->email, 'password' => 'Desk-pass-2026'])->assertOk();

        // A suspended staff account gets nothing, and a client address is not a staff address.
        $mailer = $this->mailerOn();
        $mailer->shouldReceive('send')->never();
        $suspended = $this->staff('Editor', ['suspended' => true]);
        $client = $this->client();
        $this->postJson('/api/cms/forgot-password', ['email' => $suspended->email])->assertOk();
        $this->postJson('/api/cms/forgot-password', ['email' => $client->email])->assertOk();
        $this->assertSame(1, PortalToken::count());
    }

    public function test_a_suspended_account_cannot_use_a_leftover_reset_link(): void
    {
        $client = $this->client();
        $record = PortalToken::issue($client, PortalToken::PASSWORD_RESET);
        $client->forceFill(['suspended' => true])->save();

        $this->getJson("/api/portal/reset/{$record->token}")->assertStatus(403);
        $this->postJson("/api/portal/reset/{$record->token}", ['password' => 'Fresh-pass-99', 'password_confirmation' => 'Fresh-pass-99'])
            ->assertStatus(403);
    }
}
