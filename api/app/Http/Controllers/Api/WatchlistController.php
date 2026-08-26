<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WatchSymbol;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WatchlistController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sym' => ['required', 'string', 'regex:/^[A-Z0-9]{1,6}$/', 'unique:watch_symbols,sym'],
        ], [
            'sym.unique' => 'That symbol is already on the ribbon.',
            'sym.regex' => 'PSE tickers are 1-6 letters or digits.',
        ]);

        $symbol = WatchSymbol::create([
            'sym' => $data['sym'],
            'name' => $data['sym'],
            'pinned' => false,
            'position' => (int) WatchSymbol::max('position') + 1,
        ]);

        $audit = Audit::log('Added ribbon symbol', $symbol->sym);

        return response()->json(['item' => $symbol->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, WatchSymbol $symbol): JsonResponse
    {
        $data = $request->validate([
            'pinned' => ['required', 'boolean'],
        ]);

        $symbol->update(['pinned' => (bool) $data['pinned']]);

        return response()->json(['item' => $symbol->toWire()]);
    }

    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
        ]);

        foreach ($data['ids'] as $index => $id) {
            WatchSymbol::whereKey($id)->update(['position' => $index]);
        }

        $items = WatchSymbol::orderBy('position')->orderBy('id')->get()->map->toWire()->values();

        return response()->json(['items' => $items]);
    }

    public function destroy(WatchSymbol $symbol): JsonResponse
    {
        $sym = $symbol->sym;
        $symbol->delete();
        $audit = Audit::log('Removed ribbon symbol', $sym);

        return response()->json(['audit' => $audit->toWire()]);
    }
}
