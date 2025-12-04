import { useAuth } from "./useAuth";

export const usePermissions = () => {
  const { user } = useAuth();
  const role = (user as any)?.role as "admin" | "editor" | null;

  return {
    user,
    isAdmin: role === "admin",
    canEdit: role === "admin" || role === "editor"
  };
};