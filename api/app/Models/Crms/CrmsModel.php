<?php

namespace App\Models\Crms;

use Illuminate\Database\Eloquent\Model;

/**
 * Every CRMS model reads the legacy schema through the `crms` connection.
 * Pinning it here means a model can never silently fall back onto the CMS
 * database. Writes go through validated controller payloads, so the models
 * are unguarded rather than carrying a fillable list each.
 */
abstract class CrmsModel extends Model
{
    protected $connection = 'crms';

    protected $guarded = [];

    /** String ids on the wire, matching every other Regis API payload. */
    protected function wireId(): string
    {
        return (string) $this->getKey();
    }

    protected static function idOrNull(mixed $v): ?string
    {
        return $v === null || $v === '' ? null : (string) $v;
    }

    /** Y-m-d for a date column that may be null or a zero date. */
    protected static function day(mixed $v): ?string
    {
        if (! $v) {
            return null;
        }
        $s = $v instanceof \DateTimeInterface ? $v->format('Y-m-d') : substr((string) $v, 0, 10);

        return str_starts_with($s, '0000') ? null : $s;
    }
}
