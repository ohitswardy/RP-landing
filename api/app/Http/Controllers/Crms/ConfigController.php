<?php

namespace App\Http\Controllers\Crms;

use App\Models\Crms\Client;
use App\Models\Crms\Form;
use App\Models\Crms\InteractionType;
use App\Models\Crms\ReportTemplate;
use App\Models\Crms\SectorGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Administrator-owned configuration: interaction types, the per-client form
 * builder, the research distribution taxonomy, and report template bindings.
 */
class ConfigController extends CrmsController
{
    /* ── Interaction types ────────────────────────────────────── */

    private const TYPE_RULES = [
        'type' => ['required', 'string', 'max:255'],
        'meetingTypes' => ['present', 'array', 'max:50'],
        'meetingTypes.*' => ['string', 'max:120'],
        'clientId' => ['nullable', 'integer'],
    ];

    public function storeType(Request $request): JsonResponse
    {
        $type = InteractionType::create($this->typeAttributes($request->validate(self::TYPE_RULES)));

        return $this->item($type->toWire(), $this->audit('Added interaction type', $type->type), 201);
    }

    public function updateType(Request $request, InteractionType $type): JsonResponse
    {
        $type->fill($this->typeAttributes($request->validate(self::TYPE_RULES)))->save();

        return $this->item($type->toWire(), $this->audit('Updated interaction type', $type->type));
    }

    public function destroyType(InteractionType $type): JsonResponse
    {
        $name = $type->type;
        $type->delete();

        return $this->deleted($this->audit('Removed interaction type', $name));
    }

    private function typeAttributes(array $d): array
    {
        return [
            'type' => trim($d['type']),
            'meeting_type' => implode("\n", array_values(array_filter(array_map('trim', $d['meetingTypes'])))),
            'client_id' => $d['clientId'] ?? null,
        ];
    }

    /* ── Form builder ─────────────────────────────────────────── */

