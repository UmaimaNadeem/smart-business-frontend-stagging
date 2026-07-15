"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiFetch, extractItem, extractList } from "@/lib/api";
import { Company, CompanyStructure, UserRow } from "@/types/entities";
import Badge from "../ui/badge/Badge";
import ModalBackdrop from "../ui/modal/ModalBackdrop";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";

type FormMode = "create" | "edit" | "view" | null;

const emptyCompany = (): Company => ({
  id: 0,
  name: "",
  currency: "PKR",
  country: "",
  status: 1,
  owner_id: undefined,
});

const isActive = (status?: number | boolean) =>
  status === 1 || status === true || status === undefined;

export default function CompaniesTable() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const [mode, setMode] = useState<FormMode>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [structure, setStructure] = useState<CompanyStructure | null>(null);
  const [structureLoading, setStructureLoading] = useState(false);

  const usersById = useMemo(() => {
    const map = new Map<number, UserRow>();
    users.forEach((u) => map.set(Number(u.id), u));
    return map;
  }, [users]);

  const loadData = useCallback(async () => {
    try {
      const [companiesRes, usersRes] = await Promise.all([
        apiFetch("/api/companies"),
        apiFetch("/api/users"),
      ]);
      setCompanies(extractList<Company>(companiesRes));
      const usersData = (usersRes as { data?: { users?: UserRow[] } })?.data
        ?.users;
      setUsers(
        Array.isArray(usersData)
          ? usersData
          : extractList<UserRow>(usersRes)
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to load companies");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const closeModal = () => {
    setSelected(null);
    setMode(null);
    setStructure(null);
  };

  const openView = async (company: Company) => {
    setSelected(company);
    setMode("view");
    setStructure(null);
    setStructureLoading(true);
    try {
      const response = await apiFetch(`/api/companies/${company.id}/structure`);
      const data = extractItem<CompanyStructure>(response);
      setStructure(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load company structure");
    } finally {
      setStructureLoading(false);
    }
  };

  const resolveOwner = (company: Company) => {
    if (typeof company.owner === "object" && company.owner?.name) {
      return {
        name: company.owner.name,
        email: company.owner.email,
      };
    }
    if (typeof company.owner === "string" && company.owner) {
      return { name: company.owner, email: undefined };
    }
    const user = company.owner_id
      ? usersById.get(Number(company.owner_id))
      : undefined;
    if (user) return { name: user.name, email: user.email };
    return null;
  };

  const ownerLabel = (company: Company) =>
    resolveOwner(company)?.name ?? "—";

  /** Merge structure roles with full user roles from users list */
  const memberRoles = (memberId: number, structureRoles?: string[]) => {
    const fromUser = usersById.get(Number(memberId))?.roles || [];
    const merged = [...(structureRoles || []), ...fromUser].filter(Boolean);
    return [...new Set(merged)];
  };

  const saveCompany = async () => {
    if (!selected?.name.trim()) {
      toast.error("Company name is required");
      return;
    }

    setSaving(true);
    const isNew = selected.id === 0;

    try {
      const payload: Record<string, unknown> = {
        name: selected.name,
        currency: selected.currency || "PKR",
        country: selected.country || null,
        status: isActive(selected.status) ? 1 : 0,
      };
      if (selected.owner_id) payload.owner_id = Number(selected.owner_id);

      const response = await apiFetch<{ data: Company }>(
        isNew
          ? "/api/companies/create"
          : `/api/companies/update/${selected.id}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const saved = response.data ?? { ...selected, ...payload };

      if (isNew) {
        setCompanies((prev) => [...prev, saved as Company]);
        toast.success("Company created successfully");
      } else {
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === selected.id ? { ...c, ...(saved as Company) } : c
          )
        );
        toast.success("Company updated successfully");
      }

      closeModal();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : isNew
            ? "Failed to create company"
            : "Failed to update company"
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteCompany = async (id: number) => {
    try {
      await apiFetch(`/api/companies/delete/${id}`, { method: "DELETE" });
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      toast.success("Company deleted successfully");
      setDeleteId(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete company");
    }
  };

  if (loading) {
    return <p className="p-5 text-gray-500">Loading companies...</p>;
  }

  const viewOwner =
    structure?.company?.owner ||
    (selected ? resolveOwner(selected) : null);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        <Link
          href="/businesses"
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Manage Businesses
        </Link>
        <Link
          href="/users"
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Assign Access
        </Link>
        <button
          onClick={() => {
            setSelected(emptyCompany());
            setMode("create");
          }}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition"
        >
          + Add Company
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
                  Currency
                </TableCell>
                <TableCell isHeader className="px-5 py-3">
                  Country
                </TableCell>
                <TableCell isHeader className="px-5 py-3">
                  Owner
                </TableCell>
                <TableCell isHeader className="px-5 py-3">
                  Status
                </TableCell>
                <TableCell isHeader className="px-5 py-3">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {companies.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="px-5 py-8 text-center text-gray-500"
                    colSpan={6}
                  >
                    No companies found. Create your first company to get started.
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="px-5 py-4 font-medium text-gray-800 dark:text-white">
                      {company.name}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500">
                      {company.currency || "PKR"}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500">
                      {company.country || "—"}
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white/90">
                          {ownerLabel(company)}
                        </p>
                        {resolveOwner(company)?.email && (
                          <p className="text-xs text-gray-500">
                            {resolveOwner(company)?.email}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <Badge
                        size="sm"
                        color={isActive(company.status) ? "success" : "warning"}
                      >
                        {isActive(company.status) ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openView(company)}
                          className="px-3 py-1 text-xs rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          Structure
                        </button>
                        <button
                          onClick={() => {
                            setSelected({ ...company });
                            setMode("edit");
                          }}
                          className="px-3 py-1 text-xs rounded-md bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                        >
                          Edit
                        </button>
                        <Link
                          href="/businesses"
                          className="px-3 py-1 text-xs rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        >
                          Businesses
                        </Link>
                        <button
                          onClick={() => setDeleteId(company.id)}
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

      {selected && mode && mode !== "view" && (
        <ModalBackdrop onClose={closeModal}>
          <div className="mx-auto w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
            <div className="border-b px-6 py-5">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                {mode === "create" ? "Add Company" : "Edit Company"}
              </h2>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Company Name *
                </label>
                <input
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                  placeholder="Enter company name"
                  value={selected.name}
                  onChange={(e) =>
                    setSelected({ ...selected, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Owner
                </label>
                <select
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                  value={selected.owner_id ?? ""}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      owner_id: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                >
                  <option value="">Select owner</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Currency
                  </label>
                  <input
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                    placeholder="PKR"
                    value={selected.currency ?? "PKR"}
                    onChange={(e) =>
                      setSelected({ ...selected, currency: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Country
                  </label>
                  <input
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                    placeholder="Country"
                    value={selected.country ?? ""}
                    onChange={(e) =>
                      setSelected({ ...selected, country: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status
                </label>
                <select
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                  value={isActive(selected.status) ? 1 : 0}
                  onChange={(e) =>
                    setSelected({ ...selected, status: Number(e.target.value) })
                  }
                >
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-5">
              <button
                onClick={closeModal}
                className="rounded-xl border px-5 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={saveCompany}
                disabled={saving}
                className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : mode === "create"
                    ? "Create Company"
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {selected && mode === "view" && (
        <ModalBackdrop onClose={closeModal}>
          <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-white px-6 py-5 dark:bg-gray-900 dark:border-gray-800">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  {structure?.company?.name || selected.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {structure?.company?.currency || selected.currency || "PKR"}
                  {(structure?.company?.country || selected.country) &&
                    ` · ${structure?.company?.country || selected.country}`}
                  {structure?.total_businesses != null &&
                    ` · ${structure.total_businesses} businesses`}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                <p className="text-xs uppercase text-gray-400 mb-1">Owner</p>
                <p className="font-medium text-gray-800 dark:text-white">
                  {("name" in (viewOwner || {}) && viewOwner?.name) ||
                    ownerLabel(selected)}
                </p>
                {viewOwner && "email" in viewOwner && viewOwner.email && (
                  <p className="text-sm text-gray-500">{viewOwner.email}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/businesses"
                  className="px-3 py-1.5 text-xs rounded-lg bg-emerald-100 text-emerald-700"
                >
                  + Add Business
                </Link>
                <Link
                  href="/users"
                  className="px-3 py-1.5 text-xs rounded-lg bg-purple-100 text-purple-700"
                >
                  Assign Member
                </Link>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Businesses & Members
                </h3>

                {structureLoading ? (
                  <p className="text-sm text-gray-500 py-6 text-center">
                    Loading structure...
                  </p>
                ) : !structure?.businesses?.length ? (
                  <p className="text-sm text-gray-500 py-6 text-center">
                    No businesses found for this company.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {structure.businesses.map((biz) => {
                      const uniqueMembers = Array.from(
                        new Map(
                          (biz.members || []).map((m) => [m.id, m])
                        ).values()
                      );

                      return (
                        <div
                          key={biz.id}
                          className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                            <div>
                              <p className="font-medium text-gray-800 dark:text-white">
                                {biz.name}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {biz.type || "branch"}
                                {biz.address ? ` · ${biz.address}` : ""}
                              </p>
                            </div>
                            <Badge
                              size="sm"
                              color={
                                isActive(biz.status) ? "success" : "warning"
                              }
                            >
                              {isActive(biz.status) ? "Active" : "Inactive"}
                            </Badge>
                          </div>

                          {uniqueMembers.length === 0 ? (
                            <p className="text-xs text-gray-400">
                              No members assigned
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {uniqueMembers.map((member) => {
                                const roles = memberRoles(
                                  member.id,
                                  member.roles
                                );
                                return (
                                  <div
                                    key={`${biz.id}-${member.id}`}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60"
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-gray-800 dark:text-white">
                                        {member.name}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {member.email}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap gap-1 justify-end max-w-md">
                                      {roles.length ? (
                                        roles.map((role) => (
                                          <Badge
                                            key={role}
                                            size="sm"
                                            color="primary"
                                          >
                                            {role}
                                          </Badge>
                                        ))
                                      ) : (
                                        <span className="text-xs text-gray-400">
                                          No roles
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white px-6 py-4 dark:bg-gray-900 dark:border-gray-800">
              <button
                onClick={() => {
                  setStructure(null);
                  setMode("edit");
                }}
                className="rounded-xl bg-yellow-100 px-5 py-2.5 text-sm text-yellow-700"
              >
                Edit Company
              </button>
              <button
                onClick={closeModal}
                className="rounded-xl border px-5 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {deleteId && (
        <ModalBackdrop onClose={() => setDeleteId(null)}>
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              Delete Company
            </h2>
            <p className="text-gray-500 mb-6">
              Are you sure you want to delete this company? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-xl border hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCompany(deleteId)}
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
