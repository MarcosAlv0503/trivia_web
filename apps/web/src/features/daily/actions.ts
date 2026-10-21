"use server";

import { redirect } from "next/navigation";
import { getAuthContext } from "@/features/profile/queries";

/** Empieza (o retoma) el reto de hoy; se juega en /daily. */
export async function startDaily() {
  const { supabase, claims } = await getAuthContext();
  if (!claims) redirect("/");
  const { error } = await supabase.rpc("start_daily_match");
  if (error) throw new Error(`start_daily_match: ${error.message}`);
  redirect("/daily");
}
