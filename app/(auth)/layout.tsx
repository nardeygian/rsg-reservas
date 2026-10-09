import { ThemeToggle } from "../_components/ThemeToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
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
