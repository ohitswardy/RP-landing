<?php

namespace Tests\Feature\Portal;

use App\Models\Role;
use App\Models\User;

/**
 * Users & access guard rails: no self-suspend or self-delete, never zero
 * active access managers, system roles are fixed, a password change ends
 * the account's sessions, and only the super admin reads passwords back.
 */
class AccessGuardsTest extends PortalTestCase
{
    public function test_you_cannot_suspend_or_delete_yourself(): void
    {
        $admin = $this->staff('Administrator');

        $this->actingAs($admin)->putJson("/api/cms/users/{$admin->id}", ['suspended' => true])
            ->assertStatus(422)->assertJsonPath('message', 'You cannot suspend your own account.');
        $this->actingAs($admin)->deleteJson("/api/cms/users/{$admin->id}")
            ->assertStatus(422)->assertJsonPath('message', 'You cannot delete your own account.');

        $this->assertFalse($admin->fresh()->suspended);
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }

    public function test_no_change_may_leave_zero_active_access_managers(): void
    {
        // The seeded super admin is the only other Administrator; park it so
        // the actor is the last active access manager standing.
        $this->superAdmin()->forceFill(['suspended' => true])->save();
        $admin = $this->staff('Administrator');
        $editorRole = Role::where('name', 'Editor')->value('id');

        // Downgrading your own role would lock everyone out of Users & access.
        $this->actingAs($admin)->putJson("/api/cms/users/{$admin->id}", ['roleId' => $editorRole])
            ->assertStatus(422)->assertJsonPath('message', 'At least one active account must keep user management access.');
        $this->assertSame('Administrator', $admin->fresh()->role->name);

        // With a second active admin in place the same change goes through.
        $second = $this->staff('Administrator');
        $this->actingAs($admin)->putJson("/api/cms/users/{$admin->id}", ['roleId' => $editorRole])
            ->assertOk()->assertJsonPath('item.role', 'Editor')->assertJsonPath('audit.action', 'Changed account role');

        // ...and now the second admin is the last one: it cannot be suspended, deleted or re-roled.
        $third = $this->staff('Administrator');
        $this->actingAs($third)->putJson("/api/cms/users/{$second->id}", ['suspended' => true])->assertOk();
        $this->actingAs($third)->putJson("/api/cms/users/{$third->id}", ['roleId' => $editorRole])->assertStatus(422);
        $this->actingAs($third)->putJson("/api/cms/users/{$second->id}", ['suspended' => false])->assertOk();
        $this->actingAs($second)->deleteJson("/api/cms/users/{$third->id}")->assertOk();
        $this->actingAs($second)->putJson("/api/cms/users/{$second->id}", ['roleId' => $editorRole])->assertStatus(422);

        // Suspending a client or an editor never trips the guard.
        $client = $this->client();
        $this->actingAs($second)->putJson("/api/cms/users/{$client->id}", ['suspended' => true])
            ->assertOk()->assertJsonPath('item.suspended', true)->assertJsonPath('audit.action', 'Suspended account');
    }

    public function test_system_roles_cannot_be_renamed_repermissioned_or_deleted(): void
    {
        $admin = $this->staff('Administrator');
        $system = Role::where('is_system', true)->firstOrFail();

        $this->actingAs($admin)->putJson("/api/cms/roles/{$system->id}", ['name' => 'Root'])
            ->assertStatus(422)->assertJsonPath('message', 'The Administrator role is fixed. Only its description can change.');
        $this->actingAs($admin)->putJson("/api/cms/roles/{$system->id}", ['permissions' => ['home.manage']])
            ->assertStatus(422);
        $this->actingAs($admin)->putJson("/api/cms/roles/{$system->id}", ['description' => 'Everything.'])
            ->assertOk()->assertJsonPath('item.description', 'Everything.')->assertJsonPath('item.system', true);
        $this->actingAs($admin)->deleteJson("/api/cms/roles/{$system->id}")
            ->assertStatus(422)->assertJsonPath('message', 'System roles cannot be deleted.');
        $this->assertSame('Administrator', $system->fresh()->name);

        // A custom role renames freely, but not while accounts sit on it.
        $custom = $this->actingAs($admin)->postJson('/api/cms/roles', ['name' => 'Desk', 'permissions' => ['email.manage']])
            ->assertCreated()->json('item');
        $renamed = $this->actingAs($admin)->putJson("/api/cms/roles/{$custom['id']}", ['name' => 'Sales desk', 'permissions' => ['email.manage', 'reports.manage']])
            ->assertOk()->assertJsonPath('item.name', 'Sales desk')->json('item.permissions');
        $this->assertEqualsCanonicalizing(['reports.manage', 'email.manage'], $renamed);
        $this->staff('Sales desk');
        $this->actingAs($admin)->deleteJson("/api/cms/roles/{$custom['id']}")->assertStatus(422);

        // Editors hold no access.manage at all.
        $this->actingAs($this->staff('Editor'))->getJson('/api/cms/access')->assertStatus(403);
    }

