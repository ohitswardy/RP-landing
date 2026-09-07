<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;

/**
 * JSON encoded into a TEXT column. Production rows hold '', 'null', and the
 * occasional malformed string, all of which read back as an empty list so a
 * screen never breaks on one bad row.
 */
class LegacyJson implements CastsAttributes
{
    public function get($model, string $key, $value, array $attributes): array
    {
        if ($value === null || $value === '' || $value === 'null') {
            return [];
        }
        $decoded = json_decode((string) $value, true);

        return is_array($decoded) ? $decoded : [];
    }

    public function set($model, string $key, $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        return json_encode(array_values(is_array($value) ? $value : []), JSON_UNESCAPED_UNICODE);
    }
}
