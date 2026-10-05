import { MisterShell } from "@/components/mister/mister-nav";

export default function MisterLayout({ children }: { children: React.ReactNode }) {
  return <MisterShell>{children}</MisterShell>;
}
