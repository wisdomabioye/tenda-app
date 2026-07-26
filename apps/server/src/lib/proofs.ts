import {
  isCloudinaryUrl,
  isProofType,
  missingProofTypes,
  formatProofTypeList,
  ErrorCode,
  PROOF_TYPES,
  type ProofType,
} from '@tenda/shared'
import { AppError } from './errors'

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
      `Too many proofs, maximum ${maxCount} allowed per submission`,
    )
  }

  const expectedFolder = `/tenda/proofs/${userId}/`

  for (const proof of proofs) {
    if (!isProofType(proof.type)) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        `Proof type must be one of: ${PROOF_TYPES.join(', ')}`,
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

/**
 * Gate the on-chain submit on the poster's declared proof requirements
 * (`gig_details.proof_requirements`). Refuses BEFORE the unsigned tx is
 * built, so a worker never signs a submit that the listing's own terms
 * reject.
 *
 * 409, not 400: the request is well-formed, the escrow is simply not in a
 * submittable state yet — the same reading as ESCROW_WRONG_STATUS.
 *
 * An empty `required` is satisfied by anything, which is how every gig
 * created before the column existed continues to behave. This is an
 * app-level gate: `submitProof` carries only a digest on-chain and enforces
 * none of it.
 */
export function assertRequirementsMet(
  required: readonly ProofType[],
  attached: readonly { type: ProofType }[],
): void {
  const missing = missingProofTypes(required, attached)
  if (missing.length === 0) return
  throw new AppError(
    409,
    ErrorCode.PROOF_REQUIREMENT_UNMET,
    `This gig requires ${formatProofTypeList(missing)} proof before you can submit`,
    { missing },
  )
}
