export interface TrashResult {
  /** Paths that were really moved to the trash. */
  moved: string[]
  /** Paths that could not be moved (in use, no permission, already gone, ...). */
  failed: string[]
}

/** Moves each path to the trash and reports what actually happened — a failure never throws. */
export async function moveManyToTrash(paths: string[]): Promise<TrashResult> {
  const outcomes = await Promise.all(
    paths.map(async (path) => ({
      path,
      ok: await window.electronAPI.moveToTrash(path).catch(() => false),
    }))
  )
  return {
    moved: outcomes.filter((o) => o.ok).map((o) => o.path),
    failed: outcomes.filter((o) => !o.ok).map((o) => o.path),
  }
}
