import { describe, expect, it } from 'vitest'
import { getSkillsRefetchInterval, shouldRetrySkillsQuery } from './useSkills'

describe('useSkills discovery policy', () => {
    it('retries transport failures while a new session RPC handler is registering', () => {
        expect(shouldRetrySkillsQuery(0)).toBe(true)
        expect(shouldRetrySkillsQuery(2)).toBe(true)
        expect(shouldRetrySkillsQuery(3)).toBe(false)
    })

    it('polls failed RPC responses until skills are available', () => {
        expect(getSkillsRefetchInterval(true, undefined, 0)).toBe(1000)
        expect(getSkillsRefetchInterval(true, { success: false, error: 'RPC handler not registered' }, 1)).toBe(1000)
    })

    it('stops after the first successful response, including an empty skill list', () => {
        expect(getSkillsRefetchInterval(true, { success: true, skills: [] }, 1)).toBe(false)
        expect(getSkillsRefetchInterval(false, undefined, 0)).toBe(false)
    })

    it('stops after the discovery poll cap', () => {
        expect(getSkillsRefetchInterval(true, undefined, 10)).toBe(false)
        expect(getSkillsRefetchInterval(true, { success: false, error: 'not ready' }, 10)).toBe(false)
    })
})
