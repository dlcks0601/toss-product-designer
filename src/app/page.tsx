export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="font-display text-3xl text-text-strong">toss calendar</h1>
      <button
        type="button"
        className="pressable rounded-card bg-primary px-6 py-3 text-white"
      >
        시작하기
      </button>
    </main>
  );
}
