<?php

namespace Tests\Feature\Crms;

use App\Models\Crms\Client;
use App\Models\Crms\Interaction;
use App\Models\Role;
use App\Models\User;
use App\Services\Crms\ReportGenerator;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The CRMS door and its permission fences: Administrator and Analyst enter,
 * Editor and clients are refused; every crms.* write is fenced by its key;
 * reports honour the date range and include every author.
 */
class CrmsAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // The crms connection is sqlite in memory under phpunit; lay the schema down there too.
        $this->artisan('migrate', ['--database' => 'crms', '--path' => 'database/migrations/2026_09_07_100000_create_crms_schema.php']);
        $this->seed(RbacSeeder::class);
    }

    private function staff(string $role): User
    {
        return User::factory()->create([
            'kind' => User::KIND_STAFF,
            'role_id' => Role::where('name', $role)->value('id'),
            'password' => 'password',
        ]);
    }

    public function test_administrator_and_analyst_sign_in_but_editor_is_refused(): void
    {
        $admin = $this->staff('Administrator');
        $analyst = $this->staff('Analyst');
        $editor = $this->staff('Editor');

        $this->postJson('/api/crms/login', ['email' => $admin->email, 'password' => 'password'])
            ->assertOk()->assertJsonPath('user.role', 'Administrator');
        $this->postJson('/api/crms/login', ['email' => $analyst->email, 'password' => 'password'])
            ->assertOk()->assertJsonFragment(['crms.access']);
        $this->postJson('/api/crms/login', ['email' => $editor->email, 'password' => 'password'])
            ->assertStatus(403);
    }

    public function test_clients_and_suspended_staff_are_refused(): void
    {
        $client = User::factory()->create(['kind' => User::KIND_CLIENT, 'password' => 'password', 'status' => User::STATUS_APPROVED]);
        $this->postJson('/api/crms/login', ['email' => $client->email, 'password' => 'password'])->assertStatus(422);

        $suspended = $this->staff('Administrator');
        $suspended->forceFill(['suspended' => true])->save();
        $this->postJson('/api/crms/login', ['email' => $suspended->email, 'password' => 'password'])->assertStatus(403);
    }

    public function test_analyst_cannot_reach_admin_routes_and_editor_cannot_reach_crms_at_all(): void
    {
        $analyst = $this->staff('Analyst');
        $this->actingAs($analyst)->getJson('/api/crms/bootstrap')->assertOk();
        $this->actingAs($analyst)->postJson('/api/crms/interaction-types', ['type' => 'Call', 'meetingTypes' => []])->assertStatus(403);

        $editor = $this->staff('Editor');
        $this->actingAs($editor)->getJson('/api/crms/bootstrap')->assertStatus(403);
    }

    public function test_client_crud_writes_a_crms_audit_row(): void
    {
        $admin = $this->staff('Administrator');

        $res = $this->actingAs($admin)->postJson('/api/crms/clients', ['name' => 'Schroders', 'region' => 'UK', 'clientType' => 'Foreign'])
            ->assertCreated()->assertJsonPath('item.name', 'Schroders');

        $this->assertDatabaseHas('audit_entries', ['action' => 'CRMS · Added client', 'target' => 'Schroders']);
        $this->assertSame('crms', Client::query()->getConnection()->getName());

        $id = $res->json('item.id');
        $this->actingAs($admin)->deleteJson("/api/crms/clients/{$id}")->assertOk();
        $this->assertDatabaseMissing('client', ['id' => $id], 'crms');
    }

    public function test_reports_honour_the_date_range_and_include_every_author(): void
    {
        $admin = $this->staff('Administrator');
        $client = Client::create(['name' => 'Schroders']);

        $research = [['id' => 1, 'name' => 'Analyst A', 'type' => 'Analyst']];
        $sales = [['id' => 2, 'name' => 'Sales B', 'type' => 'Sales']];
        foreach ([['2026-08-05', $research], ['2026-08-20', $sales], ['2026-07-30', $research], ['2026-09-01', $sales]] as [$date, $desk]) {
            Interaction::create(['client_id' => $client->id, 'interaction_date' => "$date 00:00:00", 'duration' => '30', 'sellside_contact' => $desk, 'form' => [], 'client_contact' => []]);
        }

        $inRange = Interaction::where('client_id', $client->id)->between('2026-08-01', '2026-08-31')->count();
        $this->assertSame(2, $inRange);

        $generator = app(ReportGenerator::class);
        $client_report = $generator->build('client', '2026-08-01', '2026-08-31', $client);
        $this->assertCount($inRange, $client_report['sheets']['Consumption']['rows']);

        $internal = $generator->build('internal', '2026-08-01', '2026-08-31');
        $this->assertCount(1, $internal['sheets']['Analysts']['rows'], 'analyst sheet must not come back empty');
        $this->assertCount(1, $internal['sheets']['Sales']['rows']);
        $this->assertCount(2, $internal['sheets']['All interactions']['rows']);

        $this->actingAs($admin)->postJson('/api/crms/reports/generate', ['type' => 'client', 'clientId' => $client->id, 'from' => '2026-08-01', 'to' => '2026-08-31'])
            ->assertOk()->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
}
