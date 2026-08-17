import { SessionShell } from "@/components/layout/SessionShell";
import { AuthProvider } from "@/lib/auth/AuthProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SessionShell>{children}</SessionShell>
    </AuthProvider>
  );
}
