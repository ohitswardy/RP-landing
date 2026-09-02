<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CompanyController extends Controller
{
    /** Name, ticker and classification. The ticker is optional and kept
        uppercase so the portal renders one symbol vocabulary. */
    private static function rules(?Company $company = null): array
    {
        return [
            'name' => ['required', 'string', 'max:120', Rule::unique('companies', 'name')->ignore($company?->id)],
            'symbol' => ['nullable', 'string', 'max:20', 'regex:/^[A-Za-z0-9.\-]+$/', Rule::unique('companies', 'symbol')->ignore($company?->id)],
            'type' => ['required', 'string', 'in:Local,Foreign'],
        ];
    }

    /** "ALI · Ayala Land (Local)" for the audit trail. */
    private static function describe(Company $company): string
    {
        $symbol = $company->symbol ? "{$company->symbol} · " : '';

        return "{$symbol}{$company->name} ({$company->type})";
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(self::rules());

        $company = Company::create([
            ...$data,
            'symbol' => self::normalizeSymbol($data['symbol'] ?? null),
        ]);
        $audit = Audit::log('Added company', self::describe($company));

        return response()->json(['item' => $company->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, Company $company): JsonResponse
    {
        $data = $request->validate(self::rules($company));

        $company->fill([
            ...$data,
            'symbol' => self::normalizeSymbol($data['symbol'] ?? null),
        ])->save();
        $audit = Audit::log('Updated company', self::describe($company));

        return response()->json(['item' => $company->toWire(), 'audit' => $audit->toWire()]);
    }

    /** Blank stays null so the unique index tolerates unlisted names. */
    private static function normalizeSymbol(?string $symbol): ?string
    {
        $symbol = strtoupper(trim((string) $symbol));

        return $symbol === '' ? null : $symbol;
    }

    /** Reports pointing at the company are kept and unlinked (FK nulls on delete). */
    public function destroy(Company $company): JsonResponse
    {
        $name = $company->name;
        $company->delete();
        $audit = Audit::log('Removed company', $name);

        return response()->json(['audit' => $audit->toWire()]);
    }
}
