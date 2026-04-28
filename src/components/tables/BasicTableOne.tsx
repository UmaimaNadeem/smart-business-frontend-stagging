"use client";

import React, { useEffect, useState } from "react";

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
  image?: string;
  roles?: string[];
  companies?: string[];
  businesses?: string[];
}

export default function BasicTableOne() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | null>(null);

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
    const token = getToken();

    await fetch(
      `http://smart-business-backend-stagging.test/api/users/${id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  // ================= UPDATE API =================
  const updateUser = async () => {
    if (!selectedUser) return;

    const token = getToken();

    const res = await fetch(
      `http://smart-business-backend-stagging.test/api/users/update/${selectedUser.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: selectedUser.name,
          email: selectedUser.email,
        }),
      }
    );

    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id ? selectedUser : u
        )
      );
      setMode(null);
      setSelectedUser(null);
    }
  };

  if (loading) {
    return <p className="p-5">Loading users...</p>;
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[1000px]">

            <Table>

              {/* HEADER (UNCHANGED STYLE) */}
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
                            src={user.image || "/images/user/owner.jpg"}
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

                        {/* FIXED: no delete for current user */}
                        {currentUserId !== user.id && (
                          <button
                            onClick={() => deleteUser(user.id)}
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

      {/* ================= MODAL ================= */}
      {/* ================= DETAIL MODAL ================= */}
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

        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            {mode === "view" ? "User Details" : "Edit User"}
          </h2>

          {mode === "view" ? (
            <p className="text-sm text-gray-500">
              {selectedUser.name} • {selectedUser.email}
            </p>
          ) : (
            <div className="space-y-2 mt-2">
              <input
                className="w-full border p-2 rounded"
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
                value={selectedUser.email}
                onChange={(e) =>
                  setSelectedUser({
                    ...selectedUser,
                    email: e.target.value,
                  })
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* ================= COMPANIES + BUSINESSES ================= */}
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
                🏬 {selectedUser.businesses?.[i] || "No business assigned"}
              </p>

            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">No companies assigned</p>
        )}

      </div>

      {/* ================= ACTIONS ================= */}
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
            onClick={async () => {
              const token = document.cookie.match(/(^| )token=([^;]+)/)?.[2];

              const res = await fetch(
                `http://smart-business-backend-stagging.test/api/users/${selectedUser.id}`,
                {
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    name: selectedUser.name,
                    email: selectedUser.email,
                  }),
                }
              );

              if (res.ok) {
                setUsers((prev) =>
                  prev.map((u) =>
                    u.id === selectedUser.id ? selectedUser : u
                  )
                );
                setSelectedUser(null);
                setMode(null);
              }
            }}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Save Changes
          </button>
        )}

      </div>

    </div>

  </div>
)}
    </>
  );
}