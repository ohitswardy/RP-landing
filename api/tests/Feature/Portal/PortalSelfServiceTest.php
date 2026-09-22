<?php

namespace Tests\Feature\Portal;

/**
 * What an account can do to itself: read its profile and change its own
 * password, which signs out every other device but not the one asking.
 */
class PortalSelfServiceTest extends PortalTestCase
{
    public function test_profile_returns_identity_and_mandate(): void
    {
        $client = $this->client([
            'name' => 'Kara Villaruel',
            'username' => 'RP-0042',
            'firm' => 'ARQ Capital',
            'client_type' => 'Foreign',
            'sector_prefs' => ['Banks', 'Property'],
            'preferred_analysts' => ['P. Garcia'],
            'approved_at' => '2026-03-01 09:00:00',
        ]);

        $this->actingAs($client)->getJson('/api/portal/profile')
            ->assertOk()
            ->assertJsonPath('profile.id', (string) $client->id)
            ->assertJsonPath('profile.name', 'Kara Villaruel')
            ->assertJsonPath('profile.username', 'RP-0042')
            ->assertJsonPath('profile.email', $client->email)
            ->assertJsonPath('profile.firm', 'ARQ Capital')
            ->assertJsonPath('profile.clientType', 'Foreign')
            ->assertJsonPath('profile.sectorPrefs', ['Banks', 'Property'])
            ->assertJsonPath('profile.preferredAnalysts', ['P. Garcia'])
            ->assertJsonStructure(['profile' => ['id', 'name', 'username', 'email', 'firm', 'clientType', 'sectorPrefs', 'preferredAnalysts', 'memberSince']]);

        $memberSince = $this->actingAs($client)->getJson('/api/portal/profile')->json('profile.memberSince');
        $this->assertSame('2026-03-01', substr($memberSince, 0, 10));

        // Never leaks the hash or the recoverable copy.
        $this->actingAs($client)->getJson('/api/portal/profile')->assertJsonMissing(['password'])->assertJsonMissing(['password_recoverable']);

        $this->actingAs($this->staff())->getJson('/api/portal/profile')->assertStatus(403);
        $this->guest()->getJson('/api/portal/profile')->assertStatus(401);
    }

    public function test_client_changes_own_password_and_keeps_the_current_session(): void
    {
        $client = $this->client();
        $current = $this->portalToken($client);
        $otherDevice = $this->portalToken($client, true);
        $this->assertSame(2, $client->tokens()->count());

        // Wrong current password, mismatched confirmation, same-as-current: all 422, nothing changes.
        $this->withToken($current)->putJson('/api/portal/password', ['current' => 'not-it', 'password' => 'Brand-new-1', 'password_confirmation' => 'Brand-new-1'])
            ->assertStatus(422)->assertJsonPath('errors.current.0', 'The current password is incorrect.');
        $this->withToken($current)->putJson('/api/portal/password', ['current' => self::PASSWORD, 'password' => 'Brand-new-1', 'password_confirmation' => 'other'])
            ->assertStatus(422);
        $this->withToken($current)->putJson('/api/portal/password', ['current' => self::PASSWORD, 'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD])
            ->assertStatus(422);
        $this->withToken($current)->putJson('/api/portal/password', ['current' => self::PASSWORD, 'password' => 'short', 'password_confirmation' => 'short'])
            ->assertStatus(422);
        $this->assertSame(2, $client->tokens()->count());
        $this->withToken($otherDevice)->getJson('/api/portal/bookmarks')->assertOk();

        $this->withToken($current)->putJson('/api/portal/password', ['current' => self::PASSWORD, 'password' => 'Brand-new-1', 'password_confirmation' => 'Brand-new-1'])
            ->assertOk()->assertJsonPath('ok', true)->assertJsonPath('audit.action', 'Changed own password');

        // This session lives on; the other device is signed out; the new password works.
        $this->withToken($current)->getJson('/api/portal/profile')->assertOk();
        $this->withToken($otherDevice)->getJson('/api/portal/bookmarks')->assertStatus(401);
        $this->assertSame(1, $client->tokens()->count());
        $this->postJson('/api/portal/login', ['identity' => $client->email, 'password' => self::PASSWORD])->assertStatus(422);
        $this->postJson('/api/portal/login', ['identity' => $client->email, 'password' => 'Brand-new-1'])->assertOk();

        // The super-admin-readable copy follows the change, and the audit row names the client.
        $this->assertSame('Brand-new-1', $client->fresh()->revealPassword());
        $this->assertDatabaseHas('audit_entries', ['action' => 'Changed own password', 'target' => $client->email, 'actor' => $client->name]);
    }

    public function test_staff_change_own_password_through_the_cms_door(): void
    {
        $analyst = $this->staff('Analyst');
        $current = $this->cmsToken($analyst);
        $other = $this->cmsToken($analyst);

        $this->withToken($current)->putJson('/api/cms/password', ['current' => 'wrong-one', 'password' => 'Desk-new-1', 'password_confirmation' => 'Desk-new-1'])
            ->assertStatus(422);
        $this->withToken($current)->putJson('/api/cms/password', ['current' => self::PASSWORD, 'password' => 'Desk-new-1', 'password_confirmation' => 'Desk-new-1'])
            ->assertOk()->assertJsonPath('ok', true);

        $this->withToken($current)->getJson('/api/me')->assertOk();
        $this->withToken($other)->getJson('/api/me')->assertStatus(401);
        $this->postJson('/api/cms/login', ['email' => $analyst->email, 'password' => 'Desk-new-1'])->assertOk();
        $this->assertSame('Desk-new-1', $analyst->fresh()->revealPassword());

        // No module permission is needed: an Editor can change their own too. Clients cannot use the CMS route.
        $editor = $this->staff('Editor');
        $this->actingAs($editor)->putJson('/api/cms/password', ['current' => self::PASSWORD, 'password' => 'Editor-new-1', 'password_confirmation' => 'Editor-new-1'])->assertOk();
        $this->actingAs($this->client())->putJson('/api/cms/password', ['current' => self::PASSWORD, 'password' => 'Client-new-1', 'password_confirmation' => 'Client-new-1'])->assertStatus(403);
    }
}
