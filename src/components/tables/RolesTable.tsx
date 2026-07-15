"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiFetch, extractList } from "@/lib/api";
import { Role } from "@/types/entities";
import ModalBackdrop from "../ui/modal/ModalBackdrop";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";

type FormMode = "create" | "edit" | "view" | null;

const emptyRole = (): Role => ({
  id: 0,
  name: "",
});

export default function RolesTable() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Role | null>(null);
  const [mode, setMode] = useState<FormMode>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadRoles = useCallback(async () => {
    try {
      const response = await apiFetch("/api/roles");
      setRoles(extractList<Role>(response));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load roles");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const closeModal = () => {
    setSelected(null);
    setMode(null);
  };

  const saveRole = async () => {
    if (!selected?.name.trim()) {
      toast.error("Role name is required");
      return;
    }

    setSaving(true);
    const isNew = selected.id === 0;

    try {
      const response = await apiFetch<{ data: Role }>(
        isNew ? "/api/roles/create" : `/api/roles/update/${selected.id}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: selected.name }),
        }
      );

      const saved = response.data ?? selected;

      if (isNew) {
        setRoles((prev) => [...prev, saved]);
        toast.success("Role created successfully");
      } else {
        setRoles((prev) =>
          prev.map((r) => (r.id === selected.id ? { ...r, ...saved } : r))
        );
        toast.success("Role updated successfully");
      }

      closeModal();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : isNew
            ? "Failed to create role"
            : "Failed to update role"
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (id: number) => {
    try {
      await apiFetch(`/api/roles/delete/${id}`, { method: "DELETE" });
      setRoles((prev) => prev.filter((r) => r.id !== id));
      toast.success("Role deleted successfully");
      setDeleteId(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete role");
    }
  };

  if (loading) {
    return <p className="p-5 text-gray-500">Loading roles...</p>;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        <Link
          href="/users"
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Assign to Users
        </Link>
        <button
          onClick={() => {
            setSelected(emptyRole());
            setMode("create");
          }}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition"
        >
          + Add Role
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <TableCell isHeader className="px-5 py-3">
                  Name
                </TableCell>
                <TableCell isHeader className="px-5 py-3">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="px-5 py-8 text-center text-gray-500"
                    colSpan={2}
                  >
                    No roles found. Create your first role to get started.
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="px-5 py-4 font-medium text-gray-800 dark:text-white">
                      {role.name}
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setSelected(role);
                            setMode("view");
                          }}
                          className="px-3 py-1 text-xs rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          View
                        </button>
                        <button
                          onClick={() => {
                            setSelected({ ...role });
                            setMode("edit");
                          }}
                          className="px-3 py-1 text-xs rounded-md bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                        >
                          Edit
                        </button>
                        <Link
                          href="/users"
                          className="px-3 py-1 text-xs rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        >
                          Assign
                        </Link>
                        <button
                          onClick={() => setDeleteId(role.id)}
                          className="px-3 py-1 text-xs rounded-md bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selected && mode && (
        <ModalBackdrop onClose={closeModal}>
          <div className="mx-auto w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
            <div className="border-b px-6 py-5">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                {mode === "view"
                  ? "Role Details"
                  : mode === "create"
                    ? "Add Role"
                    : "Edit Role"}
              </h2>
            </div>

            <div className="space-y-4 px-6 py-5">
              {mode === "view" ? (
                <div>
                  <p className="text-xs uppercase text-gray-400 mb-1">Name</p>
                  <p className="font-medium text-gray-800 dark:text-white">
                    {selected.name}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Role Name *
                  </label>
                  <input
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                    placeholder="e.g. Admin, Manager, Staff"
                    value={selected.name}
                    onChange={(e) =>
                      setSelected({ ...selected, name: e.target.value })
                    }
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-5">
              <button
                onClick={closeModal}
                className="rounded-xl border px-5 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {mode === "view" ? "Close" : "Cancel"}
              </button>
              {mode !== "view" && (
                <button
                  onClick={saveRole}
                  disabled={saving}
                  className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : mode === "create"
                      ? "Create Role"
                      : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </ModalBackdrop>
      )}

      {deleteId && (
        <ModalBackdrop onClose={() => setDeleteId(null)}>
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              Delete Role
            </h2>
            <p className="text-gray-500 mb-6">
              Are you sure you want to delete this role? Users with this role may
              lose access.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-xl border hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteRole(deleteId)}
                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </>
  );
}
