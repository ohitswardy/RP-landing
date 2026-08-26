<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PageBlock extends Model
{
    protected $fillable = ['page', 'field', 'position', 'value', 'updated', 'editor'];

    protected function casts(): array
    {
        return ['updated' => 'date:Y-m-d', 'position' => 'integer'];
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'page' => $this->page,
            'field' => $this->field,
            'position' => (int) $this->position,
            'value' => $this->value,
            'updated' => $this->updated->format('Y-m-d'),
            'editor' => $this->editor,
        ];
    }
}
