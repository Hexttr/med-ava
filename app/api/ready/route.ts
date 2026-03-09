import fs from "fs/promises"
import path from "path"

import { NextResponse } from "next/server"

import { getDb, getDataDir } from "@/lib/db"
import { getGeminiKey } from "@/lib/settings"
import { getRuntimeConfigIssues } from "@/lib/runtime-config"
import { withNoStore } from "@/lib/request-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function checkWritableDataDir(): Promise<"ok"> {
  const dataDir = getDataDir()
  const probe = path.join(dataDir, ".ready-check")
  await fs.writeFile(probe, "ok", "utf-8")
  await fs.unlink(probe)
  return "ok"
}

export async function GET() {
  try {
    const db = getDb()
    db.prepare("SELECT 1").get()

    const geminiKey = await getGeminiKey()
    const configIssues = getRuntimeConfigIssues()
    const storage = await checkWritableDataDir()

    if (!geminiKey) {
      return withNoStore(NextResponse.json(
        {
          status: "error",
          checks: {
            database: "ok",
            writableStorage: storage,
            geminiKey: "missing",
            configIssues,
          },
        },
        { status: 503 }
      ))
    }

    if (configIssues.length > 0) {
      return withNoStore(NextResponse.json(
        {
          status: "error",
          checks: {
            database: "ok",
            writableStorage: storage,
            geminiKey: "configured",
            configIssues,
          },
        },
        { status: 503 }
      ))
    }

    return withNoStore(NextResponse.json({
      status: "ok",
      checks: {
        database: "ok",
        writableStorage: storage,
        geminiKey: "configured",
        configIssues,
      },
    }))
  } catch (error) {
    return withNoStore(NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    ))
  }
}
