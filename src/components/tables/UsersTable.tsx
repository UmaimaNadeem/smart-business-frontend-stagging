"use client";

import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";

import Badge from "../ui/badge/Badge";
import Image from "next/image";

interface UserRow {
  id: number;
  name: string;
  email: string;
  password?: string;
  image?: string;
  roles?: string[];
  companies?: string[];
  businesses?: string[];
}

export default function UsersTable() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | null>(null);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const getToken = () => {
    if (typeof window === "undefined") return null;

    const match = document.cookie.match(/(^| )token=([^;]+)/);

    return match ? match[2] : null;
  };

  const getUserId = () => {
    if (typeof window === "undefined") return null;

    const match = document.cookie.match(/(^| )user_id=([^;]+)/);

    return match ? Number(match[2]) : null;
  };

  useEffect(() => {
    setCurrentUserId(getUserId());
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = getToken();

        if (!token) return;

        const res = await fetch(
          "http://smart-business-backend-stagging.test/api/users",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        const response = await res.json();

        setUsers(response?.data?.users || []);
      } catch (err) {
        console.error(err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

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
        setUsers((prev) => [...prev, data.data.user]);
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 w-[600px] max-h-[80vh] overflow-y-auto rounded-2xl p-6">
            {/* HEADER */}
            <div className="flex items-center gap-3 mb-5">
              <Image
                src={selectedUser.image || "/images/user/owner.jpg"}
                width={55}
                height={55}
                className="rounded-full"
                alt="user"
              />

              <div className="w-full">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  {mode === "view"
                    ? "User Details"
                    : selectedUser.id === 0
                    ? "Add User"
                    : "Edit User"}
                </h2>

                {mode === "view" ? (
                  <p className="text-sm text-gray-500">
                    {selectedUser.name} • {selectedUser.email}
                  </p>
                ) : (
                  <div className="space-y-2 mt-3">
                    <input
                      className="w-full border p-2 rounded"
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
                      className="w-full border p-2 rounded"
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
  className="w-full border p-2 rounded"
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

            {/* COMPANIES + BUSINESSES */}
            {mode === "view" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Companies & Businesses
                </h3>

                {selectedUser.companies?.length ? (
                  selectedUser.companies.map((company, i) => (
                    <div
                      key={i}
                      className="border rounded-xl p-3 bg-gray-50 dark:bg-gray-800"
                    >
                      <p className="font-medium text-gray-800 dark:text-white">
                        🏢 {company}
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        🏬{" "}
                        {selectedUser.businesses?.[i] ||
                          "No business assigned"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">
                    No companies assigned
                  </p>
                )}
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setMode(null);
                }}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Close
              </button>

              {mode === "edit" && (
                <button
                  onClick={updateUser}
                  className="px-4 py-2 bg-green-500 text-white rounded"
                >
                  {selectedUser.id === 0
                    ? "Create User"
                    : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE MODAL ================= */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl w-[420px]">
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
        </div>
      )}
    </>
  );
}