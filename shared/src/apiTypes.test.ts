import { describe, expect, it } from 'bun:test'
import { ListCodexSessionsRpcResponseSchema } from './apiTypes'

describe('ListCodexSessionsRpcResponseSchema', () => {
    it('保留完整 Codex 会话中的 messages', () => {
        const response = {
            success: true as const,
            sessions: [{
                id: 'codex-session-id',
                title: 'Codex session',
                file: '/tmp/rollout.jsonl',
                modifiedAt: 1,
                messages: [{
                    role: 'user' as const,
                    content: { type: 'text' as const, text: 'hello' },
                    meta: { sentFrom: 'cli' as const }
                }]
            }]
        }

        expect(ListCodexSessionsRpcResponseSchema.parse(response)).toEqual(response)
    })
})
