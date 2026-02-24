import type { Department, Employee } from "@/lib/types"

const DEPARTMENTS_BASE = "/api/departments"
const EMPLOYEES_BASE = "/api/employees"

export async function fetchDepartments(): Promise<Department[]> {
  const res = await fetch(DEPARTMENTS_BASE)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createDepartment(body: { name: string }): Promise<Department> {
  const res = await fetch(DEPARTMENTS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось создать отдел")
  }
  return res.json()
}

export async function updateDepartment(id: string, body: { name: string }): Promise<Department> {
  const res = await fetch(`${DEPARTMENTS_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось обновить отдел")
  }
  return res.json()
}

export async function deleteDepartment(id: string): Promise<void> {
  const res = await fetch(`${DEPARTMENTS_BASE}/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось удалить отдел")
  }
}

export async function fetchEmployees(params?: { departmentId?: string }): Promise<Employee[]> {
  const url =
    params?.departmentId !== undefined && params.departmentId !== ""
      ? `${EMPLOYEES_BASE}?departmentId=${encodeURIComponent(params.departmentId)}`
      : EMPLOYEES_BASE
  const res = await fetch(url)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createEmployee(body: {
  name: string
  photoUrl: string
  departmentId?: string | null
}): Promise<Employee> {
  const res = await fetch(EMPLOYEES_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, departmentId: body.departmentId ?? null }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось добавить сотрудника")
  }
  return res.json()
}

export async function updateEmployee(
  id: string,
  body: { name?: string; photoUrl?: string; departmentId?: string | null }
): Promise<Employee> {
  const res = await fetch(`${EMPLOYEES_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось обновить сотрудника")
  }
  return res.json()
}

export async function deleteEmployee(id: string): Promise<void> {
  const res = await fetch(`${EMPLOYEES_BASE}/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось удалить сотрудника")
  }
}
