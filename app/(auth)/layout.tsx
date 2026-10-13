import { ThemeToggle } from "../_components/ThemeToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="fixed inset-0 flex items-center justify-center px-4 overflow-y-auto" style={{ background: "var(--color-bg)" }}>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm py-10">
        <div className="text-center mb-8">
          <p className="eyebrow">Iglesia RSG</p>
          <h1 className="font-serif text-3xl mt-2 tracking-[-0.02em]">
            Panel RSG
          </h1>
        </div>
        {children}
      </div>
    </main>
  );
}
