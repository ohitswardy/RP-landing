<?php

namespace App\Console\Commands;

use App\Models\Crms\ClientContact;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\Crms\PortalAccountResolver;
use App\Support\Audit;
use App\Support\LegacyAccountsExport;
use App\Support\SuperAdmin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/** Thrown inside the import transaction on --dry-run so the writes roll back. */
final class DryRunRollback extends RuntimeException
{
    public function __construct(public readonly array $summary)
    {
        parent::__construct('dry run');
    }
}

/**
 * Brings the accounts exported from the old regis.ph CMS
 * (`regis_accounts_export.sql`: 23 CMS staff, 564 portal clients) into
 * `users`.
 *
 *   php artisan accounts:import-legacy ../regis_accounts_export.sql --fresh
 *
 * Every row keeps its old primary key in `legacy_id`, so re-running updates
 * in place. Client bcrypt hashes migrate as-is; the legacy CMS used an
 * in-house password encoding, so staff get an unusable password (or the one
 * passed with --staff-password) and reset it from Users & access. The
 * CWDevs super admin is re-asserted at the end of every run.
 */
class ImportLegacyAccounts extends Command
{
    protected $signature = 'accounts:import-legacy
        {file : Path to regis_accounts_export.sql}
        {--fresh : Delete every existing account first; the super admin is recreated}
        {--staff-password= : Temporary password for every imported staff account}
        {--dry-run : Parse, map and report without writing anything}';

    protected $description = 'Import the staff and client accounts exported from the legacy regis.ph CMS';

    /**
     * Legacy CMS module keys => the permission keys that cover the same
     * ground here. Sub-modules (`newsletter:daily`) fall back to their parent.
     * The old "clients" module managed portal accounts and their read logs;
     * that is Users & access plus Client logs in this CMS — a coarser grant,
     * flagged in the role description for review.
     */
    private const MODULE_MAP = [
        'home' => ['home.manage'],
        'about-us' => ['people.manage'],
        'services' => ['services.manage'],
        'contact-us' => ['pages.manage'],
        'privacy-statement' => ['pages.manage'],
        'newsletter' => ['newsletter.manage', 'email.manage'],
        'clients' => ['access.manage', 'logs.view'],
        'clients:client-list' => ['access.manage'],
        'clients:client-data' => ['logs.view'],
        'clients:settings-tags' => [],
        'clients:settings-email' => ['email.manage'],
        'clients:settings-analyst' => [],
    ];

    /** Roles reconstructed from the permission sets the legacy CMS actually granted, smallest first. */
    private const LEGACY_ROLES = [
        [
            'name' => 'Newsletter Desk',
            'description' => 'Legacy CMS scope: the Daily, Weekly and Monthly mailers. Publishes newsletter issues and sends them from the Email desk.',
            'permissions' => ['newsletter.manage', 'email.manage'],
        ],
        [
            'name' => 'Client Desk',
            'description' => 'Legacy CMS scope: the mailers plus the portal client list and client data log. The old client list maps onto Users & access here, which also covers staff accounts — review before go-live.',
            'permissions' => ['newsletter.manage', 'email.manage', 'access.manage', 'logs.view'],
        ],
        [
            'name' => 'Site Editor',
            'description' => 'Legacy CMS scope: every public page (home, about, services, contact, privacy) plus the mailers and the portal client list.',
            'permissions' => ['home.manage', 'people.manage', 'services.manage', 'pages.manage', 'newsletter.manage', 'email.manage', 'access.manage', 'logs.view'],
        ],
    ];

    private array $notes = [];

