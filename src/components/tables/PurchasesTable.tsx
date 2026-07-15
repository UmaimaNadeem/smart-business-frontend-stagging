"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiFetch, extractItem, extractList } from "@/lib/api";
import { Business, Inward, Product, Purchase } from "@/types/entities";
import Badge from "../ui/badge/Badge";
import ModalBackdrop from "../ui/modal/ModalBackdrop";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";

type Tab = "purchases" | "inwards";
type FormMode = "create" | "edit" | "view" | null;

const emptyPurchase = (): Purchase => ({
  id: 0,
  business_id: undefined,
  supplier_name: "",
  notes: "",
  status: "pending",
  items: [{ product_id: undefined, quantity: 1, unit_price: "" }],
});

export default function PurchasesTable() {
  const [tab, setTab] = useState<Tab>("purchases");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [inwards, setInwards] = useState<Inward[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [mode, setMode] = useState<FormMode>(null);
  const [inwardDetail, setInwardDetail] = useState<Inward | null>(null);
  const [tallyInward, setTallyInward] = useState<Inward | null>(null);
  const [tallyNotes, setTallyNotes] = useState("");
  const [filterBusinessId, setFilterBusinessId] = useState("");

  const getBusinessName = (item: { business_id?: number; business?: string | Business }) => {
    if (typeof item.business === "string") return item.business;
    if (item.business?.name) return item.business.name;
    return (
      businesses.find((b) => Number(b.id) === Number(item.business_id))?.name ??
      "—"
    );
  };

  const loadLookups = useCallback(async () => {
    try {
      const [bizRes, prodRes] = await Promise.all([
        apiFetch("/api/businesses"),
        apiFetch("/api/products"),
      ]);
      setBusinesses(extractList<Business>(bizRes));
      setProducts(extractList<Product>(prodRes));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const path = filterBusinessId
        ? `/api/purchases/business/${filterBusinessId}`
        : "/api/purchases";
      const res = await apiFetch(path);
      setPurchases(extractList<Purchase>(res));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load purchases");
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [filterBusinessId]);

  const loadInwards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/inwards").catch(() =>
        apiFetch("/api/purchases/inwards")
      );
      setInwards(extractList<Inward>(res));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load inwards");
      setInwards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (tab === "purchases") loadPurchases();
    else loadInwards();
  }, [tab, loadPurchases, loadInwards]);

  const closeModal = () => {
    setSelected(null);
    setMode(null);
  };

  const savePurchase = async () => {
    if (!selected?.business_id) {
      toast.error("Select a business");
      return;
    }
    if (!selected.supplier_name?.trim() && !selected.supplier?.trim()) {
      toast.error("Supplier name is required");
      return;
    }

    setSaving(true);
    const isNew = selected.id === 0;
    try {
      const payload = {
        business_id: Number(selected.business_id),
        supplier_name: selected.supplier_name || selected.supplier || "",
        notes: selected.notes || null,
        items: (selected.items || []).map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
        })),
      };

      const response = await apiFetch<{ data: Purchase }>(
        isNew
          ? "/api/purchases/create"
          : `/api/purchases/update/${selected.id}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      toast.success(isNew ? "Purchase created" : "Purchase updated");
      closeModal();
      loadPurchases();
      if (response?.data) {
        /* refreshed by load */
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save purchase"
      );
    } finally {
      setSaving(false);
    }
  };

  const openPurchaseDetail = async (purchase: Purchase) => {
    setSelected(purchase);
    setMode("view");
    try {
      const res = await apiFetch(`/api/purchases/detail/${purchase.id}`).catch(
        () => apiFetch(`/api/purchases/${purchase.id}`)
      );
      const detail = extractItem<Purchase>(res);
      if (detail) setSelected(detail);
    } catch (error) {
      console.error(error);
    }
  };

  const confirmForInward = async (purchase: Purchase) => {
    try {
      await apiFetch("/api/purchases/confirm-inward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchase_id: purchase.id }),
      }).catch(() =>
        apiFetch(`/api/purchases/${purchase.id}/confirm-inward`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purchase_id: purchase.id }),
        })
      );
      toast.success("Purchase confirmed for inward");
      loadPurchases();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to confirm inward"
      );
    }
  };

  const openInwardDetail = async (inward: Inward) => {
    setInwardDetail(inward);
    try {
      const res = await apiFetch(`/api/inwards/detail/${inward.id}`).catch(() =>
        apiFetch(`/api/inwards/${inward.id}`)
      );
      const detail = extractItem<Inward>(res);
      if (detail) setInwardDetail(detail);
    } catch (error) {
      console.error(error);
    }
  };

  const submitTally = async () => {
    if (!tallyInward) return;
    setSaving(true);
    try {
      await apiFetch("/api/inwards/tally", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inward_id: tallyInward.id,
          notes: tallyNotes || null,
        }),
      });
      toast.success("Inward tallied successfully");
      setTallyInward(null);
      setTallyNotes("");
      loadInwards();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to tally inward"
      );
    } finally {
      setSaving(false);
    }
  };

  const statusColor = (status?: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("confirm") || s.includes("complete") || s === "approved")
      return "success" as const;
    if (s.includes("pending") || s.includes("draft")) return "warning" as const;
    if (s.includes("reject") || s.includes("cancel")) return "error" as const;
    return "primary" as const;
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
          <button
            onClick={() => setTab("purchases")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === "purchases"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                : "text-gray-500"
            }`}
          >
            Purchases
          </button>
          <button
            onClick={() => setTab("inwards")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === "inwards"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                : "text-gray-500"
            }`}
          >
            Inward Gate
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {tab === "purchases" && (
            <>
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                value={filterBusinessId}
                onChange={(e) => setFilterBusinessId(e.target.value)}
              >
                <option value="">All businesses</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <Link
                href="/products"
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
              >
                Products
              </Link>
              <button
                onClick={() => {
                  setSelected(emptyPurchase());
                  setMode("create");
                }}
                className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
              >
                + Create Purchase
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <p className="p-5 text-gray-500">Loading...</p>
      ) : tab === "purchases" ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3">
                    ID
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3">
                    Business
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3">
                    Supplier
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3">
                    Total
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
                {purchases.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="px-5 py-8 text-center text-gray-500"
                      colSpan={6}
                    >
                      No purchases found.
                    </TableCell>
                  </TableRow>
                ) : (
                  purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="px-5 py-4 text-gray-500">
                        #{purchase.id}
                      </TableCell>
                      <TableCell className="px-5 py-4 font-medium text-gray-800 dark:text-white">
                        {getBusinessName(purchase)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-500">
                        {purchase.supplier_name || purchase.supplier || "—"}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-500">
                        {purchase.total ?? "—"}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <Badge size="sm" color={statusColor(purchase.status)}>
                          {purchase.status || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openPurchaseDetail(purchase)}
                            className="px-3 py-1 text-xs rounded-md bg-blue-100 text-blue-600"
                          >
                            Detail
                          </button>
                          <button
                            onClick={() => {
                              setSelected({
                                ...purchase,
                                items: purchase.items?.length
                                  ? purchase.items
                                  : emptyPurchase().items,
                              });
                              setMode("edit");
                            }}
                            className="px-3 py-1 text-xs rounded-md bg-yellow-100 text-yellow-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => confirmForInward(purchase)}
                            className="px-3 py-1 text-xs rounded-md bg-emerald-100 text-emerald-700"
                          >
                            Confirm Inward
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
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3">
                    ID
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3">
                    Purchase
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3">
                    Business
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
                {inwards.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="px-5 py-8 text-center text-gray-500"
                      colSpan={5}
                    >
                      No inward records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  inwards.map((inward) => (
                    <TableRow key={inward.id}>
                      <TableCell className="px-5 py-4 text-gray-500">
                        #{inward.id}
                      </TableCell>
                      <TableCell className="px-5 py-4 font-medium text-gray-800 dark:text-white">
                        #{inward.purchase_id ?? inward.purchase?.id ?? "—"}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-500">
                        {getBusinessName(inward)}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <Badge size="sm" color={statusColor(inward.status)}>
                          {inward.status || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openInwardDetail(inward)}
                            className="px-3 py-1 text-xs rounded-md bg-blue-100 text-blue-600"
                          >
                            Detail
                          </button>
                          <button
                            onClick={() => {
                              setTallyInward(inward);
                              setTallyNotes("");
                            }}
                            className="px-3 py-1 text-xs rounded-md bg-purple-100 text-purple-700"
                          >
                            Tally
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
      )}

      {selected && mode && (
        <ModalBackdrop onClose={closeModal}>
          <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
            <div className="border-b px-6 py-5">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                {mode === "view"
                  ? `Purchase #${selected.id}`
                  : mode === "create"
                    ? "Create Purchase"
                    : "Edit Purchase"}
              </h2>
            </div>

            <div className="space-y-4 px-6 py-5">
              {mode === "view" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Info label="Business" value={getBusinessName(selected)} />
                    <Info
                      label="Supplier"
                      value={
                        selected.supplier_name || selected.supplier || "—"
                      }
                    />
                    <Info label="Status" value={selected.status || "—"} />
                    <Info label="Total" value={String(selected.total ?? "—")} />
                  </div>
                  {selected.notes && (
                    <Info label="Notes" value={selected.notes} />
                  )}
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-2">Items</p>
                    <div className="space-y-2">
                      {(selected.items || []).length === 0 ? (
                        <p className="text-sm text-gray-500">No items</p>
                      ) : (
                        selected.items!.map((item, i) => (
                          <div
                            key={i}
                            className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800/60 flex justify-between gap-2"
                          >
                            <span>
                              {item.product_name ||
                                products.find(
                                  (p) => p.id === item.product_id
                                )?.name ||
                                `Product #${item.product_id}`}
                            </span>
                            <span className="text-gray-500">
                              qty {item.quantity} · {item.unit_price}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Business *
                    </label>
                    <select
                      className="w-full rounded-xl border px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      value={selected.business_id ?? ""}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          business_id: Number(e.target.value),
                        })
                      }
                    >
                      <option value="">Select business</option>
                      {businesses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Supplier *
                    </label>
                    <input
                      className="w-full rounded-xl border px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      value={selected.supplier_name || selected.supplier || ""}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          supplier_name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Notes
                    </label>
                    <textarea
                      className="w-full rounded-xl border px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white resize-none"
                      rows={2}
                      value={selected.notes ?? ""}
                      onChange={(e) =>
                        setSelected({ ...selected, notes: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Line Items</label>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected({
                            ...selected,
                            items: [
                              ...(selected.items || []),
                              {
                                product_id: undefined,
                                quantity: 1,
                                unit_price: "",
                              },
                            ],
                          })
                        }
                        className="text-xs text-brand-500 font-medium"
                      >
                        + Add item
                      </button>
                    </div>
                    <div className="space-y-3">
                      {(selected.items || []).map((item, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-12 gap-2 items-end"
                        >
                          <div className="col-span-5">
                            <select
                              className="w-full rounded-xl border px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              value={item.product_id ?? ""}
                              onChange={(e) => {
                                const items = [...(selected.items || [])];
                                items[index] = {
                                  ...items[index],
                                  product_id: Number(e.target.value),
                                };
                                setSelected({ ...selected, items });
                              }}
                            >
                              <option value="">Product</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              placeholder="Qty"
                              className="w-full rounded-xl border px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              value={item.quantity ?? ""}
                              onChange={(e) => {
                                const items = [...(selected.items || [])];
                                items[index] = {
                                  ...items[index],
                                  quantity: Number(e.target.value),
                                };
                                setSelected({ ...selected, items });
                              }}
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              placeholder="Price"
                              className="w-full rounded-xl border px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              value={String(item.unit_price ?? "")}
                              onChange={(e) => {
                                const items = [...(selected.items || [])];
                                items[index] = {
                                  ...items[index],
                                  unit_price: e.target.value,
                                };
                                setSelected({ ...selected, items });
                              }}
                            />
                          </div>
                          <div className="col-span-1">
                            <button
                              type="button"
                              onClick={() => {
                                const items = (selected.items || []).filter(
                                  (_, i) => i !== index
                                );
                                setSelected({
                                  ...selected,
                                  items: items.length
                                    ? items
                                    : emptyPurchase().items,
                                });
                              }}
                              className="text-red-500 text-sm px-1"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-5">
              <button
                onClick={closeModal}
                className="rounded-xl border px-5 py-2.5 text-sm"
              >
                {mode === "view" ? "Close" : "Cancel"}
              </button>
              {mode !== "view" && (
                <button
                  onClick={savePurchase}
                  disabled={saving}
                  className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : mode === "create"
                      ? "Create Purchase"
                      : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </ModalBackdrop>
      )}

      {inwardDetail && (
        <ModalBackdrop onClose={() => setInwardDetail(null)}>
          <div className="mx-auto w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
            <div className="border-b px-6 py-5">
              <h2 className="text-xl font-semibold">
                Inward #{inwardDetail.id}
              </h2>
            </div>
            <div className="space-y-3 px-6 py-5">
              <Info
                label="Purchase"
                value={`#${inwardDetail.purchase_id ?? inwardDetail.purchase?.id ?? "—"}`}
              />
              <Info label="Business" value={getBusinessName(inwardDetail)} />
              <Info label="Status" value={inwardDetail.status || "—"} />
              {inwardDetail.notes && (
                <Info label="Notes" value={inwardDetail.notes} />
              )}
              <div>
                <p className="text-xs uppercase text-gray-400 mb-2">Items</p>
                {(inwardDetail.items || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No items</p>
                ) : (
                  inwardDetail.items!.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-gray-50 px-3 py-2 text-sm mb-2 dark:bg-gray-800/60"
                    >
                      {item.product_name || `Product #${item.product_id}`} · qty{" "}
                      {item.quantity}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex justify-end border-t px-6 py-4">
              <button
                onClick={() => setInwardDetail(null)}
                className="rounded-xl border px-5 py-2.5 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {tallyInward && (
        <ModalBackdrop onClose={() => setTallyInward(null)}>
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold mb-1">Tally Inward</h2>
            <p className="text-sm text-gray-500 mb-4">
              Confirm tally for inward #{tallyInward.id}
            </p>
            <label className="mb-2 block text-sm font-medium">Notes</label>
            <textarea
              className="w-full rounded-xl border px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white resize-none"
              rows={3}
              value={tallyNotes}
              onChange={(e) => setTallyNotes(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setTallyInward(null)}
                className="px-4 py-2 rounded-xl border"
              >
                Cancel
              </button>
              <button
                onClick={submitTally}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-brand-500 text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Confirm Tally"}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-400 mb-1">{label}</p>
      <p className="text-gray-800 dark:text-white">{value}</p>
    </div>
  );
}
