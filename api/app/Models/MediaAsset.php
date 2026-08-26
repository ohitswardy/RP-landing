<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MediaAsset extends Model
{
    protected $fillable = ['path', 'label', 'kind', 'used_by'];

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'path' => $this->path,
            'label' => $this->label,
            'kind' => $this->kind,
            'usedBy' => $this->used_by,
        ];
    }
}
