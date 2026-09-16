<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Support\SuperAdmin;
use Illuminate\Database\Seeder;

class RbacSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            ['key' => 'home.manage', 'label' => 'Landing page', 'group' => 'Site content'],
            ['key' => 'insights.manage', 'label' => 'Insights', 'group' => 'Site content'],
            ['key' => 'reports.manage', 'label' => 'Reports', 'group' => 'Site content'],
            ['key' => 'services.manage', 'label' => 'Services', 'group' => 'Site content'],
            ['key' => 'people.manage', 'label' => 'People', 'group' => 'Site content'],
            ['key' => 'careers.manage', 'label' => 'Careers', 'group' => 'Site content'],
            ['key' => 'pages.manage', 'label' => 'Legal', 'group' => 'Site content'],
            ['key' => 'media.manage', 'label' => 'Media library', 'group' => 'Site content'],
            ['key' => 'market.manage', 'label' => 'Market ribbon', 'group' => 'Systems'],
            ['key' => 'newsletter.manage', 'label' => 'Newsletter', 'group' => 'Systems'],
            ['key' => 'email.manage', 'label' => 'Email desk', 'group' => 'Systems'],
            ['key' => 'access.manage', 'label' => 'Users & access', 'group' => 'Systems'],
            ['key' => 'logs.view', 'label' => 'Client logs', 'group' => 'Systems'],
            // CRMS — signed into with the same staff accounts (CRMSmasterplan.md §5.2).
            ['key' => 'crms.access', 'label' => 'CRMS sign-in', 'group' => 'CRMS'],
            ['key' => 'crms.interactions.manage', 'label' => 'Interactions', 'group' => 'CRMS'],
            ['key' => 'crms.events.manage', 'label' => 'Events & itineraries', 'group' => 'CRMS'],
            ['key' => 'crms.contacts.manage', 'label' => 'Clients & corporates', 'group' => 'CRMS'],
            ['key' => 'crms.reports.generate', 'label' => 'Consumption reports', 'group' => 'CRMS'],
            ['key' => 'crms.admin', 'label' => 'Interaction types, form builder, CRMS logs', 'group' => 'CRMS'],
        ];

        $crmsKeys = ['crms.access', 'crms.interactions.manage', 'crms.events.manage', 'crms.contacts.manage', 'crms.reports.generate', 'crms.admin'];

        foreach ($permissions as $p) {
            Permission::updateOrCreate(['key' => $p['key']], $p);
        }

        $all = Permission::pluck('id', 'key');

        $admin = Role::updateOrCreate(
            ['name' => 'Administrator'],
            ['description' => 'Full control of content, publishing, and every account on the system.', 'is_system' => true],
        );
        $admin->permissions()->sync($all->values());

        $editor = Role::updateOrCreate(
            ['name' => 'Editor'],
            ['description' => 'Publishes content across every module. No access to user management.', 'is_system' => false],
        );
        // Editors publish content; account control, the compliance ledger and
        // the CRMS stay with the Administrator and the desk.
        $editor->permissions()->sync($all->except(['access.manage', 'logs.view', ...$crmsKeys])->values());

        $analyst = Role::updateOrCreate(
            ['name' => 'Analyst'],
            ['description' => 'Drafts research notes and posts reports. No site or system access.', 'is_system' => false],
        );
        // Analysts blast their own research, so the Email desk rides along, and
        // they run the CRMS desk — everything but its administration.
        $analyst->permissions()->sync([
            $all['insights.manage'], $all['reports.manage'], $all['email.manage'],
            $all['crms.access'], $all['crms.interactions.manage'], $all['crms.events.manage'],
            $all['crms.contacts.manage'], $all['crms.reports.generate'],
        ]);

        // The only seeded account. Every other staff member and every portal
        // client comes from the legacy regis.ph export:
        //   php artisan accounts:import-legacy ../regis_accounts_export.sql --fresh
        SuperAdmin::ensure();
    }
}
