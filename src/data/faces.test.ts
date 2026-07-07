import { describe, expect, it } from 'vitest';
import { FACES, faceIdByName } from './faces';
import { ORG } from './world';

/**
 * 얼굴 큐레이션 계약 — 20명 전원이 서로 다른 얼굴로 렌더되는지 데이터 수준에서 지킨다. v1 이식.
 * (조합 규칙: 완전 중복 금지, 밝은 염색 2~3명, 안경 4~5명)
 */
describe('FACES 큐레이션', () => {
  it('ORG 20명 전원의 id 가 키로 존재한다', () => {
    expect(ORG).toHaveLength(20);
    for (const m of ORG) expect(FACES[m.id], `${m.name}(${m.id})의 얼굴 정의 누락`).toBeDefined();
    expect(Object.keys(FACES)).toHaveLength(20);
  });

  it('(hair, hairColor, skin, accessory, bg) 완전 중복 조합이 없다', () => {
    const seen = new Map<string, string>();
    for (const [id, f] of Object.entries(FACES)) {
      const key = [f.hair, f.hairColor, f.skin, f.accessory ?? 'none', f.bg].join('/');
      expect(seen.get(key), `${id}와 ${seen.get(key)}의 조합이 완전히 동일`).toBeUndefined();
      seen.set(key, id);
    }
  });

  it('밝은 염색(hairColor 2)은 2~3명, 안경은 4~5명', () => {
    const faces = Object.values(FACES);
    const dyed = faces.filter((f) => f.hairColor === 2).length;
    const glasses = faces.filter((f) => f.accessory === 'glasses').length;
    expect(dyed).toBeGreaterThanOrEqual(2);
    expect(dyed).toBeLessThanOrEqual(3);
    expect(glasses).toBeGreaterThanOrEqual(4);
    expect(glasses).toBeLessThanOrEqual(5);
  });

  it('faceIdByName 은 ORG 이름을 id 로 되돌린다 (미등록 이름은 undefined)', () => {
    for (const m of ORG) expect(faceIdByName(m.name)).toBe(m.id);
    expect(faceIdByName('없는사람')).toBeUndefined();
  });
});
