<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArticleController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tag' => ['required', 'string', 'max:60'],
            'title' => ['required', 'string', 'max:500'],
            'author' => ['required', 'string', 'max:120'],
            'excerpt' => ['nullable', 'string', 'max:2000'],
            'status' => ['required', 'in:draft,review,published'],
            'date' => ['sometimes', 'date'],
            'featured' => ['sometimes', 'boolean'],
        ]);

        $article = Article::create([
            ...$data,
            'excerpt' => $data['excerpt'] ?? '',
            'date' => $data['date'] ?? now()->toDateString(),
            'featured' => $data['featured'] ?? false,
            'reads' => 0,
        ]);

        $this->keepOneLead($article);

        $audit = Audit::log($article->status === 'published' ? 'Published' : 'Saved draft', $article->title);

        return response()->json(['item' => $article->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, Article $article): JsonResponse
    {
        $data = $request->validate([
            'tag' => ['sometimes', 'string', 'max:60'],
            'title' => ['sometimes', 'string', 'max:500'],
            'author' => ['sometimes', 'string', 'max:120'],
            'excerpt' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'status' => ['sometimes', 'in:draft,review,published'],
            'date' => ['sometimes', 'date'],
            'featured' => ['sometimes', 'boolean'],
        ]);

        $statusChanged = array_key_exists('status', $data) && $data['status'] !== $article->status;
        $article->fill([...$data, 'excerpt' => $data['excerpt'] ?? $article->excerpt])->save();

        $this->keepOneLead($article);

        $action = $statusChanged
            ? ($article->status === 'published' ? 'Published' : ($article->status === 'review' ? 'Submitted for review' : 'Returned to draft'))
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
