export default function EnterpriseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // FORK fibrazo: always enterprise — the community gate is removed so the
  // enterprise route group renders unconditionally.
  return <div>{children}</div>
}
