<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccessController extends Controller
{
    private const ACCESS_PERM = 'access.manage';

    public function index(): JsonResponse
    {
        return response()->json([
            'users' => User::with('role')
                ->orderByRaw("kind = 'client'") // staff first
                ->orderBy('name')
                ->get()
                ->map->toAccountWire()
                ->values(),
            'roles' => Role::with('permissions')->orderByDesc('is_system')->orderBy('name')->get()->map->toWire()->values(),
            'permissions' => Permission::orderBy('id')->get()->map->toWire()->values(),
        ]);
    }

    /* ── Users ────────────────────────────────────────────────── */

    public function storeUser(Request $request): JsonResponse
    {
        // Portal clients go through PortalClientController, which issues their
        // registration link. This endpoint creates CMS staff only.
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'kind' => ['required', 'in:staff'],
            'roleId' => ['required', 'integer', 'exists:roles,id'],
            'outlookEmail' => ['sometimes', 'nullable', 'email', 'max:190'],
        ], [
            'kind.in' => 'Portal clients are provisioned through the client onboarding flow.',
            'roleId.required' => 'Assign the staff account a role.',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => mb_strtolower($data['email']),
            'password' => $data['password'],
            'kind' => User::KIND_STAFF,
            'status' => User::STATUS_APPROVED,
            'role_id' => $data['roleId'],
            'firm' => null,
            'outlook_email' => $data['outlookEmail'] ?? null,
            'suspended' => false,
        ]);

        $audit = Audit::log('Provisioned staff account', $user->email);

        return response()->json(['item' => $user->load('role')->toAccountWire(), 'audit' => $audit->toWire()], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'roleId' => ['sometimes', 'nullable', 'integer', 'exists:roles,id'],
            'firm' => ['sometimes', 'nullable', 'string', 'max:120'],
            'suspended' => ['sometimes', 'boolean'],
            'password' => ['sometimes', 'nullable', 'string', 'min:8'],
            'outlookEmail' => ['sometimes', 'nullable', 'email', 'max:190'],
            'clientType' => ['sometimes', 'nullable', 'in:Local,Foreign'],
            'sectorPrefs' => ['sometimes', 'array', 'max:30'],
            'sectorPrefs.*' => ['string', 'max:80'],
            'preferredAnalysts' => ['sometimes', 'array', 'max:30'],
            'preferredAnalysts.*' => ['string', 'max:120'],
        ]);

        $actor = $request->user();

        if (array_key_exists('suspended', $data) && (bool) $data['suspended'] && $user->id === $actor->id) {
            return response()->json(['message' => 'You cannot suspend your own account.'], 422);
        }

        // Simulate the change and refuse anything that leaves no active access manager.
        $wouldSuspend = array_key_exists('suspended', $data) ? (bool) $data['suspended'] : $user->suspended;
        $newRoleId = array_key_exists('roleId', $data) ? $data['roleId'] : $user->role_id;
        if ($user->isStaff() && $this->losesLastAccessManager($user, $newRoleId, $wouldSuspend)) {
            return response()->json(['message' => 'At least one active account must keep user management access.'], 422);
        }

        $suspendChanged = array_key_exists('suspended', $data) && (bool) $data['suspended'] !== $user->suspended;
        $roleChanged = array_key_exists('roleId', $data) && (int) $data['roleId'] !== (int) $user->role_id;
        $passwordChanged = ! empty($data['password']);

        $user->fill([
            'name' => $data['name'] ?? $user->name,
            'firm' => array_key_exists('firm', $data) ? $data['firm'] : $user->firm,
            'suspended' => $wouldSuspend,
        ]);
        if ($user->isStaff() && array_key_exists('roleId', $data)) {
            $user->role_id = $data['roleId'];
        }
        if ($user->isStaff() && array_key_exists('outlookEmail', $data)) {
            $user->outlook_email = $data['outlookEmail'] !== null ? mb_strtolower($data['outlookEmail']) : null;
        }
        if ($user->isClient()) {
            if (array_key_exists('clientType', $data)) {
                $user->client_type = $data['clientType'];
            }
            if (array_key_exists('sectorPrefs', $data)) {
                $user->sector_prefs = array_values($data['sectorPrefs']);
            }
            if (array_key_exists('preferredAnalysts', $data)) {
                $user->preferred_analysts = array_values($data['preferredAnalysts']);
            }
        }
        if ($passwordChanged) {
            $user->password = $data['password'];
        }
        $user->save();

        $action = $suspendChanged
            ? ($user->suspended ? 'Suspended account' : 'Restored account')
            : ($roleChanged ? 'Changed account role' : ($passwordChanged ? 'Reset password' : 'Updated account'));
        $audit = Audit::log($action, $user->email);

        return response()->json(['item' => $user->load('role')->toAccountWire(), 'audit' => $audit->toWire()]);
    }

    public function destroyUser(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }

        if ($user->isStaff() && $this->losesLastAccessManager($user, null, true)) {
            return response()->json(['message' => 'At least one active account must keep user management access.'], 422);
        }

        $email = $user->email;
        $kind = $user->kind;
        $user->tokens()->delete();
        $user->delete();

        $audit = Audit::log($kind === 'staff' ? 'Deleted staff account' : 'Revoked client access', $email);

        return response()->json(['audit' => $audit->toWire()]);
    }

    /* ── Roles ────────────────────────────────────────────────── */

    public function storeRole(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', 'unique:roles,name'],
            'description' => ['nullable', 'string', 'max:300'],
            'permissions' => ['array'],
            'permissions.*' => ['string', 'exists:permissions,key'],
        ]);

        $role = Role::create([
            'name' => $data['name'],
            'description' => $data['description'] ?? '',
            'is_system' => false,
        ]);
        $role->permissions()->sync(
            Permission::whereIn('key', $data['permissions'] ?? [])->pluck('id'),
        );

        $audit = Audit::log('Created role', $role->name);

        return response()->json(['item' => $role->load('permissions')->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function updateRole(Request $request, Role $role): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:60', 'unique:roles,name,'.$role->id],
            'description' => ['sometimes', 'nullable', 'string', 'max:300'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', 'exists:permissions,key'],
        ]);

        if ($role->is_system && (array_key_exists('name', $data) || array_key_exists('permissions', $data))) {
            return response()->json(['message' => 'The Administrator role is fixed. Only its description can change.'], 422);
        }

        $role->fill([
            'name' => $data['name'] ?? $role->name,
            'description' => array_key_exists('description', $data) ? ($data['description'] ?? '') : $role->description,
        ])->save();

        if (! $role->is_system && array_key_exists('permissions', $data)) {
            $role->permissions()->sync(
                Permission::whereIn('key', $data['permissions'])->pluck('id'),
            );
        }

        $audit = Audit::log('Updated role', $role->name);

        return response()->json(['item' => $role->load('permissions')->toWire(), 'audit' => $audit->toWire()]);
    }

    public function destroyRole(Role $role): JsonResponse
    {
        if ($role->is_system) {
            return response()->json(['message' => 'System roles cannot be deleted.'], 422);
        }
        if ($role->users()->exists()) {
            return response()->json(['message' => 'Reassign the accounts on this role before deleting it.'], 422);
        }

        $name = $role->name;
        $role->delete();
        $audit = Audit::log('Deleted role', $name);

        return response()->json(['audit' => $audit->toWire()]);
    }

    /**
     * Would suspending/deleting/re-roling this user leave zero active staff
     * accounts that can manage users?
     */
    private function losesLastAccessManager(User $user, ?int $newRoleId, bool $removedOrSuspended): bool
    {
        $accessRoleIds = Permission::where('key', self::ACCESS_PERM)
            ->first()?->roles()->pluck('roles.id') ?? collect();

        if ($accessRoleIds->isEmpty()) {
            return false;
        }

        $hadAccess = $user->role_id && $accessRoleIds->contains($user->role_id);
        $keepsAccess = ! $removedOrSuspended && $newRoleId && $accessRoleIds->contains($newRoleId);

        if (! $hadAccess || $keepsAccess) {
            return false;
        }

        $others = User::where('kind', User::KIND_STAFF)
            ->where('suspended', false)
            ->where('id', '!=', $user->id)
            ->whereIn('role_id', $accessRoleIds)
            ->count();

        return $others === 0;
    }
}
