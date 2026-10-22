import { expect, it } from 'vitest';
import { mentionsSoftPain, SOFT_PAIN_PATTERN } from '../core/safety/softPain';
it.each(['I injured my knee', 'Tweaked my back', 'My shoulder has been aching', 'Knee feels off', 'sore', 'niggle', 'PAINFUL\nshoulder', 'twinge', 'sprained ankle'])('matches %s', text => expect(mentionsSoftPain(text)).toBe(true));
it.each(['office chair', 'Coffee then squats', 'Spain trip', 'Bench 60kg 3x8', 'tight', 'funny'])('does not match %s', text => expect(mentionsSoftPain(text)).toBe(false));
it('is reusable and uses only i', () => {expect(SOFT_PAIN_PATTERN.flags).toBe('i'); expect(mentionsSoftPain('sore')).toBe(true); expect(mentionsSoftPain('sore')).toBe(true);});
