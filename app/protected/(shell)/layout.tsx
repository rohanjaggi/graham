import { ProtectedShell } from '../protected-shell'

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell>{children}</ProtectedShell>
}
