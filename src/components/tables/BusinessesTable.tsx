"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiFetch, extractList } from "@/lib/api";
import { Business, Company } from "@/types/entities";
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

const emptyBusiness = (): Business => ({
  id: 0,
  name: "",
  company_id: undefined,
  type: "branch",
  address: "",
  status: 1,
});

const isActive = (status?: number | boolean) =>
  status === 1 || status === true || status === undefined;

export default function BusinessesTable() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Business | null>(null);
  const [mode, setMode] = useState<FormMode>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const getCompanyName = (business: Business) => {
    if (typeof business.company === "string") return business.company;
    if (business.company?.name) return business.company.name;
    const company = companies.find(
      (c) => Number(c.id) === Number(business.company_id)
    );
    return company?.name ?? "—";
  };

  const loadData = useCallback(async () => {
    try {
      const [businessRes, companyRes] = await Promise.all([
        apiFetch("/api/businesses"),
        apiFetch("/api/companies"),
      ]);
      setBusinesses(extractList<Business>(businessRes));
      setCompanies(extractList<Company>(companyRes));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load businesses");
      setBusinesses([]);
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
  };

  const saveBusiness = async () => {
    if (!selected?.name.trim()) {
      toast.error("Business name is required");
      return;
    }
    if (!selected.company_id) {
      toast.error("Please select a company");
      return;
    }

    setSaving(true);
    const isNew = selected.id === 0;

    try {
      const payload = {
        name: selected.name,
        company_id: Number(selected.company_id),
        type: selected.type ?? "branch",
        address: selected.address || null,
        status: isActive(selected.status) ? 1 : 0,
      };

      const response = await apiFetch<{ data: Business }>(
        isNew
          ? "/api/businesses/create"
          : `/api/businesses/update/${selected.id}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const saved = response.data ?? { ...selected, ...payload };

      if (isNew) {
        setBusinesses((prev) => [...prev, saved]);
        toast.success("Business created successfully");
      } else {
        setBusinesses((prev) =>
          prev.map((b) => (b.id === selected.id ? { ...b, ...saved } : b))
        );
        toast.success("Business updated successfully");
      }

      closeModal();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : isNew
            ? "Failed to create business"
            : "Failed to update business"
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteBusiness = async (id: number) => {
    try {
      await apiFetch(`/api/businesses/delete/${id}`, { method: "DELETE" });
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      toast.success("Business deleted successfully");
      setDeleteId(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete business");
    }
  };

  if (loading) {
    return <p className="p-5 text-gray-500">Loading businesses...</p>;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        <Link
          href="/companies"
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Companies
        </Link>
        <Link
          href="/users"
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Assign Members
        </Link>
        <button
          onClick={() => {
            setSelected(emptyBusiness());
            setMode("create");
          }}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition"
        >
          + Add Business
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <TableCell isHeader className="px-5 py-3">Name</TableCell>
                <TableCell isHeader className="px-5 py-3">Company</TableCell>
                <TableCell isHeader className="px-5 py-3">Type</TableCell>
                <TableCell isHeader className="px-5 py-3">Address</TableCell>
                <TableCell isHeader className="px-5 py-3">Status</TableCell>
                <TableCell isHeader className="px-5 py-3">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {businesses.length === 0 ? (
                <TableRow>
                  <TableCell className="px-5 py-8 text-center text-gray-500" colSpan={6}>
                    No businesses found. Create your first business to get started.
                  </TableCell>
                </TableRow>
              ) : (
                businesses.map((business) => (
                  <TableRow key={business.id}>
                    <TableCell className="px-5 py-4 font-medium text-gray-800 dark:text-white">
                      {business.name}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500">
                      {getCompanyName(business)}
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <Badge size="sm" color="primary">
                        {business.type || "branch"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500 max-w-xs truncate">
                      {business.address || "—"}
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <Badge
                        size="sm"
                        color={isActive(business.status) ? "success" : "warning"}
                      >
                        {isActive(business.status) ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setSelected(business);
                            setMode("view");
                          }}
                          className="px-3 py-1 text-xs rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          View
                        </button>
                        <button
                          onClick={() => {
                            setSelected({ ...business });
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
                          onClick={() => setDeleteId(business.id)}
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
                  ? "Business Details"
                  : mode === "create"
                    ? "Add Business"
                    : "Edit Business"}
              </h2>
            </div>

            <div className="space-y-4 px-6 py-5">
              {mode === "view" ? (
                <>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Name</p>
                    <p className="font-medium text-gray-800 dark:text-white">
                      {selected.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Company</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {getCompanyName(selected)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Type</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {selected.type || "branch"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Address</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {selected.address || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Status</p>
                    <Badge
                      size="sm"
                      color={isActive(selected.status) ? "success" : "warning"}
                    >
                      {isActive(selected.status) ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Business Name *
                    </label>
                    <input
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                      placeholder="Enter business name"
                      value={selected.name}
                      onChange={(e) =>
                        setSelected({ ...selected, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Company *
                    </label>
                    <select
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                      value={selected.company_id ?? ""}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          company_id: Number(e.target.value),
                        })
                      }
                    >
                      <option value="">Select company</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Type
                    </label>
                    <select
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                      value={selected.type ?? "branch"}
                      onChange={(e) =>
                        setSelected({ ...selected, type: e.target.value })
                      }
                    >
                      <option value="branch">Branch</option>
                      <option value="headquarters">Headquarters</option>
                      <option value="warehouse">Warehouse</option>
                      <option value="store">Store</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Address
                    </label>
                    <input
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                      placeholder="Business address"
                      value={selected.address ?? ""}
                      onChange={(e) =>
                        setSelected({ ...selected, address: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Status
                    </label>
                    <select
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
                      value={isActive(selected.status) ? 1 : 0}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          status: Number(e.target.value),
                        })
                      }
                    >
                      <option value={1}>Active</option>
                      <option value={0}>Inactive</option>
                    </select>
                  </div>
                </>
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
                  onClick={saveBusiness}
                  disabled={saving}
                  className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : mode === "create"
                      ? "Create Business"
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
              Delete Business
            </h2>
            <p className="text-gray-500 mb-6">
              Are you sure you want to delete this business?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-xl border hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteBusiness(deleteId)}
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
