import { redirect } from "next/navigation";
import { getOptionalUser } from "@/server/auth/session";

export default async function RootPage() {
  const user = await getOptionalUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
