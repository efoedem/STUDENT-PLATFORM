import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { me } from "@/lib/api.functions";

export type Profile = {
  id: string;
  display_name: string;
  student_number: string | null;
  programme: string | null;
  department: string | null;
  level: number | null;
  avatar_url: string | null;
  bio: string | null;
  status: "active" | "suspended";
};

type AuthValue = {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  roles: string[];
  isStaff: boolean;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  profile: null,
  roles: [],
  isStaff: false,
  isAdmin: false,
  loading: true,
  refresh: async () => {},
});

export const meQueryOptions = {
  queryKey: ["me"] as const,
  queryFn: () => me(),
  staleTime: 30_000,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(meQueryOptions);

  const value = useMemo<AuthValue>(
    () => ({
      user: data?.user ?? null,
      profile: (data?.profile as Profile | null) ?? null,
      roles: data?.roles ?? [],
      isStaff: data?.isStaff ?? false,
      isAdmin: data?.isAdmin ?? false,
      loading: isLoading,
      refresh: async () => {
        await queryClient.invalidateQueries({ queryKey: ["me"] });
      },
    }),
    [data, isLoading, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
