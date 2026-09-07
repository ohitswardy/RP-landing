<?php

namespace App\Models\Crms;

/** REGIS analysts and sales staff who appear on schedules. */
class SellsideContact extends CrmsModel
{
    protected $table = 'sellside_contact';

    public function toSnapshot(): array
    {
        return [
            'id' => (int) $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'type' => $this->type,
            'position' => $this->position,
            'office_no' => $this->office_no,
            'mobile_no' => $this->mobile_no,
        ];
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'name' => $this->name,
            'email' => $this->email,
            'type' => $this->type,
            'position' => $this->position,
            'officeNo' => $this->office_no,
            'mobileNo' => $this->mobile_no,
        ];
    }
}
