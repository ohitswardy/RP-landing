<?php

namespace Tests\Unit\Crms;

use App\Models\Crms\CrmsModel;
use Illuminate\Database\Eloquent\Model;
use Tests\TestCase;

/**
 * CRMSmasterplan.md §11.6 connection guard. Every model under App\Models\Crms
 * must read and write through the `crms` connection, and no CRMS controller
 * may touch a CMS-side model beyond the short allowlist below, so a CRMS
 * write can never land in the CMS database except as an audit row.
 */
class ConnectionGuardTest extends TestCase
{
    /**
     * CMS models a CRMS controller is allowed to name. Reads of the staff and
     * portal accounts (User, Role, Permission) are part of the design — the
     * CRMS has no accounts of its own — and AuditEntry is the one CMS table
     * the CRMS writes (through App\Support\Audit). Anything else is a leak.
     */
    private const ALLOWED_CMS_MODELS = [
        'App\Models\User',
        'App\Models\Role',
        'App\Models\Permission',
        'App\Models\AuditEntry',
    ];

    public function test_every_crms_model_is_pinned_to_the_crms_connection(): void
    {
        $dir = app_path('Models/Crms');
        $files = glob($dir.DIRECTORY_SEPARATOR.'*.php');
        $this->assertNotEmpty($files, 'no CRMS models found');

        $checked = 0;
        foreach ($files as $file) {
            $class = 'App\\Models\\Crms\\'.pathinfo($file, PATHINFO_FILENAME);
            $this->assertTrue(class_exists($class), "$class does not autoload");
            $ref = new \ReflectionClass($class);
            if ($ref->isAbstract()) {
                continue;
            }
            $this->assertTrue($ref->isSubclassOf(CrmsModel::class), "$class must extend CrmsModel");
            /** @var Model $model */
            $model = $ref->newInstance();
            $this->assertSame('crms', $model->getConnectionName(), "$class is not on the crms connection");
            $checked++;
        }
        $this->assertGreaterThan(0, $checked);
    }

    public function test_crms_controllers_reference_no_cms_model_outside_the_allowlist(): void
    {
        $dir = app_path('Http/Controllers/Crms');
        $files = glob($dir.DIRECTORY_SEPARATOR.'*.php');
        $this->assertNotEmpty($files, 'no CRMS controllers found');

        $offenders = [];
        foreach ($files as $file) {
            $source = file_get_contents($file);
            // `use App\Models\X;` imports and inline \App\Models\X references alike.
            preg_match_all('/\\\\?App\\\\Models\\\\[A-Za-z0-9_\\\\]+/', $source, $m);
            foreach (array_unique($m[0]) as $fqcn) {
                $fqcn = ltrim($fqcn, '\\');
                if (str_starts_with($fqcn, 'App\\Models\\Crms\\')) {
                    continue;
                }
                if (in_array($fqcn, self::ALLOWED_CMS_MODELS, true)) {
                    continue;
                }
                $offenders[] = basename($file).' → '.$fqcn;
            }
        }

        $this->assertSame([], $offenders, "CRMS controllers reference CMS models outside the allowlist:\n".implode("\n", $offenders));
    }

    public function test_crms_controllers_only_query_the_crms_connection_directly(): void
    {
        // Raw query-builder access must name the crms connection; DB::table() alone would hit the CMS database.
        $dir = app_path('Http/Controllers/Crms');
        $offenders = [];
        foreach (glob($dir.DIRECTORY_SEPARATOR.'*.php') as $file) {
            $source = file_get_contents($file);
            if (preg_match_all('/DB::(table|select|insert|update|delete|statement)\(/', $source, $m)) {
                $offenders[] = basename($file).' → '.implode(', ', array_unique($m[0]));
            }
        }
        $this->assertSame([], $offenders, "CRMS controllers use the default DB connection directly:\n".implode("\n", $offenders));
    }
}