    public function test_update_user_password_change_revokes_the_accounts_tokens(): void
    {
        $admin = $this->staff('Administrator');
        $client = $this->client();
        $clientToken = $this->portalToken($client);
        $staff = $this->staff('Analyst');
        $staffToken = $this->cmsToken($staff);

        $this->withToken($clientToken)->getJson('/api/portal/bookmarks')->assertOk();
        $this->withToken($staffToken)->getJson('/api/me')->assertOk();

        $this->actingAs($admin)->putJson("/api/cms/users/{$client->id}", ['password' => 'Client-new-1'])
            ->assertOk()->assertJsonPath('audit.action', 'Reset password');
        $this->actingAs($admin)->putJson("/api/cms/users/{$staff->id}", ['password' => 'Staff-new-1'])
            ->assertOk();

        $this->withToken($clientToken)->getJson('/api/portal/bookmarks')->assertStatus(401);
        $this->withToken($staffToken)->getJson('/api/me')->assertStatus(401);
        $this->postJson('/api/portal/login', ['identity' => $client->email, 'password' => 'Client-new-1'])->assertOk();
        $this->postJson('/api/cms/login', ['email' => $staff->email, 'password' => 'Staff-new-1'])->assertOk();

        // A non-password edit leaves sessions alone.
        $token = $client->createToken('portal', ['portal'])->plainTextToken;
        $this->actingAs($admin)->putJson("/api/cms/users/{$client->id}", ['name' => 'Renamed'])->assertOk();
        $this->withToken($token)->getJson('/api/portal/bookmarks')->assertOk();

        // Suspending an account ends its sessions too.
        $this->actingAs($admin)->putJson("/api/cms/users/{$client->id}", ['suspended' => true])->assertOk();
        $this->withToken($token)->getJson('/api/portal/bookmarks')->assertStatus(401);

        // An admin changing their own password keeps the session making the call.
        $adminToken = $this->cmsToken($admin);
        $other = $admin->createToken('cms', ['cms'])->plainTextToken;
        $this->withToken($adminToken)->putJson("/api/cms/users/{$admin->id}", ['password' => 'Admin-new-1'])->assertOk();
        $this->withToken($adminToken)->getJson('/api/cms/access')->assertOk();
        $this->withToken($other)->getJson('/api/cms/access')->assertStatus(401);
    }

    public function test_only_the_super_admin_can_reveal_a_password(): void
    {
        $super = $this->superAdmin();
        $admin = $this->staff('Administrator');
        $client = $this->client(['password' => 'Readable-1']);

        $this->actingAs($admin)->getJson('/api/cms/access')->assertOk()->assertJsonPath('canRevealPasswords', false);
        $this->actingAs($super)->getJson('/api/cms/access')->assertOk()->assertJsonPath('canRevealPasswords', true);

        $this->actingAs($admin)->getJson("/api/cms/users/{$client->id}/password")
            ->assertStatus(403)->assertJsonPath('message', 'Only the super admin can view account passwords.');
        $this->assertDatabaseMissing('audit_entries', ['action' => 'Viewed password']);

        $this->actingAs($super)->getJson("/api/cms/users/{$client->id}/password")
            ->assertOk()->assertJsonPath('password', 'Readable-1')->assertJsonPath('audit.action', 'Viewed password');
        $this->assertDatabaseHas('audit_entries', ['action' => 'Viewed password', 'target' => $client->email, 'actor' => $super->name]);

        // A password that arrived already hashed has no plaintext on record.
        $imported = User::factory()->create(['kind' => User::KIND_CLIENT, 'status' => User::STATUS_APPROVED, 'password' => bcrypt('legacy')]);
        $this->actingAs($super)->getJson("/api/cms/users/{$imported->id}/password")->assertOk()->assertJsonPath('password', null);

        // The super admin flag is by identity, not by role.
        $this->postJson('/api/cms/login', ['email' => 'superadmin@cwdevs.com', 'password' => 'CWDevs2021!'])
            ->assertOk()->assertJsonPath('user.superAdmin', true);
    }
}
