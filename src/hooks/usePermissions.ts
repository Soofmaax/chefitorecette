import { useAuth } from "./useAuth";
import type { Role } from "./useAuth";

export const usePermissions = () => {
  const { user } = useAuth();
  const role: Role = user?.appRole ?? null;

  return {
    user,
    isAdmin: role === "admin",
    canEdit: role === "admin" || role === "editor"
  };
};