/**
 * Every string the auth flow shows. Product facts (the name, the legal links,
 * the support address) are NOT here — they come from shared `APP_INFO`.
 *
 * The comps' wording is used where the comps have one, because these screens
 * have no shared counterpart to defer to: mobile's auth copy lives in its own
 * screens and the two flows differ (mobile has phone and Google today; web has
 * email and wallet), so there is no cross-client vocabulary to fork here the
 * way `SUPPORT_TOPICS` is one.
 */
export const AUTH_COPY = {
  chooser: {
    title: 'Sign in to Tenda',
    lede: 'Two ways in. Both reach the same account, and you can link the other one later from Settings.',
    email: {
      label: 'Continue with email',
      /** Email is the only method that can CREATE an account (decision #3). */
      hint: 'A six-digit code. Creates an account if you do not have one.',
    },
    wallet: {
      label: 'Continue with a wallet',
      /** Server-enforced: a wallet signs in, it does not register. */
      hint: 'Signs in a wallet already linked to an account.',
    },
    browse: 'Keep browsing without an account',
    help: 'Stuck?',
  },
  email: {
    back: 'All sign-in methods',
    title: 'What is your email?',
    lede: 'We send a six-digit code. No password to remember or lose.',
    label: 'Email',
    cta: 'Send the code',
    sending: 'Sending…',
    invalid: 'Enter a valid email address',
    failed: 'Something went wrong, please try again',
    /**
     * The comp's note, and it answers the question this step actually raises:
     * someone who cannot remember whether they signed up needs to know that
     * typing the address is safe either way.
     */
    collision:
      'If an account already uses this email, the code signs you into it rather than creating a second one.',
  },
  verify: {
    back: 'Change email',
    title: 'Enter the code',
    /** `to` is the identifier the code went to — shown, never guessed at. */
    lede: (to: string) => `Sent to ${to}.`,
    cta: 'Verify',
    verifying: 'Verifying…',
    resend: 'Send a new code',
    resendIn: (seconds: number) => `Send a new code in ${seconds}s`,
    failed: 'Verification failed, please try again',
    resendFailed: 'Could not resend the code',
    /** Counts the SERVER's own validity window down; see the page. */
    expiresIn: (clock: string) => `Expires in ${clock}`,
    expired: 'This code has expired',
  },
  profile: {
    eyebrow: 'Last step',
    title: 'What should people call you?',
    lede: 'Your name shows on gigs you post and applications you send. Use the name people would recognise at the door.',
    first: 'First name',
    last: 'Last name',
    firstPlaceholder: 'Segun',
    lastPlaceholder: 'Oyelaran',
    cta: 'Finish and open Tenda',
    saving: 'Saving…',
    failed: 'Could not save your profile, please try again',
    previewCaption: 'How you will appear on a gig card',
    /** Stands in for the name until one is typed — never a fake name. */
    previewEmpty: 'Your name',
    photoNote: 'You can add a photo later from Profile. It is not required to work.',
  },
  wallet: {
    back: 'All sign-in methods',
  },
} as const
