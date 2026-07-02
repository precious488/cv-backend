import { Response } from 'express'
import { z } from 'zod'
import { scoreResume, hashJobDescription } from '../utils/atsEngine'
import { cacheAside, cacheKeys } from '@craft/shared'
import { AuthenticatedRequest } from '@craft/shared'
import { v4 as uuidv4 } from 'uuid'

const analyzeSchema = z.object({
  resumeData: z.object({}).passthrough(),
  jobDescription: z.string().max(10000).optional(),
  cvId: z.string().optional(),
})

export async function analyzeResume(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const parsed = analyzeSchema.safeParse(req.body)

  if (!parsed.success) {
    res
      .status(400)
      .json({ success: false, error: 'Invalid request', correlationId })
    return
  }

  const { resumeData, jobDescription, cvId } = parsed.data
  const jdHash = jobDescription ? hashJobDescription(jobDescription) : 'nojd'

  // Cache ATS results — they're expensive but stable for same data
  const cacheKey = cvId
    ? cacheKeys.atsScore(cvId, jdHash)
    : `ats:anon:${req.user!.sub}:${jdHash}`

  const result = await cacheAside(
    cacheKey,
    () =>
      Promise.resolve(
        scoreResume(
          resumeData as unknown as Parameters<typeof scoreResume>[0],
          jobDescription,
        ),
      ),
    600, // 10 minutes
  )

  res.json({ success: true, data: result, correlationId })
}
