import type { Organization, OrganizationEmployee } from "@/lib/types"

const STORAGE_KEY = "eam_organizations"

function getStored(): Organization[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setStored(items: Organization[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // quota or unavailable
  }
}

export function getAllOrganizations(): Organization[] {
  return getStored()
}

export function getOrganizationById(id: string): Organization | null {
  return getStored().find((o) => o.id === id) ?? null
}

export function createOrganization(
  data: Pick<Organization, "name" | "photoUrl">
): Organization {
  const list = getStored()
  const now = Date.now()
  const org: Organization = {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    photoUrl: data.photoUrl ?? null,
    employees: [],
    createdAt: now,
    updatedAt: now,
  }
  setStored([org, ...list])
  return org
}

export function updateOrganization(
  id: string,
  data: Partial<Pick<Organization, "name" | "photoUrl" | "employees">>
): Organization | null {
  const list = getStored()
  const index = list.findIndex((o) => o.id === id)
  if (index === -1) return null
  const now = Date.now()
  const updated: Organization = {
    ...list[index]!,
    ...data,
    id: list[index]!.id,
    createdAt: list[index]!.createdAt,
    updatedAt: now,
    employees: data.employees ?? list[index]!.employees,
  }
  const next = [...list]
  next[index] = updated
  setStored(next)
  return updated
}

export function removeOrganization(id: string): boolean {
  const list = getStored().filter((o) => o.id !== id)
  if (list.length === getStored().length) return false
  setStored(list)
  return true
}

export function addEmployeeToOrganization(
  organizationId: string,
  employee: Pick<OrganizationEmployee, "name" | "photoUrl">
): OrganizationEmployee | null {
  const org = getOrganizationById(organizationId)
  if (!org) return null
  const emp: OrganizationEmployee = {
    id: crypto.randomUUID(),
    name: employee.name.trim() || "Сотрудник",
    photoUrl: employee.photoUrl,
  }
  const updated = updateOrganization(organizationId, {
    employees: [...org.employees, emp],
  })
  return updated ? emp : null
}

export function updateEmployeeInOrganization(
  organizationId: string,
  employeeId: string,
  data: Partial<Pick<OrganizationEmployee, "name">>
): OrganizationEmployee | null {
  const org = getOrganizationById(organizationId)
  if (!org) return null
  const emp = org.employees.find((e) => e.id === employeeId)
  if (!emp) return null
  const updatedList = org.employees.map((e) =>
    e.id === employeeId ? { ...e, ...data } : e
  )
  updateOrganization(organizationId, { employees: updatedList })
  return updatedList.find((e) => e.id === employeeId) ?? null
}

export function removeEmployeeFromOrganization(
  organizationId: string,
  employeeId: string
): boolean {
  const org = getOrganizationById(organizationId)
  if (!org) return false
  const next = org.employees.filter((e) => e.id !== employeeId)
  if (next.length === org.employees.length) return false
  updateOrganization(organizationId, { employees: next })
  return true
}
