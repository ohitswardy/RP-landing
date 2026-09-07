<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;

/**
 * The legacy CRMS stores times of day as {"hour":13,"minute":30,"second":0}
 * (the ng-bootstrap timepicker shape). The API speaks "HH:mm"; the column
 * stays byte-compatible so the Angular app can keep running beside us.
 */
class LegacyTime implements CastsAttributes
{
    public function get($model, string $key, $value, array $attributes): ?string
    {
        if ($value === null || $value === '' || $value === 'null') {
            return null;
        }
        // Already plain "HH:mm" (or "HH:mm:ss") — pass it through trimmed.
        if (preg_match('/^(\d{1,2}):(\d{2})/', (string) $value, $m)) {
            return sprintf('%02d:%02d', (int) $m[1], (int) $m[2]);
        }
        $t = json_decode((string) $value, true);
        if (! is_array($t) || ! isset($t['hour'])) {
            return null;
        }

        return sprintf('%02d:%02d', (int) $t['hour'], (int) ($t['minute'] ?? 0));
    }

    public function set($model, string $key, $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        [$h, $m] = array_pad(explode(':', (string) $value), 2, 0);

        return json_encode(['hour' => (int) $h, 'minute' => (int) $m, 'second' => 0]);
    }
}
