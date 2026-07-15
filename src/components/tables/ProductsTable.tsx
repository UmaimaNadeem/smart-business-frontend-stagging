"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiFetch, extractList } from "@/lib/api";
import { Business, Product } from "@/types/entities";
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
type StockMode = "increase" | "decrease" | null;

const emptyProduct = (): Product => ({
  id: 0,
  name: "",
  sku: "",
  business_id: undefined,
  price: "",
  cost: "",
  stock: 0,
  unit: "pcs",
  description: "",
  status: 1,
  low_stock_threshold: 5,
});

const isActive = (status?: number | boolean) =>
  status === 1 || status === true || status === undefined;

export default function ProductsTable() {
  const [products, setProducts] = useState<Product[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [mode, setMode] = useState<FormMode>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterBusinessId, setFilterBusinessId] = useState<string>("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [stockMode, setStockMode] = useState<StockMode>(null);
  const [stockQty, setStockQty] = useState("1");
  const [stockProduct, setStockProduct] = useState<Product | null>(null);

  const getBusinessName = (product: Product) => {
    if (typeof product.business === "string") return product.business;
    if (product.business?.name) return product.business.name;
    const biz = businesses.find(
      (b) => Number(b.id) === Number(product.business_id)
    );
    return biz?.name ?? "—";
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const businessRes = await apiFetch("/api/businesses");
      const bizList = extractList<Business>(businessRes);
      setBusinesses(bizList);

      const loadAllProducts = async (): Promise<Product[]> => {
        try {
          const res = await apiFetch("/api/products");
          let list = extractList<Product>(res);
          if (list.length > 0) return list;
        } catch {
          /* fall through */
        }

        // Merge per-business lists when all-products is empty/unavailable
        const perBiz = await Promise.all(
          bizList.map(async (biz) => {
            try {
              const res = await apiFetch(`/api/products/business/${biz.id}`);
              return extractList<Product>(res);
            } catch {
              return [] as Product[];
            }
          })
        );
        const byId = new Map<number, Product>();
        perBiz.flat().forEach((p) => {
          if (p?.id != null) byId.set(Number(p.id), p);
        });
        return Array.from(byId.values());
      };

      const isLowStock = (p: Product) => {
        const stock = Number(p.stock ?? 0);
        const threshold = Number(
          p.low_stock_threshold ?? p.min_stock ?? 5
        );
        return stock <= threshold;
      };

      let list: Product[] = [];

      if (showLowStock) {
        // Prefer API, then fall back to client-side filter (avoids broken stock/low routes)
        try {
          const res = await apiFetch("/api/products/stock/low");
          list = extractList<Product>(res);
        } catch {
          list = [];
        }

        if (list.length === 0) {
          try {
            const res = await apiFetch("/api/products/low-stock");
            list = extractList<Product>(res);
          } catch {
            list = [];
          }
        }

        if (list.length === 0) {
          const all = await loadAllProducts();
          list = all.filter(isLowStock);
        }
      } else if (filterBusinessId) {
        try {
          const res = await apiFetch(
            `/api/products/business/${filterBusinessId}`
          );
          list = extractList<Product>(res);
        } catch {
          try {
            const res = await apiFetch(
              `/api/businesses/${filterBusinessId}/products`
            );
            list = extractList<Product>(res);
          } catch {
            list = [];
          }
        }
      } else {
        list = await loadAllProducts();
      }

      setProducts(list);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load products"
      );
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [filterBusinessId, showLowStock]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const closeModal = () => {
    setSelected(null);
    setMode(null);
  };

  const saveProduct = async () => {
    if (!selected?.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!selected.business_id) {
      toast.error("Please select a business");
      return;
    }

    setSaving(true);
    const isNew = selected.id === 0;

    try {
      const payload = {
        name: selected.name,
        sku: selected.sku || null,
        business_id: Number(selected.business_id),
        price: selected.price === "" ? 0 : Number(selected.price),
        cost: selected.cost === "" ? 0 : Number(selected.cost),
        stock: Number(selected.stock ?? 0),
        unit: selected.unit || "pcs",
        description: selected.description || null,
        status: isActive(selected.status) ? 1 : 0,
        low_stock_threshold: Number(selected.low_stock_threshold ?? 5),
      };

      const response = await apiFetch<{ data: Product }>(
        isNew
          ? "/api/products/create"
          : `/api/products/update/${selected.id}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const saved = response.data ?? ({ ...selected, ...payload } as Product);
      if (isNew) setProducts((prev) => [...prev, saved]);
      else
        setProducts((prev) =>
          prev.map((p) => (p.id === selected.id ? { ...p, ...saved } : p))
        );

      toast.success(isNew ? "Product created" : "Product updated");
      closeModal();
      loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save product"
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: number) => {
    try {
      await apiFetch(`/api/products/delete/${id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Product deleted");
      setDeleteId(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete product");
    }
  };

  const adjustStock = async () => {
    if (!stockProduct || !stockMode) return;
    const qty = Number(stockQty);
    if (!qty || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/products/stock/${stockMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: stockProduct.id,
          quantity: qty,
        }),
      });
      toast.success(
        stockMode === "increase" ? "Stock increased" : "Stock decreased"
      );
      setStockMode(null);
      setStockProduct(null);
      setStockQty("1");
      loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Stock update failed"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading && products.length === 0) {
    return <p className="p-5 text-gray-500">Loading products...</p>;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            value={filterBusinessId}
            onChange={(e) => {
              setFilterBusinessId(e.target.value);
              setShowLowStock(false);
            }}
          >
            <option value="">All businesses</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setShowLowStock((v) => !v);
              if (!showLowStock) setFilterBusinessId("");
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${
              showLowStock
                ? "bg-warning-50 text-warning-600 border-warning-200"
                : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            }`}
          >
            {showLowStock ? "Showing low stock" : "Low stock"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/purchases"
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
          >
            Purchases
          </Link>
          <button
            onClick={() => {
              setSelected(emptyProduct());
              setMode("create");
            }}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
          >
            + Add Product
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <TableCell isHeader className="px-5 py-3">
                  Product
                </TableCell>
                <TableCell isHeader className="px-5 py-3">
                  Business
                </TableCell>
                <TableCell isHeader className="px-5 py-3">
                  Price
                </TableCell>
                <TableCell isHeader className="px-5 py-3">
                  Stock
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
              {products.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="px-5 py-8 text-center text-gray-500"
                    colSpan={6}
                  >
                    No products found.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => {
                  const low =
                    Number(product.stock ?? 0) <=
                    Number(product.low_stock_threshold ?? 5);
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="px-5 py-4">
                        <p className="font-medium text-gray-800 dark:text-white">
                          {product.name}
                        </p>
                        {product.sku && (
                          <p className="text-xs text-gray-500">
                            SKU: {product.sku}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-500">
                        {getBusinessName(product)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-500">
                        {product.price ?? "—"}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <Badge size="sm" color={low ? "warning" : "success"}>
                          {product.stock ?? 0} {product.unit || "pcs"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <Badge
                          size="sm"
                          color={
                            isActive(product.status) ? "success" : "warning"
                          }
                        >
                          {isActive(product.status) ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setSelected(product);
                              setMode("view");
                            }}
                            className="px-3 py-1 text-xs rounded-md bg-blue-100 text-blue-600"
                          >
                            View
                          </button>
                          <button
                            onClick={() => {
                              setSelected({ ...product });
                              setMode("edit");
                            }}
                            className="px-3 py-1 text-xs rounded-md bg-yellow-100 text-yellow-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setStockProduct(product);
                              setStockMode("increase");
                              setStockQty("1");
                            }}
                            className="px-3 py-1 text-xs rounded-md bg-emerald-100 text-emerald-700"
                          >
                            + Stock
                          </button>
                          <button
                            onClick={() => {
                              setStockProduct(product);
                              setStockMode("decrease");
                              setStockQty("1");
                            }}
                            className="px-3 py-1 text-xs rounded-md bg-orange-100 text-orange-700"
                          >
                            − Stock
                          </button>
                          <button
                            onClick={() => setDeleteId(product.id)}
                            className="px-3 py-1 text-xs rounded-md bg-red-100 text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
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
                  ? "Product Details"
                  : mode === "create"
                    ? "Add Product"
                    : "Edit Product"}
              </h2>
            </div>
            <div className="space-y-4 px-6 py-5">
              {mode === "view" ? (
                <>
                  <Field label="Name" value={selected.name} />
                  <Field label="SKU" value={selected.sku || "—"} />
                  <Field label="Business" value={getBusinessName(selected)} />
                  <Field label="Price" value={String(selected.price ?? "—")} />
                  <Field label="Cost" value={String(selected.cost ?? "—")} />
                  <Field
                    label="Stock"
                    value={`${selected.stock ?? 0} ${selected.unit || "pcs"}`}
                  />
                  <Field
                    label="Description"
                    value={selected.description || "—"}
                  />
                </>
              ) : (
                <>
                  <Input
                    label="Product Name *"
                    value={selected.name}
                    onChange={(v) => setSelected({ ...selected, name: v })}
                  />
                  <Input
                    label="SKU"
                    value={selected.sku ?? ""}
                    onChange={(v) => setSelected({ ...selected, sku: v })}
                  />
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Business *
                    </label>
                    <select
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
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
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Price"
                      value={String(selected.price ?? "")}
                      onChange={(v) => setSelected({ ...selected, price: v })}
                    />
                    <Input
                      label="Cost"
                      value={String(selected.cost ?? "")}
                      onChange={(v) => setSelected({ ...selected, cost: v })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Stock"
                      value={String(selected.stock ?? 0)}
                      onChange={(v) =>
                        setSelected({ ...selected, stock: Number(v) || 0 })
                      }
                    />
                    <Input
                      label="Unit"
                      value={selected.unit ?? "pcs"}
                      onChange={(v) => setSelected({ ...selected, unit: v })}
                    />
                  </div>
                  <Input
                    label="Low stock threshold"
                    value={String(selected.low_stock_threshold ?? 5)}
                    onChange={(v) =>
                      setSelected({
                        ...selected,
                        low_stock_threshold: Number(v) || 0,
                      })
                    }
                  />
                  <Input
                    label="Description"
                    value={selected.description ?? ""}
                    onChange={(v) =>
                      setSelected({ ...selected, description: v })
                    }
                  />
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
                  onClick={saveProduct}
                  disabled={saving}
                  className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : mode === "create"
                      ? "Create Product"
                      : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </ModalBackdrop>
      )}

      {stockMode && stockProduct && (
        <ModalBackdrop
          onClose={() => {
            setStockMode(null);
            setStockProduct(null);
          }}
        >
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
              {stockMode === "increase" ? "Increase Stock" : "Decrease Stock"}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {stockProduct.name} · current: {stockProduct.stock ?? 0}
            </p>
            <Input
              label="Quantity"
              value={stockQty}
              onChange={setStockQty}
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setStockMode(null);
                  setStockProduct(null);
                }}
                className="px-4 py-2 rounded-xl border"
              >
                Cancel
              </button>
              <button
                onClick={adjustStock}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-brand-500 text-white disabled:opacity-60"
              >
                {saving ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {deleteId && (
        <ModalBackdrop onClose={() => setDeleteId(null)}>
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold mb-2">Delete Product</h2>
            <p className="text-gray-500 mb-6">
              Are you sure you want to delete this product?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-xl border"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteProduct(deleteId)}
                className="px-4 py-2 rounded-xl bg-red-600 text-white"
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-400 mb-1">{label}</p>
      <p className="text-gray-800 dark:text-white">{value}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <input
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
