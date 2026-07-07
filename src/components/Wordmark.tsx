import Image from 'next/image';

/**
 * 로고 락업 — v1 그대로: 토스 공식 심벌 + `toss`(semibold) `calendar`(light 70%).
 * 워드마크는 Toss Display Sans(.font-display), 심벌은 /public/toss-symbol.png.
 */
export default function Wordmark() {
  return (
    <span className="flex items-center gap-[5px]">
      <Image src="/toss-symbol.png" alt="" width={22} height={22} priority className="shrink-0" />
      <span className="font-display text-[19px] leading-none tracking-[-0.02em]">
        <span className="font-semibold text-text-strong">toss</span>
        <span className="ml-[5px] font-normal text-text-strong/70">calendar</span>
      </span>
    </span>
  );
}