    public function handle(): int
    {
        $path = (string) $this->argument('file');
        try {
            $export = new LegacyAccountsExport($path);
            $cmsUsers = $export->cmsUsers();
            $clients = $export->clientAccounts();
            $quality = $export->dataQuality();
        } catch (Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info(sprintf('Parsed %d CMS accounts, %d client accounts, %d data-quality flags.', count($cmsUsers), count($clients), array_sum(array_map('count', $quality))));

        $dry = (bool) $this->option('dry-run');
        $staffPassword = $this->option('staff-password') ?: null;
        if ($staffPassword !== null && strlen($staffPassword) < 8) {
            $this->error('--staff-password must be at least 8 characters.');

            return self::FAILURE;
        }

        if ($dry) {
            $this->warn('Dry run: nothing will be written.');
        }
        if (! Role::where('is_system', true)->exists()) {
            $this->error('No Administrator role yet. Run `php artisan db:seed --class=RbacSeeder` first.');

            return self::FAILURE;
        }

        try {
            $summary = DB::transaction(function () use ($cmsUsers, $clients, $quality, $dry, $staffPassword, $path) {
                if ($this->option('fresh')) {
                    $this->wipe();
                }

                $roles = $this->ensureRoles();
                $staff = $this->importStaff($cmsUsers, $roles, $staffPassword);
                $clientStats = $this->importClients($clients, $quality);

                SuperAdmin::ensure();

                Audit::log(
                    'Imported legacy accounts',
                    sprintf('%d staff, %d clients from %s', $staff['imported'], $clientStats['imported'], basename($path)),
                    'System',
                );

                $summary = ['staff' => $staff, 'clients' => $clientStats];
                if ($dry) {
                    throw new DryRunRollback($summary); // unwinds the transaction, keeps the numbers
                }

                return $summary;
            });
        } catch (DryRunRollback $e) {
            $summary = $e->summary;
        }

        if (! $dry) {
            $this->relinkCrms();
        }

        $this->report($summary, $staffPassword);

        return self::SUCCESS;
    }

    /* ── Wipe ─────────────────────────────────────────────────── */

    private function wipe(): void
    {
        $users = User::count();
        $activities = DB::table('client_activities')->whereNotNull('user_id')->count();

        DB::table('personal_access_tokens')->where('tokenable_type', User::class)->delete();
        User::query()->delete(); // portal_tokens and bookmarks cascade; audit and activity rows keep their text, lose the id

        $this->info("Removed {$users} existing account(s).");
        if ($activities > 0) {
            $this->notes[] = "{$activities} client_activities rows referenced deleted accounts. Their user link is now null, so the ledger's hash chain will report them altered; clear the table if it only held demo traffic.";
        }
    }

    /* ── Roles ────────────────────────────────────────────────── */

    /** @return array{admin: Role, templates: array<int, array{role: Role, permissions: string[]}>} */
    private function ensureRoles(): array
    {
        $admin = Role::where('is_system', true)->orderBy('id')->firstOrFail();
        $byKey = Permission::pluck('id', 'key');

        $templates = [];
        foreach (self::LEGACY_ROLES as $def) {
            $role = Role::updateOrCreate(['name' => $def['name']], ['description' => $def['description'], 'is_system' => false]);
            $role->permissions()->sync($byKey->only($def['permissions'])->values());
            $templates[] = ['role' => $role, 'permissions' => $def['permissions']];
        }

        return ['admin' => $admin, 'templates' => $templates];
    }

    /** The smallest reconstructed role that covers everything the legacy blob granted; null when it granted nothing. */
    private function roleFor(array $modules, array $roles): ?Role
    {
        $wanted = [];
        foreach ($modules as $key) {
            $perms = self::MODULE_MAP[$key] ?? self::MODULE_MAP[Str::before($key, ':')] ?? [];
            foreach ($perms as $p) {
                $wanted[$p] = true;
            }
        }
        if ($wanted === []) {
            return null;
        }

        foreach ($roles['templates'] as $t) {
            if (array_diff(array_keys($wanted), $t['permissions']) === []) {
                return $t['role'];
            }
        }

        return $roles['templates'][array_key_last($roles['templates'])]['role'];
    }

    /* ── Staff ────────────────────────────────────────────────── */

    private function importStaff(array $rows, array $roles, ?string $password): array
    {
        $imported = 0;
        $suspended = 0;
        $byRole = [];

        foreach ($rows as $r) {
            $email = mb_strtolower(trim((string) $r['email']));
            $legacySuper = $r['is_super_admin'] === '1';
            $system = $legacySuper || $r['user_type'] === '0';
            $modules = LegacyAccountsExport::grantedModules($r['access_rights_b64']);
            $role = $system ? $roles['admin'] : $this->roleFor($modules, $roles);

            // The old vendor's master login is superseded by the CWDevs super
            // admin: imported for the record, but not live.
            $isSuspended = $r['status_code'] !== '1' || $legacySuper;
            if ($legacySuper) {
                $this->notes[] = "Legacy super-admin {$email} imported suspended; superadmin@cwdevs.com replaces it. Restore it from Users & access if it is still needed.";
            }

            $user = $this->find((int) $r['cms_user_id'], User::KIND_STAFF, $email);
            $fresh = ! $user->exists;

            $user->fill([
                'name' => $this->cleanName($r['full_name']) ?: $this->cleanName($r['first_name'].' '.$r['last_name']) ?: $email,
                'email' => $email,
                'username' => null,
                'kind' => User::KIND_STAFF,
                'status' => User::STATUS_APPROVED,
                'role_id' => $role?->id,
                'firm' => null,
                'outlook_email' => str_ends_with($email, '@regis.ph') ? $email : null,
                'suspended' => $isSuspended,
                'last_active_at' => $r['last_login_at'] ?? $r['date_last_login'] ?? $r['date_last_activity'],
                'legacy_meta' => [
                    'username' => $r['username'],
                    'superAdmin' => $legacySuper,
                    'userType' => (int) $r['user_type'],
                    'legacyStatus' => $r['status_text'],
                    'modules' => $modules,
                    'logins' => (int) $r['login_count'],
                    'firstLoginAt' => $r['first_login_at'],
                    'lastLoginAt' => $r['last_login_at'],
                ],
            ]);
            $user->legacy_id = (int) $r['cms_user_id'];
            if ($fresh || $password !== null) {
                $user->password = $password ?? $this->unusablePassword();
            }
            if ($fresh) {
                $user->created_at = $r['date_created'] ?? $r['first_login_at'] ?? now();
            }
            $user->save();

            $imported++;
            $suspended += $isSuspended ? 1 : 0;
            $label = $role?->name ?? 'No role';
            $byRole[$label] = ($byRole[$label] ?? 0) + 1;
        }

        ksort($byRole);

        return ['imported' => $imported, 'suspended' => $suspended, 'byRole' => $byRole];
    }

    /* ── Clients ──────────────────────────────────────────────── */

    private function importClients(array $rows, array $quality): array
    {
        // Prefer the copy someone can actually use when the export carries the
        // same email (or user id) twice: a password, then logins, then Active.
        usort($rows, fn (array $a, array $b) => [$b['has_password'], (int) $b['login_count'], $a['status_code'], (int) $b['client_id']]
            <=> [$a['has_password'], (int) $a['login_count'], $b['status_code'], (int) $a['client_id']]);

        $seenEmail = [];
        $seenUsername = [];
        $imported = 0;
        $byStatus = [];
        $skipped = [];

        foreach ($rows as $r) {
            $id = (int) $r['client_id'];
            $email = $this->cleanEmail($r['email']);
            if ($email === '') {
                $skipped[] = "#{$id} {$r['username']}: no email address";

                continue;
            }
            if (isset($seenEmail[$email])) {
                $skipped[] = "#{$id} {$r['username']}: duplicate of #{$seenEmail[$email]} ({$email})";

                continue;
            }
            $seenEmail[$email] = $id;

            $username = trim((string) $r['username']) ?: null;
            if ($username !== null) {
                $key = mb_strtolower($username);
                if (isset($seenUsername[$key])) {
                    $this->notes[] = "#{$id} {$email}: user id '{$username}' already belongs to #{$seenUsername[$key]}; this account signs in by email only.";
                    $username = null;
                } else {
                    $seenUsername[$key] = $id;
                }
            }

            $issues = $quality[$id] ?? [];
            if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $issues[] = 'email address is not valid';
                $this->notes[] = "#{$id}: email '{$email}' is not a valid address; fix it in Users & access.";
            }

            [$status, $suspended] = match ((int) $r['status_code']) {
                1 => [$r['has_password'] === '1' ? User::STATUS_APPROVED : User::STATUS_INVITED, false],
                2 => [User::STATUS_APPROVED, true],
                3 => [User::STATUS_PENDING, false],
                default => [User::STATUS_DECLINED, false],
            };

            $country = trim((string) $r['address_country']);
            $phone = trim(trim((string) $r['contact_country_code']).' '.trim((string) $r['contact_no']));

            $user = $this->find($id, User::KIND_CLIENT, $email);
            $fresh = ! $user->exists;

            $user->fill([
                'name' => $this->cleanName($r['first_name'].' '.$r['last_name']) ?: $this->cleanName($r['full_name']) ?: $email,
                'email' => $email,
                'username' => $username,
                'kind' => User::KIND_CLIENT,
                'status' => $status,
                'role_id' => null,
                'firm' => trim((string) $r['organization']) ?: null,
                'position' => trim((string) $r['position']) ?: null,
                'phone' => $phone !== '' ? mb_substr($phone, 0, 40) : null,
                'client_type' => $country === '' ? null : ($country === 'Philippines' ? 'Local' : 'Foreign'),
                'suspended' => $suspended,
                'last_active_at' => $r['last_login_at'] ?? $r['last_report_view_at'],
                'registered_at' => $r['registered_at'],
                'legacy_meta' => array_filter([
                    'middleName' => trim((string) $r['middle_name']) ?: null,
                    'address' => array_filter([
                        'line1' => trim((string) $r['address_1']) ?: null,
                        'line2' => trim((string) $r['address_2']) ?: null,
                        'country' => $country ?: null,
                        'zip' => trim((string) $r['address_zip']) ?: null,
                    ]) ?: null,
                    'mifid' => $r['is_mifid_account'] === '1',
                    'legacyStatus' => $r['status_text'],
                    'hadPassword' => $r['has_password'] === '1',
                    'hadRegistrationToken' => $r['has_registration_token'] === '1',
                    'logins' => (int) $r['login_count'],
                    'firstLoginAt' => $r['first_login_at'],
                    'lastLoginAt' => $r['last_login_at'],
                    'reportViews' => (int) $r['report_view_count'],
                    'lastReportViewAt' => $r['last_report_view_at'],
                    'bookmarks' => (int) $r['bookmark_count'],
                    'createdBy' => trim((string) $r['created_by_name']) ?: null,
                    'modifiedBy' => trim((string) $r['modified_by_name']) ?: null,
                    'modifiedAt' => $r['modified_at'],
                    'blocked' => $suspended ? array_filter([
                        'at' => $r['blocked_at'],
                        'by' => trim((string) $r['blocked_by_name']) ?: null,
                        'reason' => $r['blocked_reason'],
                    ]) ?: true : null,
                    'issues' => $issues ?: null,
                ], fn ($v) => $v !== null && $v !== false),
            ]);
            $user->legacy_id = $id;
            if ($r['password_hash']) {
                $user->password = $r['password_hash']; // bcrypt already; the cast stores it untouched
            } elseif ($fresh) {
                $user->password = $this->unusablePassword();
            }
            if ($fresh) {
                $user->created_at = $r['created_at'] ?? $r['registered_at'] ?? $r['first_login_at'] ?? now();
            }
            $user->save();

            $imported++;
            $label = $suspended ? 'suspended' : $status;
            $byStatus[$label] = ($byStatus[$label] ?? 0) + 1;
        }

        return ['imported' => $imported, 'byStatus' => $byStatus, 'skipped' => $skipped];
    }

