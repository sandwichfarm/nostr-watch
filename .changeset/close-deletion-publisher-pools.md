---
"@nostrwatch/publisher": patch
---

Release short-lived deletion publisher connections after every relay has acknowledged, rejected, or timed out. This prevents remediation queue drains from retaining one WebSocket pool per deletion while preserving first-ACK success and slower relay delivery.

Require a positive relay ACK before recording durable deletion success. Connection failures now reject instead of being mistaken for successful publication, so direct and queued deletions remain retryable.
