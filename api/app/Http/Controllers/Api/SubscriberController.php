<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subscriber;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;

class SubscriberController extends Controller
{
    public function destroy(Subscriber $subscriber): JsonResponse
    {
        $email = $subscriber->email;
        $subscriber->delete();
        $audit = Audit::log('Removed subscriber', $email);

        return response()->json(['audit' => $audit->toWire()]);
    }
}
