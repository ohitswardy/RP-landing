<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Support\Audit;
use App\Support\Html;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ArticleController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tag' => ['required', 'string', 'max:60'],
            'title' => ['required', 'string', 'max:500'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:200', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'author' => ['required', 'string', 'max:120'],
            'excerpt' => ['nullable', 'string', 'max:2000'],
            // HTML from the CMS rich-text field; sanitized to the article whitelist.
            'body' => ['sometimes', 'nullable', 'string', 'max:2000000'],
            'status' => ['required', 'in:review,published'],
            'date' => ['sometimes', 'date'],
            'featured' => ['sometimes', 'boolean'],
        ], ['slug.regex' => 'Slugs are lowercase words joined by hyphens.']);

        $article = Article::create([
            ...$data,
            'slug' => Article::uniqueSlug($data['slug'] ?? null, $data['title']),
            'excerpt' => $data['excerpt'] ?? '',
            'body' => array_key_exists('body', $data) ? Html::article($data['body']) : '',
            'date' => $data['date'] ?? now()->toDateString(),
            'featured' => $data['featured'] ?? false,
            'reads' => 0,
        ]);

        $this->keepOneLead($article);

        $audit = Audit::log($article->status === 'published' ? 'Published' : 'Saved for review', $article->title);

        return response()->json(['item' => $article->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, Article $article): JsonResponse
    {
        $data = $request->validate([
            'tag' => ['sometimes', 'string', 'max:60'],
            'title' => ['sometimes', 'string', 'max:500'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:200', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'author' => ['sometimes', 'string', 'max:120'],
            'excerpt' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'body' => ['sometimes', 'nullable', 'string', 'max:2000000'],
            'status' => ['sometimes', 'in:review,published'],
            'date' => ['sometimes', 'date'],
            'featured' => ['sometimes', 'boolean'],
        ], ['slug.regex' => 'Slugs are lowercase words joined by hyphens.']);

        $statusChanged = array_key_exists('status', $data) && $data['status'] !== $article->status;

        $attributes = [...$data, 'excerpt' => $data['excerpt'] ?? $article->excerpt];
        if (array_key_exists('body', $data)) {
            $attributes['body'] = Html::article($data['body']);
        }
        // A blank slug means "derive one from the title"; an existing slug is
        // kept unless the desk types a new one, so published links stay stable.
        if (array_key_exists('slug', $data)) {
            $attributes['slug'] = Article::uniqueSlug($data['slug'], $data['title'] ?? $article->title, $article->id);
        } elseif (! $article->slug) {
            $attributes['slug'] = Article::uniqueSlug(null, $data['title'] ?? $article->title, $article->id);
        }

        $article->fill($attributes)->save();

        $this->keepOneLead($article);

        $action = $statusChanged
            ? ($article->status === 'published' ? 'Published' : 'Submitted for review')
            : (array_key_exists('featured', $data) ? ($article->featured ? 'Set as lead note' : 'Cleared lead note') : 'Updated note');
        $audit = Audit::log($action, $article->title);

        return response()->json(['item' => $article->toWire(), 'audit' => $audit->toWire()]);
    }

    /** Only one note leads the journal - promoting this one demotes the rest. */
    private function keepOneLead(Article $article): void
    {
        if (! $article->featured) {
            return;
        }

        DB::table('articles')->where('id', '!=', $article->id)->update(['featured' => false]);
    }

    public function destroy(Article $article): JsonResponse
    {
        $title = $article->title;
        $article->delete();
        $audit = Audit::log('Deleted note', $title);

        return response()->json(['audit' => $audit->toWire()]);
    }
}
