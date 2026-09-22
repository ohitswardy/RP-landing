<?php

namespace Tests\Feature\Crms;

use App\Enums\Crms\EventCategory;
use App\Models\Crms\Client;
use App\Models\Crms\Corporate;
use App\Models\Crms\Event;
use App\Models\Crms\Interaction;
use App\Models\Crms\InteractionType;
use App\Models\Crms\Meeting;
use App\Models\Crms\OneOffMeeting;
use App\Models\Crms\SellsideContact;
use App\Models\Role;
use App\Models\User;
use App\Services\Crms\InteractionTypeResolver;
use App\Services\MicrosoftGraphMailer;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

/**
 * What the legacy Angular events area did that ours must keep doing:
 * converted meetings carry an interaction type and the Regis party, one-off
 * analyst meetings keep their analyst list in `description`, the itinerary
 * is a real PDF that can be emailed, and legacy rows stay editable.
 */
class EventsLegacyParityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate', ['--database' => 'crms', '--path' => [
            'database/migrations/2026_09_07_100000_create_crms_schema.php',
            'database/migrations/2026_09_18_100000_add_important_to_crms_interactions.php',
            'database/migrations/2026_09_22_100000_add_layout_to_crms_report_templates.php',
        ]]);
        $this->seed(RbacSeeder::class);
    }

    private function admin(): User
    {
        return User::factory()->create([
            'kind' => User::KIND_STAFF,
            'role_id' => Role::where('name', 'Administrator')->value('id'),
            'password' => 'password',
        ]);
    }

    private function event(EventCategory $cat, array $extra = []): Event
    {
        return Event::create($extra + ['category' => $cat->value, 'start_date' => '2026-10-05 00:00:00', 'end_date' => '2026-10-06 00:00:00', 'client_contact' => [], 'sellside_contact' => []]);
    }

    public function test_the_resolver_normalises_legacy_spellings_and_prefers_the_clients_own_type(): void
    {
        $client = Client::create(['name' => 'Schroders']);
        $other = Client::create(['name' => 'GMO']);
        InteractionType::create(['type' => 'Roadshow: Deal', 'client_id' => $client->id]);
        InteractionType::create(['type' => 'Roadshow:Deal', 'client_id' => $other->id]);
        $global = InteractionType::create(['type' => 'Deal Related', 'client_id' => null]);

        $resolver = app(InteractionTypeResolver::class);
        $hit = $resolver->resolve($client->id, InteractionTypeResolver::CANDIDATES['deal-roadshow']);
        $this->assertSame('Roadshow: Deal', $hit->type);
        $this->assertSame($client->id, (int) $hit->client_id);

        // Another client cannot borrow Schroders' type; it falls through to the global candidate.
        $this->assertSame($global->id, $resolver->resolve(Client::create(['name' => 'FIM'])->id, InteractionTypeResolver::CANDIDATES['deal-roadshow'])->id);
        $this->assertNull($resolver->resolve($client->id, ['Nothing Like This']));
    }

    public function test_a_roadshow_meeting_converts_with_the_deal_type_and_contact_time(): void
    {
        $admin = $this->admin();
        $client = Client::create(['name' => 'Schroders']);
        $corp = Corporate::create(['name' => 'Ayala Land, Inc.', 'ticker' => 'ALI']);
        $deal = InteractionType::create(['type' => 'Roadshow: Deal', 'client_id' => $client->id]);
        $event = $this->event(EventCategory::Roadshow, ['corporate_id' => $corp->id, 'classification' => 'Deal Roadshow', 'sellside_contact' => [['id' => 9, 'name' => 'Sales B']]]);
        $meeting = Meeting::create(['roadshow_id' => $event->id, 'date' => '2026-10-05 00:00:00', 'time_start' => '09:00', 'time_end' => '10:30', 'location' => 'Makati', 'meeting_type' => '1x1', 'corporate_type' => 'client', 'client_id' => $client->id, 'client_contact' => [], 'corporate_contact' => []]);

        $res = $this->actingAs($admin)->postJson("/api/crms/meetings/{$meeting->id}/convert-to-interaction")->assertCreated();
        $interaction = Interaction::find($res->json('item.id'));
        $this->assertSame($deal->id, (int) $interaction->interactions_type_id);
        $this->assertSame('90', (string) $interaction->duration);
        $this->assertSame('Sales B', $interaction->sellside_contact[0]['name']);
        $this->assertSame('Roadshow: Deal', $res->json('item.typeName'));
    }

    public function test_an_analyst_marketing_meeting_carries_its_own_analysts_into_the_interaction(): void
    {
        $admin = $this->admin();
        $client = Client::create(['name' => 'Schroders']);
        $type = InteractionType::create(['type' => 'Analyst Meeting', 'client_id' => null]);
        $a = SellsideContact::create(['name' => 'Analyst A', 'type' => 'Analyst', 'email' => 'a@regis.ph']);
        $b = SellsideContact::create(['name' => 'Analyst B', 'type' => 'Analyst', 'email' => 'b@regis.ph']);
        $event = $this->event(EventCategory::AnalystMarketing, ['sellside_contact' => [$a->toSnapshot(), $b->toSnapshot()]]);

        // The meeting names a subset of the travelling party; it goes into corporate_contact as legacy did.
        $meetingId = $this->actingAs($admin)->postJson("/api/crms/events/{$event->id}/meetings", [
            'date' => '2026-10-05', 'timeStart' => '09:00', 'timeEnd' => '10:00', 'location' => 'Singapore', 'meetingType' => '1x1',
            'classification' => 'client', 'clientId' => $client->id, 'clientContactIds' => [], 'corporateContactIds' => [], 'analystIds' => [$b->id],
        ])->assertCreated()->assertJsonPath('item.corporateContacts.0.name', 'Analyst B')->json('item.id');

        $res = $this->actingAs($admin)->postJson("/api/crms/meetings/$meetingId/convert-to-interaction")->assertCreated();
        $interaction = Interaction::find($res->json('item.id'));
        $this->assertSame($type->id, (int) $interaction->interactions_type_id);
        $this->assertCount(1, $interaction->sellside_contact);
        $this->assertSame('Analyst B', $interaction->sellside_contact[0]['name']);
    }

    public function test_a_one_off_analyst_meeting_keeps_its_analysts_in_description_and_converts_typed(): void
    {
        $admin = $this->admin();
        $client = Client::create(['name' => 'Schroders']);
        $type = InteractionType::create(['type' => 'Analyst Interaction', 'client_id' => null]);
        $a = SellsideContact::create(['name' => 'Analyst A', 'type' => 'Analyst', 'email' => 'a@regis.ph']);

        // No location, no corporate — legacy never required them for an analyst meeting.
        $this->actingAs($admin)->postJson('/api/crms/one-off-meetings', [
            'clientId' => $client->id, 'startDate' => '2026-10-05', 'timeStart' => '10:00', 'timeEnd' => '11:00', 'classification' => 'analyst',
            'clientContactIds' => [], 'corporateContactIds' => [], 'sellsideContactIds' => [],
        ])->assertStatus(422)->assertJsonPath('message', 'An analyst meeting needs at least one analyst.');

        $res = $this->actingAs($admin)->postJson('/api/crms/one-off-meetings', [
            'clientId' => $client->id, 'startDate' => '2026-10-05', 'timeStart' => '10:00', 'timeEnd' => '11:00', 'classification' => 'analyst',
            'clientContactIds' => [], 'corporateContactIds' => [], 'sellsideContactIds' => [$a->id],
        ])->assertCreated()->assertJsonPath('item.analysts.0.name', 'Analyst A')->assertJsonPath('item.description', null)->assertJsonPath('item.subject', 'Analyst A');
        $id = $res->json('item.id');

        // Byte-compatible with the Angular app: a JSON list in the description column.
        $raw = OneOffMeeting::find($id)->getRawOriginal('description');
        $this->assertSame('Analyst A', json_decode($raw, true)[0]['name']);

        // A legacy row written by the old app reads back the same way.
        $legacy = OneOffMeeting::create(['client_id' => $client->id, 'start_date' => '2026-10-06 00:00:00', 'classification' => 'analyst', 'description' => json_encode([['id' => $a->id, 'name' => 'Analyst A', 'email' => 'a@regis.ph']]), 'client_contact' => [], 'corporate_contact' => []]);
        $this->assertSame('Analyst A', $legacy->analysts()[0]['name']);
        $this->assertSame('Analyst A', $legacy->subject());

        $conv = $this->actingAs($admin)->postJson("/api/crms/one-off-meetings/$id/convert-to-interaction")->assertCreated();
        $interaction = Interaction::find($conv->json('item.id'));
        $this->assertSame($type->id, (int) $interaction->interactions_type_id);
        $this->assertSame('Analyst A', $interaction->sellside_contact[0]['name']);
        $this->assertSame('60', (string) $interaction->duration);
    }

    public function test_the_itinerary_downloads_as_a_pdf_and_emails_through_graph(): void
    {
        $admin = $this->admin();
        $corp = Corporate::create(['name' => 'Ayala Land, Inc.', 'ticker' => 'ALI']);
        $event = $this->event(EventCategory::Roadshow, ['corporate_id' => $corp->id, 'classification' => 'Non-Deal Roadshow', 'coordinator' => 'Coordinator C']);
        Meeting::create(['roadshow_id' => $event->id, 'date' => '2026-10-05 00:00:00', 'time_start' => '09:00', 'time_end' => '10:00', 'location' => 'Makati', 'meeting_type' => '1x1', 'corporate_type' => 'corporate', 'corporate_id' => $corp->id, 'booked_by' => 'Sales B', 'client_contact' => [], 'corporate_contact' => []]);

        $pdf = $this->actingAs($admin)->get("/api/crms/events/{$event->id}/itinerary.pdf")->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $pdf->getContent());
        $this->assertStringContainsString('Non-Deal Roadshow Schedule - Ayala Land, Inc.', $pdf->headers->get('content-disposition'));

        // The aggregator prints the ticker and who booked the slot.
        $json = $this->actingAs($admin)->getJson("/api/crms/events/{$event->id}/itinerary")->assertOk()->json();
        $this->assertSame('Ayala Land, Inc. (ALI)', $json['days'][0]['items'][0]['title']);
        $this->assertStringContainsString('Booked by Sales B', $json['days'][0]['items'][0]['detail']);

        // Never touch the real mailbox from a test: an unconfigured mailer answers with a clear 503.
        $off = Mockery::mock(MicrosoftGraphMailer::class);
        $off->shouldReceive('enabled')->andReturn(false);
        $this->app->instance(MicrosoftGraphMailer::class, $off);
        $this->actingAs($admin)->postJson("/api/crms/events/{$event->id}/itinerary/email")->assertStatus(503);

        $mailer = Mockery::mock(MicrosoftGraphMailer::class);
        $mailer->shouldReceive('enabled')->andReturn(true);
        $mailer->shouldReceive('senderFor')->andReturn('desk@regis.ph');
        $mailer->shouldReceive('senderAllowed')->andReturn(true);
        $mailer->shouldReceive('attachmentMaxBytes')->andReturn(3 * 1024 * 1024);
        $mailer->shouldReceive('send')->once()->withArgs(function (string $sender, array $message) use ($admin) {
            return $sender === 'desk@regis.ph'
                && $message['toRecipients'][0]['emailAddress']['address'] === mb_strtolower($admin->email)
                && $message['subject'] === 'Non-Deal Roadshow Schedule - Ayala Land, Inc.'
                && $message['attachments'][0]['contentType'] === 'application/pdf'
                && str_contains($message['body']['content'], 'Ayala Land, Inc. (ALI)');
        })->andReturn('req-1');
        $this->app->instance(MicrosoftGraphMailer::class, $mailer);

        $this->actingAs($admin)->postJson("/api/crms/events/{$event->id}/itinerary/email")->assertOk()
            ->assertJsonPath('to', mb_strtolower($admin->email))->assertJsonPath('audit.action', 'CRMS · Emailed itinerary');
    }

    public function test_legacy_loose_rows_stay_editable_and_the_regis_row_can_be_overridden(): void
    {
        $admin = $this->admin();
        $event = $this->event(EventCategory::ReverseRoadshow, ['client_id' => Client::create(['name' => 'Schroders'])->id]);

        // Ground transport with only a date, a window and a pick-up — as most legacy rows are.
        $this->actingAs($admin)->postJson("/api/crms/events/{$event->id}/transportation", [
            'date' => '2026-10-05', 'startTime' => '08:00', 'endTime' => '18:00', 'location' => 'Hotel lobby',
        ])->assertCreated()->assertJsonPath('item.driverName', '');

        $staff = SellsideContact::create(['name' => 'Sales B', 'type' => 'Sales', 'email' => 'b@regis.ph', 'mobile_no' => '0917 000 0000', 'position' => 'Sales']);
        $this->actingAs($admin)->postJson("/api/crms/events/{$event->id}/attendees", ['sellsideContactId' => $staff->id, 'mobileNo' => '+65 9000 0000'])
            ->assertCreated()->assertJsonPath('item.mobileNo', '+65 9000 0000')->assertJsonPath('item.position', 'Sales')->assertJsonPath('item.email', 'b@regis.ph');

        // The header names no Regis party (as legacy), so a converted meeting takes the Regis tab as its sellside.
        $corp = Corporate::create(['name' => 'Ayala Land, Inc.']);
        $meeting = Meeting::create(['roadshow_id' => $event->id, 'date' => '2026-10-05 00:00:00', 'time_start' => '09:00', 'time_end' => '10:00', 'location' => 'Makati', 'meeting_type' => '1x1', 'corporate_type' => 'corporate', 'corporate_id' => $corp->id, 'client_contact' => [], 'corporate_contact' => []]);
        $res = $this->actingAs($admin)->postJson("/api/crms/meetings/{$meeting->id}/convert-to-interaction")->assertCreated();
        $this->assertSame('Sales B', Interaction::find($res->json('item.id'))->sellside_contact[0]['name']);
    }
}
