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
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('companies', 'name')],
            'type' => ['required', 'string', 'in:Local,Foreign'],
        ]);

        $company = Company::create($data);
        $audit = Audit::log('Added company', "{$company->name} ({$company->type})");

        return response()->json(['item' => $company->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, Company $company): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('companies', 'name')->ignore($company->id)],
            'type' => ['required', 'string', 'in:Local,Foreign'],
        ]);

        $company->fill($data)->save();
        $audit = Audit::log('Updated company', "{$company->name} ({$company->type})");

        return response()->json(['item' => $company->toWire(), 'audit' => $audit->toWire()]);
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