    private function formRules(?Form $form): array
    {
        return [
            'clientId' => ['nullable', 'integer', Rule::unique('crms.form', 'client_id')->ignore($form?->id)],
            'fields' => ['present', 'array', 'max:60'],
            'fields.*.internalName' => ['required', 'string', 'max:80', 'regex:/^[a-z][a-z0-9_]*$/'],
            'fields.*.label' => ['required', 'string', 'max:160'],
            'fields.*.fieldType' => ['required', 'in:textBox,textArea,select,date,number'],
            'fields.*.required' => ['sometimes', 'boolean'],
            'fields.*.multiLine' => ['sometimes', 'boolean'],
            'fields.*.multiSelect' => ['sometimes', 'boolean'],
            'fields.*.options' => ['sometimes', 'array'],
            'fields.*.options.type' => ['sometimes', 'nullable', 'in:Lookup,Static,'],
            'fields.*.options.bindLabel' => ['sometimes', 'nullable', 'string', 'max:40'],
            'fields.*.options.value' => ['sometimes', 'nullable'],
            'fields.*.column' => ['sometimes', 'nullable', 'string', 'max:4'],
            'fields.*.defaultValue' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }

    public function storeForm(Request $request): JsonResponse
    {
        $data = $request->validate($this->formRules(null));
        $form = Form::create(['client_id' => $data['clientId'] ?? null, 'fields' => $this->normalizeFields($data['fields'])]);

        return $this->item($form->toWire(), $this->audit('Added interaction form', $this->formLabel($form)), 201);
    }

    public function updateForm(Request $request, Form $form): JsonResponse
    {
        $data = $request->validate($this->formRules($form));
        $form->fill(['client_id' => $data['clientId'] ?? null, 'fields' => $this->normalizeFields($data['fields'])])->save();

        return $this->item($form->toWire(), $this->audit('Updated interaction form', $this->formLabel($form)));
    }

    public function destroyForm(Form $form): JsonResponse
    {
        $label = $this->formLabel($form);
        $form->delete();

        return $this->deleted($this->audit('Removed interaction form', $label));
    }

    /**
     * Stable ids per field, in the legacy FieldSchema shape (Database.md §5):
     * a select is Static (options.value = choices) or a Lookup (options.value
     * names the source: Corporate, CorporateContact, SellsideContact).
     */
    private function normalizeFields(array $fields): array
    {
        return array_values(array_map(function (array $f, int $i) {
            $type = $f['options']['type'] ?? '';
            $value = $f['options']['value'] ?? '';
            if ($f['fieldType'] !== 'select') {
                $type = '';
                $value = '';
            } elseif ($type === 'Static') {
                $value = array_values(array_filter(array_map('trim', is_array($value) ? $value : preg_split('/\r\n|\r|\n/', (string) $value)), fn ($v) => $v !== ''));
            } else {
                $type = 'Lookup';
                $value = in_array($value, ['Corporate', 'CorporateContact', 'SellsideContact'], true) ? $value : 'Corporate';
            }

            return [
                'id' => (int) ($f['id'] ?? $i + 1),
                'internalName' => $f['internalName'],
                'label' => $f['label'],
                'fieldType' => $f['fieldType'],
                'required' => (bool) ($f['required'] ?? false),
                'multiLine' => (bool) ($f['multiLine'] ?? $f['fieldType'] === 'textArea'),
                'rows' => (int) ($f['rows'] ?? 0),
                'options' => ['type' => $type, 'bindLabel' => $f['options']['bindLabel'] ?? 'name', 'value' => $value],
                'multiSelect' => (bool) ($f['multiSelect'] ?? false),
                'column' => (string) ($f['column'] ?? '1'),
                'defaultValue' => $f['defaultValue'] ?? '',
            ];
        }, $fields, array_keys($fields)));
    }

    private function formLabel(Form $form): string
    {
        return $form->client_id ? (Client::find($form->client_id)?->name ?? "client #{$form->client_id}") : 'Default form';
    }

    /* ── Research distribution taxonomy (§7.8) ────────────────── */

    private const GROUP_RULES = [
        'name' => ['required', 'string', 'max:255'],
        'scope' => ['required', 'in:domestic,foreign'],
        'position' => ['nullable', 'integer', 'min:0'],
        'corporateIds' => ['present', 'array', 'max:300'],
        'corporateIds.*' => ['integer'],
    ];

    public function storeGroup(Request $request): JsonResponse
    {
        $data = $request->validate(self::GROUP_RULES);
        $group = SectorGroup::create([
            'name' => trim($data['name']),
            'scope' => $data['scope'],
            'position' => $data['position'] ?? ((int) SectorGroup::where('scope', $data['scope'])->max('position') + 1),
        ]);
        $group->corporates()->sync($data['corporateIds']);

        return $this->item($this->groupWire($group), $this->audit('Added sector group', $group->scope.' · '.$group->name), 201);
    }

    public function updateGroup(Request $request, SectorGroup $group): JsonResponse
    {
        $data = $request->validate(self::GROUP_RULES);
        $group->fill(['name' => trim($data['name']), 'scope' => $data['scope'], 'position' => $data['position'] ?? $group->position])->save();
        $group->corporates()->sync($data['corporateIds']);

        return $this->item($this->groupWire($group), $this->audit('Updated sector group', $group->scope.' · '.$group->name));
    }

    public function destroyGroup(SectorGroup $group): JsonResponse
    {
        $label = $group->scope.' · '.$group->name;
        $group->corporates()->detach();
        $group->contacts()->detach();
        $group->delete();

        return $this->deleted($this->audit('Removed sector group', $label));
    }

    private function groupWire(SectorGroup $group): array
    {
        return $group->refresh()->load('corporates')->loadCount('contacts')->toWire();
    }

    /* ── Report templates ─────────────────────────────────────── */

    private function templateRules(?ReportTemplate $t): array
    {
        return [
            'clientId' => ['required', 'integer', Rule::unique('crms.report_templates', 'client_id')->ignore($t?->id)],
            'code' => ['required', Rule::in(ReportTemplate::CODES)],
            'active' => ['sometimes', 'boolean'],
        ];
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        $d = $request->validate($this->templateRules(null));
        $t = ReportTemplate::create(['client_id' => $d['clientId'], 'code' => $d['code'], 'is_active' => $d['active'] ?? true]);

        return $this->item($t->load('client')->toWire(), $this->audit('Bound report template', $t->code), 201);
    }

    public function updateTemplate(Request $request, ReportTemplate $template): JsonResponse
    {
        $d = $request->validate($this->templateRules($template));
        $template->fill(['client_id' => $d['clientId'], 'code' => $d['code'], 'is_active' => $d['active'] ?? $template->is_active])->save();

        return $this->item($template->load('client')->toWire(), $this->audit('Updated report template', $template->code));
    }

    public function destroyTemplate(ReportTemplate $template): JsonResponse
    {
        $code = $template->code;
        $template->delete();

        return $this->deleted($this->audit('Removed report template', $code));
    }
}
