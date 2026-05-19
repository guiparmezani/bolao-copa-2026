import { AdminAppFrame } from "@/components/app-frame";
import { requireAdminPage } from "@/lib/admin/auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAdminPage();

  return <AdminAppFrame user={user}>{children}</AdminAppFrame>;
}
