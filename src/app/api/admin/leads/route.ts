import { getAdminSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { deleteLeadsSql, handleLeadDeletion } from "@/lib/lead-deletion";

export async function DELETE(request: Request) {
  return handleLeadDeletion(request, {
    getAdmin: getAdminSession,
    remove: async (ids, adminId) => {
      const rows = await getSql().query(deleteLeadsSql, [ids, adminId]) as { id: string }[];
      return rows.map((row) => row.id);
    },
  });
}
