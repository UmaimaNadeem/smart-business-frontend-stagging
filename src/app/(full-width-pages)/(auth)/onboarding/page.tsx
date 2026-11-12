"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { api, extractList, unwrap } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/context/AuthContext";
import { AuthTitle } from "@/components/sb/AuthBits";
import { FormGrid, FieldDef } from "@/components/sb/Form";
import { Alert, Btn, Loading } from "@/components/sb/ui";

const COUNTRIES = ["Pakistan", "United Arab Emirates", "Saudi Arabia", "United Kingdom", "United States", "India", "Bangladesh"].map((c) => ({ value: c, label: c }));
const CURRENCIES = ["PKR", "AED", "SAR", "GBP", "USD", "INR", "BDT"].map((c) => ({ value: c, label: c }));
const TIMEZONES = ["Asia/Karachi", "Asia/Dubai", "Asia/Riyadh", "Europe/London", "America/New_York", "Asia/Kolkata", "Asia/Dhaka"].map((c) => ({ value: c, label: c }));

const STEPS: { title: string; fields: FieldDef[] }[] = [
  { title: "Company details", fields: [
    { name: "name", label: "Company name", required: true, span: 2 },
    { name: "email", label: "Company email", type: "email" },
    { name: "phone", label: "Phone" },
    { name: "tax_number", label: "Tax / NTN number" },
    { name: "address", label: "Address", span: 2 },
  ] },
  { title: "Region & currency", fields: [
    { name: "country", label: "Country", type: "select", options: COUNTRIES, required: true },
    { name: "currency", label: "Currency", type: "select", options: CURRENCIES, required: true },
    { name: "timezone", label: "Timezone", type: "select", options: TIMEZONES, required: true },
  ] },
  { title: "First branch & warehouse", fields: [
    { name: "branch_name", label: "Branch name", required: true },
    { name: "branch_address", label: "Branch address" },
    { name: "warehouse_name", label: "Warehouse name", required: true },
    { name: "warehouse_location", label: "Warehouse location" },
  ] },
];

export default function OnboardingPage() {
  const { me, company, branches, loading, refresh } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.replace("/signin");
    if (company) setF((p) => ({
      name: company.name, country: company.country ?? "Pakistan", currency: company.currency ?? "PKR", timezone: company.timezone ?? "Asia/Karachi",
      branch_name: branches[0]?.name ?? "Main Branch", warehouse_name: "Main Warehouse", ...p,
    }));
  }, [company, branches, loading, me, router]);

  if (loading || !company) return <Loading />;
  if (company.onboarding_completed_at) return <><AuthTitle title="You're all set" /><Btn onClick={() => router.replace("/")}>Go to dashboard</Btn></>;

  const next = async () => {
    setBusy(true); setErrors(null);
    try {
      if (step === 0 || step === 1) {
        await api.put(`/companies/update/${company.id}`, { name: f.name, email: f.email, phone: f.phone, tax_number: f.tax_number, address: f.address, country: f.country, currency: f.currency, timezone: f.timezone });
      }
      if (step === 2) {
        const branch = branches[0];
        let branchId = branch?.id;
        if (branch) await api.put(`/businesses/update/${branch.id}`, { name: f.branch_name, address: f.branch_address, company_id: company.id });
        else branchId = unwrap<{ id: number }>(await api.post("/businesses/create", { name: f.branch_name, address: f.branch_address, company_id: company.id, type: "branch" })).id;
        // The Laravel backend implements /warehouses and /onboarding/complete, so errors are shown in every mode.
        if (extractList(await api.get("/warehouses")).length === 0) await api.post("/warehouses", { name: f.warehouse_name, location: f.warehouse_location, business_id: branchId });
        await api.post("/onboarding/complete");
        await refresh();
        toast.success("Welcome to Smart Business!");
        router.replace("/");
        return;
      }
      setStep(step + 1);
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <>
      <AuthTitle title="Set up your company" subtitle={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step].title}`} />
      <div className="mb-6 flex gap-2">{STEPS.map((s, i) => <div key={s.title} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"}`} />)}</div>
      {step === 1 && <div className="mb-4"><Alert kind="info">Currency is used on every document and report. Choose carefully.</Alert></div>}
      <FormGrid fields={STEPS[step].fields} values={f} setValues={(v) => setF(v as Record<string, string>)} errors={errors} />
      <div className="mt-6 flex justify-between">
        <Btn variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Btn>
        <Btn loading={busy} onClick={next}>{step === STEPS.length - 1 ? "Finish setup" : "Continue"}</Btn>
      </div>
    </>
  );
}
