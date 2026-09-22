<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Article extends Model
{
    protected $fillable = ['tag', 'title', 'slug', 'author', 'date', 'status', 'reads', 'excerpt', 'body', 'featured'];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d', 'reads' => 'integer', 'featured' => 'boolean'];
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }

    /**
     * A URL-safe slug that no other note holds. Given a blank, derives one
     * from the title; a collision gets a numeric suffix. $ignoreId keeps a
     * note's own slug from counting as a collision on update.
     */
    public static function uniqueSlug(?string $wanted, string $title, ?int $ignoreId = null): string
    {
        $base = Str::slug(Str::limit(trim((string) $wanted) !== '' ? (string) $wanted : $title, 80, '')) ?: 'note';
        $slug = $base;
        $n = 2;
        while (static::where('slug', $slug)->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->exists()) {
            $slug = $base.'-'.$n++;
        }

        return $slug;
    }

    /** The public journal-list shape: everything but the body. */
    public function toSummary(): array
    {
        return [
            'id' => (string) $this->id,
            'slug' => (string) $this->slug,
            'tag' => $this->tag,
            'title' => $this->title,
            'author' => $this->author,
            'date' => $this->date->format('Y-m-d'),
            'excerpt' => $this->excerpt,
            'featured' => (bool) $this->featured,
        ];
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'slug' => (string) $this->slug,
            'tag' => $this->tag,
            'title' => $this->title,
            'author' => $this->author,
            'date' => $this->date->format('Y-m-d'),
            'status' => $this->status,
            'reads' => $this->reads,
            'excerpt' => $this->excerpt,
            'body' => (string) $this->body,
            'featured' => (bool) $this->featured,
        ];
    }
}
