<?php

namespace App\Services;

use RuntimeException;

/**
 * A Graph call that did not send. Transient failures (throttling, gateway
 * errors, network) tell the job to back off and try the same batch again;
 * anything else fails that batch and moves on.
 */
class GraphMailException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly bool $transient = false,
        public readonly ?int $retryAfter = null,
    ) {
        parent::__construct($message);
    }
}
