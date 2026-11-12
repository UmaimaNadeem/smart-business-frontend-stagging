"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/context/AuthContext";
import { FormGrid } from "@/components/sb/Form";
import { Btn, Card, PageHeader, SimpleTable } from "@/components/sb/ui";

export default function ProfilePage() {
  const { me, refresh, logout } = useAuth();
  const [p, setP] = useState<Record<string, string>>({ name: me?.name ?? "", email: me?.email ?? "", phone: me?.phone ?? "" });
  const [pw, setPw] = useState<Record<string, string>>({});
  const [errP, setErrP] = useState<Record<string, string[]> | null>(null);
  const [errPw, setErrPw] = useState<Record<string, string[]> | null>(null);

  const saveProfile = async () => { setErrP(null); try { await api.put("/user/profile", p); toast.success("Profile updated"); refresh(); } catch (e) { if (e instanceof ApiError && e.errors) setErrP(e.errors); toast.error(errorMessage(e)); } };
  const savePw = async () => { setErrPw(null); try { await api.put("/user/password", pw); toast.success("Password changed"); setPw({}); } catch (e) { if (e instanceof ApiError && e.errors) setErrPw(e.errors); toast.error(errorMessage(e)); } };
  const logoutAll = async () => { if (!window.confirm("Sign out from all devices?")) return; try { await api.post("/auth/logout-all"); } finally { logout(); } };

  return (
    <div className="space-y-6">
      <PageHeader title="My profile" actions={<Btn variant="outline" onClick={logoutAll}>Sign out everywhere</Btn>} />
      <Card title="Profile">
        <FormGrid values={p} setValues={(v) => setP(v as Record<string, string>)} errors={errP} fields={[{ name: "name", label: "Name", required: true }, { name: "email", label: "Email", type: "email", required: true }, { name: "phone", label: "Phone" }]} />
        <div className="mt-4 flex justify-end"><Btn onClick={saveProfile}>Save profile</Btn></div>
      </Card>
      <Card title="Change password">
        <FormGrid values={pw} setValues={(v) => setPw(v as Record<string, string>)} errors={errPw} fields={[{ name: "current_password", label: "Current password", type: "password", required: true, span: 2 }, { name: "password", label: "New password", type: "password", required: true }, { name: "password_confirmation", label: "Confirm new password", type: "password", required: true }]} />
        <div className="mt-4 flex justify-end"><Btn onClick={savePw}>Change password</Btn></div>
      </Card>
      <Card title="My access">
        <SimpleTable head={["Company", "Branch", "Role", "Permissions"]} rows={(me?.assignments ?? []).map((a) => [a.company, a.business ?? "All branches", a.role, a.permissions.length])} />
      </Card>
    </div>
  );
}
