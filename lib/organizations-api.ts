import type { Organization, OrganizationEmployee } from "@/lib/types"

const BASE = "/api/organizations"

export async function fetchAllOrganizations(): Promise<Organization[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data
}

export async function fetchOrganizationById(id: string): Promise<Organization | null> {
  const res = await fetch(`${BASE}/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createOrganizationApi(body: {
  name: string
  photoUrl?: string | null
  employees: OrganizationEmployee[]
}): Promise<Organization> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось создать организацию")
  }
  return res.json()
}

export async function updateOrganizationApi(
  id: string,
  body: {
    name?: string
    photoUrl?: string | null
    employees?: OrganizationEmployee[]
  }
): Promise<Organization> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось обновить организацию")
  }
  return res.json()
}

export async function deleteOrganizationApi(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось удалить организацию")
  }
}

export async function addEmployeeToOrganizationApi(
  orgId: string,
  body: { name: string; photoUrl: string }
): Promise<{ id: string; name: string; photoUrl: string }> {
  const res = await fetch(`${BASE}/${orgId}/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось добавить сотрудника")
  }
  return res.json()
}
