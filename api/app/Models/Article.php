<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Article extends Model
{
    protected $fillable = ['tag', 'title', 'author', 'date', 'status', 'reads', 'excerpt', 'featured'];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d', 'reads' => 'integer', 'featured' => 'boolean'];
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'tag' => $this->tag,
            'title' => $this->title,
            'author' => $this->author,
            'date' => $this->date->format('Y-m-d'),
            'status' => $this->status,
            'reads' => $this->reads,
            'excerpt' => $this->excerpt,
            'featured' => (bool) $this->featured,
        ];
    }
}