    /* ── Helpers ──────────────────────────────────────────────── */

    /** The row this legacy id already became, else the same email of the same kind, else a new one. */
    private function find(int $legacyId, string $kind, string $email): User
    {
        return User::where('legacy_id', $legacyId)->where('kind', $kind)->first()
            ?? User::where('email', $email)->where('kind', $kind)->first()
            ?? new User;
    }

    private function cleanName(?string $v): string
    {
        return trim(preg_replace('/\s+/u', ' ', (string) $v));
    }

    /** Lowercased, with every whitespace character removed — one row carries a tab inside the address. */
    private function cleanEmail(?string $v): string
    {
        return mb_strtolower(preg_replace('/\s+/u', '', (string) $v));
    }

    /**
     * A bcrypt-shaped string no password verifies against. Stored where the
     * legacy system had no migratable secret, so the account exists but cannot
     * be signed into until a password is set through Users & access.
     */
    private function unusablePassword(): string
    {
        return '$2y$12$'.Str::random(53);
    }

    /** Point CRMS contacts at the re-imported portal accounts (exact-email rule) when the CRMS database is reachable. */
    private function relinkCrms(): void
    {
        try {
            $live = User::where('kind', User::KIND_CLIENT)->pluck('id')->all();
            $stale = ClientContact::whereNotNull('portal_user_id')->whereNotIn('portal_user_id', $live)->update(['portal_user_id' => null]);

            $resolver = app(PortalAccountResolver::class);
            $linked = 0;
            ClientContact::whereNull('portal_user_id')->whereNotNull('email')->where('email', '<>', '')
                ->each(function (ClientContact $c) use ($resolver, &$linked) {
                    $resolver->autoLinkByEmail($c);
                    $linked += $c->portal_user_id ? 1 : 0;
                });

            $this->info("CRMS: cleared {$stale} stale portal link(s), linked {$linked} contact(s) by exact email.");
        } catch (Throwable $e) {
            $this->notes[] = 'CRMS contacts were not relinked ('.$e->getMessage().'). Run `php artisan db:seed --class=CrmsConfigSeeder` once the crms database is up.';
        }
    }

    private function report(array $s, ?string $staffPassword): void
    {
        $this->newLine();
        $this->table(['Staff', 'Count'], [
            ['Imported', $s['staff']['imported']],
            ['Suspended (inactive in the old CMS)', $s['staff']['suspended']],
            ...array_map(fn ($k, $v) => ["  role: {$k}", $v], array_keys($s['staff']['byRole']), $s['staff']['byRole']),
        ]);
        $this->table(['Clients', 'Count'], [
            ['Imported', $s['clients']['imported']],
            ...array_map(fn ($k, $v) => ["  {$k}", $v], array_keys($s['clients']['byStatus']), $s['clients']['byStatus']),
            ['Skipped', count($s['clients']['skipped'])],
        ]);

        foreach ($s['clients']['skipped'] as $line) {
            $this->line("  skipped {$line}");
        }
        foreach ($this->notes as $note) {
            $this->warn('  note: '.$note);
        }

        $this->newLine();
        $this->info('Super admin: '.SuperAdmin::EMAIL.' (Administrator).');
        $this->line($staffPassword !== null
            ? 'Every imported staff account uses the --staff-password you passed.'
            : 'Imported staff accounts have no usable password (the legacy encoding cannot be migrated); set one per account in Users & access.');
    }
}
