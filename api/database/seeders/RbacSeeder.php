<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PortalToken;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class RbacSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            ['key' => 'insights.manage', 'label' => 'Insights', 'group' => 'Site content'],
            ['key' => 'reports.manage', 'label' => 'Reports', 'group' => 'Site content'],
            ['key' => 'services.manage', 'label' => 'Services', 'group' => 'Site content'],
            ['key' => 'people.manage', 'label' => 'People', 'group' => 'Site content'],
            ['key' => 'careers.manage', 'label' => 'Careers', 'group' => 'Site content'],
            ['key' => 'pages.manage', 'label' => 'Legal', 'group' => 'Site content'],
            ['key' => 'media.manage', 'label' => 'Media library', 'group' => 'Site content'],
            ['key' => 'market.manage', 'label' => 'Market ribbon', 'group' => 'Systems'],
            ['key' => 'newsletter.manage', 'label' => 'Newsletter', 'group' => 'Systems'],
            ['key' => 'access.manage', 'label' => 'Users & access', 'group' => 'Systems'],
            ['key' => 'logs.view', 'label' => 'Client logs', 'group' => 'Systems'],
        ];

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
        // Editors publish content; account control and the compliance ledger
        // stay with the Administrator.
        $editor->permissions()->sync($all->except(['access.manage', 'logs.view'])->values());

        $analyst = Role::updateOrCreate(
            ['name' => 'Analyst'],
            ['description' => 'Drafts research notes and posts reports. No site or system access.', 'is_system' => false],
        );
        $analyst->permissions()->sync([$all['insights.manage'], $all['reports.manage']]);

        // Staff accounts — mirrors the roster that ran the workspace pre-API.
        $staff = [
            ['name' => 'Edward S. Dagal', 'email' => 'e.dagal@regis.ph', 'role' => $admin, 'last' => '2026-08-23', 'suspended' => false],
            ['name' => 'Renalyn C. Chu', 'email' => 'r.chu@regis.ph', 'role' => $editor, 'last' => '2026-08-22', 'suspended' => false],
            ['name' => 'Carl Stanley T. Sy', 'email' => 'c.sy@regis.ph', 'role' => $editor, 'last' => '2026-08-21', 'suspended' => false],
            ['name' => 'Paolo Gabriel D. Garcia', 'email' => 'p.garcia@regis.ph', 'role' => $analyst, 'last' => '2026-08-19', 'suspended' => false],
            ['name' => 'Cerre Klyne M. Resullar', 'email' => 'c.resullar@regis.ph', 'role' => $analyst, 'last' => '2026-08-07', 'suspended' => false],
            ['name' => 'Mark Anthony P. Salvador', 'email' => 'm.salvador@regis.ph', 'role' => $editor, 'last' => '2026-05-30', 'suspended' => true],
        ];

        foreach ($staff as $s) {
            User::updateOrCreate(
                ['email' => $s['email']],
                [
                    'name' => $s['name'],
                    'password' => 'password',
                    'kind' => User::KIND_STAFF,
                    'role_id' => $s['role']->id,
                    'firm' => null,
                    'suspended' => $s['suspended'],
                    'last_active_at' => $s['last'].' 09:00:00',
                ],
            );
        }

        // Portal clients — approved institutional mandates.
        $clients = [
            ['name' => 'Katrina Villaruel', 'email' => 'k.villaruel@arqcapital.ph', 'username' => 'kvillaruel', 'firm' => 'ARQ Capital', 'position' => 'Head of Research', 'phone' => '+63 917 284 6610', 'last' => '2026-08-19'],
            ['name' => 'Miguel Dizon', 'email' => 'mdizon@lakefieldam.com', 'username' => 'mdizon', 'firm' => 'Lakefield Asset Mgmt', 'position' => 'Portfolio Manager', 'phone' => '+63 918 553 2074', 'last' => '2026-08-17'],
            ['name' => 'Thea Abalos', 'email' => 'thea.abalos@sunwardpensions.ph', 'username' => 'tabalos', 'firm' => 'Sunward Pensions', 'position' => 'Investment Officer', 'phone' => '+63 915 908 4471', 'last' => '2026-08-14'],
        ];

        foreach ($clients as $c) {
            User::updateOrCreate(
                ['email' => $c['email']],
                [
                    'name' => $c['name'],
                    'username' => $c['username'],
                    'password' => 'password',
                    'kind' => User::KIND_CLIENT,
                    'status' => User::STATUS_APPROVED,
                    'role_id' => null,
                    'firm' => $c['firm'],
                    'position' => $c['position'],
                    'phone' => $c['phone'],
                    'suspended' => false,
                    'last_active_at' => $c['last'].' 09:00:00',
                    'registered_at' => '2026-05-02 10:15:00',
                    'approved_at' => '2026-05-02 14:40:00',
                ],
            );
        }

        // Mandates mid-onboarding, so the approval queue reflects real states.
        $invited = User::updateOrCreate(
            ['email' => 'r.ocampo@bataancapital.ph'],
            [
                'name' => 'Rafael Ocampo',
                'username' => 'rocampo',
                'password' => Str::random(40),
                'kind' => User::KIND_CLIENT,
                'status' => User::STATUS_INVITED,
                'role_id' => null,
                'firm' => 'Bataan Capital',
                'suspended' => false,
            ],
        );
        PortalToken::issue($invited, PortalToken::REGISTRATION);

        User::updateOrCreate(
            ['email' => 'i.sarmiento@calderonpartners.com'],
            [
                'name' => 'Ingrid Sarmiento',
                'username' => 'isarmiento',
                'password' => 'password',
                'kind' => User::KIND_CLIENT,
                'status' => User::STATUS_PENDING,
                'role_id' => null,
                'firm' => 'Calderon Partners',
                'position' => 'Senior Analyst, Equities',
                'phone' => '+63 917 441 9082',
                'suspended' => false,
                'registered_at' => '2026-08-23 16:20:00',
            ],
        );
    }
}
