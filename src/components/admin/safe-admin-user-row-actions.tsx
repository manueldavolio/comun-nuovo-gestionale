"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import type { UserRole } from "@prisma/client";
import { AdminUserRowActions } from "@/components/admin/admin-user-row-actions";

type SafeAdminUserRowActionsProps = {
  userId: string;
  initialRole: UserRole;
  initialIsActive: boolean;
  isCurrentUser: boolean;
  fallback?: ReactNode;
};

type AdminUserRowActionsBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type AdminUserRowActionsBoundaryState = {
  hasError: boolean;
};

class AdminUserRowActionsBoundary extends Component<
  AdminUserRowActionsBoundaryProps,
  AdminUserRowActionsBoundaryState
> {
  state: AdminUserRowActionsBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AdminUserRowActionsBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export function SafeAdminUserRowActions({
  userId,
  initialRole,
  initialIsActive,
  isCurrentUser,
  fallback = <span className="text-xs text-zinc-500">Azioni non disponibili</span>,
}: SafeAdminUserRowActionsProps) {
  return (
    <AdminUserRowActionsBoundary fallback={fallback}>
      <AdminUserRowActions
        userId={userId}
        initialRole={initialRole}
        initialIsActive={initialIsActive}
        isCurrentUser={isCurrentUser}
      />
    </AdminUserRowActionsBoundary>
  );
}
