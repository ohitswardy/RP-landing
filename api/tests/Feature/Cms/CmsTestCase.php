<?php

namespace Tests\Feature\Cms;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Shared footing for the CMS tests: RBAC seeded (super admin only), Graph
 * blanked by phpunit.xml, and actors built from the factory per role.
 */
abstract class CmsTestCase extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RbacSeeder::class);
        config()->set('app.frontend_url', 'https://regis.ph');
        config()->set('app.url', 'https://api.regis.ph');
    }

    protected function staff(string $role = 'Administrator', array $over = []): User
    {
        return User::factory()->create($over + [
            'kind' => User::KIND_STAFF,
            'status' => User::STATUS_APPROVED,
            'role_id' => Role::where('name', $role)->value('id'),
            'suspended' => false,
        ]);
    }

    protected function client(array $over = []): User
    {
        return User::factory()->create($over + [
            'kind' => User::KIND_CLIENT,
            'status' => User::STATUS_APPROVED,
            'client_type' => 'Local',
            'firm' => 'Test Fund',
            'suspended' => false,
        ]);
    }

    /** Sign in as a staff member of the given role and return them. */
    protected function actingAsStaff(string $role = 'Administrator', array $over = []): User
    {
        $user = $this->staff($role, $over);
        Sanctum::actingAs($user, ['cms']);

        return $user;
    }
}
