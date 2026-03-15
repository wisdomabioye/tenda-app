import { isCloudinaryUrl, ErrorCode } from '@tenda/shared'
import { AppError } from './errors'

const VALID_PROOF_TYPES = ['image', 'video', 'document'] as const
type ProofType = typeof VALID_PROOF_TYPES[number]

export interface ProofInput {
  url:  string
  type: string
}

/**
 * Validates an array of proof objects.
 * Throws AppError (400) on the first violation.
 *
 * Checks (in order):
 *  1. Count does not exceed maxCount (if provided)
 *  2. Each type is one of: image, video, document
 *  3. Each URL is a valid Cloudinary URL
 *  4. Each URL lives inside the uploading user's own folder
 *
 * @param proofs   - proof array from the request body
 * @param userId   - authenticated user id; enforces `/tenda/proofs/:userId/` folder ownership
 * @param maxCount - optional upper bound on array length
 */
export function validateProofs(
  proofs: ProofInput[],
  userId: string,
  maxCount?: number,
): void {
  if (maxCount !== undefined && proofs.length > maxCount) {
    throw new AppError(
      400,
      ErrorCode.VALIDATION_ERROR,
      `Too many proofs — maximum ${maxCount} allowed per submission`,
    )
  }

  const expectedFolder = `/tenda/proofs/${userId}/`

  for (const proof of proofs) {
    if (!VALID_PROOF_TYPES.includes(proof.type as ProofType)) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        'Proof type must be "image", "video", or "document"',
      )
    }
    if (!isCloudinaryUrl(proof.url)) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        'All proof URLs must be hosted on Cloudinary (https://res.cloudinary.com/)',
      )
    }
    if (!proof.url.includes(expectedFolder)) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        'Proof URL was not uploaded by the submitting user',
      )
    }
  }
}
