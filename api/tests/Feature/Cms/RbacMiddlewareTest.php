<?php

namespace Tests\Feature\Cms;

use Laravel\Sanctum\Sanctum;

/**
 * The permission fence around /api/cms/*: the role's keys decide, clients
 * never get in, and a suspension ends the session on the next request.
 */
class RbacMiddlewareTest extends CmsTestCase
{
    public function test_staff_without_the_key_are_refused_and_with_it_admitted(): void
    {
        // Editors do not hold access.manage; Administrators hold everything.
        $this->actingAsStaff('Editor');
        $this->getJson('/api/cms/access')->assertForbidden()
            ->assertJsonPath('message', 'Your role does not include access to this module.');
        $this->getJson('/api/cms/media')->assertOk(); // media.manage is an Editor key

        $this->actingAsStaff('Administrator');
        $this->getJson('/api/cms/access')->assertOk();

        // Analysts hold email.manage but not services.manage.
        $this->actingAsStaff('Analyst');
        $this->getJson('/api/cms/email-blasts')->assertOk();
        $this->postJson('/api/cms/services', ['title' => 'Nope'])->assertForbidden();
    }

    public function test_a_client_token_is_refused_on_every_cms_route(): void
    {
        Sanctum::actingAs($this->client(), ['portal']);

        $this->getJson('/api/cms/bootstrap')->assertForbidden();
        $this->getJson('/api/cms/media')->assertForbidden();
        $this->getJson('/api/cms/email-blasts')->assertForbidden();
    }

    public function test_a_suspended_staff_member_is_refused(): void
    {
        $this->actingAsStaff('Administrator', ['suspended' => true]);

        $this->getJson('/api/cms/bootstrap')->assertForbidden();
        $this->getJson('/api/cms/access')->assertForbidden();
    }

    public function test_an_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/cms/bootstrap')->assertUnauthorized();
    }
}
