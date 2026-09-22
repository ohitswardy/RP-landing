<?php

namespace Tests\Feature\Portal;

use App\Models\User;
use App\Support\AccountGate;

/**
 * The portal door: only approved, non-suspended clients enter, by user id
 * or email; every other status is refused with its own copy; "remember me"
 * turns the session token into a 30-day one.
 */
class PortalLoginTest extends PortalTestCase
{
    public function test_approved_client_signs_in_by_email_and_by_user_id(): void
    {
        $client = $this->client(['username' => 'RP-DEMO-0001']);

        $this->postJson('/api/portal/login', ['identity' => $client->email, 'password' => self::PASSWORD])
            ->assertOk()
            ->assertJsonPath('client.id', (string) $client->id)
            ->assertJsonPath('client.username', 'RP-DEMO-0001')
            ->assertJsonPath('client.firm', 'Test Capital')
            ->assertJsonPath('expiresAt', null)
            ->assertJsonStructure(['token', 'expiresAt', 'client' => ['id', 'name', 'email', 'username', 'firm']]);

        // The user id matches regardless of the casing typed.
        $this->postJson('/api/portal/login', ['identity' => 'rp-demo-0001', 'password' => self::PASSWORD])
            ->assertOk()->assertJsonPath('client.email', $client->email);
        $this->postJson('/api/portal/login', ['identity' => ' RP-DEMO-0001 ', 'password' => self::PASSWORD])
            ->assertOk();
    }

    public function test_bad_credentials_and_staff_accounts_are_refused_with_422(): void
    {
        $client = $this->client();
        $staff = $this->staff();

        $this->postJson('/api/portal/login', ['identity' => $client->email, 'password' => 'wrong-password'])
            ->assertStatus(422);
        // A staff address is not a portal identity, even with the right password.
        $this->postJson('/api/portal/login', ['identity' => $staff->email, 'password' => self::PASSWORD])
            ->assertStatus(422);
        $this->postJson('/api/portal/login', ['identity' => 'nobody@example.com', 'password' => self::PASSWORD])
            ->assertStatus(422);
    }

    public function test_each_onboarding_state_is_refused_with_distinct_copy(): void
    {
        $messages = [];
        foreach ([User::STATUS_INVITED, User::STATUS_PENDING, User::STATUS_DECLINED] as $status) {
            $client = $this->client(['status' => $status, 'approved_at' => null]);
            $messages[$status] = $this->postJson('/api/portal/login', ['identity' => $client->email, 'password' => self::PASSWORD])
                ->assertStatus(403)
                ->json('message');
        }

        $suspended = $this->client(['suspended' => true]);
        $messages['suspended'] = $this->postJson('/api/portal/login', ['identity' => $suspended->email, 'password' => self::PASSWORD])
            ->assertStatus(403)
            ->json('message');

        $this->assertSame(AccountGate::CLIENT_SUSPENDED, $messages['suspended']);
        $this->assertStringContainsString('not complete', $messages[User::STATUS_INVITED]);
        $this->assertStringContainsString('review', $messages[User::STATUS_PENDING]);
        $this->assertStringContainsString('not approved', $messages[User::STATUS_DECLINED]);
        $this->assertCount(4, array_unique($messages), 'every refusal carries its own copy');
    }

    public function test_remember_me_issues_a_thirty_day_token(): void
    {
        $client = $this->client();

        $res = $this->postJson('/api/portal/login', ['identity' => $client->email, 'password' => self::PASSWORD, 'remember' => true])
            ->assertOk();

        $expiresAt = $res->json('expiresAt');
        $this->assertNotNull($expiresAt);
        $this->assertEqualsWithDelta(now()->addDays(30)->timestamp, strtotime($expiresAt), 5);
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $client->id,
            'name' => 'portal',
        ]);
        $this->assertNotNull($client->tokens()->first()->expires_at);

        // The remembered token works now and dies after 30 days.
        $token = $res->json('token');
        $this->withToken($token)->getJson('/api/portal/bookmarks')->assertOk();
        $this->travel(31)->days();
        $this->withToken($token)->getJson('/api/portal/bookmarks')->assertStatus(401);
    }

    public function test_plain_login_leaves_the_token_without_expiry(): void
    {
        $client = $this->client();
        $this->postJson('/api/portal/login', ['identity' => $client->email, 'password' => self::PASSWORD, 'remember' => false])
            ->assertOk()->assertJsonPath('expiresAt', null);
        $this->assertNull($client->tokens()->first()->expires_at);
    }

    public function test_cms_login_honours_remember_and_returns_the_session_shape(): void
    {
        $admin = $this->staff('Administrator');

        $this->postJson('/api/cms/login', ['email' => $admin->email, 'password' => self::PASSWORD])
            ->assertOk()
            ->assertJsonPath('expiresAt', null)
            ->assertJsonPath('user.role', 'Administrator')
            ->assertJsonPath('user.superAdmin', false)
            ->assertJsonStructure(['token', 'expiresAt', 'user' => ['id', 'name', 'email', 'role', 'permissions', 'outlookEmail', 'superAdmin']]);

        $expiresAt = $this->postJson('/api/cms/login', ['email' => $admin->email, 'password' => self::PASSWORD, 'remember' => true])
            ->assertOk()->json('expiresAt');
        $this->assertEqualsWithDelta(now()->addDays(30)->timestamp, strtotime($expiresAt), 5);

        $suspended = $this->staff('Editor', ['suspended' => true]);
        $this->postJson('/api/cms/login', ['email' => $suspended->email, 'password' => self::PASSWORD])
            ->assertStatus(403)->assertJsonPath('message', AccountGate::STAFF_SUSPENDED);
    }

    public function test_me_returns_the_login_shape_for_both_audiences(): void
    {
        $client = $this->client(['username' => 'RP-ME-0001']);
        $token = $this->portalToken($client);
        $this->withToken($token)->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('kind', 'client')
            ->assertJsonPath('client.username', 'RP-ME-0001')
            ->assertJsonPath('client.firm', 'Test Capital');

        $analyst = $this->staff('Analyst');
        $this->withToken($this->cmsToken($analyst))->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('kind', 'staff')
            ->assertJsonPath('user.role', 'Analyst')
            ->assertJsonFragment(['crms.access'])
            ->assertJsonStructure(['user' => ['id', 'name', 'email', 'role', 'permissions', 'outlookEmail', 'superAdmin']]);

        // A role change shows up on the next /me without a new login.
        $analyst->forceFill(['role_id' => \App\Models\Role::where('name', 'Editor')->value('id')])->save();
        $this->withToken($this->cmsToken($analyst))->getJson('/api/me')
            ->assertOk()->assertJsonPath('user.role', 'Editor')->assertJsonMissing(['crms.access']);

        $this->guest()->getJson('/api/me')->assertStatus(401);
    }
}
