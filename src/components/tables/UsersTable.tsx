"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  apiFetch,
  extractList,
  getToken,
  getUserId,
} from "@/lib/api";
import { Business, Company, Role, UserRow } from "@/types/entities";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";

import Badge from "../ui/badge/Badge";
import ModalBackdrop from "../ui/modal/ModalBackdrop";
import Image from "next/image";

export default function UsersTable() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | null>(null);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const [assignModal, setAssignModal] = useState(false);
  const [assignUser, setAssignUser] = useState<UserRow | null>(null);
  
  const [assignData, setAssignData] = useState({
    user_id: 0,
    role_id: "",
    company_id: "",
    business_id: "",
  });
  const [assignOptionsLoading, setAssignOptionsLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const filteredBusinesses = useMemo(() => {
    if (!assignData.company_id) return businesses;
    const companyId = Number(assignData.company_id);
    const matched = businesses.filter((business) => {
      const bizCompanyId =
        business.company_id ??
        (typeof business.company === "object" ? business.company?.id : undefined);
      return Number(bizCompanyId) === companyId;
    });
    // If API omits company_id, fall back to full list so user can still assign
    return matched.length > 0 ? matched : businesses;
  }, [assignData.company_id, businesses]);

  useEffect(() => {
    setCurrentUserId(getUserId());
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await apiFetch<{ data?: { users?: UserRow[] } }>(
        "/api/users"
      );
      setUsers(response?.data?.users || []);
    } catch (err) {
      console.error(err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const loadAssignOptions = useCallback(async () => {
    setAssignOptionsLoading(true);
    try {
      const [rolesRes, companiesRes, businessesRes] = await Promise.all([
        apiFetch("/api/roles"),
        apiFetch("/api/companies"),
        apiFetch("/api/businesses"),
      ]);

      setRoles(extractList<Role>(rolesRes));
      setCompanies(extractList<Company>(companiesRes));
      setBusinesses(extractList<Business>(businessesRes));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load assignment options");
    } finally {
      setAssignOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (assignModal) {
      loadAssignOptions();
    }
  }, [assignModal, loadAssignOptions]);

  // ================= DELETE API =================
  const deleteUser = async (id: number) => {
    try {
      const token = getToken();

      const res = await fetch(
        `http://smart-business-backend-stagging.test/api/users/delete/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== id));

        toast.success("User deleted successfully");

        setDeleteId(null);
      } else {
        toast.error("Failed to delete user");
      }
    } catch (error) {
      console.error("DELETE ERROR:", error);

      toast.error("Something went wrong");
    }
  };

  // ================= CREATE / UPDATE API =================
  const updateUser = async () => {
    if (!selectedUser) return;

    try {
      const token = getToken();
      const isNew = selectedUser.id === 0;

      const payload: any = {
        name: selectedUser.name,
        email: selectedUser.email,
      };

      if (selectedUser.password) {
        payload.password = selectedUser.password;
      }

      const res = await fetch(
        isNew
          ? "http://smart-business-backend-stagging.test/api/users/create"
          : `http://smart-business-backend-stagging.test/api/users/update/${selectedUser.id}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        const data = await res.json();

        if (isNew) {
          setUsers((prev) => [
            ...prev,
            {
              ...data.data,
              roles: ["Not Assigned"],
              companies: ["Not Assigned"],
              businesses: ["Not Assigned"],
            },
          ]);
          toast.success("User created successfully");
        } else {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === selectedUser.id ? { ...u, ...selectedUser } : u
            )
          );
          toast.success("User updated successfully");
        }

        setSelectedUser(null);
        setMode(null);
      } else {
        toast.error("Operation failed");
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    }
  };
  const assignRole = async () => {
    const roleId = Number(assignData.role_id);
    const companyId = Number(assignData.company_id);
    const businessId = Number(assignData.business_id);

    if (!roleId || !companyId || !businessId) {
      toast.error("Please select a role, company, and business");
      return;
    }

    setAssigning(true);
    try {
      await apiFetch("/api/roles/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: assignData.user_id,
          role_id: roleId,
          company_id: companyId,
          business_id: businessId,
        }),
      });

      toast.success("Access assigned successfully");
      setAssignModal(false);
      setAssignUser(null);
      await fetchUsers();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Assignment failed"
      );
    } finally {
      setAssigning(false);
    }
  };
  if (loading) {
    return <p className="p-5">Loading users...</p>;
  }

  return (
    <>
      {/* ================= ADD BUTTON ================= */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            setSelectedUser({
              id: 0,
              name: "",
              email: "",
              password: "",
              companies: [],
              businesses: [],
            });

            setMode("edit");
          }}
          className="px-4 py-2 rounded-lg bg-green-600 text-white"
        >
          + Add New User
        </button>
      </div>
      
      {/* ================= TABLE ================= */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[1000px]">
            <Table>
              {/* HEADER */}
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3">
                    User
                  </TableCell>

                  <TableCell isHeader className="px-5 py-3">
                    Email
                  </TableCell>

                  <TableCell isHeader className="px-5 py-3">
                    Roles
                  </TableCell>

                  <TableCell isHeader className="px-5 py-3">
                    Companies
                  </TableCell>

                  <TableCell isHeader className="px-5 py-3">
                    Businesses
                  </TableCell>

                  <TableCell isHeader className="px-5 py-3">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHeader>

              {/* BODY */}
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {users.map((user) => (
                  <TableRow key={user.id}>
                    {/* USER */}
                    <TableCell className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 overflow-hidden rounded-full">
                          <Image
                            width={40}
                            height={40}
                            src={"/images/user/owner.jpg"}
                            alt={user.name}
                          />
                        </div>

                        <span className="font-medium text-gray-800 dark:text-white">
                          {user.name}
                        </span>
                      </div>
                    </TableCell>

                    {/* EMAIL */}
                    <TableCell className="px-5 py-4 text-gray-500">
                      {user.email}
                    </TableCell>

                    {/* ROLES */}
                    <TableCell className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(user.roles || []).map((role, i) => (
                          <Badge key={i} size="sm" color="success">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>

                    {/* COMPANIES */}
                    <TableCell className="px-5 py-4 text-gray-500">
                      {(user.companies || []).join(", ") || "-"}
                    </TableCell>

                    {/* BUSINESSES */}
                    <TableCell className="px-5 py-4 text-gray-500">
                      {(user.businesses || []).join(", ") || "-"}
                    </TableCell>

                    {/* ACTIONS */}
                    <TableCell className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
  onClick={() => {
    setAssignUser(user);

    setAssignData({
      user_id: user.id,
      role_id: "",
      company_id: "",
      business_id: "",
    });

    setAssignModal(true);
  }}
  className="px-3 py-1 rounded bg-purple-100 text-purple-700 text-xs"
>
  Assign
</button>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setMode("view");
                          }}
                          className="px-3 py-1 text-xs rounded-md bg-blue-100 text-blue-600"
                        >
                          View
                        </button>

                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setMode("edit");
                          }}
                          className="px-3 py-1 text-xs rounded-md bg-yellow-100 text-yellow-600"
                        >
                          Edit
                        </button>

                        {currentUserId !== user.id && (
                          <button
                            onClick={() => setDeleteId(user.id)}
                            className="px-3 py-1 text-xs rounded-md bg-red-100 text-red-600"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ================= VIEW / EDIT MODAL ================= */}
      {selectedUser && mode && (
        <ModalBackdrop
          onClose={() => {
            setSelectedUser(null);
            setMode(null);
          }}
        >
          <div className="mx-auto bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl">
            {/* HEADER */}
            <div className="sticky top-0 z-10 border-b bg-white px-6 py-5 dark:bg-gray-900 dark:border-gray-800">
              <div className="flex items-center gap-4">
                <Image
                  src={selectedUser.image || "/images/user/owner.jpg"}
                  width={56}
                  height={56}
                  className="rounded-full"
                  alt="user"
                />

                <div className="w-full min-w-0">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                    {mode === "view"
                      ? "User Details"
                      : selectedUser.id === 0
                        ? "Add User"
                        : "Edit User"}
                  </h2>

                  {mode === "view" ? (
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white/90 truncate">
                        {selectedUser.name}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {selectedUser.email}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 mt-3">
                      <input
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                        placeholder="Enter name"
                        value={selectedUser.name}
                        onChange={(e) =>
                          setSelectedUser({
                            ...selectedUser,
                            name: e.target.value,
                          })
                        }
                      />

                      <input
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                        placeholder="Enter email"
                        value={selectedUser.email}
                        onChange={(e) =>
                          setSelectedUser({
                            ...selectedUser,
                            email: e.target.value,
                          })
                        }
                      />
                      <input
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                        placeholder="Enter password"
                        type="password"
                        value={selectedUser.password || ""}
                        onChange={(e) =>
                          setSelectedUser({
                            ...selectedUser,
                            password: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-5">

            {/* ACCESS STRUCTURE */}
            {mode === "view" && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase text-gray-400 mb-2">All Roles</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...new Set(selectedUser.roles || [])].length ? (
                      [...new Set(selectedUser.roles || [])].map((role) => (
                        <Badge key={role} size="sm" color="success">
                          {role}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">No roles assigned</span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Companies & Businesses
                  </h3>

                  {(() => {
                    type Grouped = {
                      name: string;
                      businesses: {
                        name: string;
                        type?: string;
                        address?: string;
                        roles: string[];
                      }[];
                    };

                    let grouped: Grouped[] = [];

                    if (selectedUser.assignments?.length) {
                      const map: Record<string, Grouped> = {};
                      selectedUser.assignments.forEach((item) => {
                        const companyName = item.company || "Unknown Company";
                        if (!map[companyName]) {
                          map[companyName] = { name: companyName, businesses: [] };
                        }
                        const bizName = item.business || "Unnamed business";
                        const existing = map[companyName].businesses.find(
                          (b) => b.name === bizName
                        );
                        const roleList = [
                          ...(item.roles || []),
                          ...(item.role ? [item.role] : []),
                        ];
                        if (existing) {
                          existing.roles = [
                            ...new Set([...existing.roles, ...roleList]),
                          ];
                        } else {
                          map[companyName].businesses.push({
                            name: bizName,
                            type: item.business_type,
                            address: item.address,
                            roles: [...new Set(roleList)],
                          });
                        }
                      });
                      grouped = Object.values(map);
                    } else {
                      const map: Record<string, Grouped> = {};
                      (selectedUser.companies || []).forEach((company, i) => {
                        if (!map[company]) {
                          map[company] = { name: company, businesses: [] };
                        }
                        const biz = selectedUser.businesses?.[i];
                        if (
                          biz &&
                          !map[company].businesses.some((b) => b.name === biz)
                        ) {
                          map[company].businesses.push({
                            name: biz,
                            roles: [],
                          });
                        }
                      });
                      grouped = Object.values(map);
                    }

                    if (!grouped.length) {
                      return (
                        <p className="text-sm text-gray-500 py-4 text-center">
                          No companies or businesses assigned
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {grouped.map((company) => (
                          <div
                            key={company.name}
                            className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                          >
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div>
                                <p className="font-medium text-gray-800 dark:text-white">
                                  {company.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {company.businesses.length} business
                                  {company.businesses.length === 1 ? "" : "es"}
                                </p>
                              </div>
                              <Badge size="sm" color="success">
                                Active
                              </Badge>
                            </div>

                            {company.businesses.length === 0 ? (
                              <p className="text-xs text-gray-400">
                                No businesses under this company
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {company.businesses.map((biz) => (
                                  <div
                                    key={`${company.name}-${biz.name}`}
                                    className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-800/60"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div>
                                        <p className="text-sm font-medium text-gray-800 dark:text-white">
                                          {biz.name}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          {biz.type || "branch"}
                                          {biz.address ? ` · ${biz.address}` : ""}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap gap-1 justify-end">
                                        {(biz.roles.length
                                          ? biz.roles
                                          : selectedUser.roles || []
                                        )
                                          .filter(
                                            (r, i, arr) => arr.indexOf(r) === i
                                          )
                                          .map((role) => (
                                            <Badge
                                              key={role}
                                              size="sm"
                                              color="primary"
                                            >
                                              {role}
                                            </Badge>
                                          ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
            </div>

            {/* ACTIONS */}
            <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white px-6 py-4 dark:bg-gray-900 dark:border-gray-800">
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setMode(null);
                }}
                className="px-4 py-2 rounded-xl border text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Close
              </button>

              {mode === "edit" && (
                <button
                  onClick={updateUser}
                  className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm hover:bg-brand-600"
                >
                  {selectedUser.id === 0 ? "Create User" : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ================= DELETE MODAL ================= */}
      {deleteId && (
        <ModalBackdrop onClose={() => setDeleteId(null)}>
          <div className="mx-auto bg-white dark:bg-gray-900 p-6 rounded-2xl w-full max-w-[420px] shadow-2xl">
            <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">
              Delete User
            </h2>

            <p className="text-gray-500 mb-6">
              Are you sure you want to delete this user?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>

              <button
                onClick={() => deleteUser(deleteId)}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {assignModal && assignUser && (
        <ModalBackdrop
          onClose={() => {
            setAssignUser(null);
            setAssignModal(false);
          }}
        >
          <div className="mx-auto w-full max-w-xl rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">

      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-5">
        <div>
          <h2 className="text-xl font-semibold">
            Assign Access
          </h2>

          <p className="text-sm text-gray-500">
            Assign role, company and business to this user.
          </p>
        </div>

        <button
          onClick={() => {
            setAssignUser(null);
            setAssignModal(false);
          }}
          className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          ✕
        </button>
      </div>

      {/* User */}
      <div className="flex items-center gap-4 px-6 py-5">

        <Image
          src="/images/user/owner.jpg"
          width={60}
          height={60}
          className="rounded-full"
          alt="user"
        />

        <div>

          <h3 className="font-semibold text-lg">
            {assignUser.name}
          </h3>

          <p className="text-sm text-gray-500">
            {assignUser.email}
          </p>

        </div>

      </div>

      {/* Form */}
      <div className="space-y-5 px-6 pb-6">

        {/* Role */}
        <div>

          <label className="mb-2 block text-sm font-medium">
            Role
          </label>

          <select
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none disabled:opacity-60"
            value={assignData.role_id}
            disabled={assignOptionsLoading}
            onChange={(e) =>
              setAssignData((prev) => ({ ...prev, role_id: e.target.value }))
            }
          >
            <option value="">
              {assignOptionsLoading ? "Loading roles..." : "Select Role"}
            </option>

            {roles.map((role) => (
              <option key={role.id} value={String(role.id)}>
                {role.name}
              </option>
            ))}
          </select>

        </div>

        {/* Company */}

        <div>

          <label className="mb-2 block text-sm font-medium">
            Company
          </label>

          <select
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none disabled:opacity-60"
            value={assignData.company_id}
            disabled={assignOptionsLoading}
            onChange={(e) =>
              setAssignData((prev) => ({
                ...prev,
                company_id: e.target.value,
                business_id: "",
              }))
            }
          >
            <option value="">
              {assignOptionsLoading ? "Loading companies..." : "Select Company"}
            </option>

            {companies.map((company) => (
              <option key={company.id} value={String(company.id)}>
                {company.name}
              </option>
            ))}
          </select>

        </div>

        {/* Business */}

        <div>

          <label className="mb-2 block text-sm font-medium">
            Business
          </label>

          <select
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none disabled:opacity-60"
            value={assignData.business_id}
            disabled={assignOptionsLoading || !assignData.company_id}
            onChange={(e) =>
              setAssignData((prev) => ({
                ...prev,
                business_id: e.target.value,
              }))
            }
          >
            <option value="">
              {!assignData.company_id
                ? "Select a company first"
                : assignOptionsLoading
                  ? "Loading businesses..."
                  : filteredBusinesses.length === 0
                    ? "No businesses available"
                    : "Select Business"}
            </option>

            {filteredBusinesses.map((business) => (
              <option key={business.id} value={String(business.id)}>
                {business.name}
              </option>
            ))}
          </select>

        </div>

      </div>

      {/* Footer */}

      <div className="flex justify-end gap-3 border-t px-6 py-5">

        <button
          onClick={() => {
            setAssignUser(null);
            setAssignModal(false);
          }}
          className="rounded-xl border px-5 py-2.5 hover:bg-gray-100"
        >
          Cancel
        </button>

        <button
          onClick={assignRole}
          disabled={assigning || assignOptionsLoading}
          className="rounded-xl bg-brand-500 px-6 py-2.5 font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {assigning ? "Assigning..." : "Assign Access"}
        </button>

      </div>

          </div>
        </ModalBackdrop>
      )}
    </>
  );
}