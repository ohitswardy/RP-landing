<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A named, reusable audience for the Email desk: a saved set of contacts
 * (clients, subscribers, typed addresses) the composer flattens into a
 * blast's recipient pool. Contacts share the recipient shape blasts use.
 */
class DistributionList extends Model
{
    protected $fillable = ['name', 'description', 'contacts', 'created_by'];

    protected $casts = ['contacts' => 'array'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function toWire(): array
    {
        $contacts = array_values($this->contacts ?? []);

        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'contacts' => $contacts,
            'count' => count($contacts),
            'createdByName' => $this->creator?->name,
            'createdAt' => $this->created_at?->toIso8601String() ?? now()->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String() ?? now()->toIso8601String(),
        ];
    }
}
