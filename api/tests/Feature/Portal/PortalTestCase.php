<?php

namespace Tests\Feature\Portal;

use App\Models\Company;
use App\Models\Report;
use App\Models\Role;
use App\Models\User;
use App\Services\MicrosoftGraphMailer;
use Database\Seeders\RbacSeeder;
use Illuminate\Contracts\Auth\Authenticatable as UserContract;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

/**
 * Shared fixtures for the portal suite. RbacSeeder seeds the roles and the
 * super admin only, so every other actor is built here with the factory.
 */
abstract class PortalTestCase extends TestCase
{
    use RefreshDatabase;

    protected const PASSWORD = 'Portal-pass-1';

    protected function setUp(): void
    {
        parent::setUp();
        // Guest throttling keys on the IP across every throttled route, so a
        // test's own logins would otherwise eat the forgot-password budget.
        $this->withoutMiddleware(ThrottleRequests::class);
        $this->seed(RbacSeeder::class);
        // Never reach the real tenant from a test: an inert mailer unless a
        // test swaps in its own expectation.
        $this->mailerOff();
    }

    /**
     * Laravel keeps guard instances (and the user they resolved) for the whole
     * test, so a second request with another token, or with a revoked or
     * expired one, would still see the first user. Every change of caller
     * drops the cached guards so the next request authenticates afresh.
     */
    protected function freshAuth(): static
    {
        $this->app['auth']->forgetGuards();

        return $this;
    }

    public function withToken(string $token, string $type = 'Bearer'): static
    {
        $this->freshAuth();

        return parent::withToken($token, $type);
    }

    public function actingAs(UserContract $user, $guard = null): static
    {
        $this->freshAuth()->withoutToken();

        return parent::actingAs($user, $guard);
    }

    /** The next request carries no session and no token. */
    protected function guest(): static
    {
        return $this->freshAuth()->withoutToken();
    }

    /** A portal client, approved unless overridden, signing in with PASSWORD. */
    protected function client(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'kind' => User::KIND_CLIENT,
            'status' => User::STATUS_APPROVED,
            'username' => 'RP-'.fake()->unique()->numerify('####'),
            'firm' => 'Test Capital',
            'client_type' => 'Local',
            'sector_prefs' => [],
            'preferred_analysts' => [],
            'password' => self::PASSWORD,
            'approved_at' => now(),
        ], $attributes));
    }

    /** A staff account on a seeded role, signing in with PASSWORD. */
    protected function staff(string $role = 'Administrator', array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'kind' => User::KIND_STAFF,
            'status' => User::STATUS_APPROVED,
            'role_id' => Role::where('name', $role)->value('id'),
            'password' => self::PASSWORD,
        ], $attributes));
    }

    /** The seeded CWDevs super admin. */
    protected function superAdmin(): User
    {
        return User::where('email', 'superadmin@cwdevs.com')->firstOrFail();
    }

    protected function report(array $attributes = []): Report
    {
        static $n = 0;
        $n++;

        return Report::create(array_merge([
            'title' => "Report {$n}",
            'category' => 'Banks',
            'analyst' => 'C. Resullar, CFA',
            'date' => '2026-08-0'.(($n % 9) + 1),
            'pages' => 12,
            'summary' => 'Summary.',
            'file_name' => "report-{$n}.pdf",
            'file_size' => 1000,
            'file_url' => null,
            'file_path' => null,
        ], $attributes));
    }

    protected function company(string $name, string $symbol, string $type = 'Local'): Company
    {
        return Company::create(['name' => $name, 'symbol' => $symbol, 'type' => $type]);
    }

    /** Sign a client in through the real door and return the plain token. */
    protected function portalToken(User $client, bool $remember = false): string
    {
        return $this->postJson('/api/portal/login', [
            'identity' => $client->email,
            'password' => self::PASSWORD,
            'remember' => $remember,
        ])->assertOk()->json('token');
    }

    /** Sign staff in through the CMS door and return the plain token. */
    protected function cmsToken(User $staff, bool $remember = false): string
    {
        return $this->postJson('/api/cms/login', [
            'email' => $staff->email,
            'password' => self::PASSWORD,
            'remember' => $remember,
        ])->assertOk()->json('token');
    }

    /** A Graph mailer that reports itself unconfigured. */
    protected function mailerOff(): MockInterface
    {
        $off = Mockery::mock(MicrosoftGraphMailer::class);
        $off->shouldReceive('enabled')->andReturn(false);
        $off->shouldReceive('send')->never();
        $this->app->instance(MicrosoftGraphMailer::class, $off);

        return $off;
    }

    /** A configured Graph mailer whose send() is left for the test to expect. */
    protected function mailerOn(string $sender = 'noreply@regis.ph'): MockInterface
    {
        $on = Mockery::mock(MicrosoftGraphMailer::class);
        $on->shouldReceive('enabled')->andReturn(true);
        $on->shouldReceive('defaultSender')->andReturn($sender);
        $on->shouldReceive('senderAllowed')->andReturn(true);
        $this->app->instance(MicrosoftGraphMailer::class, $on);

        return $on;
    }
}
