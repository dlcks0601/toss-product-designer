import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // 요일 안무 계약(S1~S4)은 화요일 앵커의 정본 세계로 검증한다 — 런타임은 라이브 앵커.
    env: { NEXT_PUBLIC_ANCHOR: '2026-07-07' },
  },
})
